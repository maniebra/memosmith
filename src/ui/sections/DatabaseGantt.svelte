<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import { rowTitle } from "../../lib/utils/database";
  import { dateFromIso, isoDate } from "../../lib/utils/calendarMonth";
  import type { Column, Row } from "../../lib/utils/database";

  export let columns: Column[];
  export let rows: Row[];
  /** Date column the bars start on. */
  export let startColumn: string | undefined;
  /** Date column the bars end on; absent means one-day bars. */
  export let endColumn: string | undefined;
  export let onOpenRow: (rowId: string) => void = () => {};

  const dayMs = 86_400_000;
  const dayWidth = 28;

  function dateOf(row: Row, columnId: string | undefined) {
    const value = columnId ? row.data[columnId] : null;
    return typeof value === "string" ? dateFromIso(value) : null;
  }

  $: bars = rows
    .map((row) => {
      const start = dateOf(row, startColumn);
      if (!start) {
        return null;
      }
      const end = dateOf(row, endColumn) ?? start;
      return { row, start, end: end < start ? start : end };
    })
    .filter((bar) => bar !== null);

  // Pad a day either side so the first and last bar are not flush to the edge.
  $: span = (() => {
    if (!bars.length) {
      return null;
    }
    const first = Math.min(...bars.map((bar) => bar.start.getTime())) - dayMs;
    const last = Math.max(...bars.map((bar) => bar.end.getTime())) + dayMs;
    const days = Math.round((last - first) / dayMs) + 1;
    return {
      first,
      days: Array.from({ length: days }, (_, index) => new Date(first + index * dayMs)),
    };
  })();

  function offset(date: Date, first: number) {
    return Math.round((date.getTime() - first) / dayMs);
  }
</script>

{#if !startColumn}
  <p class="px-4 py-6 text-sm text-stone-400">
    {$i18n.t("database.noStartColumn")}
  </p>
{:else if !span}
  <p class="px-4 py-6 text-sm text-stone-400">{$i18n.t("database.noValue")}</p>
{:else}
  <div class="min-h-0 flex-1 overflow-auto p-3">
    <div class="flex w-max">
      <div class="sticky left-0 z-10 bg-white dark:bg-stone-900">
        <div class="h-6 border-b border-stone-200/70 dark:border-stone-800"></div>
        {#each bars as bar (bar.row.id)}
          <button
            type="button"
            class="flex h-7 w-40 items-center truncate px-2 text-left text-xs text-stone-600 hover:bg-stone-500/10 dark:text-stone-300"
            onclick={() => onOpenRow(bar.row.id)}
          >
            {rowTitle(bar.row, columns)}
          </button>
        {/each}
      </div>
      <div>
        <div class="flex h-6 border-b border-stone-200/70 dark:border-stone-800">
          {#each span.days as date (date.getTime())}
            <div
              class="shrink-0 border-l border-stone-200/50 text-center text-[0.625rem] text-stone-400 dark:border-stone-800/80"
              style="width: {dayWidth}px"
            >
              {date.getDate()}
            </div>
          {/each}
        </div>
        {#each bars as bar (bar.row.id)}
          <div class="relative h-7" style="width: {span.days.length * dayWidth}px">
            <div
              class="absolute top-1 h-5 truncate rounded bg-emerald-600/25 px-1.5 text-[0.6875rem] leading-5 text-emerald-800 dark:text-emerald-300"
              style="left: {offset(bar.start, span.first) * dayWidth}px; width: {(offset(
                bar.end,
                span.first,
              ) -
                offset(bar.start, span.first) +
                1) *
                dayWidth}px"
              title="{rowTitle(bar.row, columns)} · {isoDate(bar.start)} → {isoDate(
                bar.end,
              )}"
            >
              {isoDate(bar.start)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
