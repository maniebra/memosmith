<script lang="ts" context="module">
  export type SelectOption = {
    label: string;
    value: string;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { Check, ChevronDown } from "@lucide/svelte";
  import { cn } from "../../lib/utils/cn";
  import { portal } from "../../lib/utils/portal";

  export let value = "";
  export let options: SelectOption[] = [];
  export let className = "";
  export let rootClassName = "w-full";
  export let ariaLabel = "";
  export let onChange: (value: string) => void = () => {};

  const selectId = Math.random().toString(36).slice(2);
  let open = false;
  let root: HTMLDivElement;
  let activeIndex = 0;
  /** Fixed placement, so a scrolling or clipping ancestor cannot cut the list off. */
  let menu = { left: 0, top: 0, width: 0 };
  /** The portalled panel, so an outside-click test still recognises it. */
  let menuElement: HTMLElement | undefined;

  onMount(() => {
    function handleSelectOpened(event: Event) {
      if ((event as CustomEvent<string>).detail !== selectId) {
        close();
      }
    }

    function handleWindowPointerDown(event: PointerEvent) {
      if (!open) {
        return;
      }

      const target = event.target;
      const inside =
        target instanceof Node &&
        (root.contains(target) || menuElement?.contains(target));
      if (!inside) {
        close();
      }
    }

    /**
     * A page scroll moves the trigger away from the placed menu, so it closes —
     * but the menu scrolling itself is not that, and must not close it.
     */
    function handleScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && menuElement?.contains(target)) {
        return;
      }
      close();
    }

    // Capture phase: inner scroll containers do not bubble their scroll events.
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("memosmith:select-opened", handleSelectOpened);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("memosmith:select-opened", handleSelectOpened);
    };
  });

  function placeMenu() {
    const bounds = root.getBoundingClientRect();
    // Rows are 28px inside 4px of padding, capped by the panel's max height.
    const height = Math.min(options.length * 28 + 8, 288);
    const below = window.innerHeight - bounds.bottom - 8;

    menu = {
      left: bounds.left,
      top:
        below < height && bounds.top > height
          ? bounds.top - height - 4
          : bounds.bottom + 4,
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
  // Arrow keys walk past the visible rows, so the active one is kept in view.
  $: if (open && menuElement) {
    menuElement.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function close() {
    open = false;
  }

  function openMenu() {
    placeMenu();
    open = true;
    window.dispatchEvent(
      new CustomEvent("memosmith:select-opened", { detail: selectId }),
    );
  }

  function toggle() {
    if (open) {
      close();
      return;
    }

    openMenu();
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
      if (!open) {
        openMenu();
      }
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
      }
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (open) {
        choose(activeIndex);
      } else {
        openMenu();
      }
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

<svelte:window onkeydown={handleWindowKeydown} />

<div bind:this={root} class={cn("relative", rootClassName)}>
  <button
    type="button"
    aria-haspopup="listbox"
    aria-label={ariaLabel || undefined}
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
      bind:this={menuElement}
      use:portal
      class="fixed z-50 max-h-72 min-w-40 overflow-y-auto rounded-lg border border-stone-200/70 bg-white p-1 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.35),0_10px_20px_-15px_rgba(22,23,24,0.2)] dark:border-white/10 dark:bg-stone-900"
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
            "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors",
            "text-stone-700 dark:text-stone-200",
            index === activeIndex && "bg-stone-500/10 dark:bg-white/8",
          )}
          onclick={() => choose(index)}
          onmouseenter={() => (activeIndex = index)}
        >
          <span class="min-w-0 flex-1 truncate">{option.label}</span>
          {#if option.value === value}
            <Check
              class="size-3.5 shrink-0 text-stone-400"
              strokeWidth={2}
              aria-hidden="true"
            />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
