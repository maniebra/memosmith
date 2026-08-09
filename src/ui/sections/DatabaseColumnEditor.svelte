<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import type { Column, ColumnType } from "../../lib/utils/database";
  import Select from "../components/Select.svelte";

  export let column: Column;
  export let databaseOptions: { id: string; name: string }[] = [];
  export let left = 0;
  export let top = 0;
  export let width = 240;
  export let columnTypes: { value: ColumnType; label: string }[] = [];
  export let onUpdate: (patch: Partial<Column>) => void;
  export let onDelete: () => void;
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
  {#if column.type === "select" || column.type === "multi_select"}
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
  <button
    type="button"
    class="rounded-md px-2 py-1 text-left text-xs font-normal text-rose-600 hover:bg-rose-500/10"
    onclick={onDelete}
  >
    {$i18n.t("database.deleteColumn")}
  </button>
</div>
