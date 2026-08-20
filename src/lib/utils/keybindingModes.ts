import type {
  KeybindingMode,
  KeybindingSettings,
} from "../storage/settingsTypes";

/**
 * Vim-flavoured layout: `g`/`<space>` sequences for window-level commands.
 *
 * ponytail: remaps combinations only, there is no normal/insert mode, so
 * in-editor keys stay the default ones. Add a modal layer here if real vim
 * editing is wanted.
 */
export const vimCombinations: Record<string, string> = {
  "app.nextTab": "g t",
  "app.previousTab": "g shift+t",
  "app.closeTab": "space q",
  "app.settingsChord": "space s",
  "app.toggleSpacePane": "space e",
  "app.databases": "space d",
  "palette.toggleChord": "space p",
  "sidebar.refresh": "space r",
  "sidebar.newRootFolderChord": "space n",
};

/** The name-to-combination overrides a mode applies over the default layout. */
export function keybindingOverrides(
  settings: KeybindingSettings,
): Record<string, string> {
  const byMode: Record<KeybindingMode, Record<string, string>> = {
    default: {},
    vim: vimCombinations,
    custom: settings.combinations,
  };

  return byMode[settings.mode] ?? {};
}
