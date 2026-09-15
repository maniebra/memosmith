<script lang="ts">
  import { Plus, Trash2 } from "@lucide/svelte";
  import { groupRows, rowTitle, uncategorized } from "../../lib/utils/database";
  import {
    hasOptionColors,
    optionChipStyle,
    palette,
  } from "../../lib/utils/optionColors";
  import type {
    CellValue,
    Choice,
    Column,
    Row,
  } from "../../lib/utils/database";
  import { movedBefore } from "./databaseEdits";
  import DatabaseCell from "../components/DatabaseCell.svelte";

  export let columns: Column[];
  export let rows: Row[];
  export let groupBy: string | undefined;
  /** Column id -> selectable values, already resolved for relation columns. */
  export let choices: Record<string, Choice[]> = {};
  export let onCell: (
    rowId: string,
    columnId: string,
    value: CellValue,
  ) => void;
  export let onAddRow: (groupValue: string | null) => void;
  export let onDeleteRow: (rowId: string) => void;
  /** Rows in their new order, top to bottom, across every group. */
  export let onReorderRows: (rowIds: string[]) => void = () => {};
  export let onOpenRow: (rowId: string) => void = () => {};
  /** Width of every board column, in pixels; unset uses the default. */
  export let cardWidth: number | undefined = undefined;
  export let onCardWidth: (width: number) => void = () => {};
  /** Embedded boards delay text-like cell commits so the note editor keeps focus stable. */
  export let commitCellsOnInput = true;

  const MIN_WIDTH = 180;
  const DEFAULT_WIDTH = 288;

  let dragging: string | null = null;
  /** Group under the pointer, so the drop target is visible while dragging. */
  let over: string | null = null;
  /** Card the dragged one would land ahead of. */
  let overRow: string | null = null;
  let resizing: {
    startX: number;
    startWidth: number;
    width: number;
    x: number;
  } | null = null;

  $: width = resizing?.width ?? cardWidth ?? DEFAULT_WIDTH;

  function startResize(event: PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    resizing = {
      startX: event.clientX,
      startWidth: width,
      width,
      x: event.clientX,
    };
  }

  function moveResize(event: PointerEvent) {
    if (resizing) {
      const next = Math.max(
        MIN_WIDTH,
        Math.round(resizing.startWidth + event.clientX - resizing.startX),
      );

      resizing = {
        ...resizing,
        width: next,
        x: resizing.startX + next - resizing.startWidth,
      };
    }
  }

  function endResize() {
    if (resizing) {
      onCardWidth(resizing.width);
      resizing = null;
    }
  }

  $: groupColumn = columns.find((column) => column.id === groupBy);
  $: groupChoices = groupColumn ? (choices[groupColumn.id] ?? []) : [];
  $: titleColumn =
    columns.find((column) => column.type === "text") ?? columns[0];
  $: cardColumns = columns.filter(
    (column) => column.id !== titleColumn?.id && column.id !== groupColumn?.id,
  );
  $: groups = groupRows(
    rows,
    groupColumn,
    groupChoices.map((choice) => choice.value),
  );

  /** Cell value a card takes on when it lands in `groupKey`, in that column's shape. */
  function groupValue(groupKey: string): CellValue {
    if (!groupColumn) {
      return null;
    }
    const multi =
      groupColumn.type === "multi_select" || groupColumn.type === "relation";
    if (groupKey === uncategorized) {
      return multi ? [] : null;
    }
    return multi ? [groupKey] : groupKey;
  }

  /**
   * Drops the card into `groupKey`, ahead of `beforeRowId` when it landed on a
   * card. Order is global — the board only ever shows a slice of it — so the
   * whole visible list is renumbered from the position the card was dropped at.
   */
  function drop(groupKey: string, beforeRowId: string | null = null) {
    const rowId = dragging;
    dragging = null;
    over = null;
    overRow = null;

    if (!rowId || !groupColumn) {
      return;
    }

    const current = rows.find((row) => row.id === rowId);
    const changesGroup =
      String(current?.data[groupColumn.id] ?? "") !==
      String(groupValue(groupKey) ?? "");
    if (changesGroup) {
      onCell(rowId, groupColumn.id, groupValue(groupKey));
    }

    if (beforeRowId && beforeRowId !== rowId) {
      onReorderRows(
        movedBefore(
          rows.map((row) => row.id),
          rowId,
          beforeRowId,
        ),
      );
    }
  }

  /** Only an option column colours its buckets, and never the empty one. */
  function chipStyle(key: string) {
    return groupColumn && hasOptionColors(groupColumn) && key !== uncategorized
      ? optionChipStyle(groupColumn, key, $palette)
      : "";
  }

  function groupLabel(key: string) {
    if (key === uncategorized) {
      return "No value";
    }

    return groupChoices.find((choice) => choice.value === key)?.label ?? key;
  }
