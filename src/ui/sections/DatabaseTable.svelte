<script lang="ts">
  import { GripVertical, Plus, Settings2, Trash2 } from "@lucide/svelte";
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
  /** Rows in their new order, top to bottom. */
  export let onReorderRows: (rowIds: string[]) => void = () => {};
  /** Embedded tables delay text-like cell commits so the note editor keeps focus stable. */
  export let commitCellsOnInput = true;

  const panelWidth = 240;
  const MIN_WIDTH = 80;

  /** Width being dragged right now; committed to the column on pointerup. */
  let resizing: { id: string; startX: number; startWidth: number; width: number; x: number } | null =
    null;

  function widthOf(column: Column) {
    return resizing?.id === column.id ? resizing.width : column.width;
  }

  function startResize(event: PointerEvent, column: Column, header: HTMLElement) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    resizing = {
      id: column.id,
      startX: event.clientX,
      startWidth: column.width ?? header.getBoundingClientRect().width,
      width: column.width ?? header.getBoundingClientRect().width,
      x: event.clientX,
    };
  }

  function moveResize(event: PointerEvent) {
    if (resizing) {
      const width = Math.max(MIN_WIDTH, Math.round(resizing.startWidth + event.clientX - resizing.startX));

      // The guide sticks to the column edge, so it stops where the minimum width does.
      resizing = { ...resizing, width, x: resizing.startX + width - resizing.startWidth };
    }
  }

  function endResize() {
    if (resizing) {
      updateColumn(resizing.id, { width: resizing.width });
      resizing = null;
    }
  }

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

  let headers: Record<string, HTMLElement> = {};
  let draggedRow: string | null = null;
  let dropRow: string | null = null;
  let draggedColumn: string | null = null;
  let dropColumn: string | null = null;

  function moved<T>(entries: T[], from: number, to: number) {
    const next = [...entries];

    next.splice(to, 0, ...next.splice(from, 1));

    return next;
  }

  function dropRowOn(targetId: string) {
    const from = rows.findIndex((row) => row.id === draggedRow);
    const to = rows.findIndex((row) => row.id === targetId);

    draggedRow = null;
    dropRow = null;

    if (from !== -1 && to !== -1 && from !== to) {
      onReorderRows(moved(rows, from, to).map((row) => row.id));
    }
  }

  function dropColumnOn(targetId: string) {
    const from = columns.findIndex((column) => column.id === draggedColumn);
    const to = columns.findIndex((column) => column.id === targetId);

    draggedColumn = null;
    dropColumn = null;

    if (from !== -1 && to !== -1 && from !== to) {
      onColumnsChange(moved(columns, from, to));
    }
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

{#if resizing}
  <div
    class="pointer-events-none fixed inset-y-0 z-50 w-px bg-emerald-500"
    style="left: {resizing.x}px"
  ></div>
{/if}

<div class="min-w-0 overflow-auto" onscroll={() => (editingColumn = null)}>
  <table class="w-max min-w-full border-collapse text-sm">
    <thead>
      <tr class="border-b border-stone-200 dark:border-stone-800">
        <th class="w-6"></th>
        {#each columns as column (column.id)}
          <th
            bind:this={headers[column.id]}
            class="relative border-r border-stone-200/70 px-2 py-1.5 text-left font-medium dark:border-stone-800 {dropColumn ===
            column.id
              ? 'bg-emerald-600/10'
              : ''} {widthOf(
              column,
            )
              ? ''
              : 'min-w-44'}"
            style={widthOf(column)
              ? `width:${widthOf(column)}px;min-width:${widthOf(column)}px;max-width:${widthOf(column)}px`
              : ""}
          >
            <div
              class="flex items-center justify-between gap-1"
              ondragover={(event) => {
                if (draggedColumn) {
                  event.preventDefault();
                  dropColumn = column.id;
                }
              }}
              ondragleave={() => dropColumn === column.id && (dropColumn = null)}
              ondrop={(event) => {
                event.preventDefault();
                dropColumnOn(column.id);
              }}
              role="none"
            >
              <span
                class="cursor-grab truncate text-xs tracking-wide text-stone-500 uppercase active:cursor-grabbing"
                draggable="true"
                ondragstart={(event) => {
                  draggedColumn = column.id;
                  // WebKit ignores a drag that carries no payload.
                  event.dataTransfer?.setData("text/plain", column.id);
                }}
                ondragend={() => {
                  draggedColumn = null;
                  dropColumn = null;
                }}
                role="none"
              >{column.name}</span>
              <button
                type="button"
                class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
                aria-label="Edit column {column.name}"
                onclick={(event) => toggleEditor(column.id, event)}
              >
                <Settings2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-emerald-600/30 {resizing?.id ===
              column.id
                ? 'bg-emerald-600/40'
                : ''}"
              onpointerdown={(event) => startResize(event, column, headers[column.id])}
              onpointermove={moveResize}
              onpointerup={endResize}
              onpointercancel={endResize}
              ondblclick={() => updateColumn(column.id, { width: undefined })}
              title="Drag to resize, double-click to fit contents"
            ></div>

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
        <tr
          class="group border-b border-stone-200/70 hover:bg-stone-500/5 dark:border-stone-800 {dropRow ===
          row.id
            ? 'border-t-2 border-t-emerald-600'
            : ''}"
          ondragover={(event) => {
            if (draggedRow) {
              event.preventDefault();
              dropRow = row.id;
            }
          }}
          ondragleave={() => dropRow === row.id && (dropRow = null)}
          ondrop={(event) => {
            event.preventDefault();
            dropRowOn(row.id);
          }}
        >
          <td class="w-6 align-top">
            <div
              class="flex h-8 cursor-grab items-center justify-center text-stone-300 opacity-0 group-hover:opacity-100 active:cursor-grabbing dark:text-stone-600"
              draggable="true"
              ondragstart={(event) => {
                draggedRow = row.id;
                event.dataTransfer?.setData("text/plain", row.id);
              }}
              ondragend={() => {
                draggedRow = null;
                dropRow = null;
              }}
              role="none"
              title="Drag to reorder"
            >
              <GripVertical class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </div>
          </td>

          {#each columns as column (column.id)}
            <td
              data-row={row.id}
              data-column={column.id}
              class="overflow-hidden border-r border-stone-200/70 align-top dark:border-stone-800"
              style={widthOf(column)
                ? `width:${widthOf(column)}px;min-width:${widthOf(column)}px;max-width:${widthOf(column)}px`
                : ""}
            >
              <DatabaseCell
                {column}
                choices={choices[column.id] ?? []}
                value={row.data[column.id] ?? null}
                commitOnInput={commitCellsOnInput}
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
