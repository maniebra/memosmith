import { runCommand } from "./commands";
import { applyToRange, done, unhandled } from "./session";
import { finishRecording, record, repeatLastChange } from "./repeat";
import {
  clampToLine,
  lineEnd,
  lineNumber,
  lineStart,
  offsetOfLine,
  wordEnd,
} from "./motions";
import { isMotionKey, resolveMotion, type MotionResult } from "./resolve";
import { textObject, type Range } from "./textObjects";
import { handleVisualKey, startVisual, visualRange } from "./visual";
import type { VimDoc, VimResult, VimState } from "./types";

const OPERATORS = ["d", "c", "y", ">", "<"];
const PENDING_KEYS = ["g", "f", "F", "t", "T", "r", '"', "i", "a", "Z"];

function takeCount(state: VimState) {
  const typed = state.count ? Number(state.count) : null;
  const operator = state.operatorCount ? Number(state.operatorCount) : null;

  if (typed === null && operator === null) {
    return null;
  }

  return (typed ?? 1) * (operator ?? 1);
}

function motionRange(doc: VimDoc, motion: MotionResult): Range {
  const start = Math.min(doc.caret, motion.offset);
  const end = Math.max(doc.caret, motion.offset) + (motion.inclusive ? 1 : 0);

  return { start, end, linewise: motion.linewise };
}

/** `cw` behaves like `ce`, one of vim's oldest special cases. */
function changeWordRange(doc: VimDoc, count: number): Range {
  let at = doc.caret;

  for (let step = 0; step < count; step += 1) {
    at = wordEnd(doc.text, step === 0 ? at - 1 : at, false);
  }

  return { start: doc.caret, end: at + 1 };
}

function moveCaret(
  state: VimState,
  doc: VimDoc,
  motion: MotionResult,
): VimResult {
  state.desiredColumn = motion.column ?? null;

  const visual = state.mode === "visual" || state.mode === "visual-line";
  const caret = visual
    ? Math.max(0, Math.min(motion.offset, doc.text.length - 1))
    : clampToLine(doc.text, motion.offset);

  return {
    handled: true,
    caret,
    selection: visual
      ? {
          start: Math.min(state.anchor ?? caret, caret),
          end: Math.max(state.anchor ?? caret, caret) + 1,
        }
      : null,
    mode: state.mode,
  };
}

/** The `count` whole lines starting at the caret, as `3dd` needs. */
function lineRange(doc: VimDoc, count: number): Range {
  const start = lineStart(doc.text, doc.caret);
  const last = offsetOfLine(
    doc.text,
    lineNumber(doc.text, doc.caret) + count - 1,
  );

  return {
    start,
    end: Math.min(lineEnd(doc.text, last) + 1, doc.text.length),
    linewise: true,
  };
}

function handleOperatorKey(
  state: VimState,
  doc: VimDoc,
  key: string,
): VimResult {
  const operator = key === "g" ? state.pending : key;

  if (
    state.mode === "visual" ||
    state.mode === "visual-line" ||
    state.operator === operator
  ) {
    const range =
      state.mode === "normal"
        ? lineRange(doc, takeCount(state) ?? 1)
        : visualRange(state, doc);

    return applyToRange(state, doc, operator ?? key, range);
  }

  state.operator = operator ?? key;
  state.operatorCount = state.count;
  state.count = "";

  return { handled: true, mode: state.mode };
}

function handleTextObject(
  state: VimState,
  doc: VimDoc,
  key: string,
): VimResult {
  const around = state.pending === "a";
  const range = textObject(doc.text, doc.caret, around, key);

  if (!range) {
    return done(state, { handled: true, mode: state.mode });
  }

  if (state.operator) {
    return applyToRange(state, doc, state.operator, range);
  }

  state.pending = null;
  state.anchor = range.start;

  return {
    handled: true,
    caret: Math.max(range.start, range.end - 1),
    selection: { start: range.start, end: range.end },
    mode: state.mode,
  };
}

function handleMotion(
  state: VimState,
  doc: VimDoc,
  key: string,
  argument: string,
): VimResult | null {
  const count = takeCount(state);
  const motion = resolveMotion(state, doc, key, count, argument);

  if (!motion) {
    return done(state, { handled: true, mode: state.mode });
  }

  if (!state.operator) {
    return done(state, moveCaret(state, doc, motion));
  }

  const range =
    state.operator === "c" && (key === "w" || key === "W")
      ? changeWordRange(doc, count ?? 1)
      : motionRange(doc, motion);

  return applyToRange(state, doc, state.operator, range);
}

