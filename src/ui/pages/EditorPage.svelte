<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { explainIssue } from "../../lib/tauri/llm";
  import type { DatabaseSummary } from "../../lib/tauri/databases";
  import { i18n, locale } from "../../lib/i18n";
  import { loadSettings, saveSettings } from "../../lib/storage/settings";
  import { palette } from "../../lib/utils/optionColors";
  import { loadSpaceRoot } from "../../lib/storage/space";
  import { loadTabs, saveTabs } from "../../lib/storage/tabs";
  import type { GrammarIssue, GrammarReport } from "../../lib/utils/grammar";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import {
    displayNoteName,
    displayNotePath,
    entryPathFromNote,
  } from "../../lib/utils/path";
  import { backlinksForNote } from "../../lib/utils/wikilinks";
  import { applyAppearanceTheme } from "../../lib/utils/theme";
  import EditorPageView from "./EditorPageView.svelte";
  import { countWords, noteBreadcrumbs } from "./editorPageUtils";
  import { createTabActions } from "./editorPageTabActions";
  import type {
    EditorPageActions,
    EditorPageContext,
    PaneName,
  } from "./editorPageContext";
  import {
    createCoreActions,
    createPaneActions,
  } from "./editorPageCoreActions";
  import {
    createDatabaseActions,
    createSpaceActions,
  } from "./editorPageSpaceActions";
  import { createEntryActions } from "./editorPageEntryActions";
  import { createMetaActions } from "./editorPageMetaActions";
  import { createAssetActions } from "./editorPageAssetActions";
  import { createGrammarActions } from "./editorPageGrammarActions";
  import { createWikilinkActions } from "./editorPageWikilinkActions";

  const appTitle = "MemoSmith";
  const paneSlide = {
    axis: "x" as const,
    easing: cubicOut,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 200,
  };

  let path: string | null = null;
  let settings = loadSettings();
  let spaceRoot = loadSpaceRoot();
  let spaceNotes: string[] = [];
  let noteContents: Record<string, string> = {};
  let spaceMeta: SpaceMeta = {};
  let databases: DatabaseSummary[] = [];
  let activeDatabaseId: string | null = null;
  let databasesOpen = false;
  let isDirty = false;
  let contents = "";
  let statusMessage = spaceRoot
    ? $i18n.t("app.selectOrCreateNote")
    : $i18n.t("app.chooseSpace");
  let editor: HTMLElement | undefined;
  let words = countWords(contents);
  let characters = contents.length;
  let settingsOpen = false;
  let pdfPreviewOpen = false;
  let grammarOpen = false;
  let grammarReport: GrammarReport | null = null;
  let grammarChecking = false;
  let grammarError = "";
  let grammarTimer: ReturnType<typeof setTimeout> | undefined;
  let grammarCheckedText = "";
  let prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let noteSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let statsTimer: ReturnType<typeof setTimeout> | undefined;
  let resizing: {
    pane: PaneName;
    startX: number;
    startWidth: number;
  } | null = null;

  const storedTabs = loadTabs();
  let openTabs = storedTabs.open;
  let pinnedTabs = storedTabs.pinned;

  $: noteDir = path ? path.slice(0, path.lastIndexOf("/")) : null;
  $: spacePrefix = spaceRoot ? `${spaceRoot}/` : null;
  $: activeRelativePath =
    path && spacePrefix && path.startsWith(spacePrefix)
      ? path.slice(spacePrefix.length)
      : null;
  $: activeEntryPath = activeRelativePath
    ? entryPathFromNote(activeRelativePath)
    : null;
  $: activePageMeta = activeEntryPath
    ? (spaceMeta[activeEntryPath] ?? {})
    : {};
  $: fileLabel = activeRelativePath
    ? displayNotePath(activeRelativePath)
    : spaceRoot
      ? $i18n.t("app.noNoteSelected")
      : $i18n.t("app.noSpace");
  $: breadcrumbs = noteBreadcrumbs(activeRelativePath, spaceNotes, fileLabel);
  $: noteTitle = activeRelativePath ? displayNoteName(activeRelativePath) : "";
  $: wikilinkKey = `${activeRelativePath ?? ""}\n${spaceNotes.join("\n")}`;
  $: backlinks = backlinksForNote(activeRelativePath, spaceNotes, {
    ...noteContents,
    ...(activeRelativePath ? { [activeRelativePath]: contents } : {}),
  });
  $: activeTab = activeDatabaseId
    ? `db:${activeDatabaseId}`
    : activeRelativePath;
  $: openTabs = tabs.sync(activeTab, spaceNotes, databases, pinnedTabs);
  $: saveTabs({
    open: openTabs,
    pinned: pinnedTabs.filter((tab) => openTabs.includes(tab)),
    active: activeTab,
  });
  $: dirtyMarker = isDirty ? " *" : "";
  $: displayName = `${fileLabel}${dirtyMarker}`;
  $: grammarProfile = settings.grammarProfiles[settings.grammarMode];
  $: grammarAutoFull =
    settings.features.grammarPolice &&
    settings.features.grammarCheckMode === "auto-full";
  $: grammarAutoDiff =
    settings.features.grammarPolice &&
    settings.features.grammarCheckMode === "auto-diff";
  $: grammarDecorations = grammar.grammarDecorations(
    grammarReport,
    contents,
  );
  $: document.title = `${displayName} - ${appTitle}`;
  $: locale.set(settings.locale);
  $: document.documentElement.lang = settings.locale;
  $: document.documentElement.dir = $i18n.dir;
  $: applyAppearanceTheme(
    pdfPreviewOpen ? "light" : settings.theme,
    settings.appearance,
    prefersDark,
  );
  // Database chips read the palette from a store, not from drilled props.
  $: palette.set(settings.databasePalette);
  $: saveSettings(settings);
  $: if (!settings.features.grammarPolice && grammarOpen) {
    grammarOpen = false;
  }
  $: if (!settings.features.databases && (databasesOpen || activeDatabaseId)) {
    databasesOpen = false;
    activeDatabaseId = null;
  }

  const context: EditorPageContext = {
    get activeDatabaseId() { return activeDatabaseId; },
    set activeDatabaseId(value) { activeDatabaseId = value; },
    get activeEntryPath() { return activeEntryPath; },
    get activePageMeta() { return activePageMeta; },
    get activeRelativePath() { return activeRelativePath; },
    get characters() { return characters; },
    set characters(value) { characters = value; },
    get contents() { return contents; },
    set contents(value) { contents = value; },
    get databases() { return databases; },
    set databases(value) { databases = value; },
    get databasesOpen() { return databasesOpen; },
    set databasesOpen(value) { databasesOpen = value; },
    get editor() { return editor; },
    set editor(value) { editor = value; },
    get grammarAutoDiff() { return grammarAutoDiff; },
    get grammarAutoFull() { return grammarAutoFull; },
    get grammarCheckedText() { return grammarCheckedText; },
    set grammarCheckedText(value) { grammarCheckedText = value; },
    get grammarChecking() { return grammarChecking; },
    set grammarChecking(value) { grammarChecking = value; },
    get grammarError() { return grammarError; },
    set grammarError(value) { grammarError = value; },
    get grammarOpen() { return grammarOpen; },
    set grammarOpen(value) { grammarOpen = value; },
    get grammarProfile() { return grammarProfile; },
    get grammarReport() { return grammarReport; },
    set grammarReport(value) { grammarReport = value; },
    get grammarTimer() { return grammarTimer; },
    set grammarTimer(value) { grammarTimer = value; },
    get isDirty() { return isDirty; },
    set isDirty(value) { isDirty = value; },
    get isRtl() { return $i18n.dir === "rtl"; },
    get noteContents() { return noteContents; },
    set noteContents(value) { noteContents = value; },
    get noteDir() { return noteDir; },
    get openTabs() { return openTabs; },
    set openTabs(value) { openTabs = value; },
    get pinnedTabs() { return pinnedTabs; },
    set pinnedTabs(value) { pinnedTabs = value; },
    get activeTab() { return activeTab; },
    get noteSaveTimer() { return noteSaveTimer; },
    set noteSaveTimer(value) { noteSaveTimer = value; },
    get path() { return path; },
    set path(value) { path = value; },
    get resizing() { return resizing; },
    set resizing(value) { resizing = value; },
    get settings() { return settings; },
    set settings(value) { settings = value; },
    get settingsOpen() { return settingsOpen; },
    set settingsOpen(value) { settingsOpen = value; },
    get spaceMeta() { return spaceMeta; },
    set spaceMeta(value) { spaceMeta = value; },
    get spaceNotes() { return spaceNotes; },
    set spaceNotes(value) { spaceNotes = value; },
    get spaceRoot() { return spaceRoot; },
    set spaceRoot(value) { spaceRoot = value; },
    get statsTimer() { return statsTimer; },
    set statsTimer(value) { statsTimer = value; },
    get statusMessage() { return statusMessage; },
    set statusMessage(value) { statusMessage = value; },
    get t() { return $i18n.t; },
    get words() { return words; },
    set words(value) { words = value; },
  };

  const core = createCoreActions(context);
  const pane = createPaneActions(context);
  const meta = createMetaActions(context);
  const assets = createAssetActions(context, meta);
  const grammar = createGrammarActions(context, { updateNote });
  const space = createSpaceActions(context, core);
  const databasesApi = createDatabaseActions(context, core, space.refreshSpace);
  const entries = createEntryActions(
    context,
    core,
    space.refreshSpace,
    space.spacePath,
  );
  const wikilinks = createWikilinkActions(context, assets, space.spacePath);
  const tabs = createTabActions(context, {
    clearActive: core.clearActiveNote,
    flushNoteSave: core.flushNoteSave,
    runWithStatus,
    select: (id) =>
      id.startsWith("db:")
        ? databasesApi.selectDatabase(id.slice(3))
        : space.selectSpaceNote(id),
  });

  const actions: EditorPageActions = {
    ...core,
    ...pane,
    ...meta,
    ...space,
    ...databasesApi,
    ...entries,
    ...assets,
    ...grammar,
    ...wikilinks,
    handleShortcut,
    runWithStatus,
    updateNote,
  };

  async function runWithStatus(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function updateNote() {
    if (!path) {
      return;
    }
    if (!isDirty) {
      isDirty = true;
    }
    if (activeRelativePath) {
      noteContents = { ...noteContents, [activeRelativePath]: contents };
    }
    core.scheduleStats();
    core.scheduleNoteSave(runWithStatus);
    grammar.scheduleGrammarCheck();
    if (statusMessage !== $i18n.t("app.saving")) {
      statusMessage = $i18n.t("app.saving");
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "Escape" && (settingsOpen || databasesOpen)) {
      settingsOpen = false;
      databasesOpen = false;
      return;
    }
    if (!isPrimaryShortcut) {
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      tabs.cycleTabs(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key.toLowerCase() === "w" && activeTab) {
      event.preventDefault();
      void tabs.closeTab(activeTab);
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      settingsOpen = !settingsOpen;
    }
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      actions.toggleSpacePane();
    }
  }

  runWithStatus(async () => {
    await space.refreshSpace();
    await tabs.restoreTab(storedTabs.active);
  });

  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      prefersDark = mediaQuery.matches;
    };
    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme);
    };
  });

  onDestroy(() => {
    if (noteSaveTimer) {
      clearTimeout(noteSaveTimer);
      void core.saveActiveNote();
    }
    if (statsTimer) {
      clearTimeout(statsTimer);
    }
    if (grammarTimer) {
      clearTimeout(grammarTimer);
    }
  });
</script>

<EditorPageView
  {activeDatabaseId}
  {activePageMeta}
  {activeRelativePath}
  {actions}
  {appTitle}
  {backlinks}
  {breadcrumbs}
  {characters}
  bind:contents
  bind:databases
  bind:databasesOpen
  bind:editor
  {fileLabel}
  {grammarChecking}
  {grammarDecorations}
  {grammarError}
  bind:grammarOpen
  {grammarProfile}
  {grammarReport}
  {isDirty}
  {noteTitle}
  {openTabs}
  {pinnedTabs}
  {activeTab}
  onSelectTab={tabs.openTab}
  onCloseTab={tabs.closeTab}
  onPinTab={(id) => (openTabs = tabs.togglePinTab(id))}
  onReorderTabs={(id, target) => (openTabs = tabs.reorderTabs(id, target))}
  {paneSlide}
  {path}
  bind:pdfPreviewOpen
  bind:settings
  bind:settingsOpen
  {spaceMeta}
  {spaceNotes}
  {spaceRoot}
  bind:statusMessage
  {wikilinkKey}
  {words}
  explainGrammarIssue={(issue: GrammarIssue) =>
    explainIssue(settings.llm, issue, grammarProfile)}
/>
