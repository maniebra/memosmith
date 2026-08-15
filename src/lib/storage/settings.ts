import {
  GRAMMAR_MODES,
  isGrammarMode,
  type GrammarMode,
} from "../utils/grammar";
import { isLocale } from "../i18n";
import { normalizeCalloutIcon } from "../utils/calloutIcons";
import { readPalette } from "./settingsPalette";
import type { Kernel } from "../utils/runner";
import {
  defaultAppearanceSettings,
  normalizeFontStack,
  type AccentColor,
  type AppearanceSettings,
  type CornerStyle,
  type Density,
  type EditorLineHeight,
  type FontChoice,
} from "../utils/theme";
import type {
  ThemePreference,
  EditorWidth,
  GrammarCheckMode,
  FeatureSettings,
  MermaidSettings,
  PlantumlSettings,
  RunnerSettings,
  LspSettings,
  CalloutDefinition,
  LlmSettings,
  AppSettings,
  GrammarProfile,
} from "./settingsTypes";
export type * from "./settingsTypes";
const SETTINGS_KEY = "memosmith:settings";
export * from "./settingsDefaults";
import {
  defaultCalloutDefinitions,
  defaultFeatureSettings,
  defaultLlmSettings,
  defaultLspSettings,
  defaultMermaidSettings,
  defaultPlantumlSettings,
  defaultProfiles,
  defaultRunnerSettings,
  defaultSettings,
  emptyLlmSettings,
} from "./settingsDefaults";
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
      wordTarget:
        typeof stored.wordTarget === "string" ? stored.wordTarget : "",
      llm: readLlm(stored.llm, emptyLlmSettings),
    };
  }
  return profiles;
}
function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
function isAccentColor(value: unknown): value is AccentColor {
  return (
    value === "emerald" ||
    value === "sky" ||
    value === "violet" ||
    value === "rose" ||
    value === "amber"
  );
}
function isFontChoice(value: unknown): value is FontChoice {
  return (
    value === "system" ||
    value === "inter" ||
    value === "serif" ||
    value === "mono"
  );
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
  return (
    value === "focused" ||
    value === "comfortable" ||
    value === "wide" ||
    value === "full"
  );
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
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim()
          : id,
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
    uiFont: isFontChoice(parsed.uiFont)
      ? parsed.uiFont
      : defaultAppearanceSettings.uiFont,
    uiFontStack: normalizeFontStack(parsed.uiFontStack),
    editorFont: isFontChoice(parsed.editorFont)
      ? parsed.editorFont
      : defaultAppearanceSettings.editorFont,
    editorFontStack: normalizeFontStack(parsed.editorFontStack),
    cornerStyle: isCornerStyle(parsed.cornerStyle)
      ? parsed.cornerStyle
      : defaultAppearanceSettings.cornerStyle,
    density: isDensity(parsed.density)
      ? parsed.density
      : defaultAppearanceSettings.density,
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
      typeof parsed.databases === "boolean"
        ? parsed.databases
        : defaultFeatureSettings.databases,
    fancyTableEditor:
      typeof parsed.fancyTableEditor === "boolean"
        ? parsed.fancyTableEditor
        : defaultFeatureSettings.fancyTableEditor,
    callouts:
      typeof parsed.callouts === "boolean"
        ? parsed.callouts
        : defaultFeatureSettings.callouts,
    badges:
      typeof parsed.badges === "boolean"
        ? parsed.badges
        : defaultFeatureSettings.badges,
    drawings:
      typeof parsed.drawings === "boolean"
        ? parsed.drawings
        : defaultFeatureSettings.drawings,
    diagrams:
      typeof parsed.diagrams === "boolean"
        ? parsed.diagrams
        : defaultFeatureSettings.diagrams,
    codeExecution:
      typeof parsed.codeExecution === "boolean"
        ? parsed.codeExecution
        : defaultFeatureSettings.codeExecution,
    lsp:
      typeof parsed.lsp === "boolean" ? parsed.lsp : defaultFeatureSettings.lsp,
    plantuml:
      typeof parsed.plantuml === "boolean"
        ? parsed.plantuml
        : defaultFeatureSettings.plantuml,
    mermaid:
      typeof parsed.mermaid === "boolean"
        ? parsed.mermaid
        : defaultFeatureSettings.mermaid,
    windowControls:
      typeof parsed.windowControls === "boolean"
        ? parsed.windowControls
        : defaultFeatureSettings.windowControls,
  };
}
function readRunner(value: unknown): RunnerSettings {
  const parsed = (value ?? {}) as Partial<RunnerSettings>;
  const stored = (parsed.commands ?? {}) as Partial<Record<Kernel, string>>;
  const timeout = Number(parsed.timeoutMs);
  return {
    commands: Object.fromEntries(
      (Object.keys(defaultRunnerSettings.commands) as Kernel[]).map(
        (kernel) => [
          kernel,
          typeof stored[kernel] === "string" ? stored[kernel] : "",
        ],
      ),
    ) as Record<Kernel, string>,
    timeoutMs: Number.isFinite(timeout)
      ? Math.min(600000, Math.max(1000, timeout))
      : defaultRunnerSettings.timeoutMs,
    sharedKernel:
      typeof parsed.sharedKernel === "boolean"
        ? parsed.sharedKernel
        : defaultRunnerSettings.sharedKernel,
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
      parsed.format === "png" ||
      parsed.format === "txt" ||
      parsed.format === "svg"
        ? parsed.format
        : defaultPlantumlSettings.format,
    theme: typeof parsed.theme === "string" ? parsed.theme : "",
  };
}
function readMermaid(value: unknown): MermaidSettings {
  const theme = ((value ?? {}) as Partial<MermaidSettings>).theme;
  return {
    theme:
      theme === "dark" ||
      theme === "forest" ||
      theme === "neutral" ||
      theme === "default"
        ? theme
        : defaultMermaidSettings.theme,
  };
}
function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
function readPaneSettings(parsed: Partial<AppSettings>) {
  return {
    spacePaneWidth: clampPaneWidth(
      parsed.spacePaneWidth,
      defaultSettings.spacePaneWidth,
    ),
    settingsPaneWidth: clampPaneWidth(
      parsed.settingsPaneWidth,
      defaultSettings.settingsPaneWidth,
    ),
    backlinksPaneWidth: clampPaneWidth(
      parsed.backlinksPaneWidth,
      defaultSettings.backlinksPaneWidth,
    ),
    spacePaneOpen: readBoolean(
      parsed.spacePaneOpen,
      defaultSettings.spacePaneOpen,
    ),
    backlinksPaneOpen: readBoolean(
      parsed.backlinksPaneOpen,
      defaultSettings.backlinksPaneOpen,
    ),
  };
}
function readEditorSettings(parsed: Partial<AppSettings>) {
  return {
    editorWidth: isEditorWidth(parsed.editorWidth)
      ? parsed.editorWidth
      : defaultSettings.editorWidth,
    textSize: clampTextSize(parsed.textSize),
    spellcheck: readBoolean(parsed.spellcheck, defaultSettings.spellcheck),
    slashCommands: readBoolean(
      parsed.slashCommands,
      defaultSettings.slashCommands,
    ),
    showPageTitle: readBoolean(
      parsed.showPageTitle,
      defaultSettings.showPageTitle,
    ),
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
      locale: isLocale(parsed.locale) ? parsed.locale : defaultSettings.locale,
      theme: isThemePreference(parsed.theme)
        ? parsed.theme
        : defaultSettings.theme,
      appearance: readAppearance(parsed.appearance),
      features: readFeatures(parsed.features),
      callouts: readCallouts(parsed.callouts),
      databasePalette: readPalette(parsed.databasePalette),
      runner: readRunner(parsed.runner),
      lsp: readLsp(parsed.lsp),
      plantuml: readPlantuml(parsed.plantuml),
      mermaid: readMermaid(parsed.mermaid),
      ...readEditorSettings(parsed),
      ...readPaneSettings(parsed),
      grammarMode: isGrammarMode(parsed.grammarMode)
        ? parsed.grammarMode
        : defaultSettings.grammarMode,
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
