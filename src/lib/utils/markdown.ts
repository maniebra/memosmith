import hljs from "highlight.js/lib/common";
import katex from "katex";
import { assetFolder } from "./assets";
import { parseWikilink, type WikilinkResolution } from "./wikilinks";

type BlockRule = {
  match: RegExp;
  className: string;
  /** Hide the markdown marker when the caret is elsewhere. */
  hideMark?: boolean;
};

const BLOCK_RULES: BlockRule[] = [
  { match: /^# /, className: "md-h1", hideMark: true },
  { match: /^## /, className: "md-h2", hideMark: true },
  { match: /^### /, className: "md-h3", hideMark: true },
  { match: /^#{4,6} /, className: "md-h4", hideMark: true },
  { match: /^\s*[-*+] \[x\] /i, className: "md-task md-task-done", hideMark: true },
  { match: /^\s*[-*+] \[ \] /, className: "md-task", hideMark: true },
  { match: /^\s*[-*+] /, className: "md-bullet", hideMark: true },
  { match: /^\s*\d+\. /, className: "md-ordered" },
  { match: /^> /, className: "md-quote", hideMark: true },
  { match: /^(-{3,}|\*{3,}|_{3,})$/, className: "md-rule", hideMark: true },
];

/** One pass so replacements are never rescanned as markdown. */
const INLINE = /`([^`\n]+)`|\$([^$\n]+)\$|\[\[([^\]\n]+)\]\]|\*\*([^*\n]+)\*\*|(?<![*\w])\*(\S|\S[^*\n]*\S)\*(?!\*)|\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const EQUATION_BLOCK = /^\s*\$\$\s*(\S.*?)\s*\$\$\s*$/;

function mark(text: string) {
  return `<span class="md-mark">${text}</span>`;
}

function renderKatex(source: string, displayMode: boolean) {
  try {
    return katex.renderToString(source, {
      displayMode,
      output: "html",
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return escapeHtml(source);
  }
}

function unescapeHtml(text: string) {
  return text.replace(/&(amp|lt|gt);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">" })[entity]!);
}

function renderInlineMath(source: string) {
  return `<span class="md-math-inline"><span class="md-math-source">${mark("$")}${source}${mark("$")}</span><span class="md-math-rendered" contenteditable="false">${renderKatex(unescapeHtml(source), false)}</span></span>`;
}

/** Source stays an ordinary editable line; the preview is a sibling the caret never enters. */
function mathLine(line: string, group: number, closed: boolean) {
  // Only a closed block may hide its source, since only then is there a preview to hide behind.
  return `<div class="md-block md-math-line" data-math="${group}"${closed ? " data-closed" : ""}>${escapeHtml(line) || "<br>"}</div>`;
}

function mathPreview(source: string, group: number) {
  return `<div class="md-preview md-math-preview" data-math="${group}" contenteditable="false">${renderKatex(source, true)}</div>`;
}

export type WikilinkResolver = (target: string) => WikilinkResolution;
export type WikilinkEmbed = {
  title: string;
  html: string;
  exists: boolean;
};

type RenderInlineOptions = {
  resolveWikilink?: WikilinkResolver;
};

function renderWikilink(raw: string, options: RenderInlineOptions) {
  const rawText = unescapeHtml(raw);
  const link = parseWikilink(rawText);
  const aliasIndex = rawText.indexOf("|");
  const sourceStart = aliasIndex === -1 ? "[[" : `[[${rawText.slice(0, aliasIndex + 1)}`;
  const label = aliasIndex === -1 ? rawText : rawText.slice(aliasIndex + 1);
  const resolution = options.resolveWikilink?.(link.raw);
  const missing = resolution && !resolution.exists ? " md-wikilink-missing" : "";

  return `<span class="md-wikilink${missing}" data-wikilink-target="${attribute(link.raw)}">${mark(
    escapeHtml(sourceStart),
  )}${escapeHtml(label)}${mark("]]")}</span>`;
}

function renderInline(escaped: string, options: RenderInlineOptions = {}) {
  return escaped.replace(INLINE, (all, code, math, wiki, bold, italic, linkText, href) => {
    if (code) {
      return `<span class="md-code">${mark("`")}${code}${mark("`")}</span>`;
    }

    if (math) {
      return renderInlineMath(math);
    }

    if (wiki) {
      return renderWikilink(wiki, options);
    }

    if (bold) {
      return `<span class="md-bold">${mark("**")}${bold}${mark("**")}</span>`;
    }

    if (italic) {
      return `<span class="md-italic">${mark("*")}${italic}${mark("*")}</span>`;
    }

    if (linkText !== undefined) {
      return `<span class="md-link">${mark("[")}${linkText}${mark(`](${href})`)}</span>`;
    }

    return all;
  });
}

type TableAlignment = "left" | "center" | "right" | null;

export type TableCell = {
  text: string;
  colspan: number;
  rowspan: number;
  background?: string;
  covered: boolean;
};

export type MarkdownTable = {
  alignments: TableAlignment[];
  rows: TableCell[][];
};

export type TableEdit =
  | { type: "set-cell-text"; row: number; column: number; text: string }
  | { type: "insert-row"; row: number }
  | { type: "insert-column"; column: number }
  | { type: "merge-right"; row: number; column: number }
  | { type: "merge-down"; row: number; column: number }
  | { type: "split-cell"; row: number; column: number }
  | { type: "set-cell-background"; row: number; column: number; background?: string };

export const DEFAULT_TABLE_MARKDOWN = "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |";

const TABLE_CELL_META = /^\s*\{::\s*([^]*?)\s*::\}\s*/;
const TABLE_BACKGROUNDS = new Set(["#fee2e2", "#fef3c7", "#dcfce7", "#dbeafe", "#f3e8ff"]);

function endsWithTableDelimiter(line: string) {
  const trimmed = line.trimEnd();

  if (!trimmed.endsWith("|")) {
    return false;
  }

  let backslashes = 0;

  for (let index = trimmed.length - 2; index >= 0 && trimmed[index] === "\\"; index--) {
    backslashes++;
  }

  return backslashes % 2 === 0;
}

function splitTableRow(line: string) {
  const trimmed = line.trim();
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  let inCode = false;
  let bracketDepth = 0;

  for (const char of trimmed) {
    if (escaped) {
      cell += char === "|" ? "|" : `\\${char}`;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "`") {
      inCode = !inCode;
    } else if (!inCode && char === "[") {
      bracketDepth++;
    } else if (!inCode && char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }

    if (char === "|" && !inCode && bracketDepth === 0) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  if (escaped) {
    cell += "\\";
  }

  cells.push(cell.trim());

  if (trimmed.startsWith("|")) {
    cells.shift();
  }

  if (endsWithTableDelimiter(trimmed)) {
    cells.pop();
  }

  return cells;
}

function separatorAlign(cell: string): TableAlignment | false {
  const match = /^\s*(:?)-{3,}(:?)\s*$/.exec(cell);

  if (!match) {
    return false;
  }

  return match[1] && match[2] ? "center" : match[2] ? "right" : match[1] ? "left" : null;
}

function tableSeparator(line: string) {
  const cells = splitTableRow(line);
  const alignments = cells.map(separatorAlign);

  return alignments.length > 0 && alignments.every((alignment) => alignment !== false)
    ? (alignments as TableAlignment[])
    : null;
}

function emptyTableCell(): TableCell {
  return {
    text: "",
    colspan: 1,
    rowspan: 1,
    covered: false,
  };
}

function parseTableCell(source: string): TableCell {
  const cell = emptyTableCell();
  const meta = TABLE_CELL_META.exec(source);

  if (!meta) {
    return { ...cell, text: source };
  }

  for (const token of meta[1].trim().split(/\s+/)) {
    const [key, value] = token.split("=");

    if (key === "covered") {
      cell.covered = true;
    } else if (key === "colspan") {
      cell.colspan = Math.max(1, Number(value) || 1);
    } else if (key === "rowspan") {
      cell.rowspan = Math.max(1, Number(value) || 1);
    } else if (key === "bg" && /^#[\da-f]{6}$/i.test(value ?? "")) {
      cell.background = value.toLowerCase();
    }
  }

  return {
    ...cell,
    text: source.slice(meta[0].length),
  };
}

function tableWidth(table: MarkdownTable) {
  return Math.max(table.alignments.length, ...table.rows.map((row) => row.length));
}

function normalizeTable(table: MarkdownTable): MarkdownTable {
  const width = Math.max(1, tableWidth(table));
  const alignments = [...table.alignments, ...Array<TableAlignment>(width - table.alignments.length).fill(null)];
  const rows = table.rows.map((row) => {
    const cells = row.map((cell) => ({ ...cell }));

    return [...cells, ...Array.from({ length: width - cells.length }, emptyTableCell)];
  });

  return { alignments, rows };
}

export function parseMarkdownTable(lines: string[]): MarkdownTable | null {
  const alignments = tableSeparator(lines[1]);

  if (!alignments || lines.length < 2) {
    return null;
  }

  return normalizeTable({
    alignments,
    rows: lines.filter((_, index) => index !== 1).map((line) => splitTableRow(line).map(parseTableCell)),
  });
}

function escapedTableText(text: string) {
  return text.replace(/\n/g, " ").replace(/\|/g, "\\|");
}

function serializedTableCell(cell: TableCell) {
  const meta = [
    cell.covered ? "covered" : "",
    cell.colspan > 1 ? `colspan=${cell.colspan}` : "",
    cell.rowspan > 1 ? `rowspan=${cell.rowspan}` : "",
    cell.background ? `bg=${cell.background}` : "",
  ].filter(Boolean);
  const text = escapedTableText(cell.text);

  return `${meta.length ? `{:: ${meta.join(" ")} ::} ` : ""}${text}`;
}

function alignmentMarker(alignment: TableAlignment) {
  return alignment === "center" ? ":---:" : alignment === "right" ? "---:" : alignment === "left" ? ":---" : "---";
}

export function serializeMarkdownTable(table: MarkdownTable) {
  const normalized = normalizeTable(table);
  const rows = normalized.rows.map((row) => `| ${row.map(serializedTableCell).join(" | ")} |`);
  const separator = `| ${normalized.alignments.map(alignmentMarker).join(" | ")} |`;

  return [rows[0], separator, ...rows.slice(1)].join("\n");
}

function tableCell(
  content: string,
  tag: "td" | "th",
  alignment: TableAlignment,
  options: RenderInlineOptions,
) {
  const align = alignment ? `text-align:${alignment};` : "";
  const cell = parseTableCell(content);
  const colspan = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "";
  const rowspan = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "";
  const background =
    cell.background && TABLE_BACKGROUNDS.has(cell.background) ? `background-color:${cell.background};` : "";
  const style = align || background ? ` style="${align}${background}"` : "";
  const body = renderInline(escapeHtml(cell.text), options);

  if (cell.covered) {
    return "";
  }

  return `<${tag} class="md-table-cell" data-table-cell data-row="" data-column="" contenteditable="true" spellcheck="true"${colspan}${rowspan}${style}>${body || emptyAnchor()}</${tag}>`;
}

function renderTable(lines: string[], options: RenderInlineOptions) {
  const table = parseMarkdownTable(lines);

  if (!table) {
    return "";
  }

  const rowHtml = (row: TableCell[], rowIndex: number, tag: "td" | "th") =>
    `<tr>${row
      .map((cell, columnIndex) =>
        tableCell(serializedTableCell(cell), tag, table.alignments[columnIndex] ?? null, options)
          .replace('data-row=""', `data-row="${rowIndex}"`)
          .replace('data-column=""', `data-column="${columnIndex}"`),
      )
      .join("")}</tr>`;

  return `<table class="md-table"><thead>${rowHtml(table.rows[0], 0, "th")}</thead><tbody>${table.rows
    .slice(1)
    .map((row, index) => rowHtml(row, index + 1, "td"))
    .join("")}</tbody></table>`;
}

function isTableStart(lines: string[], index: number) {
  return index + 1 < lines.length && isTableRow(lines[index]) && tableSeparator(lines[index + 1]) !== null;
}

function isTableRow(line: string) {
  return splitTableRow(line).length > 1 || line.trim().startsWith("|");
}

function tableLine(line: string, group: number, options: RenderInlineOptions) {
  return `<div class="md-block md-table-line" data-table="${group}">${renderLine(line, options)}</div>`;
}

function tablePreview(
  lines: string[],
  group: number,
  showToolbar = true,
  options: RenderInlineOptions = {},
) {
  const divider = '<span class="md-table-tool-divider" aria-hidden="true">|</span>';
  const toolbar = showToolbar
    ? `<div class="md-table-tools-shell" contenteditable="false"><div class="md-table-tools"><button type="button" data-table-action="insert-row" title="Add row">Row +</button>${divider}<button type="button" data-table-action="insert-column" title="Add column">Col +</button>${divider}<button type="button" data-table-action="merge-right" title="Merge with cell on the right">Merge H</button>${divider}<button type="button" data-table-action="merge-down" title="Merge with cell below">Merge V</button>${divider}<button type="button" data-table-action="split-cell" title="Split cell">Split</button>${divider}${Array.from(
        TABLE_BACKGROUNDS,
      )
        .map(
          (color) =>
            `<button type="button" class="md-table-swatch" data-table-action="set-color" data-color="${color}" style="background-color:${color}" title="Cell color"></button>`,
        )
        .join("")}${divider}<button type="button" data-table-action="clear-color" title="Clear cell color">Clear</button></div></div>`
    : "";

  return `<div class="md-preview md-table-preview" data-table="${group}" contenteditable="false">${toolbar}<div class="md-table-scroll">${renderTable(
      lines,
      options,
    )}</div></div>`;
}

function tableCellAt(table: MarkdownTable, row: number, column: number) {
  return table.rows[row]?.[column];
}

function ensureCell(table: MarkdownTable, row: number, column: number) {
  const normalized = normalizeTable(table);

  while (normalized.rows.length <= row) {
    normalized.rows.push(Array.from({ length: tableWidth(normalized) }, emptyTableCell));
  }

  while (normalized.rows[row].length <= column) {
    normalized.rows[row].push(emptyTableCell());
    normalized.alignments.push(null);
  }

  return normalized;
}

function applyTableEdit(table: MarkdownTable, edit: TableEdit): MarkdownTable {
  const row = "row" in edit ? Math.max(0, edit.row) : 0;
  const column = "column" in edit ? Math.max(0, edit.column) : 0;
  const next = ensureCell(table, row, column);
  const width = tableWidth(next);
  const cell = tableCellAt(next, row, column);

  if (!cell || cell.covered) {
    return next;
  }

  if (edit.type === "set-cell-text") {
    cell.text = edit.text;
  } else if (edit.type === "insert-row") {
    next.rows.splice(Math.max(1, row + 1), 0, Array.from({ length: width }, emptyTableCell));
  } else if (edit.type === "insert-column") {
    const insertionColumn = Math.min(width, column + 1);

    next.alignments.splice(insertionColumn, 0, null);
    for (const tableRow of next.rows) {
      tableRow.splice(insertionColumn, 0, emptyTableCell());
    }
  } else if (edit.type === "merge-right") {
    const targetColumn = column + cell.colspan;
    const target = tableCellAt(next, row, targetColumn);

    if (target && !target.covered) {
      cell.text = [cell.text, target.text].filter(Boolean).join(" ");
      cell.colspan += target.colspan;

      for (let coveredColumn = targetColumn; coveredColumn < Math.min(width, targetColumn + target.colspan); coveredColumn++) {
        next.rows[row][coveredColumn] = { ...emptyTableCell(), covered: true };
      }
    }
  } else if (edit.type === "merge-down") {
    const targetRow = row + cell.rowspan;

    if (targetRow < next.rows.length) {
      const target = tableCellAt(next, targetRow, column);

      if (target && !target.covered) {
        cell.text = [cell.text, target.text].filter(Boolean).join(" ");
        cell.rowspan += target.rowspan;

        for (let coveredRow = targetRow; coveredRow < Math.min(next.rows.length, targetRow + target.rowspan); coveredRow++) {
          for (let coveredColumn = column; coveredColumn < Math.min(width, column + cell.colspan); coveredColumn++) {
            next.rows[coveredRow][coveredColumn] = { ...emptyTableCell(), covered: true };
          }
        }
      }
    }
  } else if (edit.type === "split-cell") {
    const { colspan, rowspan } = cell;

    cell.colspan = 1;
    cell.rowspan = 1;

    for (let splitRow = row; splitRow < Math.min(next.rows.length, row + rowspan); splitRow++) {
      for (let splitColumn = column; splitColumn < Math.min(width, column + colspan); splitColumn++) {
        if (splitRow !== row || splitColumn !== column) {
          next.rows[splitRow][splitColumn] = emptyTableCell();
        }
      }
    }
  } else if (edit.type === "set-cell-background") {
    cell.background = edit.background && TABLE_BACKGROUNDS.has(edit.background) ? edit.background : undefined;
  }

  return normalizeTable(next);
}

export function editMarkdownTable(text: string, edit: TableEdit) {
  const table = parseMarkdownTable(text.split("\n"));

  return table ? serializeMarkdownTable(applyTableEdit(table, edit)) : text;
}

function emptyAnchor() {
  return "&#8203;";
}

export const SLASH_COMMANDS = [
  { label: "Heading 1", hint: "#", prefix: "# " },
  { label: "Heading 2", hint: "##", prefix: "## " },
  { label: "Heading 3", hint: "###", prefix: "### " },
  { label: "Bulleted list", hint: "-", prefix: "- " },
  { label: "Numbered list", hint: "1.", prefix: "1. " },
  { label: "To-do", hint: "[ ]", prefix: "- [ ] " },
  { label: "Quote", hint: ">", prefix: "> " },
  { label: "Code", hint: "```", prefix: "```" },
  { label: "Equation", hint: "$$", prefix: "$$" },
  { label: "Table", hint: "2x2", prefix: DEFAULT_TABLE_MARKDOWN },
  { label: "Divider", hint: "---", prefix: "---" },
  { label: "Text", hint: "plain", prefix: "" },
];

const MEDIA_LINE = /^(\s*)!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;
const WIKILINK_EMBED_LINE = /^(\s*)!\[\[([^\]\n]+)\]\]\s*$/;

export type MediaOptions = { width?: number; align?: "left" | "center" | "right" };

export function isMediaLine(line: string) {
  return MEDIA_LINE.test(line);
}

/** Obsidian-style pipe options in the alt text: `![alt|center|400](src)`. */
export function mediaOptions(line: string): MediaOptions {
  const parts = MEDIA_LINE.exec(line)?.[2].split("|").slice(1) ?? [];
  const width = parts.find((part) => /^\d+$/.test(part));
  const align = parts.find((part) => /^(left|center|right)$/.test(part));

  return {
    width: width ? Number(width) : undefined,
    align: align as MediaOptions["align"],
  };
}

export function withMediaOptions(line: string, options: MediaOptions) {
  const media = MEDIA_LINE.exec(line);

  if (!media) {
    return line;
  }

  const [, indent, alt, source] = media;
  const { width, align } = { ...mediaOptions(line), ...options };
  const parts = [alt.split("|")[0], align, width].filter(Boolean);

  return `${indent}![${parts.join("|")}](${source})`;
}

function attribute(text: string) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/** Source stays editable; the media sits in a sibling preview the caret never enters. */
function mediaPreview(line: string, alt: string, source: string, resolveAsset: (source: string) => string) {
  const url = attribute(resolveAsset(source));
  const folder = assetFolder(source);
  const { width, align } = mediaOptions(line);
  const size = width ? ` style="width:${width}px"` : "";
  const media =
    folder === "videos"
      ? `<video class="md-media" src="${url}"${size} controls></video>`
      : folder === "audio"
        ? `<audio class="md-media" src="${url}" controls></audio>`
        : `<img class="md-media" src="${url}" alt="${attribute(alt.split("|")[0])}"${size}>`;

  // The handle is a drag target only; the editor rewrites the source line on release.
  const handle = folder === "audio" ? "" : `<span class="md-resize" aria-hidden="true"></span>`;

  return `<div class="md-preview md-media-preview" style="justify-content:${
    align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"
  }" contenteditable="false"><span class="md-media-wrap">${media}${handle}</span></div>`;
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function blockRule(line: string) {
  return BLOCK_RULES.find((rule) => rule.match.test(line));
}

export function lineClass(line: string) {
  return blockRule(line)?.className ?? "";
}

export function renderLine(line: string, options: RenderInlineOptions = {}) {
  if (!line) {
    return emptyAnchor();
  }

  const rule = blockRule(line);
  const prefix = rule?.hideMark ? rule.match.exec(line)![0] : "";
  const body = renderInline(escapeHtml(line.slice(prefix.length)), options);

  return `${prefix ? mark(escapeHtml(prefix)) : ""}${body || emptyAnchor()}`;
}

const FENCE = /^\s*```(\w*)/;

/** Highlighting is per line so each line stays one block the caret can map onto. */
function renderCode(line: string, language: string) {
  if (!line) {
    return emptyAnchor();
  }

  if (!language || !hljs.getLanguage(language)) {
    return escapeHtml(line);
  }

  return hljs.highlight(line, { language, ignoreIllegals: true }).value;
}

/** True when the document has a `$$` line with no partner, so typing one should close it. */
export function mathUnclosed(text: string) {
  return (text.match(/^[ \t]*\$\$[ \t]*$/gm) ?? []).length % 2 === 1;
}

/** True when the text ends inside an unclosed fence. */
export function insideFence(text: string) {
  return (text.match(/^[ \t]*```/gm) ?? []).length % 2 === 1;
}

