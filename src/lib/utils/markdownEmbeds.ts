import { kernelFor, KERNEL_LABELS } from "./runner";
import type { CalloutDefinition, PaletteColor } from "../storage/settings";
import { calloutIconSvg } from "./calloutIcons";
import type { GitlabCard } from "./gitlab";
import { preferredTextDirection } from "./textDirection";
import type { QuizLabels } from "./markdownQuizRender";
import {
  attribute,
  escapeHtml,
  lineClass,
  renderInline,
  renderLine,
  type RenderInlineOptions,
  type WikilinkEmbed,
  type WikilinkResolver,
} from "./markdownInline";

export const WIKILINK_EMBED_LINE = /^\s*!\[\[([^\]\n]+)\]\]\s*$/;
export const CALLOUT_START = /^\s*>\s*\[!([a-z][\w-]*)\]\s*(.*)$/i;
export const CALLOUT_LINE = /^\s*>\s?(.*)$/;

export type RenderDocumentOptions = {
  fancyTableEditor?: boolean;
  callouts?: boolean;
  calloutDefinitions?: CalloutDefinition[];
  drawings?: boolean;
  diagrams?: boolean;
  quizzes?: boolean;
  quizLabels?: QuizLabels;
  resolveWikilink?: WikilinkResolver;
  highlightColors?: PaletteColor[];
  renderWikilinkEmbed?: (target: string, depth: number) => WikilinkEmbed | null;
  wikilinkEmbedDepth?: number;
  staticDiagramPreviews?: boolean;
  codeExecution?: boolean;
  databaseEmbeds?: boolean;
  /** Unset: YouTube links render as images; otherwise whether we are online. */
  youtubeOnline?: boolean;
  resolveGitlab?: (key: string) => GitlabCard | undefined;
  plantuml?: boolean;
  mermaid?: boolean;
  subblockDepth?: number;
};

/** Language of the fenced block that holds an Excalidraw scene as JSON. */
export const DRAWING_LANGUAGE = "excalidraw";

export const EMPTY_DRAWING = '```excalidraw\n{"elements":[]}\n```';

/** Language of the fenced block that holds a draw.io diagram: its XML plus a rendered SVG. */
export const DIAGRAM_LANGUAGE = "drawio";

export const EMPTY_DIAGRAM = '```drawio\n{"xml":"","svg":""}\n```';

export function diagramPreview(
  group: number,
  source = "",
  staticPreview = false,
) {
  if (staticPreview) {
    let svg = "";
    let width: number | undefined;
    let align: string | undefined;

    try {
      const parsed = JSON.parse(source || "{}") as {
        svg?: string;
        width?: number;
        align?: string;
      };

      svg = parsed.svg ?? "";
      width = typeof parsed.width === "number" ? parsed.width : undefined;
      align = parsed.align;
    } catch {
      svg = "";
    }

    const justify =
      align === "center"
        ? "center"
        : align === "right"
          ? "flex-end"
          : "flex-start";
    const widthStyle = width ? ` style="width:${width}px"` : "";
    const body = svg
      ? `<div class="md-diagram-open md-diagram-thumbnail md-diagram-static"${widthStyle}>${svg}</div>`
      : `<div class="md-diagram-open md-diagram-static">Diagram preview unavailable</div>`;

    return `<div class="md-preview md-diagram-preview md-diagram-static-preview" data-code="${group}" style="justify-content:${justify}" contenteditable="false">${body}</div>`;
  }

  return `<div class="md-preview md-diagram-preview" data-code="${group}" contenteditable="false"><button type="button" class="md-diagram-open">Edit diagram</button></div>`;
}

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z"/></svg>';
const RESTART_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

