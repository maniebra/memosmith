import type {
  KeybindingMode,
  KeybindingSettings,
} from "../storage/settingsTypes";

/**
 * Vim mode keeps the default app shortcuts: the vim keys themselves live in
 * the engine (`utils/vim`), which owns every key while the editor has focus.
 */
export const vimCombinations: Record<string, string> = {};

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
