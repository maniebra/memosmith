import type { LiveDiagramEngine } from "../utils/markdown";
import type { MermaidSettings, PlantumlSettings } from "../storage/settings";
import { renderPlantuml, type PlantumlOutput } from "../tauri/plantuml";

export type DiagramOutput = PlantumlOutput;

let mermaidCount = 0;

/** Mermaid ships with the app and draws in the page, so it needs nothing installed. */
async function renderMermaid(source: string, settings: MermaidSettings): Promise<DiagramOutput> {
  const { default: mermaid } = await import("mermaid");
  const id = `md-mermaid-${mermaidCount++}`;

  mermaid.initialize({ startOnLoad: false, theme: settings.theme, securityLevel: "strict" });

  try {
    return { format: "svg", content: (await mermaid.render(id, source)).svg };
  } finally {
    // A failed render leaves its scratch node behind, and it is never small.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}

export function renderDiagram(
  engine: LiveDiagramEngine,
  source: string,
  settings: { plantuml: PlantumlSettings; mermaid: MermaidSettings },
): Promise<DiagramOutput> {
  return engine === "mermaid"
    ? renderMermaid(source, settings.mermaid)
    : renderPlantuml(source, settings.plantuml);
}
