<script lang="ts" context="module">
  export type ContextMenuAction = {
    label: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    separator?: false;
    icon?: any;
    onSelect?: () => void | Promise<void>;
  };

  export type ContextMenuSeparator = {
    separator: true;
  };

  export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator;
</script>

<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import { cn } from "../../lib/utils/cn";

  export let x = 0;
  export let y = 0;
  export let items: ContextMenuItem[] = [];
  export let onClose: () => void = () => {};

  const width = 320;

  $: left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  $: top = Math.max(
    8,
    Math.min(y, window.innerHeight - items.length * 34 - 16),
  );

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

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleWindowKeydown}
/>

<div
  class="fixed z-[80] w-min-48 w-max-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-1.5 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
  style="left: {left}px; top: {top}px; transform-origin: top left;"
  role="menu"
  tabindex="-1"
  in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
>
  {#each items as item}
    {#if item.separator}
      <div
        class="my-1 h-px bg-stone-200/70 dark:bg-stone-700/70"
        role="separator"
      ></div>
    {:else}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        class={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors",
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
        {#if item.icon}
          <svelte:component
            this={item.icon}
            class="size-4 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        {/if}
        <span class="sr-only">{item.label}</span>
        <span class="flex-1 truncate">{item.label}</span>
        {#if item.shortcut}
          <span
            class="shrink-0 text-[0.7rem] text-stone-400 dark:text-stone-500"
            >{item.shortcut}</span
          >
        {/if}
      </button>
    {/if}
  {/each}
</div>
