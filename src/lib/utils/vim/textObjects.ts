import {
  classOf,
  lineEnd,
  lineNumber,
  lineStart,
  offsetOfLine,
} from "./motions";

export type Range = { start: number; end: number; linewise?: boolean };

const PAIRS: Record<string, [string, string]> = {
  "(": ["(", ")"],
  ")": ["(", ")"],
  b: ["(", ")"],
  "[": ["[", "]"],
  "]": ["[", "]"],
  "{": ["{", "}"],
  "}": ["{", "}"],
  B: ["{", "}"],
  "<": ["<", ">"],
  ">": ["<", ">"],
};

const QUOTES = ["'", '"', "`"];

function word(text: string, offset: number, around: boolean): Range {
  const from = classOf(text, offset);
  let start = offset;
  let end = offset;

  while (start > 0 && classOf(text, start - 1) === from) {
    start -= 1;
  }

  while (end + 1 < text.length && classOf(text, end + 1) === from) {
    end += 1;
  }

  if (!around) {
    return { start, end: end + 1 };
  }

  let after = end + 1;

  while (after < text.length && classOf(text, after) === "blank") {
    after += 1;
  }

  if (after === end + 1) {
    while (start > 0 && classOf(text, start - 1) === "blank") {
      start -= 1;
    }
  }

  return { start, end: after };
}

function pair(
  text: string,
  offset: number,
  [open, close]: [string, string],
  around: boolean,
): Range | null {
  let depth = 0;
  let start = -1;

  for (let at = offset; at >= 0; at -= 1) {
    if (text[at] === close && at !== offset) {
      depth += 1;
    } else if (text[at] === open) {
      if (depth === 0) {
        start = at;
        break;
      }

      depth -= 1;
    }
  }

  if (start === -1) {
    return null;
  }

  depth = 0;

  for (let at = start + 1; at < text.length; at += 1) {
    if (text[at] === open) {
      depth += 1;
    } else if (text[at] === close) {
      if (depth === 0) {
        return around ? { start, end: at + 1 } : { start: start + 1, end: at };
      }

      depth -= 1;
    }
  }

  return null;
}

function quoted(
  text: string,
  offset: number,
  quote: string,
  around: boolean,
): Range | null {
  const start = lineStart(text, offset);
  const end = lineEnd(text, offset);
  const positions: number[] = [];

  for (let at = start; at < end; at += 1) {
    if (text[at] === quote && text[at - 1] !== "\\") {
      positions.push(at);
    }
  }

  for (let index = 0; index + 1 < positions.length; index += 2) {
    const [open, close] = [positions[index], positions[index + 1]];

    if (offset <= close) {
      return around
        ? { start: open, end: close + 1 }
        : { start: open + 1, end: close };
    }
  }

  return null;
}

function paragraphObject(text: string, offset: number, around: boolean): Range {
  const blank = (line: number) => {
    const start = offsetOfLine(text, line);

    return !text.slice(start, lineEnd(text, start)).trim();
  };

  let first = lineNumber(text, offset);
  let last = first;

  while (first > 0 && !blank(first - 1)) {
    first -= 1;
  }

  while (offsetOfLine(text, last + 1) < text.length && !blank(last + 1)) {
    last += 1;
  }

  if (around) {
    while (offsetOfLine(text, last + 1) < text.length && blank(last + 1)) {
      last += 1;
    }
  }

  const start = offsetOfLine(text, first);
  const end = lineEnd(text, offsetOfLine(text, last));

  return { start, end, linewise: true };
}

/** `iw`, `aw`, `i(`, `a"`, `ip`, ... resolved against the caret. */
export function textObject(
  text: string,
  offset: number,
  around: boolean,
  key: string,
): Range | null {
  if (key === "w" || key === "W") {
    return word(text, offset, around);
  }

  if (key === "p") {
    return paragraphObject(text, offset, around);
  }

  if (QUOTES.includes(key)) {
    return quoted(text, offset, key, around);
  }

  const brackets = PAIRS[key];

  return brackets ? pair(text, offset, brackets, around) : null;
}
