import { runKeybinding } from "../../../lib/utils/keybindings";
import { handleVimKey } from "../../../lib/utils/vim/engine";
import type { VimCommand, VimResult } from "../../../lib/utils/vim/types";
import {
  isVimEnabled,
  syncVimMode,
  vimState,
} from "../../../lib/utils/vimMode";
import type { EditSurface } from "./surface";
import { hideBlockCaret, showBlockCaret } from "./vimCaret";
import type { Editor } from "./types";

const IGNORED = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

/** Drives the caret shape in CSS: block in normal and visual, bar in insert. */
function showMode(e: Editor, mode: VimResult["mode"] | null) {
  const element = e.element;

  if (!element) {
    return;
  }

  if (mode) {
    element.dataset.vimMode = mode;
  } else {
    delete element.dataset.vimMode;
  }
}

function paintCaret(e: Editor, mode: VimResult["mode"] | null, offset: number) {
  showBlockCaret(e, offset, mode === "normal");
}

function runEditorCommand(e: Editor, command: VimCommand) {
  const commands: Record<VimCommand, () => void> = {
    undo: () => e.undo(),
    redo: () => e.redo(),
    find: () => e.openFind(false),
    findNext: () => e.openFind(false),
    findPrevious: () => e.openFind(false),
    nextTab: () => runKeybinding("app.nextTab"),
    previousTab: () => runKeybinding("app.previousTab"),
  };

  commands[command]();
}

function applyResult(e: Editor, surface: EditSurface, result: VimResult) {
  if (result.edit) {
    const caret = result.caret ?? result.edit.start;

    surface.apply({ ...result.edit, caret });
  } else if (result.selection) {
    surface.select(result.selection.start, result.selection.end);
  } else if (typeof result.caret === "number") {
    surface.setCaret(result.caret);
  }

  if (result.command) {
    runEditorCommand(e, result.command);
  }

  syncVimMode(result.mode);
}

/**
 * Feeds editor keys to the vim engine. Normal and visual mode swallow the key,
 * insert mode lets the editor handle it exactly as before.
 */
export function handleVimKeydown(
  event: KeyboardEvent,
  e: Editor,
  surface: EditSurface,
) {
  if (!isVimEnabled()) {
    showMode(e, null);
    hideBlockCaret();

    return false;
  }

  if (IGNORED.has(event.key)) {
    return false;
  }

  // Ctrl/Cmd shortcuts stay available; only `Ctrl+R` means redo to vim.
  const modified = event.ctrlKey || event.metaKey || event.altKey;

  if (modified && !(event.ctrlKey && event.key.toLowerCase() === "r")) {
    return false;
  }

  const doc = {
    text: surface.text,
    caret: surface.caret,
    selection: surface.selection,
  };
  const result = handleVimKey(vimState, doc, event.key, event.ctrlKey);

  if (!result.handled) {
    syncVimMode(result.mode);
    showMode(e, result.mode);
    hideBlockCaret();

    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  e.closeMenu();
  e.closeCompletions();
  applyResult(e, surface, result);
  showMode(e, result.mode);
  paintCaret(e, result.mode, result.caret ?? surface.caret);

  return true;
}
