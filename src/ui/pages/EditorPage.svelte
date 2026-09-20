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
  import {
    leafIds,
    pruneTiles,
    removeLeaf,
    replaceLeaf,
    splitLeaf,
  } from "../../lib/utils/tiling";
  import type { TileNode } from "../../lib/utils/tiling";
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
  /** Session-only: how the panes are tiled. The null leaf is the active tab. */
  let tiles: TileNode = storedTabs.tiles;
  /** Tabs and panes only sync once the space listing is in. */
  let spaceLoaded = false;
  let splitSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  /** The note that was active before the current one, for split hand-off. */
  let lastNote: string | null = null;
  let previousNote: string | null = null;

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
  // Until the space has loaded, `spaceNotes` is empty and every tab would look
  // deleted: syncing then would wipe the restored tabs and panes.
  $: if (spaceLoaded) {
    openTabs = tabs.sync(activeTab, spaceNotes, databases, pinnedTabs);
  }
  $: if (spaceLoaded) {
    saveTabs({
      open: openTabs.filter((tab) => !isDiagramPreviewTab(tab)),
      pinned: pinnedTabs.filter(
        (tab) => openTabs.includes(tab) && !isDiagramPreviewTab(tab),
      ),
      active: isDiagramPreviewTab(activeTab ?? "") ? null : activeTab,
      // Diagram previews are rebuilt from the note, so their panes do not
      // persist.
      tiles: leafIds(tiles)
        .filter(isDiagramPreviewTab)
        .reduce((tree, id) => removeLeaf(tree, id), tiles),
    });
  }
  $: if (activeRelativePath !== lastNote) {
    previousNote = lastNote;
    lastNote = activeRelativePath;
  }
  $: if (spaceLoaded) {
    tiles = pruneTiles(tiles, openTabs, activeTab);
  }
  $: splitTabs = leafIds(tiles);
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

  /** The tab that takes over the main pane when the active one is split off. */
  function handoverNote(id: string) {
    const candidates = openTabs.filter(
      (tab) => tab !== id && !splitTabs.includes(tab),
    );
    return previousNote && candidates.includes(previousNote)
      ? previousNote
      : (candidates[0] ?? null);
  }

  /**
   * A tab dropped on a pane: on an edge it splits that pane, in the middle it
   * takes the pane over.
   */
  function handleTileDrop(
    target: string | null,
    zone: { axis: "row" | "column"; side: "start" | "end" } | null,
    id: string,
  ) {
    if (target === id) {
      return;
    }
    if (!zone && target === null) {
      void tabs.openTab(id);
      return;
    }
    if (!openTabs.includes(id)) {
      // Dropped from the tree: it needs a tab before it can hold a pane.
      openTabs = [...openTabs, id];
    }
    if (id === activeTab) {
      // The active tab moves into a pane, so another one takes the main pane;
      // the main pane cannot hold what a tile already shows.
      const other = handoverNote(id);
      if (!other) {
        return;
      }
      const text = contents;
      void tabs.openTab(other).then(() => {
        if (!id.startsWith("db:") && !isDiagramPreviewTab(id)) {
          noteContents = { ...noteContents, [id]: text };
        }
        tiles = zone
          ? splitLeaf(tiles, target, zone.axis, zone.side, id)
          : replaceLeaf(tiles, target, id);
      });
      return;
    }
    const without = removeLeaf(tiles, id);
    tiles = zone
      ? splitLeaf(without, target, zone.axis, zone.side, id)
      : replaceLeaf(without, target, id);
  }

  /** The tab strip button: give the note a pane, or take its pane away. */
  function toggleSplitTab(id: string) {
    if (splitTabs.includes(id)) {
      tiles = removeLeaf(tiles, id);
      return;
    }
    handleTileDrop(null, { axis: "row", side: "end" }, id);
  }

  /**
   * Each pane's note is saved on its own debounce: `path` and the note save
   * timer both belong to the active tab.
   */
  function updateSplitNote(note: string, text: string) {
    noteContents = { ...noteContents, [note]: text };
    if (!spaceRoot) {
      return;
    }
    const notePath = `${spaceRoot}/${note}`;
    clearTimeout(splitSaveTimers[note]);
    splitSaveTimers[note] = setTimeout(() => {
      delete splitSaveTimers[note];
      void runWithStatus(() => core.saveActiveNote(notePath, text));
    }, 450);
    statusMessage = $i18n.t("app.saving");
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
    spaceLoaded = true;
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
    for (const timer of Object.values(splitSaveTimers)) {
      clearTimeout(timer);
    }
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
  bind:tiles
  {splitTabs}
  {diagramPreviews}
  noteText={(note) => noteContents[note] ?? ""}
  onSplitInput={updateSplitNote}
  onSplitTab={toggleSplitTab}
  onTileDrop={handleTileDrop}
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
