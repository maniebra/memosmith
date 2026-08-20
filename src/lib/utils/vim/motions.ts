import type { FindKind } from "./types";

const WORD = /[\p{L}\p{N}_]/u;
const BLANK = /\s/;

export type CharClass = "word" | "punctuation" | "blank";

export function classOf(text: string, offset: number): CharClass {
  const character = text.slice(offset, offset + 1);

  if (!character || BLANK.test(character)) {
    return "blank";
  }

  return WORD.test(character) ? "word" : "punctuation";
}

export function lineStart(text: string, offset: number) {
  return text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
}

export function lineEnd(text: string, offset: number) {
  const end = text.indexOf("\n", offset);

  return end === -1 ? text.length : end;
}

export function firstNonBlank(text: string, offset: number) {
  const start = lineStart(text, offset);
  const end = lineEnd(text, offset);
  let at = start;

  while (at < end && BLANK.test(text[at])) {
    at += 1;
  }

  return at;
}

export function lineNumber(text: string, offset: number) {
  let line = 0;

  for (let at = text.indexOf("\n"); at !== -1 && at < offset;) {
    line += 1;
    at = text.indexOf("\n", at + 1);
  }

  return line;
}

export function offsetOfLine(text: string, line: number) {
  let at = 0;

  for (let seen = 0; seen < line; seen += 1) {
    const next = text.indexOf("\n", at);

    if (next === -1) {
      return at;
    }

    at = next + 1;
  }

  return at;
}

export function lastLineStart(text: string) {
  return lineStart(text, text.length);
}

/** Vim keeps the caret on a character, so it never sits on the newline. */
export function clampToLine(text: string, offset: number) {
  const start = lineStart(text, offset);
  const end = lineEnd(text, offset);

  return Math.max(start, Math.min(offset, Math.max(start, end - 1)));
}

export function wordForward(text: string, offset: number, big: boolean) {
  let at = Math.min(offset, text.length);
  const from = big ? "blank" : classOf(text, at);

  while (at < text.length && classOf(text, at) === from && from !== "blank") {
    at += 1;
  }

  if (big) {
    while (at < text.length && classOf(text, at) !== "blank") {
      at += 1;
    }
  }

  while (at < text.length && classOf(text, at) === "blank") {
    at += 1;
  }

  return at;
}

export function wordBackward(text: string, offset: number, big: boolean) {
  let at = Math.max(0, offset - 1);

  while (at > 0 && classOf(text, at) === "blank") {
    at -= 1;
  }

  const from = big ? "any" : classOf(text, at);
  const same = (position: number) =>
    big
      ? classOf(text, position) !== "blank"
      : classOf(text, position) === from;

  while (at > 0 && same(at - 1)) {
    at -= 1;
  }

  return at;
}

export function wordEnd(text: string, offset: number, big: boolean) {
  let at = Math.min(offset + 1, text.length);

  while (at < text.length && classOf(text, at) === "blank") {
    at += 1;
  }

  const from = big ? "any" : classOf(text, at);
  const same = (position: number) =>
    big
      ? classOf(text, position) !== "blank"
      : classOf(text, position) === from;

  while (at + 1 < text.length && same(at + 1)) {
    at += 1;
  }

  return at;
}

/** Paragraph motions: the next or previous blank line. */
export function paragraph(text: string, offset: number, forward: boolean) {
  const step = forward ? 1 : -1;
  let line = lineNumber(text, offset) + step;

  while (line > 0 && offsetOfLine(text, line) < text.length) {
    const start = offsetOfLine(text, line);

    if (!text.slice(start, lineEnd(text, start)).trim()) {
      return start;
    }

    line += step;
  }

  return forward ? text.length : 0;
}

export function findChar(
  text: string,
  offset: number,
  kind: FindKind,
  char: string,
  count: number,
) {
  const forward = kind === "f" || kind === "t";
  const start = lineStart(text, offset);
  const end = lineEnd(text, offset);
  let at = offset;

  for (let step = 0; step < count; step += 1) {
    const from = forward ? at + 1 : at - 1;
    const next = forward
      ? text.indexOf(char, kind === "t" && step === 0 ? from + 1 : from)
      : text.lastIndexOf(char, kind === "T" && step === 0 ? from - 1 : from);

    if (next === -1 || next < start || next >= end + 1) {
      return null;
    }

    at = next;
  }

  if (kind === "t") {
    return at - 1;
  }

  return kind === "T" ? at + 1 : at;
}

/** The other end of the bracket pair at or after the caret. */
export function matchingBracket(text: string, offset: number) {
  const pairs = "()[]{}";
  const end = lineEnd(text, offset);
  let at = offset;

  while (at < end && !pairs.includes(text[at])) {
    at += 1;
  }

  if (at >= end) {
    return null;
  }

  const index = pairs.indexOf(text[at]);
  const forward = index % 2 === 0;
  const open = pairs[forward ? index : index - 1];
  const close = pairs[forward ? index + 1 : index];
  const step = forward ? 1 : -1;
  let depth = 0;

  for (let scan = at; scan >= 0 && scan < text.length; scan += step) {
    if (text[scan] === open) {
      depth += forward ? 1 : -1;
    } else if (text[scan] === close) {
      depth += forward ? -1 : 1;
    }

    if (depth === 0) {
      return scan;
    }
  }

  return null;
}

/** `j` / `k`, keeping the desired column where the line is long enough. */
export function verticalMove(
  text: string,
  offset: number,
  lines: number,
  desiredColumn: number | null,
) {
  const column = desiredColumn ?? offset - lineStart(text, offset);
  const line = lineNumber(text, offset) + lines;

  if (line < 0) {
    return { offset: firstNonBlank(text, 0), column };
  }

  const start = offsetOfLine(text, Math.max(0, line));
  const end = lineEnd(text, start);

  return { offset: Math.min(start + column, Math.max(start, end)), column };
}
