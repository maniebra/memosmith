import type { TextEdit } from "../../../lib/utils/markdown";
import type { Editor } from "./types";

/**
 * One editable surface: the whole document, or a single column body. Offsets
 * are counted inside that surface only, so every markdown behaviour, Enter,
 * Tab, marks, the slash menu, works the same in both.
 */
export type EditSurface = {
  text: string;
  caret: number;
  selection: { start: number; end: number };
  /** The caret sits on a code line, so Enter must not add markdown prefixes. */
  inCodeBlock: boolean;
  direction: string;
  subblock: boolean;
  apply: (edit: TextEdit) => void;
  setCaret: (offset: number) => void;
  select: (start: number, end: number) => void;
};

function documentSurface(e: Editor): EditSurface | null {
  const caret = e.caretOffset();

  if (caret === null) {
    return null;
  }

  const block = e.blockAtOffset(caret);
  const selection = e.selectionOffsets() ?? { start: caret, end: caret };

  return {
    text: e.value,
    caret,
    selection,
    inCodeBlock: Boolean(block?.classList.contains("md-codeblock")),
    direction: block ? getComputedStyle(block).direction : "ltr",
    subblock: false,
    apply: (edit) => e.replace(edit.start, edit.end, edit.text, edit.caret),
    setCaret: (offset) => e.setCaret(offset),
    select: (start, end) => e.selectRange(start, end),
  };
}

export function editSurface(e: Editor, node: Node | null): EditSurface | null {
  const body = e.subblockBodyForNode(node ?? getSelection()?.focusNode ?? null);

  return body ? e.subblockSurface(body) : documentSurface(e);
}
