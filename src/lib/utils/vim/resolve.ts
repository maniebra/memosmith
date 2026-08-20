import {
  findChar,
  firstNonBlank,
  lastLineStart,
  lineEnd,
  lineStart,
  matchingBracket,
  offsetOfLine,
  paragraph,
  verticalMove,
  wordBackward,
  wordEnd,
  wordForward,
} from "./motions";
import type { FindKind, VimDoc, VimState } from "./types";

export type MotionResult = {
  offset: number;
  /** The character under the target belongs to the range, as in `e` or `f`. */
  inclusive?: boolean;
  linewise?: boolean;
  column?: number | null;
};

const FIND_KEYS = new Set(["f", "F", "t", "T"]);

function repeat(count: number, from: number, step: (at: number) => number) {
  let at = from;

  for (let index = 0; index < count; index += 1) {
    at = step(at);
  }

  return at;
}

function horizontal(doc: VimDoc, key: string, count: number): MotionResult {
  const { text, caret } = doc;
  const back = key === "h" || key === "ArrowLeft" || key === "Backspace";
  const offset = back
    ? Math.max(lineStart(text, caret), caret - count)
    : Math.min(lineEnd(text, caret), caret + count);

  return { offset, column: null };
}

function vertical(
  state: VimState,
  doc: VimDoc,
  key: string,
  count: number,
): MotionResult {
  const down =
    key === "j" || key === "ArrowDown" || key === "+" || key === "\n";
  const moved = verticalMove(
    doc.text,
    doc.caret,
    down ? count : -count,
    state.desiredColumn,
  );

  return { offset: moved.offset, linewise: true, column: moved.column };
}

function words(doc: VimDoc, key: string, count: number): MotionResult {
  const big = key === key.toUpperCase();
  const lower = key.toLowerCase();

  if (lower === "w") {
    return {
      offset: repeat(count, doc.caret, (at) => wordForward(doc.text, at, big)),
      column: null,
    };
  }

  if (lower === "b") {
    return {
      offset: repeat(count, doc.caret, (at) => wordBackward(doc.text, at, big)),
      column: null,
    };
  }

  return {
    offset: repeat(count, doc.caret, (at) => wordEnd(doc.text, at, big)),
    inclusive: true,
    column: null,
  };
}

function find(
  state: VimState,
  doc: VimDoc,
  key: string,
  count: number,
  argument: string,
): MotionResult | null {
  const repeated = key === ";" || key === ",";
  const last = state.lastFind;

  if (repeated && !last) {
    return null;
  }

  const flip: Record<FindKind, FindKind> = { f: "F", F: "f", t: "T", T: "t" };
  const kind = repeated
    ? key === ";"
      ? last!.kind
      : flip[last!.kind]
    : (key as FindKind);
  const char = repeated ? last!.char : argument;
  const offset = findChar(doc.text, doc.caret, kind, char, count);

  if (!repeated) {
    state.lastFind = { kind: key as FindKind, char };
  }

  return offset === null
    ? null
    : { offset, inclusive: kind === "f" || kind === "t", column: null };
}

function lineJump(
  doc: VimDoc,
  key: string,
  count: number | null,
): MotionResult {
  const target =
    count === null
      ? key === "G"
        ? lastLineStart(doc.text)
        : 0
      : offsetOfLine(doc.text, count - 1);

  return { offset: firstNonBlank(doc.text, target), linewise: true };
}

/** `0`, `^`, `$` and `|`: motions that stay on the current line. */
function withinLine(
  doc: VimDoc,
  key: string,
  times: number,
): MotionResult | null {
  const { text, caret } = doc;

  if (key === "0") {
    return { offset: lineStart(text, caret), column: null };
  }

  if (key === "^") {
    return { offset: firstNonBlank(text, caret), column: null };
  }

  if (key === "$") {
    return {
      offset: Math.max(lineStart(text, caret), lineEnd(text, caret)),
      column: null,
    };
  }

  if (key === "|") {
    const target = lineStart(text, caret) + times - 1;

    return { offset: Math.min(target, lineEnd(text, caret)) };
  }

  return null;
}

/** Turns a motion key into a target offset, or null when the motion fails. */
export function resolveMotion(
  state: VimState,
  doc: VimDoc,
  key: string,
  count: number | null,
  argument = "",
): MotionResult | null {
  const times = count ?? 1;
  const { text, caret } = doc;

  if (["h", "l", "ArrowLeft", "ArrowRight", " ", "Backspace"].includes(key)) {
    return horizontal(doc, key === " " ? "l" : key, times);
  }

  if (["j", "k", "ArrowDown", "ArrowUp", "+", "-", "Enter"].includes(key)) {
    return vertical(state, doc, key === "Enter" ? "j" : key, times);
  }

  if (["w", "W", "b", "B", "e", "E"].includes(key)) {
    return words(doc, key, times);
  }

  if (FIND_KEYS.has(key) || key === ";" || key === ",") {
    return find(state, doc, key, times, argument);
  }

  const within = withinLine(doc, key, times);

  if (within) {
    return within;
  }

  if (key === "G" || key === "gg") {
    return lineJump(doc, key === "G" ? "G" : "gg", count);
  }

  if (key === "g_") {
    const line = text.slice(lineStart(text, caret), lineEnd(text, caret));

    return {
      offset: lineStart(text, caret) + line.trimEnd().length - 1,
      inclusive: true,
    };
  }

  if (key === "{" || key === "}") {
    return { offset: paragraph(text, caret, key === "}"), column: null };
  }

  if (key === "%") {
    const match = matchingBracket(text, caret);

    return match === null ? null : { offset: match, inclusive: true };
  }

  return null;
}

export function isMotionKey(key: string) {
  return (
    ["h", "l", "j", "k", "w", "W", "b", "B", "e", "E", "0", "^", "$", "|"]
      .concat(["{", "}", "%", "G", "gg", "g_", ";", ",", "Enter", "Backspace"])
      .concat([
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        " ",
        "+",
        "-",
      ])
      .includes(key) || FIND_KEYS.has(key)
  );
}
