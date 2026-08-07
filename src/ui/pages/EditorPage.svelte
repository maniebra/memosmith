<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { slide, scale } from "svelte/transition";
  import { defaultSettings, loadSettings, saveSettings } from "../../lib/storage/settings";
  import { loadSpaceRoot, saveSpaceRoot } from "../../lib/storage/space";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { assetFolder, assetMarkdown } from "../../lib/utils/assets";
  import { compressImage } from "../../lib/utils/image";
  import {
    chooseFiles,
    chooseSpaceRoot,
    confirmDelete,
    copyAsset,
    writeAsset,
    createNote,
    deletePath,
    listSpace,
    pruneAssets,
    readNote,
    renamePath,
    writeNote,
  } from "../../lib/tauri/files";
  import {
    basename,
    dirNoteName,
    dirNotePath,
    displayNoteName,
    displayNotePath,
    withNoteExtension,
  } from "../../lib/utils/path";
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
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200,
  };

  let path: string | null = null;
  let spaceRoot = loadSpaceRoot();
  let spaceNotes: string[] = [];
  let isDirty = false;
  let contents = "";
  let statusMessage = spaceRoot ? "Select or create a note" : "Choose a space to start";
  let editor: HTMLElement | undefined;
  let words = countWords(contents);
  let characters = contents.length;
  let settings = loadSettings();
  let settingsOpen = false;
  let prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let noteSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let statsTimer: ReturnType<typeof setTimeout> | undefined;
  let resizing:
    | {
        pane: "space" | "settings";
        startX: number;
        startWidth: number;
      }
    | null = null;

  $: noteDir = path ? path.slice(0, path.lastIndexOf("/")) : null;
  $: spacePrefix = spaceRoot ? `${spaceRoot}/` : null;
  $: activeRelativePath =
    path && spacePrefix && path.startsWith(spacePrefix) ? path.slice(spacePrefix.length) : null;
  $: fileLabel = activeRelativePath ? displayNotePath(activeRelativePath) : spaceRoot ? "No note selected" : "No space";
  $: noteTitle = activeRelativePath ? displayNoteName(activeRelativePath) : "";
  $: dirtyMarker = isDirty ? " *" : "";
  $: displayName = `${fileLabel}${dirtyMarker}`;
  $: document.title = `${displayName} - ${appTitle}`;
  $: applyTheme(settings.theme, prefersDark);
  $: saveSettings(settings);

  function countWords(text: string) {
    const trimmedText = text.trim();

    return trimmedText ? trimmedText.split(/\s+/).length : 0;
  }

  function syncStats() {
    characters = contents.length;
    words = countWords(contents);
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

  function applyTheme(theme: typeof settings.theme, systemPrefersDark: boolean) {
    const useDark = theme === "dark" || (theme === "system" && systemPrefersDark);

    document.documentElement.classList.toggle("dark", useDark);
    document.documentElement.style.colorScheme = useDark ? "dark" : "light";
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
      startWidth: pane === "space" ? settings.spacePaneWidth : settings.settingsPaneWidth,
    };
  }

  function handleResize(event: PointerEvent) {
    if (!resizing) {
      return;
    }

    const delta = event.clientX - resizing.startX;
    const nextWidth =
      resizing.pane === "space" ? resizing.startWidth + delta : resizing.startWidth - delta;

    updatePaneWidth(resizing.pane, nextWidth);
  }

  function stopResize() {
    resizing = null;
  }

  function resizeWithKeyboard(event: KeyboardEvent, pane: "space" | "settings") {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 40 : 12;
    const currentWidth = pane === "space" ? settings.spacePaneWidth : settings.settingsPaneWidth;
    const nextWidth = currentWidth + (pane === "space" ? direction : -direction) * step;

    updatePaneWidth(pane, nextWidth);
  }

  function setEditorText(text: string, nextPath: string | null) {
    contents = text;
    path = nextPath;
    isDirty = false;
    syncStats();
  }

  async function refreshSpace() {
    spaceNotes = spaceRoot ? await listSpace(spaceRoot) : [];
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

    const notePath = spacePath(relativePath);

    setEditorText(await readNote(notePath), notePath);
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

  async function createSpaceNote(parentPath: string, name: string, folder = false) {
    await flushNoteSave();

    const parent = parentPath ? `${parentPath}/` : "";
    const relativePath = folder
      ? dirNotePath(`${parent}${safeName(name)}`)
      : `${parent}${withNoteExtension(safeName(name))}`;

    await createNote(spacePath(relativePath));
    await refreshSpace();
    setEditorText("", spacePath(relativePath));
    statusMessage = `Created ${displayNotePath(relativePath)}`;
    focusEditor();
  }

  async function renameSpaceEntry(relativePath: string, name: string) {
    await flushNoteSave();

    const parent = relativePath.includes("/") ? `${relativePath.slice(0, relativePath.lastIndexOf("/"))}/` : "";
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
      path = path === spacePath(dirNote) ? spacePath(nextDirNote) : path.replace(spacePath(relativePath), spacePath(nextRelativePath));
    }

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

    // The deleted note's media is now unreferenced, so its folder loses the orphans.
    const parent = relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "";

    await pruneAssets(parent ? spacePath(parent) : spaceRoot!);
    await refreshSpace();
    statusMessage = `Deleted ${displayNotePath(relativePath)}`;
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

    scheduleStats();
    scheduleNoteSave();

    if (statusMessage !== "Saving...") {
      statusMessage = "Saving...";
    }
  }

  function assetDir(name: string, mime = "") {
    return `${noteDir}/assets/${assetFolder(name, mime)}`;
  }

  function relativeToNote(assetPath: string) {
    return assetPath.startsWith(`${noteDir}/`) ? assetPath.slice(noteDir!.length + 1) : assetPath;
  }

  /** Markdown for every stored file, one per line. */
  async function storeAssets(source: { files?: File[]; paths?: string[] }) {
    if (!noteDir) {
      return "";
    }

    const stored: string[] = [];

    for (const file of source.files ?? []) {
      const compressed = await compressImage(file);
      const name = compressed.name || `pasted-${Date.now()}.${compressed.blob.type.split("/")[1] || "bin"}`;
      // ponytail: bytes cross as a JSON number array; move to a raw request if large files drag.
      const bytes = Array.from(new Uint8Array(await compressed.blob.arrayBuffer()));

      stored.push(await writeAsset(assetDir(name, compressed.blob.type), name, bytes));
    }

    for (const filePath of source.paths ?? []) {
      stored.push(await copyAsset(assetDir(basename(filePath)), filePath));
    }

    statusMessage = `Added ${stored.length} file${stored.length === 1 ? "" : "s"}`;

    return stored.map((assetPath) => assetMarkdown(relativeToNote(assetPath))).join("\n");
  }

  async function pickAssets() {
    const paths = await chooseFiles();

    return paths.length ? storeAssets({ paths }) : "";
  }

  function resolveAsset(source: string) {
    if (!noteDir || /^[a-z][\w+.-]*:/i.test(source) || source.startsWith("/")) {
      return source;
    }

    return convertFileSrc(`${noteDir}/${decodeURI(source)}`);
  }

  function handleShortcut(event: KeyboardEvent) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (event.key === "Escape" && settingsOpen) {
      settingsOpen = false;
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
    {isDirty}
    spacePaneOpen={settings.spacePaneOpen}
    onToggleSpacePane={toggleSpacePane}
    onToggleSettings={() => (settingsOpen = !settingsOpen)}
  />

  <div class="flex min-h-0 min-w-0">
    {#if settings.spacePaneOpen}
      <div class="flex min-h-0 shrink-0" transition:slide={paneSlide}>
        <SpaceSidebar
          width={settings.spacePaneWidth}
          root={spaceRoot}
          notes={spaceNotes}
          activePath={activeRelativePath}
          onChooseSpace={() => runWithStatus(chooseSpace)}
          onRefresh={() => runWithStatus(refreshSpace)}
          onSelect={(relativePath) => runWithStatus(() => selectSpaceNote(relativePath))}
          onCreate={(parentPath, name, folder) => runWithStatus(() => createSpaceNote(parentPath, name, folder))}
          onRename={(relativePath, name) => runWithStatus(() => renameSpaceEntry(relativePath, name))}
          onDelete={(relativePath) => runWithStatus(() => deleteSpaceEntry(relativePath))}
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
      <NoteEditorForm
        bind:contents
        bind:editor
        editorWidth={settings.editorWidth}
        textSize={settings.textSize}
        spellcheck={settings.spellcheck}
        slashCommands={settings.slashCommands}
        editable={Boolean(path)}
        {noteTitle}
        showPageTitle={settings.showPageTitle}
        placeholder={spaceRoot ? "Select or create a note" : "Choose a space from the sidebar"}
        onInput={updateNote}
        onAssets={(source) =>
          storeAssets(source).catch((error) => {
            statusMessage = error instanceof Error ? error.message : String(error);
            return "";
          })}
        onPickAssets={() =>
          pickAssets().catch((error) => {
            statusMessage = error instanceof Error ? error.message : String(error);
            return "";
          })}
        {resolveAsset}
      />
    </div>

    {#if settingsOpen}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm" onclick={() => (settingsOpen = false)}>
        <div class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50" transition:scale={{ duration: 150, start: 0.95 }} onclick={(e) => e.stopPropagation()}>
          <SettingsPanel
            {settings}
            onClose={() => (settingsOpen = false)}
            onReset={resetSettings}
            onChange={updateSettings}
          />
        </div>
      </div>
    {/if}
  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
