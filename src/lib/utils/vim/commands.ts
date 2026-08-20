import { clampToLine, firstNonBlank, lineEnd, lineStart } from "./motions";
import { applyOperator, readRegister, writeRegister } from "./operators";
import type { VimDoc, VimResult, VimState } from "./types";

function edit(
  start: number,
  end: number,
  text: string,
  caret: number,
  mode: VimResult["mode"] = "normal",
): VimResult {
  return {
    handled: true,
    edit: { start, end, text },
    caret,
    selection: null,
    mode,
  };
}

function deleteChars(
  state: VimState,
  doc: VimDoc,
  count: number,
  back: boolean,
) {
  const { text, caret } = doc;
  const start = back ? Math.max(lineStart(text, caret), caret - count) : caret;
  const end = back ? caret : Math.min(lineEnd(text, caret), caret + count);

  writeRegister(state, text.slice(start, end), false);

  return edit(start, end, "", clampToLine(text, start));
}

function openLine(doc: VimDoc, below: boolean): VimResult {
  const { text, caret } = doc;
  const start = lineStart(text, caret);
  const indent = text.slice(start, firstNonBlank(text, caret));
  const at = below ? lineEnd(text, caret) : start;
  const inserted = below ? `\n${indent}` : `${indent}\n`;

  return edit(
    at,
    at,
    inserted,
    at + inserted.length - (below ? 0 : 1),
    "insert",
  );
}

function paste(state: VimState, doc: VimDoc, count: number, before: boolean) {
  const { text, caret } = doc;
  const register = readRegister(state);

  if (!register.text) {
    return { handled: true, mode: "normal" as const };
  }

  const body = register.text.repeat(count);

  if (!register.linewise) {
    const at = before ? caret : Math.min(caret + 1, lineEnd(text, caret));

    return edit(at, at, body, at + body.length - 1);
  }

  const at = before ? lineStart(text, caret) : lineEnd(text, caret) + 1;
  const block = body.endsWith("\n") ? body : `${body}\n`;
  const safe = Math.min(at, text.length);
  const insert =
    safe === text.length && !text.endsWith("\n") ? `\n${block}` : block;

  return edit(
    safe,
    safe,
    insert,
    firstNonBlank(text, safe + (insert.length - block.length)),
  );
}

function joinLines(doc: VimDoc, count: number): VimResult {
  const { text, caret } = doc;
  const start = lineEnd(text, caret);
  let end = start;
  let joined = "";
  let caretAt = start;

  for (let line = 0; line < Math.max(1, count - 1); line += 1) {
    if (end >= text.length) {
      break;
    }

    const nextEnd = lineEnd(text, end + 1);
    const body = text.slice(end + 1, nextEnd).trimStart();

    caretAt = start + joined.length;
    joined += body ? ` ${body}` : "";
    end = nextEnd;
  }

  return end === start
    ? { handled: true, mode: "normal" }
    : edit(start, end, joined, caretAt);
}

function replaceChar(doc: VimDoc, count: number, char: string): VimResult {
  const end = Math.min(lineEnd(doc.text, doc.caret), doc.caret + count);

  if (end - doc.caret < count) {
    return { handled: true, mode: "normal" };
  }

  return edit(doc.caret, end, char.repeat(count), end - 1);
}

function toggleCase(doc: VimDoc, count: number): VimResult {
  const end = Math.min(lineEnd(doc.text, doc.caret), doc.caret + count);
  const slice = doc.text.slice(doc.caret, end);
  const flipped = [...slice]
    .map((char) =>
      char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase(),
    )
    .join("");

  return edit(doc.caret, end, flipped, clampToLine(doc.text, end));
}

function insertAt(doc: VimDoc, key: string): VimResult {
  const { text, caret } = doc;
  const offsets: Record<string, number> = {
    i: caret,
    a: Math.min(caret + 1, lineEnd(text, caret)),
    I: firstNonBlank(text, caret),
    A: lineEnd(text, caret),
  };

  return {
    handled: true,
    caret: offsets[key],
    selection: null,
    mode: "insert",
  };
}

/** Normal-mode commands that are not an operator plus a motion. */
export function runCommand(
  state: VimState,
  doc: VimDoc,
  key: string,
  count: number,
  argument: string,
): VimResult | null {
  if (key === "x" || key === "X") {
    return deleteChars(state, doc, count, key === "X");
  }

  if (key === "D" || key === "C" || key === "Y") {
    const range = { start: doc.caret, end: lineEnd(doc.text, doc.caret) };
    const operator = key === "D" ? "d" : key === "C" ? "c" : "y";

    return applyOperator(state, doc, operator, range);
  }

  if (key === "s") {
    return { ...deleteChars(state, doc, count, false), mode: "insert" };
  }

  if (key === "S") {
    const range = { start: doc.caret, end: doc.caret, linewise: true };

    return applyOperator(state, doc, "c", range);
  }

  if (key === "p" || key === "P") {
    return paste(state, doc, count, key === "P");
  }

  if (key === "o" || key === "O") {
    return openLine(doc, key === "o");
  }

  if (["i", "a", "I", "A"].includes(key)) {
    return insertAt(doc, key);
  }

  if (key === "J") {
    return joinLines(doc, count);
  }

  if (key === "r") {
    return replaceChar(doc, count, argument);
  }

  if (key === "~") {
    return toggleCase(doc, count);
  }

  return null;
}
