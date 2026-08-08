import { GRAMMAR_MODES, isGrammarMode, type GrammarMode } from "../utils/grammar";
import { normalizeCalloutIcon } from "../utils/calloutIcons";
import type { Kernel } from "../utils/runner";
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
export type EditorWidth = "focused" | "comfortable" | "wide" | "full";
export type GrammarCheckMode = "auto-diff" | "auto-full" | "manual";

export type FeatureSettings = {
  grammarPolice: boolean;
  grammarCheckMode: GrammarCheckMode;
  databases: boolean;
  fancyTableEditor: boolean;
  callouts: boolean;
  drawings: boolean;
  diagrams: boolean;
  codeExecution: boolean;
  lsp: boolean;
  plantuml: boolean;
  mermaid: boolean;
};

export type PlantumlFormat = "svg" | "png" | "txt";

export type MermaidTheme = "default" | "dark" | "forest" | "neutral";

/** Mermaid renders in the page, so all it needs is which built-in theme to draw with. */
export type MermaidSettings = {
  theme: MermaidTheme;
};

/** Either a local binary/command or a PlantUML server URL; the server wins when both are set. */
export type PlantumlSettings = {
  command: string;
  server: string;
  format: PlantumlFormat;
  /** PlantUML theme name, injected as `!theme <name>`; empty leaves the diagram unthemed. */
  theme: string;
};

/** Interpreter paths, empty meaning "find it on PATH", plus the per-cell time limit. */
export type RunnerSettings = {
  commands: Record<Kernel, string>;
  timeoutMs: number;
};

/** Language server paths, empty meaning "find it on PATH". */
export type LspSettings = {
  commands: Record<Kernel, string>;
};

export type CalloutDefinition = {
  id: string;
  label: string;
  color: string;
  icon: string;
};

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
  features: FeatureSettings;
  callouts: CalloutDefinition[];
  runner: RunnerSettings;
  lsp: LspSettings;
  plantuml: PlantumlSettings;
  mermaid: MermaidSettings;
  editorWidth: EditorWidth;
  textSize: number;
  spellcheck: boolean;
  slashCommands: boolean;
  showPageTitle: boolean;
  spacePaneWidth: number;
  settingsPaneWidth: number;
  backlinksPaneWidth: number;
  spacePaneOpen: boolean;
  backlinksPaneOpen: boolean;
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

export const defaultFeatureSettings: FeatureSettings = {
  grammarPolice: true,
  grammarCheckMode: "auto-full",
  databases: true,
  fancyTableEditor: true,
  callouts: true,
  drawings: false,
  diagrams: false,
  codeExecution: false,
  lsp: false,
  plantuml: false,
  mermaid: false,
};

export const defaultPlantumlSettings: PlantumlSettings = {
  command: "",
  server: "",
  format: "svg",
  theme: "",
};

export const defaultMermaidSettings: MermaidSettings = { theme: "default" };

export const defaultRunnerSettings: RunnerSettings = {
  commands: { bash: "", python: "", node: "", java: "", kotlin: "", r: "", cpp: "", rust: "" },
  timeoutMs: 30000,
};

export const defaultLspSettings: LspSettings = {
  commands: { bash: "", python: "", node: "", java: "", kotlin: "", r: "", cpp: "", rust: "" },
};

export const defaultCalloutDefinitions: CalloutDefinition[] = [
  { id: "note", label: "Note", color: "#2563eb", icon: "Info" },
  { id: "tip", label: "Tip", color: "#059669", icon: "Lightbulb" },
  { id: "important", label: "Important", color: "#7c3aed", icon: "BadgeAlert" },
  { id: "warning", label: "Warning", color: "#d97706", icon: "TriangleAlert" },
  { id: "danger", label: "Danger", color: "#dc2626", icon: "CircleX" },
  { id: "question", label: "Question", color: "#0891b2", icon: "CircleQuestionMark" },
];

export const defaultSettings: AppSettings = {
  theme: "system",
  appearance: { ...defaultAppearanceSettings },
  features: { ...defaultFeatureSettings },
  callouts: defaultCalloutDefinitions.map((callout) => ({ ...callout })),
  runner: { commands: { ...defaultRunnerSettings.commands }, timeoutMs: defaultRunnerSettings.timeoutMs },
  lsp: { commands: { ...defaultLspSettings.commands } },
  plantuml: { ...defaultPlantumlSettings },
  mermaid: { ...defaultMermaidSettings },
  editorWidth: "comfortable",
  textSize: 17,
  spellcheck: true,
  slashCommands: true,
  showPageTitle: true,
  spacePaneWidth: 240,
  settingsPaneWidth: 320,
  backlinksPaneWidth: 288,
  spacePaneOpen: true,
  backlinksPaneOpen: true,
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
  return value === "focused" || value === "comfortable" || value === "wide" || value === "full";
}

function isGrammarCheckMode(value: unknown): value is GrammarCheckMode {
  return value === "auto-diff" || value === "auto-full" || value === "manual";
}

function normalizedCalloutId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

