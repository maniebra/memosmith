<script lang="ts" context="module">
  export type ContextMenuAction = {
    label: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    separator?: false;
    icon?: any;
    /** Drawn instead of the icon, as a filled dot: a palette colour. */
    swatch?: string;
    /** Drilled into instead of selected, so a long list can nest. */
    children?: ContextMenuItem[];
    onSelect?: () => void | Promise<void>;
  };

  export type ContextMenuSeparator = {
    separator: true;
  };

  export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator;
</script>

<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fly, scale } from "svelte/transition";
  import { cn } from "../../lib/utils/cn";

  export let x = 0;
  export let y = 0;
  export let items: ContextMenuItem[] = [];
  export let onClose: () => void = () => {};

  const width = 320;
  /** A long palette scrolls instead of running off the screen. */
  const maxListHeight = 320;

  /** Submenus drilled into; the last one is what the panel shows. */
  let path: ContextMenuAction[] = [];
  /** Which way the next pane slides in: 1 deeper, -1 back out. */
  let direction = 1;
  /** Pane heights by depth, so an outgoing pane cannot clobber the incoming one. */
  let heights: Record<number, number> = {};

  // A fresh menu always opens at its top level.
  $: if (items) {
    path = [];
    direction = 1;
    heights = {};
  }

  $: parent = path[path.length - 1];
  // Hold the last measured height until the incoming pane reports its own,
  // otherwise the container collapses for a frame between panes.
  let listHeight = 0;
  $: if (heights[path.length]) {
    listHeight = heights[path.length];
  }
  $: shown = parent?.children ?? items;
  $: left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  $: top = Math.max(
    8,
    Math.min(y, window.innerHeight - (listHeight || 120) - 16),
  );

  function leave() {
    direction = -1;
    path = path.slice(0, -1);
  }

  async function selectItem(item: ContextMenuItem) {
    if (item.separator || item.disabled) {
      return;
    }

    if (item.children) {
      direction = 1;
      path = [...path, item];
      return;
    }

    if (!item.onSelect) {
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
    if (event.key !== "Escape") {
      return;
    }

    // Escape leaves the submenu first, so a mis-click costs one key, not the menu.
    if (path.length) {
      leave();
      return;
    }

    onClose();
  }
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleWindowKeydown}
/>

<div
  class="fixed z-[80] rounded-xl border border-stone-200/80 bg-stone-50/95 p-1.5 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
  style="left: {left}px; top: {top}px; width: {width}px; transform-origin: top left;"
  role="menu"
  tabindex="-1"
  in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
>
  <div
    class="relative overflow-hidden"
    style="height: {listHeight
      ? `${listHeight}px`
      : 'auto'}; transition: height 240ms cubic-bezier(0.215, 0.61, 0.355, 1)"
  >
    {#key path.length}
      <div
        class="menu-scroll absolute inset-x-0 top-0 overflow-y-auto overscroll-contain"
        style="max-height: {maxListHeight}px"
        bind:clientHeight={heights[path.length]}
        in:fly={{
          x: direction * 20,
          duration: 240,
          opacity: 0,
          easing: cubicOut,
        }}
        out:fly={{
          x: direction * -20,
          duration: 240,
          opacity: 0,
          easing: cubicOut,
        }}
      >
    {#if parent}
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-stone-500 transition-colors hover:bg-stone-200/55 dark:text-stone-400 dark:hover:bg-stone-800/75"
        onclick={(event) => {
          event.stopPropagation();
          leave();
        }}
        onpointerdown={(event) => event.stopPropagation()}
      >
        <ChevronLeft
          class="size-4 shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span class="flex-1 truncate">{parent.label}</span>
      </button>
      <div
        class="my-1 h-px bg-stone-200/70 dark:bg-stone-700/70"
        role="separator"
      ></div>
    {/if}
    {#each shown as item}
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
          {#if item.swatch}
            <span
              class="size-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/15"
              style="background: {item.swatch}"
              aria-hidden="true"
            ></span>
          {:else if item.icon}
            <svelte:component
              this={item.icon}
              class="size-4 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          {/if}
          <span class="sr-only">{item.label}</span>
          <span class="flex-1 truncate">{item.label}</span>
          {#if item.children}
            <ChevronRight
              class="size-4 shrink-0 text-stone-400 dark:text-stone-500"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          {/if}
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
    {/key}
  </div>
</div>