function handlePending(
  state: VimState,
  doc: VimDoc,
  key: string,
): VimResult | null {
  const pending = state.pending;

  if (!pending) {
    return null;
  }

  if (pending === '"') {
    state.pending = null;
    state.register = key;

    return { handled: true, mode: state.mode };
  }

  if (pending === "i" || pending === "a") {
    return handleTextObject(state, doc, key);
  }

  if (pending === "r") {
    return done(
      state,
      runCommand(state, doc, "r", takeCount(state) ?? 1, key)!,
    );
  }

  if (pending === "g") {
    return handleGoPrefix(state, doc, key);
  }

  state.pending = null;

  return handleMotion(state, doc, pending, key);
}

function handleGoPrefix(
  state: VimState,
  doc: VimDoc,
  key: string,
): VimResult | null {
  state.pending = null;

  if (key === "u" || key === "U") {
    return handleOperatorKey(state, doc, key === "u" ? "gu" : "gU");
  }

  if (key === "g" || key === "_") {
    return handleMotion(state, doc, key === "g" ? "gg" : "g_", "");
  }

  if (key === "t" || key === "T") {
    const command = key === "t" ? "nextTab" : "previousTab";

    return done(state, { handled: true, mode: state.mode, command });
  }

  return done(state, { handled: true, mode: state.mode });
}

function handleInsert(state: VimState, doc: VimDoc, key: string): VimResult {
  if (key !== "Escape") {
    return unhandled(state);
  }

  state.mode = "normal";
  state.desiredColumn = null;
  finishRecording(state, "normal");

  return {
    handled: true,
    caret: Math.max(lineStart(doc.text, doc.caret), doc.caret - 1),
    selection: null,
    mode: "normal",
  };
}

function handleNormalKey(
  state: VimState,
  doc: VimDoc,
  key: string,
  ctrl: boolean,
): VimResult {
  if (ctrl) {
    return key === "r"
      ? done(state, { handled: true, mode: "normal", command: "redo" })
      : unhandled(state);
  }

  if (key === "Escape") {
    const busy =
      state.mode !== "normal" || state.operator || state.pending || state.count;

    // A bare Escape in normal mode belongs to the app, e.g. closing a dialog.
    return busy
      ? done(state, { handled: true, caret: doc.caret, mode: "normal" })
      : unhandled(state);
  }

  if (/[1-9]/.test(key) || (key === "0" && state.count)) {
    state.count += key;

    return { handled: true, mode: state.mode };
  }

  const pendingResult = handlePending(state, doc, key);

  if (pendingResult) {
    return pendingResult;
  }

  return handleFreshKey(state, doc, key);
}

function handleFreshKey(state: VimState, doc: VimDoc, key: string): VimResult {
  if (PENDING_KEYS.includes(key) && (key !== "i" || state.operator)) {
    if (key !== "a" || state.operator) {
      state.pending = key;

      return { handled: true, mode: state.mode };
    }
  }

  if (key === "v" || key === "V") {
    return startVisual(state, doc, key === "V");
  }

  const visual =
    state.mode !== "normal" ? handleVisualKey(state, doc, key) : null;

  if (visual) {
    return visual;
  }

  if (OPERATORS.includes(key)) {
    return handleOperatorKey(state, doc, key);
  }

  if (isMotionKey(key)) {
    return handleMotion(state, doc, key, "")!;
  }

  if (key === "u") {
    return done(state, { handled: true, mode: "normal", command: "undo" });
  }

  if (key === "/" || key === "?") {
    return done(state, { handled: true, mode: "normal", command: "find" });
  }

  if (key === "n" || key === "N") {
    const command = key === "n" ? "findNext" : "findPrevious";

    return done(state, { handled: true, mode: "normal", command });
  }

  const command = runCommand(state, doc, key, takeCount(state) ?? 1, "");

  if (command) {
    return done(state, command);
  }

  // An unmapped printable key must not reach the note as text.
  return done(state, { handled: key.length === 1, mode: state.mode });
}

/**
 * Feeds one key to the engine and returns what the editor should do with it.
 * Everything here is text and offsets, so it is testable without a DOM.
 */
export function handleVimKey(
  state: VimState,
  doc: VimDoc,
  key: string,
  ctrl = false,
): VimResult {
  if (state.mode === "insert") {
    record(state, key);

    return handleInsert(state, doc, key);
  }

  if (key === "." && state.lastChange) {
    return repeatLastChange(state, doc);
  }

  record(state, key);

  const result = handleNormalKey(state, doc, key, ctrl);

  finishRecording(state, result.mode);

  return result;
}
