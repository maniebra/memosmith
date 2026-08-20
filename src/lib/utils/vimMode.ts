import { writable } from "svelte/store";
import { setVimNormal } from "./keybindings";
import { createVimState, type VimMode } from "./vim/types";

/** Shown in the status bar so the current mode is visible. */
export const vimSubMode = writable<VimMode | null>(null);

/** One engine state for the app: registers and `.` survive note switches. */
export const vimState = createVimState();

let enabled = false;

export function isVimEnabled() {
  return enabled;
}

export function syncVimMode(mode: VimMode) {
  vimState.mode = mode;
  vimSubMode.set(enabled ? mode : null);
  setVimNormal(enabled && mode !== "insert");
}

/** Turns vim mode on or off, following the keybinding mode setting. */
export function setVimEnabled(next: boolean) {
  enabled = next;
  syncVimMode(next ? "normal" : "insert");
}