/** The run bar sits under a runnable fence; its output is painted in by the editor. */
export function runPreview(group: number, language: string) {
  const kernel = kernelFor(language);

  return `<div class="md-preview md-run-preview" data-code="${group}" data-run-language="${attribute(
    language,
  )}" contenteditable="false"><div class="md-run-bar"><button type="button" class="md-run-button" title="Run cell"><span class="md-run-icon">${PLAY_ICON}</span><span class="md-run-label">Run</span></button><span class="md-run-kernel">${
    kernel ? KERNEL_LABELS[kernel] : ""
  }</span><span class="md-run-status"></span><button type="button" class="md-run-restart" title="Restart kernel">${RESTART_ICON}</button></div></div>`;
}

/** Fence languages that render live under their source, and the engine that draws them. */
export const LIVE_DIAGRAM_LANGUAGES: Record<string, LiveDiagramEngine> = {
  plantuml: "plantuml",
  puml: "plantuml",
  uml: "plantuml",
  mermaid: "mermaid",
  mmd: "mermaid",
};

export type LiveDiagramEngine = "plantuml" | "mermaid";

export const EMPTY_PLANTUML =
  "```plantuml\n@startuml\nAlice -> Bob: Hello\n@enduml\n```";

export const EMPTY_MERMAID =
  "```mermaid\nflowchart LR\n  A[Start] --> B[Done]\n```";

export function liveDiagramEngine(
  language: string,
  options: RenderDocumentOptions,
) {
  const engine = LIVE_DIAGRAM_LANGUAGES[language];

  return (engine === "plantuml" && options.plantuml) ||
    (engine === "mermaid" && options.mermaid)
    ? engine
    : null;
}

/** Width in pixels and alignment ride along on the opening fence: ```mermaid|center|420 */
export function liveDiagramLayout(info: string) {
  const parts = info.split("|").map((part) => part.trim());
  const align = parts.find((part) => part === "center" || part === "right");
  const width = parts
    .map(Number)
    .find((part) => Number.isFinite(part) && part > 0);

  return { align, width };
}

export function liveDiagramFenceLine(
  language: string,
  align?: string,
  width?: number,
) {
  return ["```" + language, align, width ? String(Math.round(width)) : ""]
    .filter(Boolean)
    .join("|");
}

/** An empty frame: the editor paints the rendered diagram in once it lands. */
export function liveDiagramPreview(
  group: number,
  engine: LiveDiagramEngine,
  source: string,
  info: string,
) {
  const { align, width } = liveDiagramLayout(info);
  const justify =
    align === "center"
      ? "center"
      : align === "right"
        ? "flex-end"
        : "flex-start";

  return `<div class="md-preview md-livediagram-preview" data-code="${group}" data-livediagram-engine="${engine}" data-livediagram="${attribute(
    source,
  )}"${align ? ` data-livediagram-align="${attribute(align)}"` : ""}${
    width ? ` data-livediagram-width="${width}"` : ""
  } style="justify-content:${justify}" contenteditable="false"></div>`;
}

/** Language of the fenced block that names a database view to embed, as JSON. */
export const DATABASE_LANGUAGE = "database";

/** What a `database` fence carries: which view of which table to show. */
export type DatabaseEmbed = {
  database?: string;
  table?: string;
  view?: string;
  /** Show only this table and view: no tabs, no toolbar. */
  locked?: boolean;
};

export function databaseEmbed(embed: DatabaseEmbed) {
  return `\`\`\`database\n${JSON.stringify(embed)}\n\`\`\``;
}

export function emptyDatabaseEmbed(databaseId: string) {
  return databaseEmbed({ database: databaseId });
}

/** An empty frame: the editor mounts the live database view into it. */
export function databasePreview(group: number, source: string) {
  return `<div class="md-preview md-database-preview md-database-anchor" data-code="${group}" data-embed="${attribute(
    source,
  )}" contenteditable="false"></div>`;
}

export function drawingPreview(group: number) {
  return `<div class="md-preview md-drawing-preview" data-code="${group}" contenteditable="false"><button type="button" class="md-drawing-open">Edit drawing</button></div>`;
}

