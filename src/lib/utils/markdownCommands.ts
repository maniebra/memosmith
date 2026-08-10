import { DEFAULT_TABLE_MARKDOWN } from "./markdownTableModel";
import { DEFAULT_COLUMN_SUBBLOCKS } from "./markdownSubblocks";
import { insideFence } from "./markdownInline";

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
  { label: "Columns", hint: "side by side", prefix: DEFAULT_COLUMN_SUBBLOCKS },
  { label: "Divider", hint: "---", prefix: "---" },
  { label: "Text", hint: "plain", prefix: "" },
];

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

/** Prefix to start the next line with when Enter is pressed inside a blockquote/callout. */
export function continueQuote(line: string): string {
  const match = /^(\s*>\s?)/.exec(line);

  if (!match || line.length === match[0].length) {
    return "";
  }

  return match[0].endsWith(" ") ? match[0] : `${match[0]} `;
}

export function stripPrefix(line: string) {
  return line.replace(
    /^\s*(#{1,6} |> |([-*+]|\d+\.)( \[[ x]\])? |```|\$\$ ?)/,
    "",
  );
}

export function applyPrefix(line: string, prefix: string) {
  return prefix + stripPrefix(line);
}

/** A replacement plus where the caret lands, so any editable surface can apply it. */
export type TextEdit = {
  start: number;
  end: number;
  text: string;
  caret: number;
};

export type InlineMarker = "*" | "**";

export function lineStartAt(text: string, offset: number) {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

/** Enter: continue the list or quote, or drop an empty marker. */
export function enterEdit(
  value: string,
  offset: number,
  inCodeBlock = false,
): TextEdit {
  const start = lineStartAt(value, offset);

  if (inCodeBlock && insideFence(value.slice(0, start))) {
    return { start: offset, end: offset, text: "\n", caret: offset + 1 };
  }

  const line = value.slice(start, offset);
  const quotePrefix = continueQuote(line);
  const prefix = quotePrefix || continueList(line);

  if (
    (!quotePrefix && /^\s*>\s?$/.test(line)) ||
    (!prefix && /^\s*([-*+]|\d+\.)( \[[ x]\])? $/.test(line))
  ) {
    return { start, end: offset, text: "", caret: start };
  }

  return {
    start: offset,
    end: offset,
    text: `\n${prefix}`,
    caret: offset + 1 + prefix.length,
  };
}

export function tabEdit(
  value: string,
  offset: number,
  outdent: boolean,
): TextEdit {
  if (!outdent) {
    return { start: offset, end: offset, text: "  ", caret: offset + 2 };
  }

  const start = lineStartAt(value, offset);
  const line = value.slice(start, offset).replace(/^ {1,2}/, "");

  return { start, end: offset, text: line, caret: start + line.length };
}

/** Toggling bold or italic over a selection, or opening an empty pair. */
export function inlineMarkEdit(
  value: string,
  start: number,
  end: number,
  marker: InlineMarker,
): { edit: TextEdit; select: { start: number; end: number } | null } {
  const width = marker.length;

  if (start === end) {
    return {
      edit: { start, end, text: `${marker}${marker}`, caret: start + width },
      select: null,
    };
  }

  const selected = value.slice(start, end);
  const wrapped = selected.startsWith(marker) && selected.endsWith(marker);
  const adjacent =
    value.slice(start - width, start) === marker &&
    value.slice(end, end + width) === marker;

  if (wrapped) {
    const inner = selected.slice(width, selected.length - width);

    return {
      edit: { start, end, text: inner, caret: start },
      select: { start, end: start + inner.length },
    };
  }

  if (adjacent) {
    return {
      edit: {
        start: start - width,
        end: end + width,
        text: selected,
        caret: start - width,
      },
      select: { start: start - width, end: end - width },
    };
  }

  return {
    edit: {
      start,
      end,
      text: `${marker}${selected}${marker}`,
      caret: start + width,
    },
    select: { start: start + width, end: end + width },
  };
}
