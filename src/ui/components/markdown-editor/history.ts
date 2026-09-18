import type { Editor } from "./types";

export type HistoryApi = {
  /** Remembers the text as it was before the write about to happen. */
  recordHistory: (previous: string) => void;
  resetHistory: () => void;
  undo: () => boolean;
  redo: () => boolean;
};

type Snapshot = { value: string; caret: number | null };

type State = {
  past: Snapshot[];
  future: Snapshot[];
  lastAt: number;
  lastBlock: number;
  applying: boolean;
};

/** Keystrokes closer together than this join the entry before them. */
const COALESCE_MS = 500;
const LIMIT = 200;

function step(
  getEditor: () => Editor,
  state: State,
  from: Snapshot[],
  to: Snapshot[],
) {
  const entry = from.pop();

  if (!entry) {
    return false;
  }

  const e = getEditor();

  to.push({ value: e.value, caret: e.caretOffset() });
  state.applying = true;
  e.value = entry.value;
  state.applying = false;
  e.render(
    entry.caret === null ? null : Math.min(entry.caret, entry.value.length),
  );
  e.props.onInput();
  state.lastAt = 0;
  state.lastBlock = -1;

  return true;
}

function record(getEditor: () => Editor, state: State, previous: string) {
  if (state.applying) {
    return;
  }

  const now = Date.now();
  const e = getEditor();
  const caret = e.caretOffset();
  // The DOM still holds the pre-write text, so this is the block being edited.
  // Compared by index, not identity: a render replaces every block element.
  const block = e.blocks().indexOf(e.blockAtOffset(caret ?? 0)!);

  state.future = [];

  if (
    state.past.length &&
    now - state.lastAt < COALESCE_MS &&
    block === state.lastBlock
  ) {
    state.lastAt = now;
    return;
  }

  state.lastAt = now;
  state.lastBlock = block;
  state.past.push({ value: previous, caret });

  if (state.past.length > LIMIT) {
    state.past.shift();
  }
}

export function createHistory(getEditor: () => Editor): HistoryApi {
  const state: State = {
    past: [],
    future: [],
    lastAt: 0,
    lastBlock: -1,
    applying: false,
  };

  return {
    recordHistory: (previous) => record(getEditor, state, previous),
    resetHistory() {
      state.past = [];
      state.future = [];
      state.lastAt = 0;
      state.lastBlock = -1;
    },
    undo: () => step(getEditor, state, state.past, state.future),
    redo: () => step(getEditor, state, state.future, state.past),
  };
}
