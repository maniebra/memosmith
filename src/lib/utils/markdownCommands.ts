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

export type InlineMarker = "*" | "**" | "~~" | "__";

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
    // Code has no list markers to continue, so carry the line's own indent.
    const indent = /^[ \t]*/.exec(value.slice(start, offset))![0];

    return {
      start: offset,
      end: offset,
      text: `\n${indent}`,
      caret: offset + 1 + indent.length,
    };
  }

  const line = value.slice(start, offset);
  const quotePrefix = continueQuote(line);
  const prefix = quotePrefix || continueList(line);

  const emptyItem = !prefix && /^\s*([-*+]|\d+\.)( \[[ x]\])? $/.test(line);

  if (emptyItem && /^[ \t]/.test(line)) {
    // An empty child steps back out to its parent's level, as in Obsidian.
    const strip = /^( {1,2}|\t)/.exec(line)![0].length;

    return { start, end: start + strip, text: "", caret: offset - strip };
  }

  if ((!quotePrefix && /^\s*>\s?$/.test(line)) || emptyItem) {
    return { start, end: offset, text: "", caret: start };
  }

  return {
    start: offset,
    end: offset,
    text: `\n${prefix}`,
    caret: offset + 1 + prefix.length,
  };
}

const INDENT = "  ";
const LIST_ITEM = /^[ \t]*([-*+]|\d+\.) /;

/** Leading whitespace in columns, a tab counting as one level. */
export function indentWidth(line: string) {
  return /^[ \t]*/.exec(line)![0].replace(/\t/g, INDENT).length;
}

function lineEndAt(text: string, offset: number) {
  const newline = text.indexOf("\n", offset);

  return newline === -1 ? text.length : newline;
}

type TabEdit = {
  edit: TextEdit;
  select: { start: number; end: number } | null;
};

/** Plain text: Tab types spaces, Shift+Tab takes them back off the line. */
function plainTabEdit(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): TabEdit {
  if (!outdent) {
    return {
      edit: { start, end, text: INDENT, caret: start + INDENT.length },
      select: null,
    };
  }

  const from = lineStartAt(value, start);
  const line = value.slice(from, start).replace(/^( {1,2}|\t)/, "");

  return {
    edit: { start: from, end: start, text: line, caret: from + line.length },
    select: null,
  };
}

/** Deeper lines below an item belong to it and travel with it. */
function childrenEnd(value: string, to: number, base: number) {
  while (to < value.length) {
    const next = value.slice(to + 1, lineEndAt(value, to + 1));

    if (!next.trim() || indentWidth(next) <= base) {
      break;
    }
    to += next.length + 1;
  }

  return to;
}

/** Where an old offset lands once each line got its new indent. */
function shiftedOffset(
  from: number,
  lines: string[],
  moved: string[],
  offset: number,
) {
  let oldAt = from;
  let newAt = from;

  for (let i = 0; i < lines.length; i++) {
    const oldEnd = oldAt + lines[i].length;

    if (offset <= oldEnd) {
      const shift = newAt - oldAt + moved[i].length - lines[i].length;

      return Math.max(newAt, offset + shift);
    }
    oldAt = oldEnd + 1;
    newAt += moved[i].length + 1;
  }

  return newAt - 1;
}

/**
 * Tab and Shift+Tab, the Obsidian way: a list item moves one level together
 * with its children, a selection moves line by line, and an item can sit at
 * most one level below the one above it. Plain text just gets spaces.
 * `null` means the key is swallowed with nothing to change.
 */
export function tabEdit(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): TabEdit | null {
  const from = lineStartAt(value, start);
  const first = value.slice(from, lineEndAt(value, from));
  // A selection ending at a line's start leaves that line alone.
  const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const listed = LIST_ITEM.test(first);

  if (!listed && !value.slice(from, last).includes("\n")) {
    return plainTabEdit(value, start, end, outdent);
  }

  const base = indentWidth(first);
  const above = from ? value.slice(lineStartAt(value, from - 1), from - 1) : "";
  const blocked = outdent
    ? base === 0
    : !LIST_ITEM.test(above) || indentWidth(above) < base;

  if (listed && blocked) {
    return null;
  }

  const to = lineEndAt(value, last);
  const lines = value
    .slice(from, listed ? childrenEnd(value, to, base) : to)
    .split("\n");
  const moved = lines.map((line) =>
    !line.trim()
      ? line
      : outdent
        ? line.replace(/^( {1,2}|\t)/, "")
        : INDENT + line,
  );
  const map = (offset: number) => shiftedOffset(from, lines, moved, offset);
  const text = moved.join("\n");

  return {
    edit: {
      start: from,
      end: from + lines.join("\n").length,
      text,
      caret: map(end),
    },
    select: start === end ? null : { start: map(start), end: map(end) },
  };
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
