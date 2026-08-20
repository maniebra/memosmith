import { applyOperator } from "./operators";
import type { Range } from "./textObjects";
import type { VimDoc, VimResult, VimState } from "./types";

export function unhandled(state: VimState): VimResult {
  return { handled: false, mode: state.mode };
}

export function done(state: VimState, result: VimResult): VimResult {
  state.count = "";
  state.operator = null;
  state.operatorCount = "";
  state.pending = null;

  if (result.mode !== "visual" && result.mode !== "visual-line") {
    state.anchor = null;
  }

  state.mode = result.mode;

  return result;
}

export function applyToRange(
  state: VimState,
  doc: VimDoc,
  operator: string,
  range: Range,
): VimResult {
  const result = applyOperator(state, doc, operator, range);

  return done(state, result);
}
