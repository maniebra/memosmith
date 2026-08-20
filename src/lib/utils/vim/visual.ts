import { applyOperator, toLinewise } from "./operators";
import { applyToRange, done } from "./session";
import type { Range } from "./textObjects";
import type { VimDoc, VimResult, VimState } from "./types";

export function visualRange(state: VimState, doc: VimDoc): Range {
  const anchor = state.anchor ?? doc.caret;
  const start = Math.min(anchor, doc.caret);
  const end = Math.max(anchor, doc.caret) + 1;

  return state.mode === "visual-line"
    ? { ...toLinewise(doc.text, { start, end }), linewise: true }
    : { start, end: Math.min(end, doc.text.length) };
}

export function handleVisualKey(
  state: VimState,
  doc: VimDoc,
  key: string,
): VimResult | null {
  if (key === "x" || key === "d" || key === "y" || key === "c") {
    const operator = key === "x" ? "d" : key;

    return applyToRange(state, doc, operator, visualRange(state, doc));
  }

  if (key === "p" || key === "P") {
    const deleted = applyOperator(state, doc, "d", visualRange(state, doc));

    return done(state, deleted);
  }

  if (key === "o") {
    const anchor = state.anchor ?? doc.caret;

    state.anchor = doc.caret;

    return { handled: true, caret: anchor, mode: state.mode };
  }

  return null;
}

export function startVisual(
  state: VimState,
  doc: VimDoc,
  line: boolean,
): VimResult {
  const mode = line ? "visual-line" : "visual";

  if (state.mode === mode) {
    return done(state, { handled: true, caret: doc.caret, mode: "normal" });
  }

  state.anchor = state.anchor ?? doc.caret;
  state.mode = mode;

  const range = visualRange(state, doc);

  return { handled: true, selection: range, caret: doc.caret, mode };
}
