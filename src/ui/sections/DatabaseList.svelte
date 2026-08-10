<script lang="ts">
  import { Plus, Trash2 } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { asDisplay, rowTitle } from "../../lib/utils/database";
  import type { Column, Row } from "../../lib/utils/database";

  export let columns: Column[];
  export let rows: Row[];
  export let onAddRow: () => void;
  export let onDeleteRow: (rowId: string) => void;
  export let onOpenRow: (rowId: string) => void = () => {};

  $: titleColumn =
    columns.find((column) => column.type === "text") ?? columns[0];
  /** A list line stays one line, so only the first few properties trail the title. */
  $: sideColumns = columns
    .filter((column) => column.id !== titleColumn?.id)
    .slice(0, 3);
</script>

<div class="min-h-0 flex-1 overflow-y-auto">
  {#each rows as row (row.id)}
    <div
      class="group flex items-center gap-2 border-b border-stone-200/70 px-3 py-2 hover:bg-stone-500/5 dark:border-stone-800"
    >
      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left text-sm text-stone-800 hover:underline dark:text-stone-100"
        onclick={() => onOpenRow(row.id)}
      >
        {rowTitle(row, columns)}
      </button>
      {#each sideColumns as column (column.id)}
        {#if asDisplay(row.data[column.id])}
          <span
            class="hidden max-w-40 truncate rounded-md bg-stone-500/10 px-1.5 py-0.5 text-[0.6875rem] text-stone-500 sm:inline"
            title="{column.name}: {asDisplay(row.data[column.id])}"
          >
            {asDisplay(row.data[column.id])}
          </span>
        {/if}
      {/each}
      <button
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
        aria-label={$i18n.t("database.deleteRow")}
        onclick={() => onDeleteRow(row.id)}
      >
        <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  {/each}

  <button
    type="button"
    class="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-stone-500 hover:bg-stone-500/5 hover:text-stone-800 dark:hover:text-stone-200"
    onclick={onAddRow}
  >
    <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    {$i18n.t("database.newRow")}
  </button>

  {#if !rows.length}
    <p class="px-2 py-4 text-center text-xs text-stone-400">
      {$i18n.t("database.noRows")}
    </p>
  {/if}
</div>
