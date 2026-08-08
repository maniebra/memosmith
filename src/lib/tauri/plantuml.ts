import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { PlantumlFormat, PlantumlSettings } from "../storage/settings";

/** SVG and ASCII come back as text, PNG as a `data:` URL, so the caller can paint either. */
export type PlantumlOutput = { format: PlantumlFormat; content: string };

function serverBase(server: string) {
  return server.trim().replace(/\/+$/, "").replace(/\/(svg|png|txt)$/, "");
}

/** `~h` + hex is the encoding PlantUML servers accept without a deflate implementation. */
function hexEncoded(source: string) {
  return `~h${Array.from(new TextEncoder().encode(source))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function readResponse(response: Response, format: PlantumlFormat): Promise<PlantumlOutput> {
  if (format === "png") {
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return { format, content: `data:image/png;base64,${btoa(binary)}` };
  }

  return { format, content: await response.text() };
}

function looksRendered(output: PlantumlOutput) {
  return output.format === "svg" ? output.content.includes("<svg") : Boolean(output.content.trim());
}

/** POST keeps the source out of the URL; older servers answer 405, so the GET form is the fallback. */
async function renderOnServer(server: string, source: string, format: PlantumlFormat) {
  const base = serverBase(server);
  const post = await fetch(`${base}/${format}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: source,
  });

  if (post.ok) {
    const output = await readResponse(post, format);

    if (looksRendered(output)) {
      return output;
    }
  }

  const get = await fetch(`${base}/${format}/${hexEncoded(source)}`);
  const output = await readResponse(get, format);

  if (get.ok && looksRendered(output)) {
    return output;
  }

  throw new Error(
    (format === "png" ? "" : output.content.trim().slice(0, 400)) ||
      `PlantUML server answered ${get.status}`,
  );
}

/** Returns the rendered diagram. The server wins when both it and a binary are configured. */
export async function renderPlantuml(
  source: string,
  settings: PlantumlSettings,
): Promise<PlantumlOutput> {
  if (settings.server.trim()) {
    return renderOnServer(settings.server, source, settings.format);
  }

  return {
    format: settings.format,
    content: await invoke<string>("render_plantuml", {
      source,
      command: settings.command,
      format: settings.format,
    }),
  };
}
