<script lang="ts">
  import { Plus, Trash2 } from "@lucide/svelte";
  import { groupRows, rowTitle, uncategorized } from "../../lib/utils/database";
  import type { CellValue, Choice, Column, Row } from "../../lib/utils/database";
  import DatabaseCell from "../components/DatabaseCell.svelte";

  export let columns: Column[];
  export let rows: Row[];
  export let groupBy: string | undefined;
  /** Column id -> selectable values, already resolved for relation columns. */
  export let choices: Record<string, Choice[]> = {};
  export let onCell: (rowId: string, columnId: string, value: CellValue) => void;
  export let onAddRow: (groupValue: string | null) => void;
  export let onDeleteRow: (rowId: string) => void;

  let dragging: string | null = null;

  $: groupColumn = columns.find((column) => column.id === groupBy);
  $: groupChoices = groupColumn ? (choices[groupColumn.id] ?? []) : [];
  $: titleColumn = columns.find((column) => column.type === "text") ?? columns[0];
  $: cardColumns = columns.filter((column) => column.id !== titleColumn?.id && column.id !== groupColumn?.id);
  $: groups = groupRows(rows, groupColumn, groupChoices.map((choice) => choice.value));

  function drop(groupKey: string) {
    if (!dragging || !groupColumn) {
      return;
    }

    const multi = groupColumn.type === "multi_select" || groupColumn.type === "relation";
    const value = groupKey === uncategorized ? (multi ? [] : null) : multi ? [groupKey] : groupKey;

    onCell(dragging, groupColumn.id, value);
    dragging = null;
  }

  function groupLabel(key: string) {
    if (key === uncategorized) {
      return "No value";
    }

    return groupChoices.find((choice) => choice.value === key)?.label ?? key;
  }
</script>

{#if !groupColumn}
  <p class="px-4 py-6 text-sm text-stone-400">
    Pick a "Group by" column to use the board.
  </p>
{:else}
  <div class="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
    {#each groups as group (group.key)}
      <section
        class="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-stone-500/5 p-2 dark:bg-stone-800/40"
        role="list"
        ondragover={(event) => event.preventDefault()}
        ondrop={() => drop(group.key)}
      >
        <header class="flex items-center justify-between px-1 pb-2">
          <span class="truncate text-xs font-medium tracking-wide text-stone-500 uppercase">
            {groupLabel(group.key)}
          </span>
          <span class="text-xs text-stone-400">{group.rows.length}</span>
        </header>

        <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {#each group.rows as row (row.id)}
            <article
              class="group rounded-lg border border-stone-200/70 bg-white p-2 shadow-sm dark:border-stone-700/70 dark:bg-stone-900"
              role="listitem"
              draggable="true"
              ondragstart={() => (dragging = row.id)}
              ondragend={() => (dragging = null)}
            >
              <div class="flex items-start justify-between gap-1">
                <p class="min-w-0 flex-1 truncate text-sm text-stone-800 dark:text-stone-100">{rowTitle(row, columns)}</p>
                <button
                  type="button"
                  class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
                  aria-label="Delete row"
                  onclick={() => onDeleteRow(row.id)}
                >
                  <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>

              {#each cardColumns as column (column.id)}
                <div class="mt-1 flex items-center gap-2">
                  <span class="w-16 shrink-0 truncate text-[0.6875rem] text-stone-400">{column.name}</span>
                  <div class="min-w-0 flex-1">
                    <DatabaseCell
                      {column}
                      choices={choices[column.id] ?? []}
                      value={row.data[column.id] ?? null}
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
          class="mt-2 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
          onclick={() => onAddRow(group.key === uncategorized ? null : group.key)}
        >
          <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          New
        </button>
      </section>
    {/each}
  </div>
{/if}
