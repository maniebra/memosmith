const SETTINGS_KEY = "memosmith:settings";

export type ThemePreference = "system" | "light" | "dark";
export type EditorWidth = "focused" | "comfortable" | "wide";

export type AppSettings = {
  theme: ThemePreference;
  editorWidth: EditorWidth;
  textSize: number;
  spellcheck: boolean;
  slashCommands: boolean;
  showPageTitle: boolean;
  spacePaneWidth: number;
  settingsPaneWidth: number;
  spacePaneOpen: boolean;
};

export const defaultSettings: AppSettings = {
  theme: "system",
  editorWidth: "comfortable",
  textSize: 17,
  spellcheck: true,
  slashCommands: true,
  showPageTitle: true,
  spacePaneWidth: 240,
  settingsPaneWidth: 320,
  spacePaneOpen: true,
};

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isEditorWidth(value: unknown): value is EditorWidth {
  return value === "focused" || value === "comfortable" || value === "wide";
}

function clampTextSize(value: unknown) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return defaultSettings.textSize;
  }

  return Math.min(21, Math.max(15, size));
}

function clampPaneWidth(value: unknown, fallback: number) {
  const width = Number(value);

  if (!Number.isFinite(width)) {
    return fallback;
  }

  return Math.min(480, Math.max(180, width));
}

export function loadSettings(): AppSettings {
  const rawSettings = localStorage.getItem(SETTINGS_KEY);

  if (!rawSettings) {
    return { ...defaultSettings };
  }

  try {
    const parsed = JSON.parse(rawSettings) as Partial<AppSettings>;

    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : defaultSettings.theme,
      editorWidth: isEditorWidth(parsed.editorWidth) ? parsed.editorWidth : defaultSettings.editorWidth,
      textSize: clampTextSize(parsed.textSize),
      spellcheck: typeof parsed.spellcheck === "boolean" ? parsed.spellcheck : defaultSettings.spellcheck,
      slashCommands:
        typeof parsed.slashCommands === "boolean" ? parsed.slashCommands : defaultSettings.slashCommands,
      showPageTitle:
        typeof parsed.showPageTitle === "boolean" ? parsed.showPageTitle : defaultSettings.showPageTitle,
      spacePaneWidth: clampPaneWidth(parsed.spacePaneWidth, defaultSettings.spacePaneWidth),
      settingsPaneWidth: clampPaneWidth(parsed.settingsPaneWidth, defaultSettings.settingsPaneWidth),
      spacePaneOpen:
        typeof parsed.spacePaneOpen === "boolean" ? parsed.spacePaneOpen : defaultSettings.spacePaneOpen,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
