<script lang="ts">
  import { Trash2 } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import Input from "./Input.svelte";
  import type { Annotation } from "../../lib/storage/readables";
  import type { OutlineItem, SearchHit } from "../../lib/utils/reader";

  export let mode: "toc" | "search" | "annotations";
  export let outline: OutlineItem[] = [];
  export let hits: SearchHit[] = [];
  export let annotations: Annotation[] = [];
  export let query = "";
  export let searching = false;
  export let onQuery: (value: string) => void;
  export let onGo: (location: string) => void;
  export let onRemove: (id: string) => void;
  export let onNote: (id: string, note: string) => void;

  const row =
    "w-full rounded-md px-2 py-1 text-start text-xs hover:bg-stone-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25";
</script>

<aside
  class="ms-island flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-s border-stone-200/70 bg-sidebar p-2 dark:border-stone-800"
>
  {#if mode === "toc"}
    {#if !outline.length}
      <p class="px-2 py-4 text-center text-xs text-stone-400">
        {$i18n.t("readables.noContents")}
      </p>
    {/if}
    {#each outline as item (item.location + item.label)}
      <button
        type="button"
        class={row}
        style={`padding-inline-start: ${0.5 + item.depth * 0.75}rem`}
        onclick={() => onGo(item.location)}
      >
        {item.label}
      </button>
    {/each}
  {:else if mode === "search"}
    <Input
      type="search"
      value={query}
      placeholder={$i18n.t("readables.searchPlaceholder")}
      oninput={(event) =>
        onQuery((event.target as HTMLInputElement).value)}
      className="h-8"
    />
    {#if searching}
      <p class="px-2 py-4 text-center text-xs text-stone-400">
        {$i18n.t("readables.searching")}
      </p>
    {:else if query && !hits.length}
      <p class="px-2 py-4 text-center text-xs text-stone-400">
        {$i18n.t("readables.noResults")}
      </p>
    {/if}
    {#each hits as hit, index (hit.location + index)}
      <button type="button" class={row} onclick={() => onGo(hit.location)}>
        <span class="block truncate text-stone-400">{hit.label}</span>
        <span class="block">{hit.excerpt}</span>
      </button>
    {/each}
  {:else}
    {#if !annotations.length}
      <p class="px-2 py-4 text-center text-xs text-stone-400">
        {$i18n.t("readables.noHighlights")}
      </p>
    {/if}
    {#each annotations as entry (entry.id)}
      <div
        class="group rounded-md border border-stone-200/70 p-2 dark:border-stone-800"
      >
        <button
          type="button"
          class="w-full text-start text-xs focus-visible:outline-none"
          onclick={() => onGo(entry.location)}
        >
          <span class="line-clamp-4">{entry.text}</span>
        </button>
        <div class="mt-1 flex items-center gap-1">
          <Input
            value={entry.note}
            placeholder={$i18n.t("readables.notePlaceholder")}
            oninput={(event) =>
              onNote(entry.id, (event.target as HTMLInputElement).value)}
            className="h-7 flex-1 text-xs"
          />
          <button
            type="button"
            class="shrink-0 rounded p-1 text-stone-500 hover:bg-stone-500/10 focus-visible:outline-none"
            aria-label={$i18n.t("readables.removeHighlight")}
            title={$i18n.t("readables.removeHighlight")}
            onclick={() => onRemove(entry.id)}
          >
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </div>
    {/each}
  {/if}
</aside>
