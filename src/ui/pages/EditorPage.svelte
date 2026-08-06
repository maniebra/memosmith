<script lang="ts">
  import { onDestroy } from "svelte";
  import { loadDraft, loadSpaceRoot, saveDraft, saveSpaceRoot } from "../../lib/storage/draft";
  import {
    chooseNotePath,
    chooseSavePath,
    chooseSpaceRoot,
    confirmDelete,
    createNote,
    deletePath,
    listSpace,
    readNote,
    renamePath,
    writeNote,
  } from "../../lib/tauri/files";
  import { basename, withNoteExtension } from "../../lib/utils/path";
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import EditorStatusBar from "../sections/EditorStatusBar.svelte";
  import EditorToolbar from "../sections/EditorToolbar.svelte";
  import SpaceSidebar from "../sections/SpaceSidebar.svelte";

  const appTitle = "MemoSmith";
  const draft = loadDraft();

  let path = draft.path;
  let spaceRoot = loadSpaceRoot();
  let spaceNotes: string[] = [];
  let isDirty = false;
  let contents = draft.contents;
  let statusMessage = "Draft autosaved locally";
  let editor: HTMLElement | undefined;
  let words = countWords(contents);
  let characters = contents.length;
  let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let statsTimer: ReturnType<typeof setTimeout> | undefined;

  $: spacePrefix = spaceRoot ? `${spaceRoot}/` : null;
  $: activeRelativePath =
    path && spacePrefix && path.startsWith(spacePrefix) ? path.slice(spacePrefix.length) : null;
  $: fileLabel = activeRelativePath ?? (path ? basename(path) : "Untitled note");
  $: dirtyMarker = isDirty ? " *" : "";
  $: displayName = `${fileLabel}${dirtyMarker}`;
  $: document.title = `${displayName} - ${appTitle}`;

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

  function writeDraft() {
    saveDraft({ contents, path });
  }

  function scheduleDraftSave() {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
    }

    draftSaveTimer = setTimeout(() => {
      writeDraft();
      draftSaveTimer = undefined;
    }, 350);
  }

  function flushDraftSave() {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = undefined;
    }

    writeDraft();
  }

  function focusEditor() {
    editor?.focus();
  }

  function setEditorText(text: string, nextPath: string | null) {
    contents = text;
    path = nextPath;
    isDirty = false;
    syncStats();
    flushDraftSave();
  }

  async function saveNote(saveAs = false) {
    const selectedPath = saveAs || !path ? await chooseSavePath(path) : path;

    if (!selectedPath) {
      statusMessage = "Save canceled";
      return;
    }

    await writeNote(selectedPath, contents);

    path = selectedPath;
    isDirty = false;
    flushDraftSave();
    statusMessage = `Saved ${basename(selectedPath)}`;
    await refreshSpace();
  }

  async function openNote() {
    const selectedPath = await chooseNotePath();

    if (!selectedPath) {
      statusMessage = "Open canceled";
      return;
    }

    setEditorText(await readNote(selectedPath), selectedPath);
    statusMessage = `Opened ${basename(selectedPath)}`;
    focusEditor();
  }

  async function refreshSpace() {
    spaceNotes = spaceRoot ? await listSpace(spaceRoot) : [];
  }

  async function openSpace() {
    const selectedRoot = await chooseSpaceRoot();

    if (!selectedRoot) {
      return;
    }

    spaceRoot = selectedRoot;
    saveSpaceRoot(spaceRoot);
    await refreshSpace();
    statusMessage = `Space ${basename(spaceRoot)}`;
  }

  async function openSpaceNote(relativePath: string) {
    const notePath = spacePath(relativePath);

    setEditorText(await readNote(notePath), notePath);
    statusMessage = `Opened ${relativePath}`;
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

  async function createSpaceNote(parentPath: string, name: string) {
    const relativePath = `${parentPath ? `${parentPath}/` : ""}${withNoteExtension(safeName(name))}`;

    await createNote(spacePath(relativePath));
    await refreshSpace();
    setEditorText("", spacePath(relativePath));
    statusMessage = `Created ${relativePath}`;
    focusEditor();
  }

  async function renameSpaceEntry(relativePath: string, name: string) {
    const parent = relativePath.includes("/") ? `${relativePath.slice(0, relativePath.lastIndexOf("/"))}/` : "";
    const isFolder = !spaceNotes.includes(relativePath);
    const nextRelativePath = `${parent}${isFolder ? safeName(name) : withNoteExtension(safeName(name))}`;

    await renamePath(spacePath(relativePath), spacePath(nextRelativePath));

    if (path === spacePath(relativePath)) {
      path = spacePath(nextRelativePath);
      flushDraftSave();
    }

    await refreshSpace();
    statusMessage = `Renamed to ${nextRelativePath}`;
  }

  async function deleteSpaceEntry(relativePath: string) {
    if (!(await confirmDelete(relativePath))) {
      return;
    }

    await deletePath(spacePath(relativePath));

    if (path === spacePath(relativePath)) {
      setEditorText("", null);
    }

    await refreshSpace();
    statusMessage = `Deleted ${relativePath}`;
  }

  function newNote() {
    setEditorText("", null);
    statusMessage = "New note";
    focusEditor();
  }

  async function runWithStatus(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function updateDraft() {
    if (!isDirty) {
      isDirty = true;
    }

    scheduleStats();
    scheduleDraftSave();

    if (statusMessage !== "Draft autosaved locally") {
      statusMessage = "Draft autosaved locally";
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (!isPrimaryShortcut) {
      return;
    }

    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      runWithStatus(() => saveNote(event.shiftKey));
    }

    if (event.key.toLowerCase() === "o") {
      event.preventDefault();
      runWithStatus(openNote);
    }

    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      newNote();
    }
  }

  runWithStatus(refreshSpace);

  onDestroy(() => {
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
    }

    if (statsTimer) {
      clearTimeout(statsTimer);
    }
  });
</script>

<svelte:window onbeforeunload={flushDraftSave} onkeydown={handleShortcut} />

<main
  class="grid h-screen overflow-hidden bg-[#fffdfa] text-stone-900 dark:bg-[#1a1917] dark:text-stone-100"
  style="grid-template-rows: auto minmax(0, 1fr) auto;"
>
  <EditorToolbar
    title={appTitle}
    {fileLabel}
    {isDirty}
    onNew={newNote}
    onOpen={() => runWithStatus(openNote)}
    onSave={() => runWithStatus(() => saveNote())}
    onSaveAs={() => runWithStatus(() => saveNote(true))}
  />

  <div class="flex min-h-0">
    <SpaceSidebar
      root={spaceRoot}
      notes={spaceNotes}
      activePath={activeRelativePath}
      onOpenSpace={() => runWithStatus(openSpace)}
      onRefresh={() => runWithStatus(refreshSpace)}
      onSelect={(relativePath) => runWithStatus(() => openSpaceNote(relativePath))}
      onCreate={(parentPath, name) => runWithStatus(() => createSpaceNote(parentPath, name))}
      onRename={(relativePath, name) => runWithStatus(() => renameSpaceEntry(relativePath, name))}
      onDelete={(relativePath) => runWithStatus(() => deleteSpaceEntry(relativePath))}
    />

    <div class="min-w-0 flex-1">
      <NoteEditorForm bind:contents bind:editor onInput={updateDraft} />
    </div>
  </div>

  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
