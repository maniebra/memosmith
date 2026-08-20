import { inlineMarkEdit, type InlineMarker } from "../../../lib/utils/markdown";
import {
  createKeybindings,
  type Keybinding,
} from "../../../lib/utils/keybindings";
import type { EditSurface } from "./surface";
import type { Editor } from "./types";

const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

function prepareShortcut(event: KeyboardEvent, e: Editor) {
  event.preventDefault();
  event.stopPropagation();
  e.closeMenu();
  e.closeCompletions();
}

function selectAll(event: KeyboardEvent, e: Editor, surface: EditSurface) {
  prepareShortcut(event, e);

  if (surface.text) {
    surface.select(0, surface.text.length);
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

function handleRtlWordNavigation(
  event: KeyboardEvent,
  e: Editor,
  surface: EditSurface,
) {
  if (!event.ctrlKey || event.metaKey || surface.direction !== "rtl") {
    return false;
  }

  const direction = event.key === "ArrowLeft" ? 1 : -1;
  const next = wordOffset(surface.text, surface.caret, direction);

  prepareShortcut(event, e);

  if (!event.shiftKey) {
    surface.setCaret(next);
  } else if (surface.subblock) {
    surface.select(surface.selection.start, next);
  } else {
    selectToOffset(e, surface.selection.start, next);
  }

  e.markActiveBlock();
  return true;
}

function toggleInlineMark(
  event: KeyboardEvent,
  e: Editor,
  surface: EditSurface,
  marker: InlineMarker,
) {
  if (!e.props.editable) {
    return false;
  }

  prepareShortcut(event, e);

  const { edit, select } = inlineMarkEdit(
    surface.text,
    surface.selection.start,
    surface.selection.end,
    marker,
  );

  surface.apply(edit);

  if (select) {
    surface.select(select.start, select.end);
  }

  return true;
}

type ShortcutContext = { e: Editor; surface: EditSurface };

function undoRedo(event: KeyboardEvent, { e }: ShortcutContext, redo: boolean) {
  if (!e.props.editable) {
    return false;
  }

  prepareShortcut(event, e);

  if (redo || event.shiftKey) {
    e.redo();
  } else {
    e.undo();
  }

  return true;
}

export const editorKeybindings: Keybinding<ShortcutContext>[] = [
  {
    combination: "mod+arrowleft",
    type: "combinational",
    name: "editor.rtlWordLeft",
    description: "Move or extend the caret by word in right-to-left text.",
    action: (event, { e, surface }) =>
      handleRtlWordNavigation(event, e, surface),
  },
  {
    combination: "mod+arrowright",
    type: "combinational",
    name: "editor.rtlWordRight",
    description: "Move or extend the caret by word in right-to-left text.",
    action: (event, { e, surface }) =>
      handleRtlWordNavigation(event, e, surface),
  },
  {
    combination: "mod+a",
    type: "combinational",
    name: "editor.selectAll",
    description: "Select the whole block.",
    action: (event, { e, surface }) => selectAll(event, e, surface),
  },
  {
    combination: "mod+f",
    type: "combinational",
    name: "editor.find",
    description: "Open the find bar.",
    action: (event, { e }) => {
      prepareShortcut(event, e);
      e.openFind(false);
    },
  },
  {
    combination: "mod+h",
    type: "combinational",
    name: "editor.replace",
    description: "Open the find bar in replace mode.",
    action: (event, { e }) => {
      prepareShortcut(event, e);
      e.openFind(true);
    },
  },
  {
    combination: "mod+z",
    type: "combinational",
    name: "editor.undo",
    description: "Undo the last edit (Shift redoes).",
    action: (event, context) => undoRedo(event, context, false),
  },
  {
    combination: "mod+shift+z",
    type: "combinational",
    name: "editor.redoAlternate",
    description: "Redo the last undone edit.",
    action: (event, context) => undoRedo(event, context, true),
  },
  {
    combination: "mod+y",
    type: "combinational",
    name: "editor.redo",
    description: "Redo the last undone edit.",
    action: (event, context) => undoRedo(event, context, true),
  },
  {
    combination: "mod+b",
    type: "combinational",
    name: "editor.bold",
    description: "Toggle bold around the selection.",
    action: (event, { e, surface }) =>
      toggleInlineMark(event, e, surface, "**"),
  },
  {
    combination: "mod+i",
    type: "combinational",
    name: "editor.italic",
    description: "Toggle italic around the selection.",
    action: (event, { e, surface }) => toggleInlineMark(event, e, surface, "*"),
  },
  {
    combination: "mod+u",
    type: "combinational",
    name: "editor.underline",
    description: "Toggle underline around the selection.",
    action: (event, { e, surface }) =>
      toggleInlineMark(event, e, surface, "__"),
  },
  {
    combination: "mod+shift+x",
    type: "combinational",
    name: "editor.strikethrough",
    description: "Toggle strikethrough around the selection.",
    action: (event, { e, surface }) =>
      toggleInlineMark(event, e, surface, "~~"),
  },
];

const runEditorKeybindings = createKeybindings(editorKeybindings);

export function handleEditorShortcut(
  event: KeyboardEvent,
  e: Editor,
  surface: EditSurface,
) {
  return runEditorKeybindings(event, { e, surface });
}
