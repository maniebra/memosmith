const SETTINGS_KEY = "memosmith:settings";

export type ThemePreference = "system" | "light" | "dark";
export type EditorWidth = "focused" | "comfortable" | "wide";

/** Every field is a string so an empty one simply means "leave it out of the request". */
export type LlmSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  reasoningEffort: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  presencePenalty: string;
  frequencyPenalty: string;
  seed: string;
  stop: string;
  extraBody: string;
};

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
  llm: LlmSettings;
};

export const defaultLlmSettings: LlmSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  systemPrompt: "You write markdown notes. Answer with markdown content only, no preamble.",
  reasoningEffort: "",
  temperature: "",
  topP: "",
  maxTokens: "",
  presencePenalty: "",
  frequencyPenalty: "",
  seed: "",
  stop: "",
  extraBody: "",
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
  llm: defaultLlmSettings,
};

function readLlm(value: unknown): LlmSettings {
  const parsed = (value ?? {}) as Partial<LlmSettings>;
  const llm = { ...defaultLlmSettings };

  for (const key of Object.keys(llm) as (keyof LlmSettings)[]) {
    if (typeof parsed[key] === "string") {
      llm[key] = parsed[key];
    }
  }

  return llm;
}

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
      llm: readLlm(parsed.llm),
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
