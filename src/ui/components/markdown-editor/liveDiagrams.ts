import { renderDiagram, type DiagramOutput } from "../../../lib/render/diagram";
import type { LiveDiagramEngine } from "../../../lib/utils/markdown";
import { RESIZE_HANDLE } from "./embedLayout";
import type { Editor, LiveDiagramApi } from "./types";

type DiagramRender = {
  state: "rendering" | "ok" | "error";
  output?: DiagramOutput;
  message?: string;
};

/** Diagrams edited away are dead weight; the oldest entries go when it grows. */
const DIAGRAM_CACHE_LIMIT = 60;
/** Typing rewrites the fence on every keystroke; diagrams wait for a pause. */
const DIAGRAM_IDLE_MS = 800;

export function createLiveDiagrams(e: Editor): LiveDiagramApi {
  const service = new EditorLiveDiagrams(e);

  return {
    paintDiagramLivePreviews: service.paintDiagramLivePreviews.bind(service),
    stopDiagramTimer: service.stopDiagramTimer.bind(service),
  };
}

/** PlantUML and Mermaid blocks, rendered off the editor's render pass. */
class EditorLiveDiagrams {
  /** Keyed by source plus the settings that shaped it. */
  private renders = new Map<string, DiagramRender>();
  /** Last good render per block, so an edit keeps showing the old diagram. */
  private last = new Map<string, DiagramOutput>();
  /** Rendered nodes per block, so a keystroke never reparses the SVG. */
  private nodes = new Map<string, { content: string; node: HTMLElement }>();
  private timer: number | undefined;

  constructor(private e: Editor) {}

  private previews() {
    const previews = this.e.element?.querySelectorAll(
      ".md-livediagram-preview",
    );

    return Array.from(previews ?? []) as HTMLElement[];
  }

  private diagramKey(engine: LiveDiagramEngine, source: string) {
    const { plantumlSettings, mermaidSettings } = this.e.props;
    const server = plantumlSettings.server.trim() || plantumlSettings.command;
    const settings =
      engine === "mermaid"
        ? mermaidSettings.theme
        : `${plantumlSettings.format}|${plantumlSettings.theme}|${server}`;

    return `${engine}\u0000${settings}\u0000${source}`;
  }

  private engineOf(preview: HTMLElement) {
    return (preview.dataset.livediagramEngine === "mermaid"
      ? "mermaid"
      : "plantuml") as LiveDiagramEngine;
  }

  private cacheDiagram(key: string, render: DiagramRender) {
    this.renders.delete(key);
    this.renders.set(key, render);

    const excess = Math.max(0, this.renders.size - DIAGRAM_CACHE_LIMIT);

    for (const stale of Array.from(this.renders.keys()).slice(0, excess)) {
      this.renders.delete(stale);
    }
  }

  stopDiagramTimer() {
    window.clearTimeout(this.timer);
  }

  paintDiagramLivePreviews() {
    let pending = false;

    for (const preview of this.previews()) {
      pending = this.paintDiagramLivePreview(preview) || pending;
    }

    window.clearTimeout(this.timer);

    if (pending) {
      this.timer = window.setTimeout(
        () => this.renderPendingDiagrams(),
        DIAGRAM_IDLE_MS,
      );
    }
  }

  /** Fires once the caret has been still: one render per pause, not per key. */
  private renderPendingDiagrams() {
    for (const preview of this.previews()) {
      const source = preview.dataset.livediagram ?? "";
      const engine = this.engineOf(preview);

      if (source.trim() && !this.renders.has(this.diagramKey(engine, source))) {
        void this.renderDiagramSource(engine, source);
      }
    }
  }

  private buildFigureBody(figure: HTMLElement, output: DiagramOutput) {
    if (output.format === "svg") {
      figure.innerHTML = output.content;

      // PlantUML ships `preserveAspectRatio="none"`, which stretches the art.
      const svg = figure.querySelector("svg");

      svg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg?.removeAttribute("height");
      // Both engines pin sizes inline, which beats any class the card sets.
      svg?.style.setProperty("height", "auto");
      svg?.style.setProperty("max-width", "100%");

      return;
    }

    if (output.format === "png") {
      const image = document.createElement("img");

      image.src = output.content;
      image.alt = "PlantUML diagram";
      figure.append(image);

      return;
    }

    const ascii = document.createElement("pre");

    ascii.className = "md-livediagram-ascii";
    ascii.textContent = output.content;
    figure.append(ascii);
  }

  private buildDiagramNode(output: DiagramOutput, engine: LiveDiagramEngine) {
    const figure = document.createElement("div");

    figure.className =
      engine === "plantuml"
        ? "md-livediagram-figure md-livediagram-paper"
        : "md-livediagram-figure";

    this.buildFigureBody(figure, output);
    figure.insertAdjacentHTML("beforeend", RESIZE_HANDLE);

    return figure;
  }

  private showDiagramOutput(
    preview: HTMLElement,
    output: DiagramOutput,
    group: string,
  ) {
    const cached = this.nodes.get(group);
    const node =
      cached?.content === output.content
        ? cached.node
        : this.buildDiagramNode(output, this.engineOf(preview));

    if (node !== cached?.node) {
      this.nodes.set(group, { content: output.content, node });
    }

    if (preview.firstChild !== node || preview.childNodes.length !== 1) {
      preview.replaceChildren(node);
    }

    this.e.applyEmbedLayout(preview, node);
  }

  /** Returns true when this block still needs a render scheduled. */
  private paintDiagramLivePreview(preview: HTMLElement) {
    const source = preview.dataset.livediagram ?? "";
    const group = preview.dataset.code ?? "";
    const key = this.diagramKey(this.engineOf(preview), source);
    const cached = this.renders.get(key);
    const previous = this.last.get(group);

    if (cached?.state === "ok" && cached.output) {
      this.last.set(group, cached.output);
      preview.classList.remove("md-livediagram-busy", "md-livediagram-error");
      this.showDiagramOutput(preview, cached.output, group);

      return false;
    }

    if (cached?.state === "error") {
      preview.classList.remove("md-livediagram-busy");
      preview.classList.add("md-livediagram-error");
      preview.textContent = cached.message ?? "";

      return false;
    }

    // Still rendering, or not asked for: keep the last diagram on screen.
    const busy = Boolean(source.trim()) && !previous;

    preview.classList.toggle("md-livediagram-busy", busy);
    preview.classList.remove("md-livediagram-error");

    if (previous) {
      this.showDiagramOutput(preview, previous, group);
    } else {
      preview.textContent = source.trim() ? "Rendering diagram…" : "";
    }

    return Boolean(source.trim()) && !cached;
  }

  private async renderDiagramSource(
    engine: LiveDiagramEngine,
    source: string,
  ) {
    const key = this.diagramKey(engine, source);

    this.cacheDiagram(key, { state: "rendering" });

    try {
      this.cacheDiagram(key, {
        state: "ok",
        output: await renderDiagram(engine, source, {
          plantuml: this.e.props.plantumlSettings,
          mermaid: this.e.props.mermaidSettings,
        }),
      });
    } catch (error) {
      this.cacheDiagram(key, {
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    this.paintDiagramLivePreviews();
  }
}
