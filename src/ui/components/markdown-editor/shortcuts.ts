import type { Editor } from "./types";

type InlineMarker = "*" | "**";
type SourceSelection = { start: number; end: number };

const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

function prepareShortcut(event: KeyboardEvent, e: Editor) {
  event.preventDefault();
  event.stopPropagation();
  e.closeMenu();
  e.closeCompletions();
}

function selectAll(event: KeyboardEvent, e: Editor) {
  prepareShortcut(event, e);

  if (e.value) {
    e.selectRange(0, e.value.length);
  }

  e.markActiveBlock();
  return true;
}

function isWordCharacter(text: string, offset: number) {
  const character = text.slice(offset, offset + 1);

  return Boolean(character && WORD_CHARACTER.test(character));
}

function nextWordOffset(text: string, offset: number) {
  let next = Math.min(offset, text.length);

  while (next < text.length && isWordCharacter(text, next)) {
    next += 1;
  }

  while (next < text.length && !isWordCharacter(text, next)) {
    next += 1;
  }

  return next;
}

function previousWordOffset(text: string, offset: number) {
  let previous = Math.max(0, offset);

  while (previous > 0 && !isWordCharacter(text, previous - 1)) {
    previous -= 1;
  }

  while (previous > 0 && isWordCharacter(text, previous - 1)) {
    previous -= 1;
  }

  return previous;
}

function wordOffset(text: string, offset: number, direction: -1 | 1) {
  return direction === 1
    ? nextWordOffset(text, offset)
    : previousWordOffset(text, offset);
}

function blockDirection(e: Editor, offset: number) {
  const block = e.blockAtOffset(offset);

  return block ? getComputedStyle(block).direction : "ltr";
}

function selectionAnchorOffset(e: Editor) {
  const selection = getSelection();

  return selection?.anchorNode
    ? e.offsetForPosition(selection.anchorNode, selection.anchorOffset)
    : null;
}

function selectToOffset(e: Editor, anchor: number, focus: number) {
  const from = e.positionAtOffset(anchor);
  const to = e.positionAtOffset(focus);
  const selection = getSelection();

  if (!from || !to || !selection) {
    e.selectRange(Math.min(anchor, focus), Math.max(anchor, focus));
    return;
  }

  const range = document.createRange();

  range.setStart(from.node, from.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  if (selection.extend) {
    selection.extend(to.node, to.offset);
  } else {
    e.selectRange(Math.min(anchor, focus), Math.max(anchor, focus));
  }
}

function handleRtlWordNavigation(event: KeyboardEvent, e: Editor) {
  if (!event.ctrlKey || event.metaKey) {
    return false;
  }

  const offset = e.caretOffset();

  if (offset === null || blockDirection(e, offset) !== "rtl") {
    return false;
  }

  const direction = event.key === "ArrowLeft" ? 1 : -1;
  const next = wordOffset(e.value, offset, direction);

  prepareShortcut(event, e);

  if (event.shiftKey) {
    selectToOffset(e, selectionAnchorOffset(e) ?? offset, next);
  } else {
    e.setCaret(next);
  }

  e.markActiveBlock();
  return true;
}

function insertEmptyMark(
  e: Editor,
  selection: SourceSelection,
  marker: InlineMarker,
) {
  e.replace(
    selection.start,
    selection.end,
    `${marker}${marker}`,
    selection.start + marker.length,
  );
}

function removeSelectedMarks(
  e: Editor,
  selection: SourceSelection,
  selected: string,
  marker: InlineMarker,
) {
  const inner = selected.slice(marker.length, selected.length - marker.length);

  e.replace(selection.start, selection.end, inner, selection.start);
  e.selectRange(selection.start, selection.start + inner.length);
}

function removeAdjacentMarks(
  e: Editor,
  selection: SourceSelection,
  selected: string,
  marker: InlineMarker,
) {
  e.replace(
    selection.start - marker.length,
    selection.end + marker.length,
    selected,
    selection.start - marker.length,
  );
  e.selectRange(
    selection.start - marker.length,
    selection.end - marker.length,
  );
}

function wrapSelection(
  e: Editor,
  selection: SourceSelection,
  selected: string,
  marker: InlineMarker,
) {
  e.replace(
    selection.start,
    selection.end,
    `${marker}${selected}${marker}`,
    selection.start + marker.length,
  );
  e.selectRange(
    selection.start + marker.length,
    selection.end + marker.length,
  );
}

function toggleInlineMark(
  event: KeyboardEvent,
  e: Editor,
  marker: InlineMarker,
) {
  if (!e.props.editable) {
    return false;
  }

  const selection = e.selectionOffsets();

  if (!selection) {
    return false;
  }

  prepareShortcut(event, e);

  if (selection.start === selection.end) {
    insertEmptyMark(e, selection, marker);
    return true;
  }

  const selected = e.value.slice(selection.start, selection.end);
  const before = e.value.slice(
    selection.start - marker.length,
    selection.start,
  );
  const after = e.value.slice(selection.end, selection.end + marker.length);

  if (selected.startsWith(marker) && selected.endsWith(marker)) {
    removeSelectedMarks(e, selection, selected, marker);
  } else if (before === marker && after === marker) {
    removeAdjacentMarks(e, selection, selected, marker);
  } else {
    wrapSelection(e, selection, selected, marker);
  }

  return true;
}

export function handleEditorShortcut(event: KeyboardEvent, e: Editor) {
  const shortcut = event.ctrlKey || event.metaKey;

  if (!shortcut || event.altKey) {
    return false;
  }

  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "arrowright") {
    return handleRtlWordNavigation(event, e);
  }

  if (key === "a") {
    return selectAll(event, e);
  }

  if (key === "b") {
    return toggleInlineMark(event, e, "**");
  }

  if (key === "i") {
    return toggleInlineMark(event, e, "*");
  }

  return false;
}
