import type { GrammarMode } from "../utils/grammar";
import type { Locale } from "../i18n";
import type { Kernel } from "../utils/runner";
import type { AppearanceSettings, ColorMode } from "../utils/theme";

export type ThemePreference = ColorMode;
export type EditorWidth = "focused" | "comfortable" | "wide" | "full";
export type GrammarCheckMode = "auto-diff" | "auto-full" | "manual";

export type FeatureSettings = {
  grammarPolice: boolean;
  grammarCheckMode: GrammarCheckMode;
  databases: boolean;
  fancyTableEditor: boolean;
  callouts: boolean;
  badges: boolean;
  drawings: boolean;
  diagrams: boolean;
  quizzes: boolean;
  codeExecution: boolean;
  lsp: boolean;
  plantuml: boolean;
  mermaid: boolean;
  windowControls: boolean;
};

export type KeybindingMode = "default" | "vim" | "custom";

/**
 * Which shortcut layout is live. `custom` applies `combinations`, keyed by
 * binding name, on top of the default layout.
 */
export type KeybindingSettings = {
  mode: KeybindingMode;
  combinations: Record<string, string>;
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
  /** Shared Kernel: a note's cells see each other's variables instead of starting clean. */
  sharedKernel: boolean;
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

/** One swatch of the database chip palette; `id` is what a column stores. */
export type PaletteColor = {
  id: string;
  label: string;
  hex: string;
};

export type AppSettings = {
  locale: Locale;
  theme: ThemePreference;
  appearance: AppearanceSettings;
  features: FeatureSettings;
  keybindings: KeybindingSettings;
  callouts: CalloutDefinition[];
  databasePalette: PaletteColor[];
  /** Swatches the `==text==` highlight offers; `id` is what a note stores. */
  highlightPalette: PaletteColor[];
  runner: RunnerSettings;
  lsp: LspSettings;
  plantuml: PlantumlSettings;
  mermaid: MermaidSettings;
  editorWidth: EditorWidth;
  textSize: number;
  spellcheck: boolean;
  slashCommands: boolean;
  showPageTitle: boolean;
  focusOnOpen: boolean;
  /** Folder the debug journal writes into; empty means the app log folder. */
  logDir: string;
  spacePaneWidth: number;
  settingsPaneWidth: number;
  backlinksPaneWidth: number;
  spacePaneOpen: boolean;
  backlinksPaneOpen: boolean;
  grammarMode: GrammarMode;
  grammarProfiles: Record<GrammarMode, GrammarProfile>;
  llm: LlmSettings;
  gitlab: GitlabInstance[];
};

/** A GitLab server synced into a space database with a personal access token. */
export type GitlabInstance = {
  id: string;
  name: string;
  url: string;
  token: string;
  /** Group path to sync; empty syncs the token owner's own issues and MRs. */
  group: string;
  /** Minutes between automatic syncs; empty or 0 syncs only on demand. */
  interval: string;
};

/** What a coach knows beyond the note itself, plus its own LLM overrides. */
export type GrammarProfile = {
  task: string;
  wordTarget: string;
  llm: LlmSettings;
};
