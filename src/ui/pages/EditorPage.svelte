<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { slide, scale } from "svelte/transition";
  import {
    defaultSettings,
    loadSettings,
    saveSettings,
    type GrammarProfile,
  } from "../../lib/storage/settings";
  import { loadSpaceRoot, saveSpaceRoot } from "../../lib/storage/space";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { assetFolder, assetMarkdown } from "../../lib/utils/assets";
  import { compressImage } from "../../lib/utils/image";
  import {
    checkGrammar,
    explainIssue,
    generateContent,
  } from "../../lib/tauri/llm";
  import {
    applyIssue,
    issueRange,
    type GrammarIssue,
    type GrammarMode,
    type GrammarReport,
  } from "../../lib/utils/grammar";
  import GrammarPolice from "../sections/GrammarPolice.svelte";
  import {
    chooseFiles,
    chooseSpaceRoot,
    confirmDelete,
    copyAsset,
    writeAsset,
    createNote,
    deletePageMeta,
    deletePath,
    listSpace,
    loadSpaceMeta,
    pruneAssets,
    readNote,
    renamePageMeta,
    renamePath,
    savePageMeta,
    writeNote,
  } from "../../lib/tauri/files";
  import {
    basename,
    dirNoteName,
    dirNotePath,
    displayNoteName,
    displayNotePath,
    entryPathFromNote,
    isDirNotePath,
    stripNoteExtension,
    withNoteExtension,
  } from "../../lib/utils/path";
  import {
    backlinksForNote,
    resolveWikilinkTarget,
    wikilinkCreatePath,
  } from "../../lib/utils/wikilinks";
  import {
    cleanPageMeta,
    hasPageMeta,
    type PageIcon,
    type PageMeta,
    type SpaceMeta,
  } from "../../lib/utils/pageMeta";
  import {
    createDatabase,
    deleteDatabase,
    listDatabases,
    type DatabaseSummary,
  } from "../../lib/tauri/databases";
  import {
    defaultColumns,
    defaultViews,
    slugify,
  } from "../../lib/utils/database";
  import { applyAppearanceTheme } from "../../lib/utils/theme";
  import { renderDocument, type WikilinkEmbed } from "../../lib/utils/markdown";
  import DatabaseManager from "../sections/DatabaseManager.svelte";
  import DatabaseView from "../sections/DatabaseView.svelte";
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import EditorStatusBar from "../sections/EditorStatusBar.svelte";
  import EditorToolbar from "../sections/EditorToolbar.svelte";
  import SettingsPanel from "../sections/SettingsPanel.svelte";
  import SpaceSidebar from "../sections/SpaceSidebar.svelte";

  const appTitle = "MemoSmith";
  const paneMinWidth = 180;
  const paneMaxWidth = 480;
  const paneSlide = {
    axis: "x" as const,
    easing: cubicOut,
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 200,
  };
  type Breadcrumb = { label: string; path?: string };

  let path: string | null = null;
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
    ? "Select or create a note"
    : "Choose a space to start";
  let editor: HTMLElement | undefined;
  let words = countWords(contents);
  let characters = contents.length;
  let settings = loadSettings();
  let settingsOpen = false;
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
    pane: "space" | "settings";
    startX: number;
    startWidth: number;
  } | null = null;

  $: noteDir = path ? path.slice(0, path.lastIndexOf("/")) : null;
  $: spacePrefix = spaceRoot ? `${spaceRoot}/` : null;
  $: activeRelativePath =
    path && spacePrefix && path.startsWith(spacePrefix)
      ? path.slice(spacePrefix.length)
      : null;
  $: activeEntryPath = activeRelativePath
    ? entryPathFromNote(activeRelativePath)
    : null;
  $: activePageMeta = activeEntryPath ? (spaceMeta[activeEntryPath] ?? {}) : {};
  $: fileLabel = activeRelativePath
    ? displayNotePath(activeRelativePath)
    : spaceRoot
      ? "No note selected"
      : "No space";
  $: breadcrumbs = noteBreadcrumbs(activeRelativePath, spaceNotes, fileLabel);
  $: noteTitle = activeRelativePath ? displayNoteName(activeRelativePath) : "";
  $: wikilinkKey = `${activeRelativePath ?? ""}\n${spaceNotes.join("\n")}`;
  $: backlinks = backlinksForNote(activeRelativePath, spaceNotes, {
    ...noteContents,
    ...(activeRelativePath ? { [activeRelativePath]: contents } : {}),
  });
  $: dirtyMarker = isDirty ? " *" : "";
  $: displayName = `${fileLabel}${dirtyMarker}`;
  $: document.title = `${displayName} - ${appTitle}`;
  $: applyAppearanceTheme(settings.theme, settings.appearance, prefersDark);
  $: saveSettings(settings);
  $: if (!settings.features.grammarPolice && grammarOpen) {
    grammarOpen = false;
  }
  $: if (!settings.features.databases && (databasesOpen || activeDatabaseId)) {
    databasesOpen = false;
    activeDatabaseId = null;
  }

  function countWords(text: string) {
    const trimmedText = text.trim();

    return trimmedText ? trimmedText.split(/\s+/).length : 0;
  }

  function syncStats() {
    characters = contents.length;
    words = countWords(contents);
  }

  function noteBreadcrumbs(
    relativePath: string | null,
    notes: string[],
    fallback: string,
  ): Breadcrumb[] {
    if (!relativePath) {
      return [{ label: fallback }];
    }

    const pathSegments = isDirNotePath(relativePath)
      ? relativePath.split("/").slice(0, -1)
      : relativePath.split("/");

    return pathSegments.map((segment, index) => {
      const isLast = index === pathSegments.length - 1;
      const folderPath = pathSegments.slice(0, index + 1).join("/");
      const folderNote = dirNotePath(folderPath);
      const path = isLast
        ? relativePath
        : notes.includes(folderNote)
          ? folderNote
          : undefined;

      return {
        label:
          isLast && !isDirNotePath(relativePath)
            ? stripNoteExtension(segment)
            : segment,
        path,
      };
    });
  }

  function scheduleStats() {
    characters = contents.length;

    if (statsTimer) {
      clearTimeout(statsTimer);
    }

    statsTimer = setTimeout(() => {
      words = countWords(contents);
      statsTimer = undefined;
    }, 120);
  }

  async function saveActiveNote(notePath = path, noteContents = contents) {
    if (!notePath) {
      return;
    }

    await writeNote(notePath, noteContents);

    if (path === notePath) {
      isDirty = false;
      statusMessage = `Synced ${activeRelativePath ? displayNotePath(activeRelativePath) : displayNoteName(notePath)}`;
    }
  }

  function scheduleNoteSave() {
    if (!path) {
      return;
    }

    if (noteSaveTimer) {
      clearTimeout(noteSaveTimer);
    }

    const notePath = path;
    const noteContents = contents;

    noteSaveTimer = setTimeout(() => {
      noteSaveTimer = undefined;
      runWithStatus(() => saveActiveNote(notePath, noteContents));
    }, 450);
  }

  async function flushNoteSave() {
    if (noteSaveTimer) {
      clearTimeout(noteSaveTimer);
      noteSaveTimer = undefined;
    }

    if (isDirty) {
      await saveActiveNote();
    }
  }

  function focusEditor() {
    editor?.focus();
  }

  function resetSettings() {
    settings = { ...defaultSettings };
  }

  function updateSettings(nextSettings: typeof settings) {
    settings = nextSettings;
  }

  function toggleSpacePane() {
    settings = { ...settings, spacePaneOpen: !settings.spacePaneOpen };
  }

  function clampPaneWidth(width: number) {
    return Math.min(paneMaxWidth, Math.max(paneMinWidth, width));
  }

  function updatePaneWidth(pane: "space" | "settings", width: number) {
    const clampedWidth = clampPaneWidth(width);

    settings =
      pane === "space"
        ? { ...settings, spacePaneWidth: clampedWidth }
        : { ...settings, settingsPaneWidth: clampedWidth };
  }

  function startResize(event: PointerEvent, pane: "space" | "settings") {
    event.preventDefault();
    resizing = {
      pane,
      startX: event.clientX,
      startWidth:
        pane === "space" ? settings.spacePaneWidth : settings.settingsPaneWidth,
    };
  }

  function handleResize(event: PointerEvent) {
    if (!resizing) {
      return;
    }

    const delta = event.clientX - resizing.startX;
    const nextWidth =
      resizing.pane === "space"
        ? resizing.startWidth + delta
        : resizing.startWidth - delta;

    updatePaneWidth(resizing.pane, nextWidth);
  }

  function stopResize() {
    resizing = null;
  }

  function resizeWithKeyboard(
    event: KeyboardEvent,
    pane: "space" | "settings",
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 40 : 12;
    const currentWidth =
      pane === "space" ? settings.spacePaneWidth : settings.settingsPaneWidth;
    const nextWidth =
      currentWidth + (pane === "space" ? direction : -direction) * step;

    updatePaneWidth(pane, nextWidth);
  }

  function setEditorText(text: string, nextPath: string | null) {
    contents = text;
    path = nextPath;
    isDirty = false;
    grammarReport = null;
    grammarError = "";
    grammarCheckedText = "";
    syncStats();
  }

  async function loadNoteContents(root: string, notes: string[]) {
    const entries = await Promise.all(
      notes.map(async (note) => [note, await readNote(`${root}/${note}`)] as const),
    );

    noteContents = Object.fromEntries(entries);
  }

  async function refreshSpace() {
    if (!spaceRoot) {
      spaceNotes = [];
      spaceMeta = {};
      databases = [];
      noteContents = {};
      return;
    }

    const root = spaceRoot;
    const notes = await listSpace(root);
    const [meta, databaseSummaries] = await Promise.all([
      loadSpaceMeta(root),
      listDatabases(root),
    ]);

    await loadNoteContents(root, notes);

    spaceNotes = notes;
    spaceMeta = meta;
    databases = databaseSummaries;
  }

  async function createSpaceDatabase(name: string) {
    if (!spaceRoot) {
      return;
    }

    await flushNoteSave();

    const columns = defaultColumns();
    const id = slugify(name);

    await createDatabase(spaceRoot, id, name, columns, defaultViews(columns));
    await refreshSpace();
    activeDatabaseId = id;
    databasesOpen = false;
    statusMessage = `Created database ${name}`;
  }

  async function selectDatabase(id: string) {
    await flushNoteSave();

    activeDatabaseId = id;
    databasesOpen = false;
    statusMessage = `Opened ${databases.find((entry) => entry.id === id)?.name ?? id}`;
  }

  async function deleteSpaceDatabase(id: string) {
    const name = databases.find((entry) => entry.id === id)?.name ?? id;

    if (!spaceRoot || !(await confirmDelete(name))) {
      return;
    }

    await deleteDatabase(spaceRoot, id);

    if (activeDatabaseId === id) {
      activeDatabaseId = null;
    }

    await refreshSpace();
    statusMessage = `Deleted database ${name}`;
  }

  async function chooseSpace() {
    const selectedRoot = await chooseSpaceRoot();

    if (!selectedRoot) {
      return;
    }

    spaceRoot = selectedRoot;
    saveSpaceRoot(spaceRoot);
    setEditorText("", null);
    await refreshSpace();
    statusMessage = `Space ${basename(spaceRoot)}`;
  }

  async function selectSpaceNote(relativePath: string) {
    await flushNoteSave();

    activeDatabaseId = null;

    const notePath = spacePath(relativePath);

    const text = await readNote(notePath);

    noteContents = { ...noteContents, [relativePath]: text };
    setEditorText(text, notePath);
    statusMessage = `Selected ${displayNotePath(relativePath)}`;
    focusEditor();
  }

  function spacePath(relativePath: string) {
    return `${spaceRoot}/${relativePath}`;
  }

  /** Names come from a text field, so they must not walk out of the space. */
  function safeName(name: string) {
    if (/[\\/]/.test(name) || name === "." || name === "..") {
      throw new Error("Names cannot contain slashes");
    }

    return name;
  }

  async function createSpaceNote(
    parentPath: string,
    name: string,
    folder = false,
  ) {
    await flushNoteSave();

    const parent = parentPath ? `${parentPath}/` : "";
    const relativePath = folder
      ? dirNotePath(`${parent}${safeName(name)}`)
      : `${parent}${withNoteExtension(safeName(name))}`;

    await createNote(spacePath(relativePath));
    await refreshSpace();
    setEditorText("", spacePath(relativePath));
    noteContents = { ...noteContents, [relativePath]: "" };
    statusMessage = `Created ${displayNotePath(relativePath)}`;
    focusEditor();
  }

  async function openWikilink(rawTarget: string) {
    if (!spaceRoot) {
      return;
    }

    await flushNoteSave();

    const resolved = resolveWikilinkTarget(rawTarget, spaceNotes, activeRelativePath);

    if (resolved.path) {
      await selectSpaceNote(resolved.path);
      return;
    }

    const relativePath = wikilinkCreatePath(rawTarget, activeRelativePath);

    if (!relativePath) {
      statusMessage = "That wikilink target is not a valid note path";
      return;
    }

    await createNote(spacePath(relativePath));
    await refreshSpace();
    setEditorText("", spacePath(relativePath));
    noteContents = { ...noteContents, [relativePath]: "" };
    statusMessage = `Created ${displayNotePath(relativePath)}`;
    focusEditor();
  }

  function resolveActiveWikilink(rawTarget: string) {
    return resolveWikilinkTarget(rawTarget, spaceNotes, activeRelativePath);
  }

  function renderActiveWikilinkEmbed(rawTarget: string, depth: number): WikilinkEmbed | null {
    const resolved = resolveWikilinkTarget(rawTarget, spaceNotes, activeRelativePath);
    const maxDepth = 2;

    if (!resolved.exists || !resolved.path) {
      return {
        title: rawTarget,
        html: "",
        exists: false,
      };
    }

    const embeddedText =
      resolved.path === activeRelativePath
        ? contents
        : (noteContents[resolved.path] ?? "");
    const embeddedPath = spacePath(resolved.path);
    const embeddedDir = embeddedPath.includes("/")
      ? embeddedPath.slice(0, embeddedPath.lastIndexOf("/"))
      : spaceRoot;

    return {
      title: displayNotePath(resolved.path),
      html: renderDocument(embeddedText, (source) => resolveAssetFromDir(embeddedDir, source), {
        fancyTableEditor: false,
        drawings: settings.features.drawings,
        diagrams: settings.features.diagrams,
        staticDiagramPreviews: true,
        resolveWikilink: (target) =>
          resolveWikilinkTarget(target, spaceNotes, resolved.path),
        renderWikilinkEmbed: depth + 1 >= maxDepth ? undefined : renderActiveWikilinkEmbed,
        wikilinkEmbedDepth: depth + 1,
      }),
      exists: true,
    };
  }

  async function renameSpaceEntry(relativePath: string, name: string) {
    await flushNoteSave();

    const parent = relativePath.includes("/")
      ? `${relativePath.slice(0, relativePath.lastIndexOf("/"))}/`
      : "";
    const isFolder = !spaceNotes.includes(relativePath);
    const nextRelativePath = `${parent}${isFolder ? safeName(name) : withNoteExtension(safeName(name))}`;

    await renamePath(spacePath(relativePath), spacePath(nextRelativePath));

    // A folder's own markdown is named after it, so it follows the folder.
    const dirNote = `${relativePath}/${dirNoteName(basename(relativePath))}`;
    const nextDirNote = dirNotePath(nextRelativePath);

    if (isFolder && spaceNotes.includes(dirNote)) {
      await renamePath(
        spacePath(`${nextRelativePath}/${dirNoteName(basename(relativePath))}`),
        spacePath(nextDirNote),
      );
    }

    if (path === spacePath(relativePath)) {
      path = spacePath(nextRelativePath);
    } else if (isFolder && path?.startsWith(`${spacePath(relativePath)}/`)) {
      path =
        path === spacePath(dirNote)
          ? spacePath(nextDirNote)
          : path.replace(spacePath(relativePath), spacePath(nextRelativePath));
    }

    await renamePageMeta(spaceRoot!, relativePath, nextRelativePath, isFolder);
    spaceMeta = renamedMeta(
      spaceMeta,
      relativePath,
      nextRelativePath,
      isFolder,
    );
    noteContents = renamedNoteContents(
      noteContents,
      relativePath,
      nextRelativePath,
      isFolder,
    );
    await refreshSpace();
    statusMessage = `Renamed to ${displayNotePath(nextRelativePath)}`;
  }

  async function deleteSpaceEntry(relativePath: string) {
    await flushNoteSave();

    if (!(await confirmDelete(relativePath))) {
      return;
    }

    await deletePath(spacePath(relativePath));

    if (path === spacePath(relativePath)) {
      setEditorText("", null);
    }

    const isFolder = !spaceNotes.includes(relativePath);

    await deletePageMeta(spaceRoot!, relativePath, isFolder);
    spaceMeta = deletedMeta(spaceMeta, relativePath, isFolder);
    noteContents = deletedNoteContents(noteContents, relativePath, isFolder);

    // The deleted note's media is now unreferenced, so its folder loses the orphans.
    const parent = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.lastIndexOf("/"))
      : "";

    await pruneAssets(parent ? spacePath(parent) : spaceRoot!);
    await refreshSpace();
    statusMessage = `Deleted ${displayNotePath(relativePath)}`;
  }

  async function updateActiveMeta(nextMeta: PageMeta) {
    if (!spaceRoot || !activeEntryPath) {
      return;
    }

    const cleaned = cleanPageMeta(nextMeta);

    await savePageMeta(spaceRoot, activeEntryPath, cleaned);

    if (hasPageMeta(cleaned)) {
      spaceMeta = { ...spaceMeta, [activeEntryPath]: cleaned };
    } else {
      const { [activeEntryPath]: _removed, ...rest } = spaceMeta;
      spaceMeta = rest;
    }
  }

  function updateActiveIcon(icon: PageIcon | null) {
    return updateActiveMeta({ ...activePageMeta, icon });
  }

  function updateActiveCover(cover: string | null) {
    return updateActiveMeta({ ...activePageMeta, cover });
  }

  async function pickActiveCover() {
    if (!path || !noteDir) {
      return;
    }

    const paths = await chooseFiles();
    const coverPath = paths[0];

    if (!coverPath) {
      return;
    }

    const stored = await copyAsset(`${noteDir}/assets/images`, coverPath);

    await updateActiveCover(relativeToNote(stored));
    statusMessage = "Updated cover";
  }

  function renamedMeta(
    meta: SpaceMeta,
    from: string,
    to: string,
    folder: boolean,
  ): SpaceMeta {
    const next: SpaceMeta = {};
    const prefix = `${from}/`;

    for (const [key, value] of Object.entries(meta)) {
      if (key === from) {
        next[to] = value;
      } else if (folder && key.startsWith(prefix)) {
        next[`${to}/${key.slice(prefix.length)}`] = value;
      } else {
        next[key] = value;
      }
    }

    return next;
  }

  function renamedNoteContents(
    contentsByPath: Record<string, string>,
    from: string,
    to: string,
    folder: boolean,
  ) {
    const next: Record<string, string> = {};
    const prefix = `${from}/`;

    for (const [key, value] of Object.entries(contentsByPath)) {
      if (key === from) {
        next[to] = value;
      } else if (folder && key.startsWith(prefix)) {
        next[`${to}/${key.slice(prefix.length)}`] = value;
      } else {
        next[key] = value;
      }
    }

    return next;
  }

  function deletedMeta(
    meta: SpaceMeta,
    path: string,
    folder: boolean,
  ): SpaceMeta {
    const next: SpaceMeta = {};
    const prefix = `${path}/`;

    for (const [key, value] of Object.entries(meta)) {
      if (key !== path && !(folder && key.startsWith(prefix))) {
        next[key] = value;
      }
    }

    return next;
  }

  function deletedNoteContents(
    contentsByPath: Record<string, string>,
    path: string,
    folder: boolean,
  ) {
    const next: Record<string, string> = {};
    const prefix = `${path}/`;

    for (const [key, value] of Object.entries(contentsByPath)) {
      if (key !== path && !(folder && key.startsWith(prefix))) {
        next[key] = value;
      }
    }

    return next;
  }

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

    scheduleStats();
    scheduleNoteSave();
    scheduleGrammarCheck();

    if (statusMessage !== "Saving...") {
      statusMessage = "Saving...";
    }
  }

  function assetDir(name: string, mime = "") {
    return `${noteDir}/assets/${assetFolder(name, mime)}`;
  }

  function relativeToNote(assetPath: string) {
    return assetPath.startsWith(`${noteDir}/`)
      ? assetPath.slice(noteDir!.length + 1)
      : assetPath;
  }

  /** Markdown for every stored file, one per line. */
  async function storeAssets(source: { files?: File[]; paths?: string[] }) {
    if (!noteDir) {
      return "";
    }

    const stored: string[] = [];

    for (const file of source.files ?? []) {
      const compressed = await compressImage(file);
      const name =
        compressed.name ||
        `pasted-${Date.now()}.${compressed.blob.type.split("/")[1] || "bin"}`;
      const bytes = Array.from(
        new Uint8Array(await compressed.blob.arrayBuffer()),
      );

      stored.push(
        await writeAsset(assetDir(name, compressed.blob.type), name, bytes),
      );
    }

    for (const filePath of source.paths ?? []) {
      stored.push(await copyAsset(assetDir(basename(filePath)), filePath));
    }

    statusMessage = `Added ${stored.length} file${stored.length === 1 ? "" : "s"}`;

    return stored
      .map((assetPath) => assetMarkdown(relativeToNote(assetPath)))
      .join("\n");
  }

  async function pickAssets() {
    const paths = await chooseFiles();

    return paths.length ? storeAssets({ paths }) : "";
  }

  async function generateFromPrompt(prompt: string) {
    statusMessage = "Generating...";

    try {
      const generated = await generateContent(settings.llm, prompt);

      statusMessage = "Generated content";

      return generated;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  $: grammarProfile = settings.grammarProfiles[settings.grammarMode];
  $: grammarAutoFull =
    settings.features.grammarPolice && settings.features.grammarCheckMode === "auto-full";
  $: grammarAutoDiff =
    settings.features.grammarPolice && settings.features.grammarCheckMode === "auto-diff";
  $: grammarDecorations = (grammarReport?.issues ?? []).flatMap((issue) => {
    const range = issueRange(contents, issue);

    return range ? [{ ...range, tone: issue.kind }] : [];
  });

  async function runGrammarCheck() {
    if (!settings.features.grammarPolice || !contents.trim() || grammarChecking) {
      return;
    }

    grammarChecking = true;
    grammarError = "";
    grammarCheckedText = contents;
    statusMessage = "Grammar Police is reading...";

    try {
      grammarReport = await checkGrammar(
        settings.llm,
        contents,
        settings.grammarMode,
        grammarProfile,
      );
      statusMessage = `Writing score ${grammarReport.score}`;
    } catch (error) {
      grammarError = error instanceof Error ? error.message : String(error);
      statusMessage = grammarError;
    } finally {
      grammarChecking = false;
    }
  }

  function canAutoCheckGrammar() {
    return grammarAutoFull || (grammarAutoDiff && Boolean(grammarCheckedText));
  }

  /** Re-checking costs a request per run, so it waits for a real pause in typing. */
  function scheduleGrammarCheck() {
    if ((!grammarAutoFull && !grammarAutoDiff) || !grammarOpen) {
      return;
    }

    if (grammarTimer) {
      clearTimeout(grammarTimer);
    }

    grammarTimer = setTimeout(() => {
      grammarTimer = undefined;

      if (contents !== grammarCheckedText && canAutoCheckGrammar()) {
        void runGrammarCheck();
      }
    }, 2500);
  }

  function updateGrammarProfile(profile: GrammarProfile) {
    settings = {
      ...settings,
      grammarProfiles: {
        ...settings.grammarProfiles,
        [settings.grammarMode]: profile,
      },
    };
  }

  /** A different coach grades the same text differently, so the old report is stale. */
  function setGrammarMode(mode: GrammarMode) {
    if (mode === settings.grammarMode) {
      return;
    }

    settings = { ...settings, grammarMode: mode };
    grammarReport = null;
    grammarError = "";
    grammarCheckedText = "";

    if (canAutoCheckGrammar()) {
      void runGrammarCheck();
    }
  }

  function toggleGrammar() {
    if (!settings.features.grammarPolice) {
      return;
    }

    grammarOpen = !grammarOpen;

    if (grammarOpen && canAutoCheckGrammar() && !grammarReport && !grammarError) {
      void runGrammarCheck();
    }
  }

  function dismissGrammarIssue(issue: GrammarIssue) {
    if (grammarReport) {
      grammarReport = {
        ...grammarReport,
        issues: grammarReport.issues.filter((entry) => entry !== issue),
      };
    }
  }

  /** An excerpt that no longer matches means the note moved on, so the issue just goes away. */
  function applyGrammarIssue(issue: GrammarIssue) {
    const next = applyIssue(contents, issue);

    if (next === null) {
      statusMessage = "That text changed, so the fix no longer applies";
    } else {
      contents = next;
      updateNote();
    }

    dismissGrammarIssue(issue);
  }

  function resolveAssetFromDir(dir: string | null, source: string) {
    if (!dir || /^[a-z][\w+.-]*:/i.test(source) || source.startsWith("/")) {
      return source;
    }

    return convertFileSrc(`${dir}/${decodeURI(source)}`);
  }

  function resolveAsset(source: string) {
    return resolveAssetFromDir(noteDir, source);
  }

  function handleShortcut(event: KeyboardEvent) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (event.key === "Escape" && (settingsOpen || databasesOpen)) {
      settingsOpen = false;
      databasesOpen = false;
      return;
    }

    if (!isPrimaryShortcut) {
      return;
    }

    if (event.key === ",") {
      event.preventDefault();
      settingsOpen = !settingsOpen;
    }

    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleSpacePane();
    }
  }

  runWithStatus(refreshSpace);

  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      prefersDark = mediaQuery.matches;
    };

    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  });

  onDestroy(() => {
    if (noteSaveTimer) {
      clearTimeout(noteSaveTimer);
      void saveActiveNote();
    }

    if (statsTimer) {
      clearTimeout(statsTimer);
    }

    if (grammarTimer) {
      clearTimeout(grammarTimer);
    }
  });
