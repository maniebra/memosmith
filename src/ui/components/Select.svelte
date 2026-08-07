<script lang="ts" context="module">
  export type SelectOption = {
    label: string;
    value: string;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { ChevronDown } from "@lucide/svelte";
  import { cn } from "../../lib/utils/cn";

  export let value = "";
  export let options: SelectOption[] = [];
  export let className = "";
  export let onChange: (value: string) => void = () => {};

  let open = false;
  let root: HTMLDivElement;
  let activeIndex = 0;
  /** Fixed placement, so a scrolling or clipping ancestor cannot cut the list off. */
  let menu = { left: 0, top: 0, width: 0 };

  onMount(() => {
    // Capture phase: inner scroll containers do not bubble their scroll events.
    window.addEventListener("scroll", close, true);

    return () => window.removeEventListener("scroll", close, true);
  });

  function placeMenu() {
    const bounds = root.getBoundingClientRect();
    const height = Math.min(options.length * 32 + 12, 240);
    const below = window.innerHeight - bounds.bottom - 8;

    menu = {
      left: bounds.left,
      top: below < height && bounds.top > height ? bounds.top - height - 4 : bounds.bottom + 4,
      width: bounds.width,
    };
  }

  $: selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  $: selected = options[selectedIndex] ?? options[0];
  $: if (!open) {
    activeIndex = selectedIndex;
  }

  function close() {
    open = false;
  }

  function toggle() {
    if (!open) {
      placeMenu();
    }

    open = !open;
  }

  function choose(index: number) {
    const option = options[index];

    if (!option) {
      return;
    }

    value = option.value;
    onChange(value);
    close();
  }

  function handleButtonKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open = true;
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      open = true;
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (open) {
        choose(activeIndex);
      } else {
        open = true;
      }
    }
  }

  function handleWindowClick(event: MouseEvent) {
    if (root && !root.contains(event.target as Node)) {
      close();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!open) {
      return;
    }

    if (event.key === "Escape") {
      close();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div bind:this={root} class="relative">
  <button
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    class={cn(
      "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-stone-200/80 bg-stone-50/80 px-3 text-left text-sm text-stone-800 shadow-sm shadow-stone-900/5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30",
      "dark:border-stone-700/80 dark:bg-stone-900/80 dark:text-stone-100 dark:shadow-black/10",
      className,
    )}
    onclick={(event) => {
      event.stopPropagation();
      toggle();
    }}
    onkeydown={handleButtonKeydown}
  >
    <span class="truncate">{selected?.label}</span>
    <ChevronDown
      class="size-4 shrink-0 text-stone-400 dark:text-stone-500"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  </button>

  {#if open}
    <div
      class="fixed z-50 max-h-60 overflow-y-auto rounded-xl border border-stone-200/80 bg-stone-50/95 p-1.5 shadow-lg shadow-stone-900/8 dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
      style="left: {menu.left}px; top: {menu.top}px; min-width: {menu.width}px;"
      role="listbox"
      tabindex="-1"
    >
      {#each options as option, index}
        <button
          type="button"
          role="option"
          aria-selected={option.value === value}
          class={cn(
            "flex h-8 w-full items-center rounded-lg px-2.5 text-left text-sm transition-colors",
            index === activeIndex && "bg-stone-200/45 dark:bg-stone-800/70",
            option.value === value
              ? "font-medium text-emerald-700 dark:text-emerald-300"
              : "text-stone-600 dark:text-stone-300",
          )}
          onclick={() => choose(index)}
          onmouseenter={() => (activeIndex = index)}
        >
          <span class="truncate">{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
