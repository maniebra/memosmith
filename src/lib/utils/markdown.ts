import hljs from "highlight.js/lib/common";
import katex from "katex";
import { assetFolder } from "./assets";

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
const INLINE = /`([^`\n]+)`|\$([^$\n]+)\$|\*\*([^*\n]+)\*\*|(?<![*\w])\*(\S|\S[^*\n]*\S)\*(?!\*)|\[([^\]\n]*)\]\(([^)\n]*)\)/g;
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

function renderInline(escaped: string) {
  return escaped.replace(INLINE, (all, code, math, bold, italic, linkText, href) => {
    if (code) {
      return `<span class="md-code">${mark("`")}${code}${mark("`")}</span>`;
    }

    if (math) {
      return renderInlineMath(math);
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

function tableCell(content: string, tag: "td" | "th", alignment: TableAlignment) {
  const align = alignment ? ` style="text-align:${alignment}"` : "";
  const body = renderInline(escapeHtml(content));

  return `<${tag}${align}>${body || emptyAnchor()}</${tag}>`;
}

function renderTable(lines: string[]) {
  const alignments = tableSeparator(lines[1]);

  if (!alignments) {
    return "";
  }

  const columns = Math.max(splitTableRow(lines[0]).length, alignments.length);
  const normalized = (line: string) => {
    const cells = splitTableRow(line).slice(0, columns);

    return [...cells, ...Array<string>(columns - cells.length).fill("")];
  };
  const header = normalized(lines[0]);
  const rows = lines.slice(2).map(normalized);

  return `<table class="md-table"><thead><tr>${header
    .map((cell, index) => tableCell(cell, "th", alignments[index] ?? null))
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((cell, index) => tableCell(cell, "td", alignments[index] ?? null)).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function isTableStart(lines: string[], index: number) {
  return index + 1 < lines.length && isTableRow(lines[index]) && tableSeparator(lines[index + 1]) !== null;
}

function isTableRow(line: string) {
  return splitTableRow(line).length > 1 || line.trim().startsWith("|");
}

function tableLine(line: string, group: number) {
  return `<div class="md-block md-table-line" data-table="${group}">${renderLine(line)}</div>`;
}

function tablePreview(lines: string[], group: number) {
  return `<div class="md-preview md-table-preview" data-table="${group}" contenteditable="false">${renderTable(
    lines,
  )}</div>`;
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
  { label: "Divider", hint: "---", prefix: "---" },
  { label: "Text", hint: "plain", prefix: "" },
];

const MEDIA_LINE = /^(\s*)!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;

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

export function renderLine(line: string) {
  if (!line) {
    return emptyAnchor();
  }

  const rule = blockRule(line);
  const prefix = rule?.hideMark ? rule.match.exec(line)![0] : "";
  const body = renderInline(escapeHtml(line.slice(prefix.length)));

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

export function renderDocument(text: string, resolveAsset?: (source: string) => string) {
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

      output.push(`<div class="md-block ${className}" data-code="${index}">${escapeHtml(line)}</div>`);
      i++;
      continue;
    }

    if (language !== null) {
      output.push(`<div class="md-block md-codeblock" data-code="${codeGroup}">${renderCode(line, language)}</div>`);
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

    const media = resolveAsset ? MEDIA_LINE.exec(line) : null;

    if (media) {
      output.push(
        `<div class="md-block md-media-line">${renderLine(line)}</div>`,
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
        output.push(tableLine(tableSourceLine, group));
      }

      output.push(tablePreview(tableLines, group));
      i = j;
      continue;
    }

    const indent = / */.exec(line)![0].length;
    const style = indent ? ` style="padding-left:${indent * 0.75}rem"` : "";

    output.push(`<div class="md-block ${lineClass(line)}"${style}>${renderLine(line)}</div>`);
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