export type RenderDocumentOptions = {
  fancyTableEditor?: boolean;
  drawings?: boolean;
  diagrams?: boolean;
  resolveWikilink?: WikilinkResolver;
  renderWikilinkEmbed?: (target: string, depth: number) => WikilinkEmbed | null;
  wikilinkEmbedDepth?: number;
  staticDiagramPreviews?: boolean;
};

/** Language of the fenced block that holds an Excalidraw scene as JSON. */
export const DRAWING_LANGUAGE = "excalidraw";

export const EMPTY_DRAWING = '```excalidraw\n{"elements":[]}\n```';

/** Language of the fenced block that holds a draw.io diagram: its XML plus a rendered SVG. */
export const DIAGRAM_LANGUAGE = "drawio";

export const EMPTY_DIAGRAM = '```drawio\n{"xml":"","svg":""}\n```';

function diagramPreview(group: number, source = "", staticPreview = false) {
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
      align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
    const widthStyle = width ? ` style="width:${width}px"` : "";
    const body = svg
      ? `<div class="md-diagram-open md-diagram-thumbnail md-diagram-static"${widthStyle}>${svg}</div>`
      : `<div class="md-diagram-open md-diagram-static">Diagram preview unavailable</div>`;

    return `<div class="md-preview md-diagram-preview md-diagram-static-preview" data-code="${group}" style="justify-content:${justify}" contenteditable="false">${body}</div>`;
  }

  return `<div class="md-preview md-diagram-preview" data-code="${group}" contenteditable="false"><button type="button" class="md-diagram-open">Edit diagram</button></div>`;
}

