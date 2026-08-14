<script lang="ts">
  import { Trash2, X } from "@lucide/svelte";
  import { cn } from "../../lib/utils/cn";
  import ContextMenu from "../components/ContextMenu.svelte";

  export let tabs: { id: string; name: string; icon?: any }[] = [];
  export let activeId: string | null = null;
  export let activeClass: string;
  export let idleClass: string;
  export let onSelect: (id: string) => void;
  export let onDelete: (id: string) => void | Promise<void>;
  export let deleteLabel: (name: string) => string;

  /** The last tab stays: a table without views, or a database without tables, has nothing to show. */
  $: removable = tabs.length > 1;

  let menu: { x: number; y: number; id: string; name: string } | null = null;

  function openMenu(event: MouseEvent, tab: { id: string; name: string }) {
    if (!removable) {
      return;
    }

    event.preventDefault();
    // The editor offers the whole card's own menu; a tab speaks for itself.
    event.stopPropagation();
    menu = { x: event.clientX, y: event.clientY, id: tab.id, name: tab.name };
  }
</script>

{#each tabs as tab (tab.id)}
  <div
    class="group flex items-center"
    role="presentation"
    oncontextmenu={(event) => openMenu(event, tab)}
  >
    <button
      type="button"
      class={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        tab.id === activeId ? activeClass : idleClass,
      )}
      onclick={() => onSelect(tab.id)}
    >
      {#if tab.icon}
        <svelte:component
          this={tab.icon}
          class="size-3.5"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      {/if}
      {tab.name}
    </button>
    {#if removable}
      <button
        type="button"
        class="flex size-5 items-center justify-center rounded text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600"
        aria-label={deleteLabel(tab.name)}
        onclick={() => void onDelete(tab.id)}
      >
        <X class="size-3" strokeWidth={2} aria-hidden="true" />
      </button>
    {/if}
  </div>
{/each}

{#if menu}
  <ContextMenu
    x={menu.x}
    y={menu.y}
    items={[
      {
        label: deleteLabel(menu.name),
        icon: Trash2,
        danger: true,
        onSelect: () => onDelete(menu!.id),
      },
    ]}
    onClose={() => (menu = null)}
  />
{/if}
