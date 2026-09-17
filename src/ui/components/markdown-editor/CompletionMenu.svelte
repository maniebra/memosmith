<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import { cn } from "../../../lib/utils/cn";
  import type { Completion } from "../../../lib/utils/lsp";

  export let items: Completion[] = [];
  export let index = 0;
  export let left = 0;
  export let top = 0;
  export let label = "";
  export let onHover: (index: number) => void = () => {};
  export let onPick: (item: Completion) => void = () => {};
</script>

<ul
  class="fixed z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-stone-200 bg-surface/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
  style="top: {top}px; left: {left}px; transform-origin: top left;"
  in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
  role="listbox"
  aria-label={label}
>
  {#each items as item, itemIndex}
    <li>
      <button
        type="button"
        role="option"
        aria-selected={itemIndex === index}
        class={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
          itemIndex === index
            ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
            : "text-stone-700 dark:text-stone-200",
        )}
        onmousedown={(event) => {
          event.preventDefault();
          onPick(item);
        }}
        onmouseenter={() => onHover(itemIndex)}
      >
        <span class="truncate font-mono text-[0.8rem]">{item.label}</span>
        <span class="truncate text-[0.7rem] text-stone-400 dark:text-stone-500"
          >{item.detail}</span
        >
      </button>
    </li>
  {/each}
</ul>
