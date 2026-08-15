<script lang="ts">
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { cn } from "../../../lib/utils/cn";
  import type { SlashCommand } from "./types";

  export let commands: SlashCommand[] = [];
  export let index = 0;
  export let left = 0;
  export let top = 0;
  export let label = "";
  export let onHover: (index: number) => void = () => {};
  export let onPick: (command: SlashCommand) => void = () => {};

  let items: HTMLElement[] = [];
  $: items[index]?.scrollIntoView({ block: "nearest" });
</script>

<ul
  class="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
  style="top: {top}px; left: {left}px; transform-origin: top left;"
  in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
  role="listbox"
  aria-label={label}
>
  {#each commands as command, commandIndex}
    <li>
      <button
        type="button"
        role="option"
        bind:this={items[commandIndex]}
        aria-selected={commandIndex === index}
        class={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
          commandIndex === index
            ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
            : "text-stone-700 dark:text-stone-200",
        )}
        onmousedown={(event) => {
          event.preventDefault();
          onPick(command);
        }}
        onmousemove={() => onHover(commandIndex)}
      >
        <span>{command.label}</span>
        <span
          class="rounded border border-stone-200 px-1.5 py-px font-mono text-[0.7rem] text-stone-400 dark:border-stone-700 dark:text-stone-500"
          >{command.children?.length ? "›" : command.hint}</span
        >
      </button>
    </li>
  {/each}
</ul>
