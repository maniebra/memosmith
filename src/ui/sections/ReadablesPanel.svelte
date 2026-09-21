<script lang="ts">
  import { BookOpen, FileText, Plus, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { Readable } from "../../lib/storage/readables";

  export let readables: Readable[] = [];
  export let activePath: string | null = null;
  export let onAdd: () => void;
  export let onOpen: (path: string) => void;
  export let onRemove: (path: string) => void;
</script>

<section
  class="flex max-h-56 shrink-0 flex-col border-t border-stone-200/70 dark:border-stone-800"
  aria-label={$i18n.t("readables.title")}
>
  <div class="flex h-9 shrink-0 items-center gap-1 px-2">
    <span
      class="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-stone-500 uppercase"
    >
      {$i18n.t("readables.title")}
    </span>
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-100"
      aria-label={$i18n.t("readables.add")}
      title={$i18n.t("readables.add")}
      onclick={onAdd}
    >
      <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
  </div>
  <div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
    {#if !readables.length}
      <p class="px-2 py-3 text-center text-xs text-stone-400">
        {$i18n.t("readables.empty")}
      </p>
    {:else}
      {#each readables as entry (entry.path)}
        <div
          role="presentation"
          draggable="true"
          ondragstart={(event) => {
            // Dropping on the tree files the shortcut into that folder.
            event.dataTransfer?.setData(
              "text/memosmith-path",
              `read:${entry.path}`,
            );
            event.dataTransfer?.setData(
              "application/x-memosmith-tab",
              `read:${entry.path}`,
            );
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
            }
          }}
          class="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm"
          class:bg-stone-500={false}
          class:bg-emerald-600={entry.path === activePath}
          class:text-white={entry.path === activePath}
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-1.5 text-start focus-visible:outline-none"
            title={entry.path}
            onclick={() => onOpen(entry.path)}
          >
            {#if entry.kind === "epub"}
              <BookOpen class="size-3.5 shrink-0" />
            {:else}
              <FileText class="size-3.5 shrink-0" />
            {/if}
            <span class="truncate">{entry.name}</span>
          </button>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-500/20 focus-visible:opacity-100 focus-visible:outline-none"
            aria-label={$i18n.t("readables.remove")}
            title={$i18n.t("readables.remove")}
            onclick={() => onRemove(entry.path)}
          >
            <X class="size-3" />
          </button>
        </div>
      {/each}
    {/if}
  </div>
</section>
