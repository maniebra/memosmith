<script lang="ts">
  import { ChevronLeft, ChevronRight, Plus } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { rowTitle } from "../../lib/utils/database";
  import {
    addMonths,
    isoDate,
    monthDays,
    startOfMonth,
  } from "../../lib/utils/calendarMonth";
  import type { CellValue, Column, Row } from "../../lib/utils/database";

  export let columns: Column[];
  export let rows: Row[];
  /** Date column the rows are placed by. */
  export let dateColumn: string | undefined;
  export let onCell: (
    rowId: string,
    columnId: string,
    value: CellValue,
  ) => void;
  /** Creates a row already dated to the day it was added on. */
  export let onAddRow: (isoDate: string) => void;
  export let onOpenRow: (rowId: string) => void = () => {};
  export let editable = true;

  const today = new Date();
  let month = startOfMonth(today);
  let dragging: string | null = null;

  $: column = columns.find((entry) => entry.id === dateColumn);

  $: days = monthDays(month);

  $: byDay = (() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const value = column ? row.data[column.id] : null;
      const key = typeof value === "string" ? value.slice(0, 10) : "";
      if (key) {
        map.set(key, [...(map.get(key) ?? []), row]);
      }
    }
    return map;
  })();

  function shiftMonth(step: number) {
    month = addMonths(month, step);
  }

  function drop(date: Date) {
    if (dragging && column && editable) {
      onCell(dragging, column.id, isoDate(date));
    }
    dragging = null;
  }
</script>

{#if !column}
  <p class="px-4 py-6 text-sm text-stone-400">
    {$i18n.t("database.noDateColumn")}
  </p>
{:else}
  <div class="flex min-h-0 flex-1 flex-col p-3">
    <div class="mb-2 flex items-center gap-2">
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10"
        aria-label={$i18n.t("database.previousMonth")}
        onclick={() => shiftMonth(-1)}
      >
        <ChevronLeft class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span class="text-sm font-medium text-stone-700 dark:text-stone-200">
        {month.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
      </span>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10"
        aria-label={$i18n.t("database.nextMonth")}
        onclick={() => shiftMonth(1)}
      >
        <ChevronRight class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10"
        onclick={() =>
          (month = startOfMonth(today))}
        >{$i18n.t("database.today")}</button
      >
    </div>

    <div
      class="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto rounded-lg border border-stone-200/70 dark:border-stone-800"
    >
      {#each days as date (date.getTime())}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="group flex min-h-24 flex-col border-r border-b border-stone-200/60 p-1 dark:border-stone-800/80 {date.getMonth() ===
          month.getMonth()
            ? ''
            : 'bg-stone-500/5 text-stone-400'}"
          ondragover={(event) => event.preventDefault()}
          ondrop={() => drop(date)}
        >
          <div class="flex items-center justify-between">
            <span
              class="px-1 text-[0.6875rem] {isoDate(date) === isoDate(today)
                ? 'rounded bg-emerald-600/15 font-medium text-emerald-700 dark:text-emerald-300'
                : 'text-stone-400'}">{date.getDate()}</span
            >
            {#if editable}
              <button
                type="button"
                class="flex size-5 items-center justify-center rounded text-stone-300 opacity-0 group-hover:opacity-100 hover:bg-stone-500/10"
                aria-label={$i18n.t("database.newRow")}
                onclick={() => onAddRow(isoDate(date))}
              >
                <Plus class="size-3" strokeWidth={1.8} aria-hidden="true" />
              </button>
            {/if}
          </div>
          <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {#each byDay.get(isoDate(date)) ?? [] as row (row.id)}
              <button
                type="button"
                class="truncate rounded bg-emerald-600/10 px-1.5 py-0.5 text-left text-[0.6875rem] text-emerald-800 dark:text-emerald-300"
                draggable={editable}
                ondragstart={() => (dragging = row.id)}
                ondragend={() => (dragging = null)}
                onclick={() => onOpenRow(row.id)}
              >
                {rowTitle(row, columns)}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
