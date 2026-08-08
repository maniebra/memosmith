import { GRAMMAR_MODES, isGrammarMode, type GrammarMode } from "../utils/grammar";
import {
  defaultAppearanceSettings,
  type AccentColor,
  type AppearanceSettings,
  type ColorMode,
  type CornerStyle,
  type Density,
  type EditorLineHeight,
  type FontChoice,
} from "../utils/theme";

const SETTINGS_KEY = "memosmith:settings";

export type ThemePreference = ColorMode;
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
  appearance: AppearanceSettings;
  editorWidth: EditorWidth;
  textSize: number;
  spellcheck: boolean;
  slashCommands: boolean;
  showPageTitle: boolean;
  spacePaneWidth: number;
  settingsPaneWidth: number;
  spacePaneOpen: boolean;
  grammarMode: GrammarMode;
  grammarProfiles: Record<GrammarMode, GrammarProfile>;
  llm: LlmSettings;
};

/** What a coach knows beyond the note itself, plus its own LLM overrides. */
export type GrammarProfile = {
  task: string;
  wordTarget: string;
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

/** An override field only counts when it is filled in, so a blank profile inherits everything. */
export const emptyLlmSettings: LlmSettings = Object.fromEntries(
  Object.keys(defaultLlmSettings).map((key) => [key, ""]),
) as LlmSettings;

export const emptyGrammarProfile: GrammarProfile = {
  task: "",
  wordTarget: "",
  llm: emptyLlmSettings,
};

export function mergeLlm(base: LlmSettings, override: LlmSettings): LlmSettings {
  const merged = { ...base };

  for (const key of Object.keys(merged) as (keyof LlmSettings)[]) {
    if (override[key].trim()) {
      merged[key] = override[key];
    }
  }

  return merged;
}

function defaultProfiles(): Record<GrammarMode, GrammarProfile> {
  return Object.fromEntries(
    GRAMMAR_MODES.map((mode) => [mode.id, { ...emptyGrammarProfile }]),
  ) as Record<GrammarMode, GrammarProfile>;
}

export const defaultSettings: AppSettings = {
  theme: "system",
  appearance: { ...defaultAppearanceSettings },
  editorWidth: "comfortable",
  textSize: 17,
  spellcheck: true,
  slashCommands: true,
  showPageTitle: true,
  spacePaneWidth: 240,
  settingsPaneWidth: 320,
  spacePaneOpen: true,
  grammarMode: "normal",
  grammarProfiles: defaultProfiles(),
  llm: defaultLlmSettings,
};

function readLlm(value: unknown, fallback = defaultLlmSettings): LlmSettings {
  const parsed = (value ?? {}) as Partial<LlmSettings>;
  const llm = { ...fallback };

  for (const key of Object.keys(llm) as (keyof LlmSettings)[]) {
    if (typeof parsed[key] === "string") {
      llm[key] = parsed[key];
    }
  }

  return llm;
}

function readProfiles(value: unknown): Record<GrammarMode, GrammarProfile> {
  const parsed = (value ?? {}) as Record<string, Partial<GrammarProfile>>;
  const profiles = defaultProfiles();

  for (const mode of GRAMMAR_MODES) {
    const stored = parsed[mode.id] ?? {};

    profiles[mode.id] = {
      task: typeof stored.task === "string" ? stored.task : "",
      wordTarget: typeof stored.wordTarget === "string" ? stored.wordTarget : "",
      llm: readLlm(stored.llm, emptyLlmSettings),
    };
  }

  return profiles;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAccentColor(value: unknown): value is AccentColor {
  return value === "emerald" || value === "sky" || value === "violet" || value === "rose" || value === "amber";
}

function isFontChoice(value: unknown): value is FontChoice {
  return value === "system" || value === "inter" || value === "serif" || value === "mono";
}

function isCornerStyle(value: unknown): value is CornerStyle {
  return value === "soft" || value === "rounded" || value === "square";
}

function isDensity(value: unknown): value is Density {
  return value === "comfortable" || value === "compact";
}

function isEditorLineHeight(value: unknown): value is EditorLineHeight {
  return value === "compact" || value === "comfortable" || value === "loose";
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

function readAppearance(value: unknown): AppearanceSettings {
  const parsed = (value ?? {}) as Partial<AppearanceSettings>;

  return {
    accentColor: isAccentColor(parsed.accentColor)
      ? parsed.accentColor
      : defaultAppearanceSettings.accentColor,
    uiFont: isFontChoice(parsed.uiFont) ? parsed.uiFont : defaultAppearanceSettings.uiFont,
    editorFont: isFontChoice(parsed.editorFont)
      ? parsed.editorFont
      : defaultAppearanceSettings.editorFont,
    cornerStyle: isCornerStyle(parsed.cornerStyle)
      ? parsed.cornerStyle
      : defaultAppearanceSettings.cornerStyle,
    density: isDensity(parsed.density) ? parsed.density : defaultAppearanceSettings.density,
    editorLineHeight: isEditorLineHeight(parsed.editorLineHeight)
      ? parsed.editorLineHeight
      : defaultAppearanceSettings.editorLineHeight,
  };
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
      appearance: readAppearance(parsed.appearance),
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
      grammarMode: isGrammarMode(parsed.grammarMode) ? parsed.grammarMode : defaultSettings.grammarMode,
      grammarProfiles: readProfiles(parsed.grammarProfiles),
      llm: readLlm(parsed.llm),
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
