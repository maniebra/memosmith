<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import type { I18nKey } from "../../lib/i18n";
  import { aggregate, aggregateOptions } from "../../lib/utils/database";
  import type { Aggregate, Column, Row } from "../../lib/utils/database";
  import Select from "../components/Select.svelte";

  export let columns: Column[];
  export let rows: Row[];
  export let aggregations: Record<string, Aggregate> = {};
  export let onAggregation: (columnId: string, fn: Aggregate) => void =
    () => {};

  $: choices = [
    { value: "none", label: "—" },
    ...aggregateOptions
      .filter((entry) => entry !== "none")
      .map((entry) => ({
        value: entry,
        label: $i18n.t(`database.agg.${entry}` as I18nKey),
      })),
  ];

  function summary(column: Column) {
    const fn = aggregations[column.id];
    if (!fn || fn === "none") {
      return "";
    }
    const value = aggregate(
      rows.map((row) => row.data[column.id] ?? null),
      fn,
    );
    return value === null ? "—" : String(value);
  }
</script>

<tfoot>
  <tr class="border-t border-stone-200 dark:border-stone-800">
    <td></td>
    {#each columns as column (column.id)}
      <td class="border-r border-stone-200/70 px-1 dark:border-stone-800">
        <div class="group/foot flex items-center justify-end gap-1">
          <span class="truncate text-xs text-stone-500">{summary(column)}</span>
          <Select
            value={aggregations[column.id] ?? "none"}
            options={choices}
            rootClassName=""
            className="h-6 w-8 rounded border-transparent bg-transparent text-xs opacity-0 shadow-none group-hover/foot:opacity-100 focus:opacity-100"
            ariaLabel={$i18n.t("database.summaryFor", { name: column.name })}
            onChange={(value) => onAggregation(column.id, value as Aggregate)}
          />
        </div>
      </td>
    {/each}
    <td></td>
  </tr>
</tfoot>
