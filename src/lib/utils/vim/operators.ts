import { lineEnd, lineStart } from "./motions";
import type { Range } from "./textObjects";
import type { VimDoc, VimResult, VimState } from "./types";

export const SHIFT_WIDTH = "  ";

export function writeRegister(
  state: VimState,
  text: string,
  linewise: boolean,
) {
  const name = state.register ?? '"';

  state.registers[name] = { text, linewise };
  state.registers['"'] = { text, linewise };
  state.register = null;
}

export function readRegister(state: VimState) {
  const name = state.register ?? '"';

  state.register = null;

  return state.registers[name] ?? { text: "", linewise: false };
}

/** Grows a range to whole lines, including the newline that ends them. */
export function toLinewise(text: string, range: Range) {
  const start = lineStart(text, range.start);
  const end = lineEnd(text, Math.max(range.start, range.end - 1));

  return { start, end: Math.min(end + 1, text.length) };
}

function indentRange(text: string, range: Range, outdent: boolean) {
  const { start, end } = toLinewise(text, range);
  const lines = text.slice(start, end).split("\n");
  const shifted = lines.map((line) => {
    if (!line) {
      return line;
    }

    if (!outdent) {
      return SHIFT_WIDTH + line;
    }

    const width = line.length - line.trimStart().length;

    return line.slice(Math.min(width, SHIFT_WIDTH.length));
  });

  return { start, end, text: shifted.join("\n") };
}

function changeCase(text: string, range: Range, upper: boolean) {
  const slice = text.slice(range.start, range.end);

  return upper ? slice.toUpperCase() : slice.toLowerCase();
}

function deleteRange(
  state: VimState,
  doc: VimDoc,
  range: Range,
  change: boolean,
): VimResult {
  const linewise = Boolean(range.linewise);
  const span = linewise ? toLinewise(doc.text, range) : range;
  const removed = doc.text.slice(span.start, span.end);

  writeRegister(state, removed, linewise);

  // `cc` empties the line instead of removing it.
  const keepLine = change && linewise;
  const end = keepLine ? Math.max(span.start, span.end - 1) : span.end;

  return {
    handled: true,
    edit: { start: span.start, end, text: "" },
    caret: span.start,
    selection: null,
    mode: change ? "insert" : "normal",
  };
}

/** Applies `d`, `c`, `y`, `>`, `<`, `gu` or `gU` to a resolved range. */
export function applyOperator(
  state: VimState,
  doc: VimDoc,
  operator: string,
  range: Range,
): VimResult {
  if (operator === "d" || operator === "c") {
    return deleteRange(state, doc, range, operator === "c");
  }

  if (operator === "y") {
    const linewise = Boolean(range.linewise);
    const span = linewise ? toLinewise(doc.text, range) : range;

    writeRegister(state, doc.text.slice(span.start, span.end), linewise);

    return {
      handled: true,
      caret: span.start,
      selection: null,
      mode: "normal",
    };
  }

  if (operator === ">" || operator === "<") {
    const shifted = indentRange(doc.text, range, operator === "<");

    return {
      handled: true,
      edit: shifted,
      caret: shifted.start,
      selection: null,
      mode: "normal",
    };
  }

  const upper = operator === "gU";
  const span = range.linewise ? toLinewise(doc.text, range) : range;

  return {
    handled: true,
    edit: {
      start: span.start,
      end: span.end,
      text: changeCase(doc.text, span, upper),
    },
    caret: span.start,
    selection: null,
    mode: "normal",
  };
}
