<script lang="ts">
  import { FileText, FolderOpen, Plus } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import Button from "../components/Button.svelte";

  export let root: string | null;
  export let notes: string[];
  export let onNewNote: () => void;
  export let onChooseSpace: () => void;
  export let onOpenNote: (relativePath: string) => void;

  $: recent = notes.slice(0, 8);

  function label(relativePath: string) {
    return relativePath.replace(/\.md$/i, "").split("/").pop() ?? relativePath;
  }
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
            variant="ghost"
            size="sm"
            onClick={onNewNote}
            disabled={!root}
          />
          <Button
            label={$i18n.t("welcome.openSpace")}
            icon={FolderOpen}
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
            {#each recent as note (note)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-sm text-stone-600 hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:text-stone-300 dark:hover:text-stone-100"
                  onclick={() => onOpenNote(note)}
                >
                  <FileText
                    class="size-4 shrink-0 text-stone-400"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span class="truncate">{label(note)}</span>
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
