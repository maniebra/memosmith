import { defaultSettings } from "./settingsDefaults";
import type { AppSettings, EditorWidth } from "./settingsTypes";

export function isEditorWidth(value: unknown): value is EditorWidth {
  return (
    value === "focused" ||
    value === "comfortable" ||
    value === "wide" ||
    value === "full"
  );
}
export function clampTextSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size)) {
    return defaultSettings.textSize;
  }
  return Math.min(21, Math.max(15, size));
}
export function clampPaneWidth(value: unknown, fallback: number) {
  const width = Number(value);
  if (!Number.isFinite(width)) {
    return fallback;
  }
  return Math.min(480, Math.max(180, width));
}
export function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function readPaneSettings(parsed: Partial<AppSettings>) {
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
export function readEditorSettings(parsed: Partial<AppSettings>) {
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
    focusOnOpen: readBoolean(parsed.focusOnOpen, defaultSettings.focusOnOpen),
    gpuRendering: readBoolean(
      parsed.gpuRendering,
      defaultSettings.gpuRendering,
    ),
    logDir:
      typeof parsed.logDir === "string"
        ? parsed.logDir
        : defaultSettings.logDir,
  };
}