</script>

{#if resizing}
  <div
    class="pointer-events-none fixed inset-y-0 z-50 w-px bg-emerald-500"
    style="left: {resizing.x}px"
  ></div>
{/if}

{#if !groupColumn}
  <p class="px-4 py-6 text-sm text-stone-400">
    Pick a "Group by" column to use the board.
  </p>
{:else}
  <div class="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto scroll-p-3 p-3">
    {#each groups as group (group.key)}
      <section
        class="relative flex max-h-full max-w-[85cqw] shrink-0 snap-start flex-col rounded-xl p-2 transition-colors {over ===
        group.key
          ? 'bg-emerald-600/10 ring-1 ring-emerald-600/30'
          : 'bg-stone-500/5 dark:bg-stone-800/40'}"
        style="width: {width}px"
        role="list"
        ondragover={(event) => {
          event.preventDefault();
          over = group.key;
          overRow = null;
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
        }}
        ondragleave={() => {
          if (over === group.key) {
            over = null;
            overRow = null;
          }
        }}
        ondrop={(event) => {
          event.preventDefault();
          drop(group.key);
        }}
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute inset-y-0 -right-2 z-10 w-2 cursor-col-resize rounded hover:bg-emerald-600/30 {resizing
            ? 'bg-emerald-600/40'
            : ''}"
          onpointerdown={startResize}
          onpointermove={moveResize}
          onpointerup={endResize}
          onpointercancel={endResize}
          ondblclick={() => onCardWidth(DEFAULT_WIDTH)}
          title="Drag to resize board columns, double-click to reset"
        ></div>
        <header class="flex items-center justify-between px-1 pb-2">
          <span
            class="truncate rounded-full px-2 py-0.5 text-xs font-medium {chipStyle(
              group.key,
            )
              ? 'db-chip'
              : 'text-stone-500'}"
            style={chipStyle(group.key)}
          >
            {groupLabel(group.key)}
          </span>
          <span class="text-xs text-stone-400">{group.rows.length}</span>
        </header>

        <div
          class="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto"
        >
          {#each group.rows as row (row.id)}
            <article
              class="group rounded-lg border bg-white p-2 shadow-sm dark:bg-stone-900 {overRow ===
              row.id
                ? 'border-t-2 border-t-emerald-600 border-stone-200/70 dark:border-stone-700/70'
                : 'border-stone-200/70 dark:border-stone-700/70'}"
              role="listitem"
              ondragover={(event) => {
                if (!dragging) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                over = group.key;
                overRow = row.id;
              }}
              ondragleave={() => overRow === row.id && (overRow = null)}
              ondrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                drop(group.key, row.id);
              }}
              draggable="true"
              ondragstart={(event) => {
                dragging = row.id;
                // WebKit ignores a drag that carries no payload.
                event.dataTransfer?.setData("text/plain", row.id);
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                }
              }}
              ondragend={() => {
                dragging = null;
                over = null;
                overRow = null;
              }}
            >
              <div class="flex items-start justify-between gap-1">
                <button
                  type="button"
                  class="min-w-0 flex-1 truncate text-left text-sm text-stone-800 hover:underline dark:text-stone-100"
                  onclick={() => onOpenRow(row.id)}
                >
                  {rowTitle(row, columns)}
                </button>
                <button
                  type="button"
                  class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
                  aria-label="Delete row"
                  onclick={() => onDeleteRow(row.id)}
                >
                  <Trash2
                    class="size-3.5"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
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
          class="mt-2 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
          onclick={() =>
            onAddRow(group.key === uncategorized ? null : group.key)}
        >
          <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          New
        </button>
      </section>
    {/each}
  </div>
{/if}
