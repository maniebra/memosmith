<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import type { I18nKey } from "../../lib/i18n";
  import { aggregateOptions } from "../../lib/utils/database";
  import type { Column, ColumnType } from "../../lib/utils/database";
  import Select from "../components/Select.svelte";

  export let column: Column;
  export let databaseOptions: { id: string; name: string }[] = [];
  export let left = 0;
  export let top = 0;
  export let width = 240;
  export let columnTypes: { value: ColumnType; label: string }[] = [];
  /** Every column of this table, so rollups can name the relation they walk. */
  export let columns: Column[] = [];
  /** Relation column id -> columns of the table it links to. */
  export let relationColumns: Record<string, Column[]> = {};
  export let onUpdate: (patch: Partial<Column>) => void;
  export let onDelete: () => void;

  $: relationOptions = columns
    .filter((entry) => entry.type === "relation")
    .map((entry) => ({ value: entry.id, label: entry.name }));
  $: targetOptions = (relationColumns[column.rollupRelation ?? ""] ?? []).map(
    (entry) => ({ value: entry.id, label: entry.name }),
  );
</script>

<div
  class="fixed z-50 flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
  style="left: {left}px; top: {top}px; width: {width}px;"
>
  <input
    class="h-8 rounded-md border border-stone-200 bg-transparent px-2 text-sm font-normal outline-none dark:border-stone-700"
    value={column.name}
    oninput={(event) => onUpdate({ name: event.currentTarget.value })}
  />
  <Select
    value={column.type}
    options={columnTypes}
    className="h-8 rounded-md font-normal"
    onChange={(type) => onUpdate({ type: type as ColumnType })}
  />
  {#if column.type === "select" || column.type === "multi_select" || column.type === "status"}
    <textarea
      rows="3"
      placeholder={$i18n.t("database.oneOptionPerLine")}
      class="rounded-md border border-stone-200 bg-transparent px-2 py-1 text-sm font-normal outline-none dark:border-stone-700"
      value={(column.options ?? []).join("\n")}
      oninput={(event) =>
        onUpdate({
          options: event.currentTarget.value
            .split("\n")
            .map((option) => option.trim())
            .filter(Boolean),
        })}></textarea>
  {/if}
  {#if column.type === "relation"}
    <Select
      value={column.relationDatabase ?? ""}
      options={[
        { value: "", label: $i18n.t("database.linkedDatabase") },
        ...databaseOptions.map((option) => ({
          value: option.id,
          label: option.name,
        })),
      ]}
      className="h-8 rounded-md font-normal"
      onChange={(id) => onUpdate({ relationDatabase: id || undefined })}
    />
  {/if}
  {#if column.type === "formula"}
    <textarea
      rows="3"
      placeholder={'if({Done}, 1, 0) * {Size}'}
      class="rounded-md border border-stone-200 bg-transparent px-2 py-1 font-mono text-xs font-normal outline-none dark:border-stone-700"
      value={column.formula ?? ""}
      oninput={(event) => onUpdate({ formula: event.currentTarget.value })}
    ></textarea>
    <p class="text-[0.6875rem] text-stone-400">
      {$i18n.t("database.formulaHint")}
    </p>
  {/if}
  {#if column.type === "rollup"}
    <Select
      value={column.rollupRelation ?? ""}
      options={[
        { value: "", label: $i18n.t("database.rollupRelation") },
        ...relationOptions,
      ]}
      className="h-8 rounded-md font-normal"
      onChange={(id) =>
        onUpdate({ rollupRelation: id || undefined, rollupTarget: undefined })}
    />
    <Select
      value={column.rollupTarget ?? ""}
      options={[
        { value: "", label: $i18n.t("database.rollupTarget") },
        ...targetOptions,
      ]}
      className="h-8 rounded-md font-normal"
      onChange={(id) => onUpdate({ rollupTarget: id || undefined })}
    />
    <Select
      value={column.rollupFunction ?? "show_original"}
      options={[
        { value: "show_original", label: $i18n.t("database.aggShowOriginal") },
        ...aggregateOptions
          .filter((entry) => entry !== "none")
          .map((entry) => ({
            value: entry,
            label: $i18n.t(`database.agg.${entry}` as I18nKey),
          })),
      ]}
      className="h-8 rounded-md font-normal"
      onChange={(value) =>
        onUpdate({ rollupFunction: value as Column["rollupFunction"] })}
    />
  {/if}
  <button
    type="button"
    class="rounded-md px-2 py-1 text-left text-xs font-normal text-rose-600 hover:bg-rose-500/10"
    onclick={onDelete}
  >
    {$i18n.t("database.deleteColumn")}
  </button>
</div>
