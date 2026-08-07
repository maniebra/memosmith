<script lang="ts">
  import { Plus, Settings2, Trash2 } from "@lucide/svelte";
  import { columnTypes } from "../../lib/utils/database";
  import type { CellValue, Choice, Column, ColumnType, Row } from "../../lib/utils/database";
  import DatabaseCell from "../components/DatabaseCell.svelte";
  import Select from "../components/Select.svelte";

  export let columns: Column[];
  export let rows: Row[];
  /** Column id -> selectable values, already resolved for relation columns. */
  export let choices: Record<string, Choice[]> = {};
  export let databaseOptions: { id: string; name: string }[] = [];
  export let onCell: (rowId: string, columnId: string, value: CellValue) => void;
  export let onAddRow: () => void;
  export let onDeleteRow: (rowId: string) => void;
  export let onColumnsChange: (columns: Column[]) => void;
  export let onAddColumn: () => void;

  const panelWidth = 240;

  /** Fixed-positioned: the table scrolls under `overflow-auto`, which would clip an absolute panel. */
  let editingColumn: { id: string; x: number; y: number } | null = null;

  function toggleEditor(id: string, event: MouseEvent) {
    if (editingColumn?.id === id) {
      editingColumn = null;
      return;
    }

    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();

    editingColumn = {
      id,
      x: Math.max(8, Math.min(bounds.right - panelWidth, window.innerWidth - panelWidth - 8)),
      y: bounds.bottom + 4,
    };
  }

  function updateColumn(id: string, patch: Partial<Column>) {
    onColumnsChange(columns.map((column) => (column.id === id ? { ...column, ...patch } : column)));
  }

  function deleteColumn(id: string) {
    editingColumn = null;
    onColumnsChange(columns.filter((column) => column.id !== id));
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && (editingColumn = null)} />

<div class="min-w-0 overflow-auto" onscroll={() => (editingColumn = null)}>
  <table class="w-max min-w-full border-collapse text-sm">
    <thead>
      <tr class="border-b border-stone-200 dark:border-stone-800">
        {#each columns as column (column.id)}
          <th class="relative min-w-44 border-r border-stone-200/70 px-2 py-1.5 text-left font-medium dark:border-stone-800">
            <div class="flex items-center justify-between gap-1">
              <span class="truncate text-xs tracking-wide text-stone-500 uppercase">{column.name}</span>
              <button
                type="button"
                class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
                aria-label="Edit column {column.name}"
                onclick={(event) => toggleEditor(column.id, event)}
              >
                <Settings2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            {#if editingColumn?.id === column.id}
              <div
                class="fixed z-50 flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
                style="left: {editingColumn.x}px; top: {editingColumn.y}px; width: {panelWidth}px;"
              >
                <input
                  class="h-8 rounded-md border border-stone-200 bg-transparent px-2 text-sm font-normal outline-none dark:border-stone-700"
                  value={column.name}
                  oninput={(event) => updateColumn(column.id, { name: event.currentTarget.value })}
                />

                <Select
                  value={column.type}
                  options={columnTypes.map((type) => ({ value: type.value, label: type.label }))}
                  className="h-8 rounded-md font-normal"
                  onChange={(type) => updateColumn(column.id, { type: type as ColumnType })}
                />

                {#if column.type === "select" || column.type === "multi_select"}
                  <textarea
                    rows="3"
                    placeholder="One option per line"
                    class="rounded-md border border-stone-200 bg-transparent px-2 py-1 text-sm font-normal outline-none dark:border-stone-700"
                    value={(column.options ?? []).join("\n")}
                    oninput={(event) =>
                      updateColumn(column.id, {
                        options: event.currentTarget.value
                          .split("\n")
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })}
                  ></textarea>
                {/if}

                {#if column.type === "relation"}
                  <Select
                    value={column.relationDatabase ?? ""}
                    options={[
                      { value: "", label: "Linked database…" },
                      ...databaseOptions.map((option) => ({ value: option.id, label: option.name })),
                    ]}
                    className="h-8 rounded-md font-normal"
                    onChange={(id) => updateColumn(column.id, { relationDatabase: id || undefined })}
                  />
                {/if}

                <button
                  type="button"
                  class="rounded-md px-2 py-1 text-left text-xs font-normal text-rose-600 hover:bg-rose-500/10"
                  onclick={() => deleteColumn(column.id)}
                >
                  Delete column
                </button>
              </div>
            {/if}
          </th>
        {/each}

        <th class="w-10 px-1 py-1.5">
          <button
            type="button"
            class="flex size-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
            aria-label="Add column"
            title="Add column"
            onclick={onAddColumn}
          >
            <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </th>
      </tr>
    </thead>

    <tbody>
      {#each rows as row (row.id)}
        <tr class="group border-b border-stone-200/70 hover:bg-stone-500/5 dark:border-stone-800">
          {#each columns as column (column.id)}
            <td class="border-r border-stone-200/70 align-top dark:border-stone-800">
              <DatabaseCell
                {column}
                choices={choices[column.id] ?? []}
                value={row.data[column.id] ?? null}
                onChange={(value) => onCell(row.id, column.id, value)}
              />
            </td>
          {/each}

          <td class="px-1 align-top">
            <button
              type="button"
              class="flex size-6 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
              aria-label="Delete row"
              onclick={() => onDeleteRow(row.id)}
            >
              <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <button
    type="button"
    class="flex w-full items-center gap-1.5 px-2 py-2 text-left text-xs text-stone-500 hover:bg-stone-500/5 hover:text-stone-800 dark:hover:text-stone-200"
    onclick={onAddRow}
  >
    <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    New row
  </button>

  {#if !rows.length}
    <p class="px-2 py-4 text-center text-xs text-stone-400">No rows match this view.</p>
  {/if}
</div>
