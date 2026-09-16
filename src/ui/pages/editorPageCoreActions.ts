import { defaultSettings, saveSettings } from "../../lib/storage/settings";
import { chooseSavePath, writeNote } from "../../lib/tauri/files";
import { applyAppearanceTheme } from "../../lib/utils/theme";
import { displayNoteName, displayNotePath } from "../../lib/utils/path";
import { countWords } from "./editorPageUtils";
import type {
  EditorPageActionDeps,
  EditorPageContext,
  PaneName,
} from "./editorPageContext";

const appTitle = "MemoSmith";
const paneMinWidth = 180;
const paneMaxWidth = 480;

export function syncEditorPageEffects(
  context: EditorPageContext,
  deps: EditorPageActionDeps,
  prefersDark: boolean,
) {
  const dirtyMarker = context.isDirty ? " *" : "";
  document.title = `${context.t("app.noSpace")}${dirtyMarker} - ${appTitle}`;
  deps.locale.set(context.settings.locale);
  document.documentElement.lang = context.settings.locale;
  document.documentElement.dir = context.isRtl ? "rtl" : "ltr";
  applyAppearanceTheme(
    context.settings.theme,
    context.settings.appearance,
    prefersDark,
    context.settings.features.badges,
  );
  saveSettings(context.settings);
}

export function createCoreActions(context: EditorPageContext) {
  const service = new CoreActions(context);
  return {
    flushNoteSave: service.flushNoteSave.bind(service),
    focusEditor: service.focusEditor.bind(service),
    resetSettings: service.resetSettings.bind(service),
    saveActiveNote: service.saveActiveNote.bind(service),
    saveNoteAs: service.saveNoteAs.bind(service),
    scheduleNoteSave: service.scheduleNoteSave.bind(service),
    scheduleStats: service.scheduleStats.bind(service),
    clearActiveNote: service.clearActiveNote.bind(service),
    setEditorText: service.setEditorText.bind(service),
    syncStats: service.syncStats.bind(service),
    toggleSpacePane: service.toggleSpacePane.bind(service),
    updateSettings: service.updateSettings.bind(service),
  };
}

class CoreActions {
  constructor(private context: EditorPageContext) {}

  syncStats() {
    this.context.characters = this.context.contents.length;
    this.context.words = countWords(this.context.contents);
  }

  scheduleStats() {
    this.context.characters = this.context.contents.length;
    if (this.context.statsTimer) {
      clearTimeout(this.context.statsTimer);
    }
    this.context.statsTimer = setTimeout(() => {
      this.context.words = countWords(this.context.contents);
      this.context.statsTimer = undefined;
    }, 120);
  }

  async saveActiveNote(
    notePath = this.context.path,
    noteContents = this.context.contents,
  ) {
    if (!notePath) {
      return;
    }
    await writeNote(notePath, noteContents);
    if (this.context.path === notePath) {
      this.context.isDirty = false;
      this.context.statusMessage = this.context.t("app.synced", {
        name: this.context.activeRelativePath
          ? displayNotePath(this.context.activeRelativePath)
          : displayNoteName(notePath),
      });
    }
  }

  /** Writes a copy to a chosen path; the open note stays the edited one. */
  async saveNoteAs() {
    if (!this.context.path) {
      return;
    }
    const target = await chooseSavePath(this.context.path);

    if (!target) {
      return;
    }
    await writeNote(target, this.context.contents);
    this.context.statusMessage = this.context.t("app.synced", {
      name: displayNoteName(target),
    });
  }

  scheduleNoteSave(runWithStatus: (action: () => Promise<void>) => void) {
    if (!this.context.path) {
      return;
    }
    if (this.context.noteSaveTimer) {
      clearTimeout(this.context.noteSaveTimer);
    }
    const notePath = this.context.path;
    const noteContents = this.context.contents;
    this.context.noteSaveTimer = setTimeout(() => {
      this.context.noteSaveTimer = undefined;
      runWithStatus(() => this.saveActiveNote(notePath, noteContents));
    }, 450);
  }

