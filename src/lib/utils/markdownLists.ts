import type { TextEdit } from "./markdownCommands";

export function lineStartAt(text: string, offset: number) {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

const INDENT = "  ";
const LIST_ITEM = /^[ \t]*([-*+]|\d+\.) /;
const ORDERED = /^([ \t]*)(\d+)\. /;

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
  const renumbered = withRenumbering(value, {
    start: from,
    end: from + lines.join("\n").length,
    text: moved.join("\n"),
    caret: map(end),
  });
  const shift = (offset: number) => renumbered.map(map(offset));

  return {
    edit: renumbered.edit,
    select: start === end ? null : { start: shift(start), end: shift(end) },
  };
}

/** The list, as a run of lines, that the line at `index` belongs to. */
function listRun(lines: string[], index: number) {
  const inList = (line = "") =>
    LIST_ITEM.test(line) || (line.trim() !== "" && indentWidth(line) > 0);

  if (!inList(lines[index])) {
    return null;
  }

  let first = index;
  let last = index;

  while (first > 0 && inList(lines[first - 1])) {
    first--;
  }
  while (last < lines.length - 1 && inList(lines[last + 1])) {
    last++;
  }

  return { first, last };
}

/**
 * Ordered items count up again wherever the list now nests them, as in
 * Obsidian: the list's first number stands, a fresh sublist starts at 1.
 */
export function renumberLists(text: string, offset: number) {
  const lines = text.split("\n");
  const run = listRun(lines, text.slice(0, offset).split("\n").length - 1);
  const levels: { width: number; next: number | null }[] = [];

  for (let i = run?.first ?? 0; run && i <= run.last; i++) {
    if (!LIST_ITEM.test(lines[i])) {
      continue;
    }

    const width = indentWidth(lines[i]);

    while (levels.length && levels[levels.length - 1].width > width) {
      levels.pop();
    }
    if (levels[levels.length - 1]?.width !== width) {
      levels.push({ width, next: null });
    }

    const level = levels[levels.length - 1];
    const ordered = ORDERED.exec(lines[i]);

    if (!ordered) {
      level.next = null;
      continue;
    }

    const number = level.next ?? (levels.length === 1 ? +ordered[2] : 1);

    lines[i] = `${ordered[1]}${number}. ${lines[i].slice(ordered[0].length)}`;
    level.next = number + 1;
  }

  return lines.join("\n");
}

/** An edit plus the renumbering it sets off, as one edit on the old text. */
export function withRenumbering(value: string, edit: TextEdit) {
  const edited = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
  const fixed = renumberLists(edited, edit.caret);

  if (fixed === edited) {
    return { edit, map: (offset: number) => offset };
  }

  const map = (offset: number) =>
    shiftedOffset(0, edited.split("\n"), fixed.split("\n"), offset);
  let head = 0;
  let tail = 0;

  while (value[head] !== undefined && value[head] === fixed[head]) {
    head++;
  }
  while (
    tail < Math.min(value.length, fixed.length) - head &&
    value[value.length - 1 - tail] === fixed[fixed.length - 1 - tail]
  ) {
    tail++;
  }

  return {
    edit: {
      start: head,
      end: value.length - tail,
      text: fixed.slice(head, fixed.length - tail),
      caret: map(edit.caret),
    },
    map,
  };
}
