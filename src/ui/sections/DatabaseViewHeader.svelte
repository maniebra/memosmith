<script lang="ts">
  import { Filter, LayoutGrid, Plus, Table2, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type {
    Choice,
    Column,
    Database,
    Table,
    View,
  } from "../../lib/utils/database";
  import Select from "../components/Select.svelte";
  import DatabaseFilterGroup from "./DatabaseFilterGroup.svelte";

  export let database: Database;
  export let table: Table;
  export let view: View;
  export let choices: Record<string, Choice[]>;
  export let compact = false;
  export let filtersOpen = false;
  export let filterCount = 0;
  export let onOpen: (() => void) | null = null;
  export let onRenameDatabase: (name: string) => void;
  export let onSelectTable: (id: string) => void;
  export let onRemoveTable: (id: string) => void | Promise<void>;
  export let onAddTable: () => void;
  export let onRenameTable: (name: string) => void;
  export let onSelectView: (id: string) => void;
  export let onAddView: (type: View["type"]) => void;
  export let onUpdateView: (patch: Partial<View>) => void;
  export let onToggleFilters: () => void;

  $: groupOptions = [
    { value: "", label: "—" },
    ...table.columns
      .filter((column: Column) =>
        ["select", "multi_select", "relation", "text"].includes(column.type),
      )
      .map((column) => ({ value: column.id, label: column.name })),
  ];
</script>

<div
  class="flex shrink-0 flex-col gap-2 border-b border-stone-200/70 dark:border-stone-800 {compact
    ? 'px-2 py-2'
    : 'px-4 py-3'}"
>
  {#if compact}
    <div class="flex items-center gap-2">
      <input
        class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-800 outline-none dark:text-stone-100"
        value={database.name}
        oninput={(event) => onRenameDatabase(event.currentTarget.value)}
      />
      {#if onOpen}
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
          onclick={onOpen}>{$i18n.t("common.open")}</button
        >
      {/if}
    </div>
  {:else}
    <input
      class="w-full bg-transparent text-2xl font-semibold text-stone-900 outline-none dark:text-stone-100"
      value={database.name}
      oninput={(event) => onRenameDatabase(event.currentTarget.value)}
    />
  {/if}

  <div
    class="flex flex-wrap items-center gap-1 border-b border-stone-200/50 pb-2 dark:border-stone-800/80"
  >
    {#each database.tables as entry (entry.id)}
      <div class="group flex items-center">
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs transition-colors {entry.id ===
          table.id
            ? 'bg-emerald-600/12 font-medium text-emerald-800 dark:text-emerald-300'
            : 'text-stone-500 hover:bg-stone-500/10'}"
          onclick={() => onSelectTable(entry.id)}>{entry.name}</button
        >
        {#if database.tables.length > 1}
          <button
            type="button"
            class="flex size-5 items-center justify-center rounded text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600"
            aria-label={$i18n.t("database.deleteTable", { name: entry.name })}
            onclick={() => void onRemoveTable(entry.id)}
          >
            <X class="size-3" strokeWidth={2} aria-hidden="true" />
          </button>
        {/if}
      </div>
    {/each}
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
      aria-label={$i18n.t("database.addTable")}
      title={$i18n.t("database.addTable")}
      onclick={onAddTable}
    >
      <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    </button>
    <input
      class="ml-2 min-w-0 flex-1 bg-transparent text-xs text-stone-500 outline-none"
      aria-label={$i18n.t("database.tableName")}
      value={table.name}
      oninput={(event) => onRenameTable(event.currentTarget.value)}
    />
  </div>

  <div class="flex flex-wrap items-center gap-1">
    {#each table.views as entry (entry.id)}
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors {entry.id ===
        view.id
          ? 'bg-stone-500/10 font-medium text-stone-900 dark:text-stone-100'
          : 'text-stone-500 hover:bg-stone-500/5'}"
        onclick={() => onSelectView(entry.id)}
      >
        <svelte:component
          this={entry.type === "board" ? LayoutGrid : Table2}
          class="size-3.5"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        {entry.name}
      </button>
    {/each}
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
      aria-label={$i18n.t("database.addView")}
      title={$i18n.t("database.addView")}
      onclick={() => onAddView("table")}
    >
      <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    </button>
    <div class="ml-auto flex items-center gap-1.5">
      {#if view.type === "board"}
        <label class="flex items-center gap-1 text-xs text-stone-500">
          {$i18n.t("database.groupBy")}
          <Select
            value={view.groupBy ?? ""}
            options={groupOptions}
            className="h-7 w-40 rounded-md text-xs"
            onChange={(groupBy) =>
              onUpdateView({ groupBy: groupBy || undefined })}
          />
        </label>
      {:else}
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
          onclick={() => onAddView("board")}
          >{$i18n.t("database.addBoardView")}</button
        >
      {/if}
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors {filterCount
          ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
          : 'text-stone-500 hover:bg-stone-500/10'}"
        onclick={onToggleFilters}
      >
        <Filter class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        {$i18n.t("common.filter")}{filterCount ? ` (${filterCount})` : ""}
      </button>
    </div>
  </div>

  {#if filtersOpen}
    <div
      class="rounded-lg border border-stone-200/80 p-2 dark:border-stone-700/70"
    >
      <DatabaseFilterGroup
        group={view.filter}
        columns={table.columns}
        {choices}
        onChange={(filter) => onUpdateView({ filter })}
      />
    </div>
  {/if}
</div>