  async flushNoteSave() {
    if (this.context.noteSaveTimer) {
      clearTimeout(this.context.noteSaveTimer);
      this.context.noteSaveTimer = undefined;
    }
    if (this.context.isDirty) {
      await this.saveActiveNote();
    }
  }

  setEditorText(text: string, nextPath: string | null) {
    this.context.contents = text;
    this.context.path = nextPath;
    this.context.isDirty = false;
    this.context.grammarReport = null;
    this.context.grammarError = "";
    this.context.grammarCheckedText = "";
    this.syncStats();
  }

  /** Drops back to the empty editor, e.g. once the last tab is closed. */
  clearActiveNote() {
    this.context.activeTab = null;
    this.context.activeDatabaseId = null;
    this.setEditorText("", null);
    this.context.statusMessage = this.context.t("app.selectOrCreateNote");
  }

  /** `force` is for freshly created notes, which always want the caret. */
  focusEditor(force = false) {
    if (!force && !this.context.settings.focusOnOpen) {
      // The editor element is reused across notes, so it keeps the caret from
      // the previous one unless it is sent away explicitly.
      this.context.editor?.blur();
      return;
    }
    this.context.editor?.focus();
  }

  resetSettings() {
    this.context.settings = { ...defaultSettings };
  }

  updateSettings(nextSettings: typeof this.context.settings) {
    this.context.settings = nextSettings;
  }

  toggleSpacePane() {
    this.context.settings = {
      ...this.context.settings,
      spacePaneOpen: !this.context.settings.spacePaneOpen,
    };
  }
}

export function createPaneActions(context: EditorPageContext) {
  const service = new PaneActions(context);
  return {
    handleResize: service.handleResize.bind(service),
    resizeWithKeyboard: service.resizeWithKeyboard.bind(service),
    startResize: service.startResize.bind(service),
    stopResize: service.stopResize.bind(service),
  };
}

class PaneActions {
  constructor(private context: EditorPageContext) {}

  startResize(event: PointerEvent, pane: PaneName) {
    event.preventDefault();
    this.context.resizing = {
      pane,
      startX: event.clientX,
      startWidth: this.currentWidth(pane),
    };
  }

  handleResize(event: PointerEvent) {
    if (!this.context.resizing) {
      return;
    }
    const delta =
      (event.clientX - this.context.resizing.startX) *
      (this.context.isRtl ? -1 : 1);
    const nextWidth =
      this.context.resizing.pane === "space"
        ? this.context.resizing.startWidth + delta
        : this.context.resizing.startWidth - delta;
    this.updatePaneWidth(this.context.resizing.pane, nextWidth);
  }

  stopResize() {
    this.context.resizing = null;
  }

  resizeWithKeyboard(event: KeyboardEvent, pane: PaneName) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const direction =
      (event.key === "ArrowRight" ? 1 : -1) *
      (this.context.isRtl ? -1 : 1);
    const step = event.shiftKey ? 40 : 12;
    const side = pane === "space" ? direction : -direction;
    this.updatePaneWidth(pane, this.currentWidth(pane) + side * step);
  }

  private currentWidth(pane: PaneName) {
    return pane === "space"
      ? this.context.settings.spacePaneWidth
      : pane === "settings"
        ? this.context.settings.settingsPaneWidth
        : this.context.settings.backlinksPaneWidth;
  }

  private updatePaneWidth(pane: PaneName, width: number) {
    const clampedWidth = Math.min(
      paneMaxWidth,
      Math.max(paneMinWidth, width),
    );
    this.context.settings =
      pane === "space"
        ? { ...this.context.settings, spacePaneWidth: clampedWidth }
        : pane === "settings"
          ? { ...this.context.settings, settingsPaneWidth: clampedWidth }
          : { ...this.context.settings, backlinksPaneWidth: clampedWidth };
  }
}
