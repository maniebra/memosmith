import type { Editor } from "./types";

type InlineMarker = "*" | "**";
type SourceSelection = { start: number; end: number };

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

export function handleFormattingShortcut(event: KeyboardEvent, e: Editor) {
  const shortcut = event.ctrlKey || event.metaKey;

  if (!shortcut || event.altKey) {
    return false;
  }

  const key = event.key.toLowerCase();

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