function normalizedCalloutColor(value: unknown) {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

function readCallouts(value: unknown): CalloutDefinition[] {
  if (!Array.isArray(value)) {
    return defaultCalloutDefinitions.map((callout) => ({ ...callout }));
  }

  const seen = new Set<string>();
  const callouts: CalloutDefinition[] = [];

  for (const entry of value as Partial<CalloutDefinition>[]) {
    const id = normalizedCalloutId(entry.id);
    const color = normalizedCalloutColor(entry.color);

    if (!id || !color || seen.has(id)) {
      continue;
    }

    seen.add(id);
    callouts.push({
      id,
      label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : id,
      color,
      icon: normalizeCalloutIcon(entry.icon),
    });
  }

  return callouts;
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

function readFeatures(value: unknown): FeatureSettings {
  const parsed = (value ?? {}) as Partial<FeatureSettings>;

  return {
    grammarPolice:
      typeof parsed.grammarPolice === "boolean"
        ? parsed.grammarPolice
        : defaultFeatureSettings.grammarPolice,
    grammarCheckMode: isGrammarCheckMode(parsed.grammarCheckMode)
      ? parsed.grammarCheckMode
      : defaultFeatureSettings.grammarCheckMode,
    databases:
      typeof parsed.databases === "boolean" ? parsed.databases : defaultFeatureSettings.databases,
    fancyTableEditor:
      typeof parsed.fancyTableEditor === "boolean"
        ? parsed.fancyTableEditor
        : defaultFeatureSettings.fancyTableEditor,
    callouts:
      typeof parsed.callouts === "boolean" ? parsed.callouts : defaultFeatureSettings.callouts,
    drawings:
      typeof parsed.drawings === "boolean" ? parsed.drawings : defaultFeatureSettings.drawings,
    diagrams:
      typeof parsed.diagrams === "boolean" ? parsed.diagrams : defaultFeatureSettings.diagrams,
    codeExecution:
      typeof parsed.codeExecution === "boolean"
        ? parsed.codeExecution
        : defaultFeatureSettings.codeExecution,
    lsp: typeof parsed.lsp === "boolean" ? parsed.lsp : defaultFeatureSettings.lsp,
    plantuml:
      typeof parsed.plantuml === "boolean" ? parsed.plantuml : defaultFeatureSettings.plantuml,
    mermaid: typeof parsed.mermaid === "boolean" ? parsed.mermaid : defaultFeatureSettings.mermaid,
  };
}

function readRunner(value: unknown): RunnerSettings {
  const parsed = (value ?? {}) as Partial<RunnerSettings>;
  const stored = (parsed.commands ?? {}) as Partial<Record<Kernel, string>>;
  const timeout = Number(parsed.timeoutMs);

  return {
    commands: Object.fromEntries(
      (Object.keys(defaultRunnerSettings.commands) as Kernel[]).map((kernel) => [
        kernel,
        typeof stored[kernel] === "string" ? stored[kernel] : "",
      ]),
    ) as Record<Kernel, string>,
    timeoutMs: Number.isFinite(timeout)
      ? Math.min(600000, Math.max(1000, timeout))
      : defaultRunnerSettings.timeoutMs,
  };
}

function readLsp(value: unknown): LspSettings {
  const stored = (((value ?? {}) as Partial<LspSettings>).commands ??
    {}) as Partial<Record<Kernel, string>>;

  return {
    commands: Object.fromEntries(
      (Object.keys(defaultLspSettings.commands) as Kernel[]).map((kernel) => [
        kernel,
        typeof stored[kernel] === "string" ? stored[kernel] : "",
      ]),
    ) as Record<Kernel, string>,
  };
}

function readPlantuml(value: unknown): PlantumlSettings {
  const parsed = (value ?? {}) as Partial<PlantumlSettings>;

  return {
    command: typeof parsed.command === "string" ? parsed.command : "",
    server: typeof parsed.server === "string" ? parsed.server : "",
    format:
      parsed.format === "png" || parsed.format === "txt" || parsed.format === "svg"
        ? parsed.format
        : defaultPlantumlSettings.format,
    theme: typeof parsed.theme === "string" ? parsed.theme : "",
  };
}

function readMermaid(value: unknown): MermaidSettings {
  const theme = ((value ?? {}) as Partial<MermaidSettings>).theme;

  return {
    theme:
      theme === "dark" || theme === "forest" || theme === "neutral" || theme === "default"
        ? theme
        : defaultMermaidSettings.theme,
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
      features: readFeatures(parsed.features),
      callouts: readCallouts(parsed.callouts),
      runner: readRunner(parsed.runner),
      lsp: readLsp(parsed.lsp),
      plantuml: readPlantuml(parsed.plantuml),
      mermaid: readMermaid(parsed.mermaid),
      editorWidth: isEditorWidth(parsed.editorWidth) ? parsed.editorWidth : defaultSettings.editorWidth,
      textSize: clampTextSize(parsed.textSize),
      spellcheck: typeof parsed.spellcheck === "boolean" ? parsed.spellcheck : defaultSettings.spellcheck,
      slashCommands:
        typeof parsed.slashCommands === "boolean" ? parsed.slashCommands : defaultSettings.slashCommands,
      showPageTitle:
        typeof parsed.showPageTitle === "boolean" ? parsed.showPageTitle : defaultSettings.showPageTitle,
      spacePaneWidth: clampPaneWidth(parsed.spacePaneWidth, defaultSettings.spacePaneWidth),
      settingsPaneWidth: clampPaneWidth(parsed.settingsPaneWidth, defaultSettings.settingsPaneWidth),
      backlinksPaneWidth: clampPaneWidth(parsed.backlinksPaneWidth, defaultSettings.backlinksPaneWidth),
      spacePaneOpen:
        typeof parsed.spacePaneOpen === "boolean" ? parsed.spacePaneOpen : defaultSettings.spacePaneOpen,
      backlinksPaneOpen:
        typeof parsed.backlinksPaneOpen === "boolean" ? parsed.backlinksPaneOpen : defaultSettings.backlinksPaneOpen,
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
