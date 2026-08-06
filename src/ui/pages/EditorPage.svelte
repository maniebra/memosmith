<script lang="ts">
  import { onDestroy } from "svelte";
  import { loadDraft, saveDraft } from "../../lib/storage/draft";
  import {
    chooseNotePath,
    chooseSavePath,
    readNote,
    writeNote,
  } from "../../lib/tauri/files";
  import { basename } from "../../lib/utils/path";
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import EditorStatusBar from "../sections/EditorStatusBar.svelte";
  import EditorToolbar from "../sections/EditorToolbar.svelte";

  const appTitle = "MemoSmith";
  const draft = loadDraft();

  let path = draft.path;
  let isDirty = false;
  let contents = draft.contents;
  let statusMessage = "Draft autosaved locally";
  let editor: HTMLElement | undefined;
  let words = countWords(contents);
  let characters = contents.length;
  let draftSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let statsTimer: ReturnType<typeof setTimeout> | undefined;

  $: fileLabel = path ? basename(path) : "Untitled note";
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

  <NoteEditorForm bind:contents bind:editor onInput={updateDraft} />

  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