export function wikilinkEmbedPreview(
  rawTarget: string,
  options: RenderDocumentOptions,
) {
  const depth = options.wikilinkEmbedDepth ?? 0;
  const embed = options.renderWikilinkEmbed?.(rawTarget, depth);
  const body = embed?.exists
    ? embed.html || `<p class="md-wikilink-embed-empty">Empty note</p>`
    : `<p class="md-wikilink-embed-empty">Missing note</p>`;
  const missing = embed?.exists === false ? " md-wikilink-embed-missing" : "";

  return `<div class="md-preview md-wikilink-embed-preview${missing}" data-wikilink-target="${attribute(
    rawTarget,
  )}" contenteditable="false"><div class="md-wikilink-embed-body">${body}</div></div>`;
}

export function calloutDefinition(
  type: string,
  definitions: CalloutDefinition[],
) {
  const normalizedType = type.toLowerCase();

  return (
    definitions.find(
      (definition) => definition.id.toLowerCase() === normalizedType,
    ) ?? {
      id: normalizedType,
      label: normalizedType,
      color: "#78716c",
      icon: "i",
    }
  );
}

function calloutRgb(color: string) {
  const sanitized = /^#[\da-f]{6}$/i.test(color) ? color : "#78716c";
  const red = Number.parseInt(sanitized.slice(1, 3), 16);
  const green = Number.parseInt(sanitized.slice(3, 5), 16);
  const blue = Number.parseInt(sanitized.slice(5, 7), 16);

  return `${red} ${green} ${blue}`;
}

export function calloutLine(
  line: string,
  group: number,
  definition: CalloutDefinition,
  index: number,
  count: number,
  options: RenderInlineOptions,
) {
  const direction = preferredTextDirection(line);
  const position = [
    index === 0 ? "md-callout-start" : "",
    index === count - 1 ? "md-callout-end" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<div dir="${direction}" class="md-block md-quote md-callout-line ${position}" data-callout="${group}" style="--md-callout-rgb:${calloutRgb(
    definition.color,
  )};">${renderLine(line, options)}</div>`;
}

export function calloutPreview(
  lines: string[],
  group: number,
  definitions: CalloutDefinition[],
  options: RenderInlineOptions,
) {
  const start = CALLOUT_START.exec(lines[0]);
  const type = start?.[1] ?? "note";
  const definition = calloutDefinition(type, definitions);
  const title = start?.[2]?.trim() || definition.label;
  const body = lines.slice(1).map((line) => CALLOUT_LINE.exec(line)?.[1] ?? "");
  const previewDirection = preferredTextDirection([title, ...body].join("\n"));
  const titleDirection = preferredTextDirection(title);
  const bodyHtml = body
    .map((line) => {
      const indent = / */.exec(line)![0].length;
      const direction = preferredTextDirection(line);
      const padding = direction === "rtl" ? "padding-right" : "padding-left";
      const style = indent ? ` style="${padding}:${indent * 0.75}rem"` : "";

      return `<div dir="${direction}" class="md-callout-body-line ${lineClass(line)}"${style}>${renderLine(line, options)}</div>`;
    })
    .join("");

  return `<div dir="${previewDirection}" class="md-preview md-callout-preview" data-callout="${group}" style="--md-callout-rgb:${calloutRgb(
    definition.color,
  )};" contenteditable="false"><div dir="${previewDirection}" class="md-callout-heading"><span class="md-callout-icon">${calloutIconSvg(
    definition.icon,
  )}</span><span dir="${titleDirection}" class="md-callout-title">${renderInline(escapeHtml(title), options)}</span></div>${
    bodyHtml ? `<div class="md-callout-body">${bodyHtml}</div>` : ""
  }</div>`;
}

/** Embedded source hides behind its preview card, so every embed language gets a collapsed line. */
export function embedLineClass(language: string) {
  if (language === DIAGRAM_LANGUAGE) {
    return "md-diagram-line";
  }

  return language === DATABASE_LANGUAGE ||
    language === "gitlab" ||
    language === "github"
    ? "md-database-line"
    : "md-drawing-line";
}