function drawingPreview(group: number) {
  return `<div class="md-preview md-drawing-preview" data-code="${group}" contenteditable="false"><button type="button" class="md-drawing-open">Edit drawing</button></div>`;
}

function wikilinkEmbedPreview(rawTarget: string, options: RenderDocumentOptions) {
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

export function renderDocument(
  text: string,
  resolveAsset?: (source: string) => string,
  options: RenderDocumentOptions = {},
) {
  const fancyTableEditor = options.fancyTableEditor ?? true;
  const drawings = options.drawings ?? false;
  const diagrams = options.diagrams ?? false;
  const inlineOptions = { resolveWikilink: options.resolveWikilink };
  let embedGroup: number | null = null;
  /** Non-null while inside a fenced block that renders as a preview card instead of code. */
  let embedLanguage: string | null = null;
  let embedSourceLines: string[] | null = null;
  let language: string | null = null;
  let codeGroup = 0;
  let mathGroup = 0;
  let tableGroup = 0;
  let mathLines: string[] | null = null;
  const output: string[] = [];

  function pushMathLines(lines: string[], closed: boolean) {
    const group = mathGroup++;

    for (const line of lines) {
      output.push(mathLine(line, group, closed));
    }

    // An unclosed block has no equation yet, so there is nothing to preview.
    if (closed) {
      output.push(mathPreview(lines.slice(1, -1).join("\n"), group));
    }
  }

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const fence = FENCE.exec(line);

    if (mathLines) {
      mathLines.push(line);

      if (line.trim() === "$$") {
        pushMathLines(mathLines, true);
        mathLines = null;
      }

      i++;
      continue;
    }

    if (fence) {
      const isOpening: boolean = language === null;
      const className = isOpening ? "md-fence md-fence-open" : "md-fence md-fence-close";

      language = isOpening ? fence[1].toLowerCase() : null;
      const index = isOpening ? codeGroup : codeGroup++;
      const embedded: string | null = isOpening
        ? (drawings && language === DRAWING_LANGUAGE) || (diagrams && language === DIAGRAM_LANGUAGE)
          ? language
          : null
        : embedGroup !== null
          ? embedLanguage
          : null;

      embedLanguage = isOpening ? embedded : null;
      embedGroup = embedded && isOpening ? index : null;
      embedSourceLines = embedded && isOpening ? [line] : embedSourceLines;
      const embedClass = embedded === DIAGRAM_LANGUAGE ? " md-diagram-line" : embedded ? " md-drawing-line" : "";

      output.push(
        `<div class="md-block ${className}${embedClass}" data-code="${index}">${escapeHtml(line)}</div>`,
      );

      // The source lives behind the preview card, so the raw JSON is only shown while the caret is inside.
      if (embedded && !isOpening) {
        embedSourceLines?.push(line);
        output.push(
          embedded === DIAGRAM_LANGUAGE
            ? diagramPreview(index, embedSourceLines?.slice(1, -1).join("\n") ?? "", options.staticDiagramPreviews)
            : drawingPreview(index),
        );
        embedSourceLines = null;
      }

      i++;
      continue;
    }

    if (language !== null) {
      // Embedded source never wears the code slab: it sits collapsed behind the preview card.
      if (embedLanguage) {
        const embedClass = embedLanguage === DIAGRAM_LANGUAGE ? "md-diagram-line" : "md-drawing-line";

        embedSourceLines?.push(line);
        output.push(
          `<div class="md-block ${embedClass}" data-code="${codeGroup}">${escapeHtml(line)}</div>`,
        );
        i++;
        continue;
      }

      output.push(
        `<div class="md-block md-codeblock" data-code="${codeGroup}" data-language="${attribute(language)}">${renderCode(line, language)}</div>`,
      );
      i++;
      continue;
    }

    const equation = EQUATION_BLOCK.exec(line);

    if (equation) {
      const group = mathGroup++;

      output.push(mathLine(line, group, true), mathPreview(equation[1], group));
      i++;
      continue;
    }

    if (line.trim() === "$$") {
      mathLines = [line];
      i++;
      continue;
    }

    const wikilinkEmbed = WIKILINK_EMBED_LINE.exec(line);

    if (wikilinkEmbed) {
      output.push(
        `<div class="md-block md-wikilink-embed-line">${renderLine(line, inlineOptions)}</div>`,
        wikilinkEmbedPreview(wikilinkEmbed[2], options),
      );
      i++;
      continue;
    }

    const media = resolveAsset ? MEDIA_LINE.exec(line) : null;

    if (media) {
      output.push(
        `<div class="md-block md-media-line">${renderLine(line, inlineOptions)}</div>`,
        mediaPreview(line, media[2], media[3], resolveAsset!),
      );
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const tableLines = [line, lines[i + 1]];
      let j = i + 2;

      while (j < lines.length && isTableRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }

      const group = tableGroup++;

      for (const tableSourceLine of tableLines) {
        output.push(tableLine(tableSourceLine, group, inlineOptions));
      }

      output.push(tablePreview(tableLines, group, fancyTableEditor, inlineOptions));
      i = j;
      continue;
    }

    const indent = / */.exec(line)![0].length;
    const style = indent ? ` style="padding-left:${indent * 0.75}rem"` : "";

    output.push(`<div class="md-block ${lineClass(line)}"${style}>${renderLine(line, inlineOptions)}</div>`);
    i++;
  }

  if (mathLines) {
    pushMathLines(mathLines, false);
  }

  return output.join("");
}

/** Prefix to start the next line with when Enter is pressed inside a list. */
export function continueList(line: string): string {
  const match = /^(\s*)([-*+]|(\d+)\.)( \[[ x]\])? /.exec(line);

  if (!match) {
    return "";
  }

  const [prefix, indent, bullet, ordinal, task] = match;

  if (line.length === prefix.length) {
    return "";
  }

  const nextBullet = ordinal ? `${Number(ordinal) + 1}.` : bullet;

  return `${indent}${nextBullet}${task ? " [ ]" : ""} `;
}

export function stripPrefix(line: string) {
  return line.replace(/^\s*(#{1,6} |> |([-*+]|\d+\.)( \[[ x]\])? |```|\$\$ ?)/, "");
}

export function applyPrefix(line: string, prefix: string) {
  return prefix + stripPrefix(line);
}
