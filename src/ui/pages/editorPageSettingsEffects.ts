import { getCurrentWindow } from "@tauri-apps/api/window";
import { locale } from "../../lib/i18n";
import { saveSettings, type AppSettings } from "../../lib/storage/settings";
import { setJournalDir } from "../../lib/utils/journal";
import { keybindingOverrides } from "../../lib/utils/keybindingModes";
import { setKeybindingOverrides } from "../../lib/utils/keybindings";
import { palette } from "../../lib/utils/optionColors";
import { applyAppearanceTheme } from "../../lib/utils/theme";
import { setVimEnabled } from "../../lib/utils/vimMode";

/** Native buttons need the OS frame; every other choice draws its own. */
function setDecorations(on: boolean) {
  try {
    getCurrentWindow()
      .setDecorations(on)
      .catch(() => {});
  } catch {
    // Throws synchronously outside Tauri (plain browser dev).
  }
}

/** Everything outside the page that a settings change has to reach. */
export function applySettingsEffects(
  settings: AppSettings,
  prefersDark: boolean,
) {
  setKeybindingOverrides(keybindingOverrides(settings.keybindings));
  setVimEnabled(settings.keybindings.mode === "vim");
  locale.set(settings.locale);
  document.documentElement.lang = settings.locale;
  setDecorations(
    settings.features.windowControls &&
      settings.appearance.windowButtons === "native",
  );
  applyAppearanceTheme(
    settings.theme,
    settings.appearance,
    prefersDark,
    settings.features.badges,
  );
  // Database chips read the palette from a store, not from drilled props.
  palette.set(settings.databasePalette);
  saveSettings(settings);
  setJournalDir(settings.logDir);
}
