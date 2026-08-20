import { handleVimKey } from "./engine";
import type { VimDoc, VimResult, VimState } from "./types";

const CHANGES = "xXsSDCYpPoOiIaAJr~<>dcy.";

function isChange(key: string) {
  return CHANGES.includes(key);
}

export function record(state: VimState, key: string) {
  if (state.recording) {
    state.recording.push(key);
  } else if (isChange(key) && key !== ".") {
    state.recording = [key];
  }
}

export function finishRecording(state: VimState, mode: VimResult["mode"]) {
  const waiting = state.operator || state.pending || state.count;

  if (state.recording && mode !== "insert" && !waiting) {
    state.lastChange = state.recording;
    state.recording = null;
  }
}

/** `.` replays the keys of the last change, typed text included. */
export function repeatLastChange(state: VimState, doc: VimDoc): VimResult {
  const keys = state.lastChange ?? [];
  const replay = { ...doc };
  let result: VimResult = { handled: true, mode: state.mode };

  state.recording = null;

  for (const key of keys) {
    const step =
      state.mode === "insert" && key.length === 1
        ? insertLiteral(replay, key)
        : handleVimKey(state, replay, key);

    applyToReplay(replay, step);
    result = { ...step, edit: undefined };
  }

  return {
    ...result,
    edit: { start: 0, end: doc.text.length, text: replay.text },
    caret: replay.caret,
    mode: state.mode === "insert" ? "normal" : state.mode,
  };
}

function insertLiteral(doc: VimDoc, key: string): VimResult {
  return {
    handled: true,
    edit: { start: doc.caret, end: doc.caret, text: key },
    caret: doc.caret + 1,
    mode: "insert",
  };
}

function applyToReplay(doc: VimDoc, result: VimResult) {
  if (result.edit) {
    doc.text =
      doc.text.slice(0, result.edit.start) +
      result.edit.text +
      doc.text.slice(result.edit.end);
  }

  if (typeof result.caret === "number") {
    doc.caret = result.caret;
    doc.selection = { start: result.caret, end: result.caret };
  }
}
