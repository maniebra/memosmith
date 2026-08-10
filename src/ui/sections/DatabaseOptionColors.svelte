<script lang="ts">
  import type { Column } from "../../lib/utils/database";
  import {
    colorOf,
    entryFor,
    optionChipStyle,
    palette,
  } from "../../lib/utils/optionColors";

  export let column: Column;
  export let onUpdate: (patch: Partial<Column>) => void;

  /** Option whose swatch row is expanded; only one at a time keeps the panel short. */
  let editing: string | null = null;

  function setColor(option: string, id: string) {
    onUpdate({
      optionColors: { ...(column.optionColors ?? {}), [option]: id },
    });
    editing = null;
  }

  function swatchHex(option: string) {
    return entryFor($palette, colorOf(column, option, $palette))?.hex ?? "#888";
  }
</script>

{#if column.options?.length}
  <div class="flex flex-col gap-0.5">
    {#each column.options as option (option)}
      <div class="flex flex-col">
        <button
          type="button"
          class="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-stone-500/8 dark:hover:bg-white/5"
          aria-expanded={editing === option}
          onclick={() => (editing = editing === option ? null : option)}
        >
          <span
            class="db-chip min-w-0 truncate rounded-full px-2 py-0.5 text-[0.6875rem]"
            style={optionChipStyle(column, option, $palette)}>{option}</span
          >
          <span
            class="ml-auto size-3 shrink-0 rounded-full"
            style="background: {swatchHex(option)}"
            aria-hidden="true"
          ></span>
        </button>
        {#if editing === option}
          <div class="flex flex-wrap gap-1 px-1 pt-1 pb-2">
            {#each $palette as color (color.id)}
              <button
                type="button"
                class="size-5 rounded-full transition-transform hover:scale-110 {colorOf(
                  column,
                  option,
                  $palette,
                ) === color.id
                  ? 'ring-2 ring-stone-400 ring-offset-1 ring-offset-white dark:ring-offset-stone-900'
                  : ''}"
                style="background: {color.hex}"
                aria-label={color.label}
                title={color.label}
                onclick={() => setColor(option, color.id)}
              ></button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
