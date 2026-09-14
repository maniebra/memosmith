<script lang="ts">
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { cn } from "../../../lib/utils/cn";
  import { portal } from "../../../lib/utils/portal";
  import { calloutIconSvg } from "../../../lib/utils/calloutIcons";
  import type { SlashCommand } from "./types";

  export let commands: SlashCommand[] = [];
  export let index = 0;
  export let left = 0;
  export let top = 0;
  /** Top of the caret line, the anchor when the menu opens upward. */
  export let caretTop = top;
  export let label = "";
  /** Submenu depth, so drilling in and out slides the pane. */
  export let depth = 0;
  export let onHover: (index: number) => void = () => {};
  export let onPick: (command: SlashCommand) => void = () => {};

  const menuWidth = 256;
  const viewportPadding = 8;
  let innerWidth = 0;
  let innerHeight = 0;
  let height = 0;
  // Use the measured menu size: a short filtered list can still fit below the
  // caret even where the full command list could not.
  $: above = height > 0 && top + height > innerHeight - viewportPadding;
  $: x = Math.max(
    viewportPadding,
    Math.min(left, innerWidth - menuWidth - viewportPadding),
  );
  // `bottom` anchors the menu's lower edge to the caret without depending on a
  // previous measurement, so it stays directly above it as its contents change.
  $: position = above
    ? `bottom: ${innerHeight - caretTop + 4}px; left: ${x}px; transform-origin: bottom left;`
    : `top: ${top}px; left: ${x}px; transform-origin: top left;`;

  let items: HTMLElement[] = [];
  $: items[index]?.scrollIntoView({ block: "nearest" });

  /** Which way the next pane slides in: 1 deeper, -1 back out. */
  let direction = 1;
  let lastDepth = depth;
  $: {
    direction = depth >= lastDepth ? 1 : -1;
    lastDepth = depth;
  }

  /** Pane heights by depth, so an outgoing pane cannot clobber the incoming one. */
  let heights: Record<number, number> = {};
  // Hold the last measured height until the incoming pane reports its own,
  // otherwise the container collapses for a frame between panes.
  let listHeight = 0;
  $: if (heights[depth]) {
    listHeight = heights[depth];
  }
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div
  class="fixed z-50 w-64 rounded-xl border border-stone-200 bg-white/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
  use:portal
  style={position}
  bind:offsetHeight={height}
  in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
>
  <div
    class="relative overflow-hidden"
    style="height: {listHeight
      ? `${listHeight}px`
      : 'auto'}; transition: height 240ms cubic-bezier(0.215, 0.61, 0.355, 1)"
  >
    {#key depth}
      <ul
        class="absolute inset-x-0 top-0 max-h-72 overflow-y-auto"
        bind:clientHeight={heights[depth]}
        in:fly={{ x: direction * 20, duration: 240, opacity: 0, easing: cubicOut }}
        out:fly={{
          x: direction * -20,
          duration: 240,
          opacity: 0,
          easing: cubicOut,
        }}
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
        <span class="flex min-w-0 items-center gap-2">
          {#if command.icon}
            <span
              class="inline-flex h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4"
              style={command.color ? `color: ${command.color};` : ""}
            >
              {@html calloutIconSvg(command.icon)}
            </span>
          {/if}
          <span class="truncate">{command.label}</span>
        </span>
        <span
          class="rounded border border-stone-200 px-1.5 py-px font-mono text-[0.7rem] text-stone-400 dark:border-stone-700 dark:text-stone-500"
          >{command.children?.length ? "›" : command.hint}</span
        >
      </button>
    </li>
  {/each}
      </ul>
    {/key}
  </div>
</div>
