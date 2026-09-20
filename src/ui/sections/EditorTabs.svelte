<script lang="ts">
  import { Columns2, Image, Pin, PinOff, Table, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import PageIcon from "../components/PageIcon.svelte";
  import { displayNoteName, entryPathFromNote } from "../../lib/utils/path";

  export let tabs: string[];
  export let pinned: string[] = [];
  export let activeTab: string | null;
  export let meta: any = {};
  export let databases: { id: string; name: string }[] = [];
  export let onSelect: (id: string) => void;
  export let onClose: (id: string) => void;
  export let onPin: (id: string) => void;
  export let onReorder: (id: string, target: string) => void;
  export let splitTab: string | null = null;
  export let onSplit: (id: string) => void = () => {};

  let dragged: string | null = null;

  const isDatabase = (id: string) => id.startsWith("db:");
  const isPreview = (id: string) => id.startsWith("preview:");

  function label(id: string) {
    if (isDatabase(id)) {
      const dbId = id.slice(3);
      return databases.find((entry) => entry.id === dbId)?.name ?? dbId;
    }
    if (isPreview(id)) {
      return $i18n.t("editor.diagramPreview");
    }
    return displayNoteName(id);
  }
</script>

{#if tabs.length}
  <div
    class="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-stone-200/70 bg-sidebar dark:border-stone-800"
    role="tablist"
  >
    {#each tabs as id (id)}
      <div
        class="group flex max-w-56 items-center gap-1.5 border-r border-stone-200/70 px-3 py-1.5 text-sm dark:border-stone-800"
        class:min-w-32={!pinned.includes(id)}
        class:bg-surface={id === activeTab}
        class:dark:bg-canvas={id === activeTab}
        class:text-stone-900={id === activeTab}
        class:dark:text-stone-100={id === activeTab}
        class:text-stone-500={id !== activeTab}
        class:dark:text-stone-400={id !== activeTab}
        class:opacity-50={id === dragged}
        draggable="true"
        role="presentation"
        ondragstart={() => (dragged = id)}
        ondragend={() => (dragged = null)}
        ondragover={(event) => event.preventDefault()}
        ondrop={(event) => {
          event.preventDefault();
          if (dragged && dragged !== id) {
            onReorder(dragged, id);
          }
          dragged = null;
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={id === activeTab}
          class="flex min-w-0 flex-1 items-center gap-1.5 text-start focus-visible:outline-none"
          title={label(id)}
          onclick={() => onSelect(id)}
          ondblclick={() => onPin(id)}
          onauxclick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
              onClose(id);
            }
          }}
        >
          {#if isDatabase(id)}
            <Table class="size-3.5 shrink-0" />
          {:else if isPreview(id)}
            <Image class="size-3.5 shrink-0" />
          {:else}
            <PageIcon
              icon={meta[entryPathFromNote(id)]?.icon}
              className="size-3.5 shrink-0"
            />
          {/if}
          {#if !pinned.includes(id)}
            <span class="truncate">{label(id)}</span>
          {/if}
        </button>
        {#if !isDatabase(id) && !isPreview(id)}
          <button
            type="button"
            class="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-200/70 focus-visible:opacity-100 focus-visible:outline-none dark:hover:bg-stone-700/60"
            class:opacity-100={id === splitTab}
            aria-label={id === splitTab
              ? $i18n.t("tabs.unsplit")
              : $i18n.t("tabs.split")}
            title={id === splitTab
              ? $i18n.t("tabs.unsplit")
              : $i18n.t("tabs.split")}
            onclick={() => onSplit(id)}
          >
            <Columns2 class="size-3" />
          </button>
        {/if}
        <button
          type="button"
          class="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-200/70 focus-visible:opacity-100 focus-visible:outline-none dark:hover:bg-stone-700/60"
          class:opacity-100={pinned.includes(id)}
          aria-label={pinned.includes(id)
            ? $i18n.t("tabs.unpin")
            : $i18n.t("tabs.pin")}
          title={pinned.includes(id)
            ? $i18n.t("tabs.unpin")
            : $i18n.t("tabs.pin")}
          onclick={() => onPin(id)}
        >
          {#if pinned.includes(id)}
            <PinOff class="size-3" />
          {:else}
            <Pin class="size-3" />
          {/if}
        </button>
        {#if !pinned.includes(id)}
          <button
            type="button"
            class="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-stone-200/70 focus-visible:opacity-100 focus-visible:outline-none dark:hover:bg-stone-700/60"
            aria-label={$i18n.t("tabs.close")}
            title={$i18n.t("tabs.close")}
            onclick={() => onClose(id)}
          >
            <X class="size-3" />
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
