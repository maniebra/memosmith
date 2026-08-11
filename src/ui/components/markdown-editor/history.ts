import type { Editor } from "./types";

export type HistoryApi = {
  /** Remembers the text as it was before the write about to happen. */
  recordHistory: (previous: string) => void;
  resetHistory: () => void;
  undo: () => boolean;
  redo: () => boolean;
};

type Snapshot = { value: string; caret: number | null };

/** Keystrokes closer together than this join the entry before them. */
const COALESCE_MS = 500;
const LIMIT = 200;

export function createHistory(getEditor: () => Editor): HistoryApi {
  let past: Snapshot[] = [];
  let future: Snapshot[] = [];
  let lastAt = 0;
  let lastBlock = -1;
  let applying = false;

  function step(from: Snapshot[], to: Snapshot[]) {
    const entry = from.pop();

    if (!entry) {
      return false;
    }

    const e = getEditor();

    to.push({ value: e.value, caret: e.caretOffset() });
    applying = true;
    e.value = entry.value;
    applying = false;
    e.render(
      entry.caret === null
        ? null
        : Math.min(entry.caret, entry.value.length),
    );
    e.props.onInput();
    lastAt = 0;
    lastBlock = -1;
    return true;
  }

  return {
    recordHistory(previous: string) {
      if (applying) {
        return;
      }

      const now = Date.now();
      const e = getEditor();
      const caret = e.caretOffset();
      // The DOM still holds the pre-write text, so this is the block being edited.
      // Compared by index, not identity: a render replaces every block element.
      const block = e.blocks().indexOf(e.blockAtOffset(caret ?? 0)!);

      future = [];

      if (past.length && now - lastAt < COALESCE_MS && block === lastBlock) {
        lastAt = now;
        return;
      }

      lastAt = now;
      lastBlock = block;
      past.push({ value: previous, caret });

      if (past.length > LIMIT) {
        past.shift();
      }
    },
    resetHistory() {
      past = [];
      future = [];
      lastAt = 0;
      lastBlock = -1;
    },
    undo: () => step(past, future),
    redo: () => step(future, past),
  };
}
