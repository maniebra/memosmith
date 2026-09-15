<script lang="ts">
  import { Plus, Trash2 } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { rowTitle } from "../../lib/utils/database";
  import type {
    CellValue,
    Choice,
    Column,
    Row,
  } from "../../lib/utils/database";
  import DatabaseCell from "../components/DatabaseCell.svelte";

  export let columns: Column[];
  export let rows: Row[];
  export let choices: Record<string, Choice[]> = {};
  export let onCell: (
    rowId: string,
    columnId: string,
    value: CellValue,
  ) => void;
  export let onAddRow: () => void;
  export let onDeleteRow: (rowId: string) => void;
  export let onOpenRow: (rowId: string) => void = () => {};
  export let commitCellsOnInput = true;

  $: titleColumn =
    columns.find((column) => column.type === "text") ?? columns[0];
  $: cardColumns = columns.filter((column) => column.id !== titleColumn?.id);
</script>

<div class="min-h-0 flex-1 overflow-y-auto p-3">
  <div
    class="grid gap-3"
    style="grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr))"
  >
    {#each rows as row (row.id)}
      <article
        class="group flex flex-col rounded-xl border border-stone-200/70 bg-white p-3 shadow-sm dark:border-stone-700/70 dark:bg-stone-900"
      >
        <div class="flex items-start justify-between gap-1">
          <button
            type="button"
            class="min-w-0 flex-1 truncate text-left text-sm font-medium text-stone-800 hover:underline dark:text-stone-100"
            onclick={() => onOpenRow(row.id)}
          >
            {rowTitle(row, columns)}
          </button>
          <button
            type="button"
            class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
            aria-label={$i18n.t("database.deleteRow")}
            onclick={() => onDeleteRow(row.id)}
          >
            <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        {#each cardColumns as column (column.id)}
          <div class="mt-1 flex items-center gap-2">
            <span
              class="w-16 shrink-0 truncate text-[0.6875rem] text-stone-400"
              >{column.name}</span
            >
            <div class="min-w-0 flex-1">
              <DatabaseCell
                {column}
                choices={choices[column.id] ?? []}
                value={row.data[column.id] ?? null}
                commitOnInput={commitCellsOnInput}
                onChange={(value) => onCell(row.id, column.id, value)}
              />
            </div>
          </div>
        {/each}
      </article>
    {/each}
  </div>

  <button
    type="button"
    class="mt-3 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
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