</script>

<svelte:window
  onbeforeunload={() => void flushNoteSave()}
  onkeydown={handleShortcut}
  onpointermove={handleResize}
  onpointerup={stopResize}
/>

<main
  class="grid h-screen overflow-hidden bg-[#fffdfa] text-stone-900 dark:bg-[#1a1917] dark:text-stone-100"
  style="grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr);"
>
  <EditorToolbar
    title={appTitle}
    {fileLabel}
    {breadcrumbs}
    {isDirty}
    spacePaneOpen={settings.spacePaneOpen}
    grammarEnabled={settings.features.grammarPolice}
    databasesEnabled={settings.features.databases}
    onSelectBreadcrumb={(relativePath) =>
      runWithStatus(() => selectSpaceNote(relativePath))}
    onToggleSpacePane={toggleSpacePane}
    onToggleSettings={() => (settingsOpen = !settingsOpen)}
    onToggleDatabases={() => {
      if (settings.features.databases) {
        databasesOpen = !databasesOpen;
      }
    }}
    onToggleGrammar={toggleGrammar}
  />

  <div class="flex min-h-0 min-w-0">
    {#if settings.spacePaneOpen}
      <div class="flex min-h-0 shrink-0" transition:slide={paneSlide}>
        <SpaceSidebar
          width={settings.spacePaneWidth}
          root={spaceRoot}
          notes={spaceNotes}
          meta={spaceMeta}
          activePath={activeRelativePath}
          onChooseSpace={() => runWithStatus(chooseSpace)}
          onRefresh={() => runWithStatus(refreshSpace)}
          onSelect={(relativePath) =>
            runWithStatus(() => selectSpaceNote(relativePath))}
          onCreate={(parentPath, name, folder) =>
            runWithStatus(() => createSpaceNote(parentPath, name, folder))}
          onRename={(relativePath, name) =>
            runWithStatus(() => renameSpaceEntry(relativePath, name))}
          onDelete={(relativePath) =>
            runWithStatus(() => deleteSpaceEntry(relativePath))}
        />

        <button
          type="button"
          class="z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-emerald-600/20 focus-visible:bg-emerald-600/20 focus-visible:outline-none"
          aria-label="Resize space pane"
          title="Resize space pane"
          onpointerdown={(event) => startResize(event, "space")}
          onkeydown={(event) => resizeWithKeyboard(event, "space")}
        ></button>
      </div>
    {/if}

    <div class="min-w-0 flex-1">
      {#if settings.features.databases && activeDatabaseId && spaceRoot}
        <DatabaseView
          root={spaceRoot}
          databaseId={activeDatabaseId}
          databaseOptions={databases}
          onStatus={(message) => (statusMessage = message)}
          onRenamed={(name) =>
            (databases = databases.map((entry) =>
              entry.id === activeDatabaseId ? { ...entry, name } : entry,
            ))}
        />
      {:else}
        <NoteEditorForm
          bind:contents
          bind:editor
          editorWidth={settings.editorWidth}
          textSize={settings.textSize}
          spellcheck={settings.spellcheck}
          slashCommands={settings.slashCommands}
          fancyTableEditor={settings.features.fancyTableEditor}
          drawings={settings.features.drawings}
          diagrams={settings.features.diagrams}
          editable={Boolean(path)}
          {noteTitle}
          pageMeta={activePageMeta}
          showPageTitle={settings.showPageTitle}
          placeholder={spaceRoot
            ? "Select or create a note"
            : "Choose a space from the sidebar"}
          onInput={updateNote}
          onIconChange={(icon) => runWithStatus(() => updateActiveIcon(icon))}
          onCoverChange={(cover) =>
            runWithStatus(() => updateActiveCover(cover))}
          onPickCover={() => runWithStatus(pickActiveCover)}
          onAssets={(source) =>
            storeAssets(source).catch((error) => {
              statusMessage =
                error instanceof Error ? error.message : String(error);
              return "";
            })}
          onPickAssets={() =>
            pickAssets().catch((error) => {
              statusMessage =
                error instanceof Error ? error.message : String(error);
              return "";
            })}
          onGenerate={generateFromPrompt}
          onWikilink={(target) => runWithStatus(() => openWikilink(target))}
          resolveWikilink={resolveActiveWikilink}
          renderWikilinkEmbed={renderActiveWikilinkEmbed}
          {wikilinkKey}
          {backlinks}
          onSelectBacklink={(relativePath) =>
            runWithStatus(() => selectSpaceNote(relativePath))}
          decorations={settings.features.grammarPolice && grammarOpen ? grammarDecorations : []}
          {resolveAsset}
        />
      {/if}
    </div>

    {#if settings.features.grammarPolice && grammarOpen && !activeDatabaseId}
      <div class="flex min-h-0" transition:slide={paneSlide}>
        <GrammarPolice
          report={grammarReport}
          checking={grammarChecking}
          error={grammarError}
          canCheck={Boolean(path) && Boolean(contents.trim())}
          mode={settings.grammarMode}
          onModeChange={setGrammarMode}
          onCheck={runGrammarCheck}
          onApply={applyGrammarIssue}
          onDismiss={dismissGrammarIssue}
          onExplain={(issue) =>
            explainIssue(settings.llm, issue, grammarProfile)}
          profile={grammarProfile}
          onProfileChange={updateGrammarProfile}
          {words}
          onClose={() => (grammarOpen = false)}
        />
      </div>
    {/if}

    {#if settings.features.databases && databasesOpen}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
        role="presentation"
        onclick={() => (databasesOpen = false)}
      >
        <div
          class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50"
          role="presentation"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(event) => event.stopPropagation()}
        >
          <DatabaseManager
            {databases}
            {activeDatabaseId}
            onSelect={(id) => runWithStatus(() => selectDatabase(id))}
            onCreate={(name) => runWithStatus(() => createSpaceDatabase(name))}
            onDelete={(id) => runWithStatus(() => deleteSpaceDatabase(id))}
            onClose={() => (databasesOpen = false)}
          />
        </div>
      </div>
    {/if}

    {#if settingsOpen}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
        role="presentation"
        onclick={() => (settingsOpen = false)}
      >
        <div
          class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50"
          role="presentation"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
        >
          <SettingsPanel
            {settings}
            onClose={() => (settingsOpen = false)}
            onReset={resetSettings}
            onChange={updateSettings}
          />
        </div>
      </div>
    {/if}
  </div>

  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
