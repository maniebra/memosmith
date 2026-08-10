import { preferredTextDirection } from "./textDirection";
import {
  attribute,
  escapeHtml,
  lineClass,
  renderLine,
  type RenderInlineOptions,
} from "./markdownInline";

export const DEFAULT_COLUMN_SUBBLOCKS = [
  ":::columns",
  "Left subblock",
  ":::---",
  "Right subblock",
  ":::",
].join("\n");

export const DEFAULT_VERTICAL_SUBBLOCKS = DEFAULT_COLUMN_SUBBLOCKS;
export const COLUMN_SUBBLOCK_OPEN = /^\s*:::(columns|vertical)\s*$/i;
export const COLUMN_SUBBLOCK_CLOSE = /^\s*:::\s*$/;
const COLUMN_SUBBLOCK_DIVIDER = /^\s*:::---\s*$/;
/** Blocks written before the divider got its own marker still say "---". */
const LEGACY_SUBBLOCK_DIVIDER = /^\s*---\s*$/;
const SOURCE_BLOCK_OPEN = ":::columns";
const SOURCE_BLOCK_CLOSE = ":::";
const SOURCE_BLOCK_DIVIDER = ":::---";

/**
 * A plain "---" is a horizontal rule, so it only splits columns in a block
 * that has no ":::---" of its own.
 */
function dividerTest(lines: string[]) {
  return lines.some((line) => COLUMN_SUBBLOCK_DIVIDER.test(line))
    ? COLUMN_SUBBLOCK_DIVIDER
    : LEGACY_SUBBLOCK_DIVIDER;
}
type MarkdownRenderer = (source: string) => string;

function subblockSourceClass(
  line: string,
  index: number,
  count: number,
  divider: RegExp,
) {
  return [
    "md-subblocks-line",
    index === 0 ? "md-subblocks-open" : "",
    index === count - 1 ? "md-subblocks-close" : "",
    divider.test(line) ? "md-subblocks-divider" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function verticalSubblockLine(
  line: string,
  group: number,
  index: number,
  count: number,
  closed: boolean,
  options: RenderInlineOptions,
  divider: RegExp = COLUMN_SUBBLOCK_DIVIDER,
) {
  const marker =
    index === 0 || index === count - 1 || divider.test(line);
  const direction = preferredTextDirection(line);
  const content = marker || closed
    ? escapeHtml(line) || "<br>"
    : renderLine(line, options);
  const closedAttr = closed ? " data-closed" : "";

  return `<div dir="${direction}" class="md-block ${subblockSourceClass(
    line,
    index,
    count,
    divider,
  )}" data-subblocks="${group}"${closedAttr}>${content}</div>`;
}

/** Only the outermost divider splits: a nested block keeps its own lines. */
function splitSubblocks(lines: string[]) {
  const groups: string[][] = [[]];
  const divider = dividerTest(lines);
  let depth = 0;

  for (const line of lines.slice(1, -1)) {
    if (depth === 0 && divider.test(line)) {
      groups.push([]);
      continue;
    }

    if (COLUMN_SUBBLOCK_OPEN.test(line)) {
      depth++;
    } else if (COLUMN_SUBBLOCK_CLOSE.test(line)) {
      depth = Math.max(0, depth - 1);
    }

    groups[groups.length - 1].push(line);
  }

  return groups;
}

export function verticalSubblocksPreview(
  lines: string[],
  group: number,
  renderMarkdown: MarkdownRenderer,
) {
  const groups = splitSubblocks(lines);
  const previewDirection = preferredTextDirection(lines.join("\n"));
  const subblocks = groups
    .map((subblock, index) => {
      const source = subblock.join("\n");
      const direction = preferredTextDirection(source);
      const body = renderMarkdown(source);
      const sectionAttrs =
        `dir="${direction}" class="md-subblock"` +
        ` data-subblock-index="${index}"`;
      const bodyAttrs =
        `class="md-subblock-body" data-subblock-body="${index}"` +
        ` contenteditable="true"`;

      return [
        `<section ${sectionAttrs}><div ${bodyAttrs}>`,
        body,
        "</div></section>",
      ].join("");
    })
    .join("");
  const previewGroup = attribute(String(group));

  return [
    `<div dir="${previewDirection}" class="md-preview md-subblocks-preview"`,
    ` data-subblocks="${previewGroup}" contenteditable="false">`,
    subblocks,
    "</div>",
  ].join("");
}

export function renderVerticalSubblocks(
  lines: string[],
  index: number,
  group: number,
  options: RenderInlineOptions,
  renderMarkdown: MarkdownRenderer,
) {
  const blockLines = [lines[index]];
  let next = index + 1;
  let closed = false;
  let depth = 0;

  while (next < lines.length) {
    const line = lines[next];

    blockLines.push(line);
    next++;

    if (COLUMN_SUBBLOCK_OPEN.test(line)) {
      depth++;
    } else if (COLUMN_SUBBLOCK_CLOSE.test(line)) {
      if (depth === 0) {
        closed = true;
        break;
      }
      depth--;
    }
  }

  const divider = dividerTest(blockLines);
  const source = blockLines
    .map((line, lineIndex) =>
      verticalSubblockLine(
        line,
        group,
        lineIndex,
        blockLines.length,
        closed,
        options,
        divider,
      ),
    )
    .join("");
  const preview = closed
    ? verticalSubblocksPreview(blockLines, group, renderMarkdown)
    : "";

  return { html: `${source}${preview}`, next };
}

export function serializeColumnSubblocks(columns: string[]) {
  return [
    SOURCE_BLOCK_OPEN,
    ...columns.flatMap((column, index) => [
      ...(index === 0 ? [] : [SOURCE_BLOCK_DIVIDER]),
      ...(column ? column.split("\n") : [""]),
    ]),
    SOURCE_BLOCK_CLOSE,
  ].join("\n");
}

export function renderMarkdownLines(
  source: string,
  options: RenderInlineOptions,
) {
  return source
    .split("\n")
    .map(
      (line) =>
        `<div dir="auto" class="md-block ${lineClass(line)}">${renderLine(
          line,
          options,
        )}</div>`,
    )
    .join("");
}
