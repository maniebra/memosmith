<script lang="ts">
  import { FileText, Folder, FolderOpen, Plus } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { displayNoteName, entryPathFromNote, isDirNotePath } from "../../lib/utils/path";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import Button from "../components/Button.svelte";
  import PageIcon from "../components/PageIcon.svelte";

  export let root: string | null;
  export let notes: string[];
  export let meta: SpaceMeta = {};
  export let onNewNote: () => void;
  export let onChooseSpace: () => void;
  export let onOpenNote: (relativePath: string) => void;

  // Folder notes live at <folder>/<folder>.dir.md, and the sidebar keys their
  // icon by the folder path, so both come from the entry path, not the file.
  $: recent = notes.slice(0, 8).map((note) => ({
    note,
    label: displayNoteName(note),
    icon: meta[entryPathFromNote(note)]?.icon,
    fallback: isDirNotePath(note) ? Folder : FileText,
  }));
</script>

<div class="flex h-full items-start justify-center overflow-y-auto px-8 py-16">
  <div class="w-full max-w-2xl">
    <h1 class="text-3xl font-semibold text-stone-800 dark:text-stone-100">
      {$i18n.t("welcome.title")}
    </h1>
    <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
      {$i18n.t("welcome.tagline")}
    </p>

    <div class="mt-10 grid gap-10 sm:grid-cols-2">
      <div>
        <h2
          class="mb-3 text-xs font-semibold tracking-wide text-stone-400 uppercase dark:text-stone-500"
        >
          {$i18n.t("welcome.start")}
        </h2>
        <div class="flex flex-col items-start gap-2">
          <Button
            label={$i18n.t("welcome.newNote")}
            icon={Plus}
            showLabel
            variant="ghost"
            size="sm"
            onClick={onNewNote}
            disabled={!root}
          />
          <Button
            label={$i18n.t("welcome.openSpace")}
            icon={FolderOpen}
            showLabel
            variant="ghost"
            size="sm"
            onClick={onChooseSpace}
          />
        </div>
      </div>

      <div>
        <h2
          class="mb-3 text-xs font-semibold tracking-wide text-stone-400 uppercase dark:text-stone-500"
        >
          {$i18n.t("welcome.recent")}
        </h2>
        {#if recent.length}
          <ul class="flex flex-col gap-1">
            {#each recent as entry (entry.note)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-sm text-stone-600 hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:text-stone-300 dark:hover:text-stone-100"
                  onclick={() => onOpenNote(entry.note)}
                >
                  <PageIcon
                    icon={entry.icon}
                    fallback={entry.fallback}
                    className="size-4 shrink-0 text-base text-stone-400 dark:text-stone-500"
                  />
                  <span class="truncate">{entry.label}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-sm text-stone-400 dark:text-stone-500">
            {$i18n.t(root ? "welcome.noNotes" : "app.chooseSpaceFromSidebar")}
          </p>
        {/if}
      </div>
    </div>
  </div>
</div>
