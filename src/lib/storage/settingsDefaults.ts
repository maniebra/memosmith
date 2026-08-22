import { GRAMMAR_MODES, type GrammarMode } from "../utils/grammar";
import { defaultAppearanceSettings } from "../utils/theme";
import type {
  AppSettings,
  CalloutDefinition,
  FeatureSettings,
  GrammarProfile,
  KeybindingMode,
  KeybindingSettings,
  LlmSettings,
  LspSettings,
  MermaidSettings,
  PaletteColor,
  PlantumlSettings,
  RunnerSettings,
} from "./settingsTypes";
export const defaultLlmSettings: LlmSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  systemPrompt:
    "You write markdown notes. Answer with markdown content only, no preamble.",
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
export function mergeLlm(
  base: LlmSettings,
  override: LlmSettings,
): LlmSettings {
  const merged = { ...base };
  for (const key of Object.keys(merged) as (keyof LlmSettings)[]) {
    if (override[key].trim()) {
      merged[key] = override[key];
    }
  }
  return merged;
}
export function defaultProfiles(): Record<GrammarMode, GrammarProfile> {
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
  badges: true,
  drawings: false,
  diagrams: false,
  quizzes: true,
  codeExecution: false,
  lsp: false,
  plantuml: false,
  mermaid: false,
  windowControls: true,
};
export const defaultPlantumlSettings: PlantumlSettings = {
  command: "",
  server: "",
  format: "svg",
  theme: "",
};
export const defaultMermaidSettings: MermaidSettings = { theme: "default" };
export const defaultRunnerSettings: RunnerSettings = {
  commands: {
    bash: "",
    python: "",
    node: "",
    java: "",
    kotlin: "",
    r: "",
    cpp: "",
    rust: "",
    csharp: "",
  },
  timeoutMs: 30000,
  sharedKernel: true,
};
export const defaultLspSettings: LspSettings = {
  commands: {
    bash: "",
    python: "",
    node: "",
    java: "",
    kotlin: "",
    r: "",
    cpp: "",
    rust: "",
    csharp: "",
  },
};
/** Ids match what existing databases already store, so saved colours survive. */
export const defaultDatabasePalette: PaletteColor[] = [
  { id: "gray", label: "Gray", hex: "#78716c" },
  { id: "brown", label: "Brown", hex: "#92400e" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "green", label: "Green", hex: "#10b981" },
  { id: "blue", label: "Blue", hex: "#0ea5e9" },
  { id: "purple", label: "Purple", hex: "#8b5cf6" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "red", label: "Red", hex: "#f43f5e" },
];
/** Ids live inside notes as `==id|text==`, so renaming one drops its colour. */
export const defaultHighlightPalette: PaletteColor[] = [
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "green", label: "Green", hex: "#10b981" },
  { id: "blue", label: "Blue", hex: "#0ea5e9" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "orange", label: "Orange", hex: "#f97316" },
];
export const defaultCalloutDefinitions: CalloutDefinition[] = [
  { id: "note", label: "Note", color: "#2563eb", icon: "Info" },
  { id: "tip", label: "Tip", color: "#059669", icon: "Lightbulb" },
  { id: "important", label: "Important", color: "#7c3aed", icon: "BadgeAlert" },
  { id: "warning", label: "Warning", color: "#d97706", icon: "TriangleAlert" },
  { id: "danger", label: "Danger", color: "#dc2626", icon: "CircleX" },
  {
    id: "question",
    label: "Question",
    color: "#0891b2",
    icon: "CircleQuestionMark",
  },
];
export const KEYBINDING_MODES: KeybindingMode[] = ["default", "vim", "custom"];
export const defaultKeybindingSettings: KeybindingSettings = {
  mode: "default",
  combinations: {},
};
export const defaultSettings: AppSettings = {
  locale: "en",
  theme: "system",
  appearance: { ...defaultAppearanceSettings },
  features: { ...defaultFeatureSettings },
  keybindings: { ...defaultKeybindingSettings, combinations: {} },
  callouts: defaultCalloutDefinitions.map((callout) => ({ ...callout })),
  databasePalette: defaultDatabasePalette.map((color) => ({ ...color })),
  highlightPalette: defaultHighlightPalette.map((color) => ({ ...color })),
  runner: {
    commands: { ...defaultRunnerSettings.commands },
    timeoutMs: defaultRunnerSettings.timeoutMs,
    sharedKernel: defaultRunnerSettings.sharedKernel,
  },
  lsp: { commands: { ...defaultLspSettings.commands } },
  plantuml: { ...defaultPlantumlSettings },
  mermaid: { ...defaultMermaidSettings },
  editorWidth: "comfortable",
  textSize: 17,
  spellcheck: true,
  slashCommands: true,
  showPageTitle: true,
  focusOnOpen: true,
  logDir: "",
  spacePaneWidth: 240,
  settingsPaneWidth: 320,
  backlinksPaneWidth: 288,
  spacePaneOpen: true,
  backlinksPaneOpen: true,
  grammarMode: "normal",
  grammarProfiles: defaultProfiles(),
  llm: defaultLlmSettings,
};
