import { fetch } from "@tauri-apps/plugin-http";
import { journal } from "../../../lib/utils/journal";
import { placeCaretAtPoint } from "./contextMenu";
import type { Editor } from "./types";

/** Files and web images carry something droppable; plain text keeps the native drop. */
export function handleDragOver(e: Editor, event: DragEvent) {
  const types = event.dataTransfer?.types ?? [];

  if (
    e.props.editable &&
    (types.includes("Files") || types.includes("text/uri-list"))
  ) {
    event.preventDefault();
  }
}

/** Images from the file manager or a browser land where they were dropped. */
export async function handleDrop(
  e: Editor,
  event: DragEvent,
  insideDatabase: boolean,
) {
  const data = event.dataTransfer;

  if (!data || !e.props.editable || insideDatabase) {
    return;
  }

  const files = Array.from(data.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  const url = files.length ? null : droppedImageUrl(data);

  if (!files.length && !url) {
    return;
  }

  event.preventDefault();
  placeCaretAtPoint(e, event);

  try {
    if (url) {
      files.push(await fetchImage(url));
    }
    e.insertAssets(await e.props.onAssets({ files }));
  } catch (error) {
    journal("drop.failed", { url, error: String(error) });
  }
}

/** Browsers drag an image as page markup; its `<img src>` beats a wrapping link. */
export function droppedImageUrl(data: Pick<DataTransfer, "getData">) {
  const html = data.getData("text/html");
  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const url = (src ?? data.getData("text/uri-list").split(/\r?\n/)[0] ?? "")
    .replace(/&amp;/g, "&")
    .trim();

  return /^(https?:|data:image\/)/i.test(url) ? url : null;
}

/** Goes through the http plugin: the webview's own fetch trips over CORS. */
async function fetchImage(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  const blob = await response.blob();

  if (!blob.type.startsWith("image/")) {
    throw new Error(`not an image: ${url}`);
  }

  const name = url.startsWith("data:")
    ? ""
    : decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  const extension = blob.type.split("/")[1].split("+")[0];

  return new File(
    [blob],
    /\.\w+$/.test(name) ? name : `dropped-${Date.now()}.${extension}`,
    { type: blob.type },
  );
}
