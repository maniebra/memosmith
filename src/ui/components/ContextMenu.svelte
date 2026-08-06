<script lang="ts" context="module">
  export type ContextMenuAction = {
    label: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    separator?: false;
    onSelect?: () => void | Promise<void>;
  };

  export type ContextMenuSeparator = {
    separator: true;
  };

  export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator;
</script>

<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let x = 0;
  export let y = 0;
  export let items: ContextMenuItem[] = [];
  export let onClose: () => void = () => {};

  const width = 192;

  $: left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  $: top = Math.max(8, Math.min(y, window.innerHeight - items.length * 34 - 16));

  async function selectItem(item: ContextMenuItem) {
    if (item.separator) {
      return;
    }

    if (item.disabled || !item.onSelect) {
      return;
    }

    try {
      await item.onSelect();
    } finally {
      onClose();
    }
  }

  function handleWindowPointerDown() {
    onClose();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div
  class="fixed z-[80] w-48 rounded-xl border border-stone-200/80 bg-stone-50/95 p-1.5 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
  style="left: {left}px; top: {top}px;"
  role="menu"
  tabindex="-1"
>
  {#each items as item}
    {#if item.separator}
      <div class="my-1 h-px bg-stone-200/70 dark:bg-stone-700/70" role="separator"></div>
    {:else}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        class={cn(
          "flex h-8 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-left text-sm transition-colors",
          "disabled:pointer-events-none disabled:opacity-40",
          item.danger
            ? "text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
            : "text-stone-700 hover:bg-stone-200/55 dark:text-stone-200 dark:hover:bg-stone-800/75",
        )}
        onclick={(event) => {
          event.stopPropagation();
          void selectItem(item);
        }}
        onpointerdown={(event) => event.stopPropagation()}
      >
        <span class="truncate">{item.label}</span>
        {#if item.shortcut}
          <span class="shrink-0 text-[0.7rem] text-stone-400 dark:text-stone-500">{item.shortcut}</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>
