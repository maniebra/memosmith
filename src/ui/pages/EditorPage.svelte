<script lang="ts">
  /* eslint-disable max-lines */
  import { onDestroy, onMount } from "svelte";
  import { scheduleGitlabSync } from "../../lib/tauri/gitlab";
  import { cubicOut } from "svelte/easing";
  import { explainIssue } from "../../lib/tauri/llm";
  import type { DatabaseSummary } from "../../lib/tauri/databases";
  import { i18n } from "../../lib/i18n";
  import { registerKeybindings } from "../../lib/utils/keybindings";
  import { createEditorPageKeybindings } from "./editorPageKeybindings";
  import { loadSettings } from "../../lib/storage/settings";
  import { journal, traced } from "../../lib/utils/journal";
  import { loadSpaceRoot } from "../../lib/storage/space";
  import { loadTabs, saveTabs } from "../../lib/storage/tabs";
  import type { GrammarIssue, GrammarReport } from "../../lib/utils/grammar";
  import type { DiagramPreview } from "../../lib/utils/diagramPreview";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import {
    displayNoteName,
    displayNotePath,
    dirname,
    entryPathFromNote,
    normalizePath,
  } from "../../lib/utils/path";
  import { backlinksForNote } from "../../lib/utils/wikilinks";
  import EditorPageView from "./EditorPageView.svelte";
  import {
    countWords,
    isDiagramPreviewTab,
    noteBreadcrumbs,
  } from "./editorPageUtils";
  import { createTabActions } from "./editorPageTabActions";
  import { applySettingsEffects } from "./editorPageSettingsEffects";
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
  import { createDiagramPreviewTabs } from "./editorPageDiagramPreview";

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
  let spaceRoot = normalizePath(loadSpaceRoot() ?? "") || null;
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
  let activeTab: string | null = null;
  let diagramPreviews: Record<string, DiagramPreview> = {};

  $: noteDir = path ? dirname(path) : null;
  $: spacePrefix = spaceRoot ? `${spaceRoot}/` : null;
  $: activeRelativePath =
    path && spacePrefix && path.startsWith(spacePrefix)
      ? path.slice(spacePrefix.length)
      : null;
  $: activeEntryPath = activeRelativePath
    ? entryPathFromNote(activeRelativePath)
    : null;
  $: activeDiagramPreview = activeTab
    ? (diagramPreviews[activeTab] ?? null)
    : null;
  $: activePageMeta = activeEntryPath
    ? (spaceMeta[activeEntryPath] ?? {})
    : {};
  $: fileLabel = activeDiagramPreview
    ? $i18n.t("editor.diagramPreview")
    : activeRelativePath
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
  $: openTabs = tabs.sync(activeTab, spaceNotes, databases, pinnedTabs);
  $: saveTabs({
    open: openTabs.filter((tab) => !isDiagramPreviewTab(tab)),
    pinned: pinnedTabs.filter(
      (tab) => openTabs.includes(tab) && !isDiagramPreviewTab(tab),
    ),
    active: isDiagramPreviewTab(activeTab ?? "") ? null : activeTab,
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
  $: applySettingsEffects(settings, prefersDark);
  $: journal("state", {
    activeTab,
    path,
    contents: contents.length,
    openTabs,
    isDirty,
  });
  $: if (!settings.features.grammarPolice && grammarOpen) {
    grammarOpen = false;
  }
  $: if (!settings.features.databases && (databasesOpen || activeDatabaseId)) {
    databasesOpen = false;
    activeDatabaseId = null;
    if (activeTab?.startsWith("db:")) {
      activeTab = activeRelativePath;
    }
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
    get diagramPreviews() { return diagramPreviews; },
    set diagramPreviews(value) { diagramPreviews = value; },
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
    get previewTabs() { return Object.keys(diagramPreviews); },
    get activeTab() { return activeTab; },
    set activeTab(value) { activeTab = value; },
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

  const core = traced("core", createCoreActions(context));
  const pane = traced("pane", createPaneActions(context));
  const meta = traced("meta", createMetaActions(context));
  const assets = traced("assets", createAssetActions(context, meta));
  const grammar = traced("grammar", createGrammarActions(context, { updateNote }));
  const space = traced("space", createSpaceActions(context, core));
  const databasesApi = traced(
    "databases",
    createDatabaseActions(context, core, space.refreshSpace),
  );
  const entries = traced(
    "entries",
    createEntryActions(context, core, space.refreshSpace, space.spacePath),
  );
  const wikilinks = traced(
    "wikilinks",
    createWikilinkActions(context, assets, space.spacePath),
  );
  const tabs = traced("tabs", createTabActions(context, {
    clearActive: core.clearActiveNote,
    flushNoteSave: core.flushNoteSave,
    runWithStatus,
    select: (id) =>
      id.startsWith("db:")
        ? databasesApi.selectDatabase(id.slice(3))
        : isDiagramPreviewTab(id)
          ? diagramTabs.select(id)
        : space.selectSpaceNote(id),
  }));
  const diagramTabs = createDiagramPreviewTabs(context, core.flushNoteSave);

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

  function closeTab(id: string) {
    if (isDiagramPreviewTab(id)) {
      diagramTabs.close(id);
    }

    void tabs.closeTab(id);
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

  const gitlabSync = scheduleGitlabSync(
    () => ({
      root: settings.features.databases ? spaceRoot : null,
      instances: settings.gitlab,
    }),
    (message) => (statusMessage = message),
  );
  $: gitlabSync.refresh(
    settings.gitlab,
    settings.features.databases,
    spaceRoot,
  );
  onDestroy(gitlabSync.stop);

  onMount(() =>
    registerKeybindings(createEditorPageKeybindings(context, actions, tabs)),
  );


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
  {activeDiagramPreview}
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
  onCloseTab={closeTab}
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
  onPreviewDiagram={diagramTabs.open}
  explainGrammarIssue={(issue: GrammarIssue) =>
    explainIssue(settings.llm, issue, grammarProfile)}
/>
