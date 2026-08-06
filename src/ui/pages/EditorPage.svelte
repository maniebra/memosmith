<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { defaultSettings, loadSettings, saveSettings } from "../../lib/storage/settings";
  import { loadSpaceRoot, saveSpaceRoot } from "../../lib/storage/space";
  import {
    chooseSpaceRoot,
    confirmDelete,
    createNote,
    deletePath,
    listSpace,
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

<svelte:window onbeforeunload={() => void flushNoteSave()} onkeydown={handleShortcut} />

<main
  class="grid h-screen overflow-hidden bg-[#fffdfa] text-stone-900 dark:bg-[#1a1917] dark:text-stone-100"
  style="grid-template-rows: auto minmax(0, 1fr) auto;"
>
  <EditorToolbar
    title={appTitle}
    {fileLabel}
    {isDirty}
    onToggleSettings={() => (settingsOpen = !settingsOpen)}
  />

  <div class="flex min-h-0">
    <SpaceSidebar
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
      />
    </div>

    {#if settingsOpen}
      <SettingsPanel
        {settings}
        onClose={() => (settingsOpen = false)}
        onReset={resetSettings}
        onChange={updateSettings}
      />
    {/if}
  </div>

  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
