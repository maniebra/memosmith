<script lang="ts">
  import {
    ArrowDownToLine,
    ArrowUpFromLine,
    CalendarDays,
    ChartGantt,
    Filter,
    Image,
    LayoutGrid,
    List,
    Plus,
    Rows3,
    Search,
    SlidersHorizontal,
    Table2,
  } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { I18nKey } from "../../lib/i18n";
  import { viewTypes } from "../../lib/utils/database";
  import type {
    Choice,
    Column,
    Database,
    Table,
    View,
  } from "../../lib/utils/database";
  import Select from "../components/Select.svelte";
  import DatabaseTabs from "./DatabaseTabs.svelte";
  import DatabaseEmbedBar from "./DatabaseEmbedBar.svelte";
  import DatabaseFilterGroup from "./DatabaseFilterGroup.svelte";

  export let database: Database;
  export let table: Table;
  export let view: View;
  export let choices: Record<string, Choice[]>;
  export let compact = false;
  export let filtersOpen = false;
  export let filterCount = 0;
  export let onOpen: (() => void) | null = null;
  /** Embedded only: pinned to this one table view, with the chrome hidden. */
  export let locked = false;
  export let onLock: ((locked: boolean) => void) | null = null;
  export let onRenameDatabase: (name: string) => void;
  export let onSelectTable: (id: string) => void;
  export let onRemoveTable: (id: string) => void | Promise<void>;
  export let onAddTable: () => void;
  export let onRenameTable: (name: string) => void;
  export let onSelectView: (id: string) => void;
  export let onAddView: (type: View["type"]) => void;
  export let onUpdateView: (patch: Partial<View>) => void;
  export let onDeleteView: (id: string) => void = () => {};
  export let onToggleFilters: () => void;
  export let search = "";
  export let onSearch: (query: string) => void = () => {};
  export let onExportCsv: () => void = () => {};
  export let onImportCsv: () => void = () => {};

  const activeTableClass =
    "bg-emerald-600/12 font-medium text-emerald-800 dark:text-emerald-300";
  const activeViewClass =
    "bg-stone-500/10 font-medium text-stone-900 dark:text-stone-100";

  let menu: "view" | "properties" | null = null;
  let bar: HTMLElement | undefined;

  /** Portalled popups (a select's menu) belong to this bar even though they sit on `<body>`. */
  function closeMenuOutside(event: PointerEvent) {
    const target = event.target;
    if (!menu || !bar || !(target instanceof Node) || bar.contains(target)) {
      return;
    }
    if (target instanceof Element && target.closest("[data-portal]")) {
      return;
    }
    menu = null;
  }

  const viewIcons: Record<string, typeof Table2> = {
    table: Table2,
    board: LayoutGrid,
    gallery: Image,
    list: List,
    calendar: CalendarDays,
    gantt: ChartGantt,
  };

  function viewLabel(type: View["type"]) {
    return $i18n.t(
      `database.view${type[0].toUpperCase()}${type.slice(1)}` as I18nKey,
    );
  }

  /** Calendars key on a date, everything else on a value that can label a group. */
  const dateTypes = ["date", "created_time", "edited_time"];
  $: groupableTypes =
    view.type === "calendar" || view.type === "gantt"
      ? dateTypes
      : ["select", "status", "multi_select", "relation", "text", "checkbox"];
  $: groupOptions = [
    { value: "", label: "—" },
    ...table.columns
      .filter((column: Column) => groupableTypes.includes(column.type))
      .map((column) => ({ value: column.id, label: column.name })),
  ];
  $: hidden = new Set(view.hidden ?? []);
  $: showsGroupBy = view.type !== "gallery" && view.type !== "list";
</script>

<svelte:window
  onpointerdown={closeMenuOutside}
  onkeydown={(event) => event.key === "Escape" && (menu = null)}
/>

<div
  class="flex shrink-0 flex-col gap-2 border-b border-stone-200/70 dark:border-stone-800 {compact
    ? 'px-2 py-2'
    : 'px-3 py-3 @2xl:px-4'}"
>
  {#if compact}
    <DatabaseEmbedBar
      {database}
      {table}
      {view}
      {onRenameDatabase}
      {onOpen}
      {locked}
      {onLock}
    />
  {:else}
    <input
      class="w-full bg-transparent text-xl font-semibold @2xl:text-2xl text-stone-900 outline-none dark:text-stone-100"
      value={database.name}
      oninput={(event) => onRenameDatabase(event.currentTarget.value)}
    />
  {/if}

  {#if !locked}
  <div
    class="flex flex-wrap items-center gap-1 border-b border-stone-200/50 pb-2 dark:border-stone-800/80"
  >
    <DatabaseTabs
      tabs={database.tables}
      activeId={table.id}
      activeClass={activeTableClass}
      idleClass="text-stone-500 hover:bg-stone-500/10"
      onSelect={onSelectTable}
      onDelete={onRemoveTable}
      deleteLabel={(name) => $i18n.t("database.deleteTable", { name })}
    />
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

  <div class="flex flex-wrap items-center gap-1" bind:this={bar}>
    <DatabaseTabs
      tabs={table.views.map((entry) => ({
        id: entry.id,
        name: entry.name,
        icon: viewIcons[entry.type] ?? Table2,
      }))}
      activeId={view.id}
      activeClass={activeViewClass}
      idleClass="text-stone-500 hover:bg-stone-500/5"
      onSelect={onSelectView}
      onDelete={onDeleteView}
      deleteLabel={() => $i18n.t("database.deleteView")}
    />
    <div class="relative">
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label={$i18n.t("database.addView")}
        title={$i18n.t("database.addView")}
        onclick={() => (menu = menu === "view" ? null : "view")}
      >
        <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </button>
      {#if menu === "view"}
        <div
          class="absolute top-8 left-0 z-50 w-44 rounded-lg border border-stone-200 bg-surface p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          {#each viewTypes as type (type)}
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-stone-600 hover:bg-stone-500/10 dark:text-stone-300"
              onclick={() => {
                menu = null;
                onAddView(type);
              }}
            >
              <svelte:component
                this={viewIcons[type]}
                class="size-3.5"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              {$i18n.t("database.addViewOfType", { type: viewLabel(type) })}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <input
      class="ml-1 hidden w-24 min-w-0 bg-transparent @md:block text-xs text-stone-500 outline-none"
      aria-label={$i18n.t("database.renameView")}
      value={view.name}
      oninput={(event) => onUpdateView({ name: event.currentTarget.value })}
    />
    <div
      class="flex w-full flex-wrap items-center gap-1.5 @3xl:ml-auto @3xl:w-auto"
    >
      <label
        class="flex min-w-0 flex-1 items-center gap-1 rounded-md bg-stone-500/5 px-2 @3xl:flex-none"
      >
        <Search class="size-3.5 text-stone-400" strokeWidth={1.8} />
        <input
          class="h-7 w-full min-w-16 bg-transparent text-xs outline-none @3xl:w-28"
          placeholder={$i18n.t("database.searchRows")}
          aria-label={$i18n.t("database.searchRows")}
          value={search}
          oninput={(event) => onSearch(event.currentTarget.value)}
        />
      </label>
      {#if showsGroupBy}
        <label class="flex items-center gap-1 text-xs text-stone-500">
          <span class="hidden @xl:inline">{$i18n.t("database.groupBy")}</span>
          <Select
            value={view.groupBy ?? ""}
            options={groupOptions}
            rootClassName=""
            className="h-7 w-28 rounded-md text-xs @xl:w-32"
            onChange={(groupBy) =>
              onUpdateView({ groupBy: groupBy || undefined })}
          />
        </label>
      {/if}
      {#if view.type === "gantt"}
        <label class="flex items-center gap-1 text-xs text-stone-500">
          <span class="hidden @xl:inline">{$i18n.t("database.endDate")}</span>
          <Select
            value={view.endBy ?? ""}
            options={groupOptions}
            rootClassName=""
            className="h-7 w-28 rounded-md text-xs @xl:w-32"
            onChange={(endBy) => onUpdateView({ endBy: endBy || undefined })}
          />
        </label>
      {/if}
      <div class="relative">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10"
          title={$i18n.t("database.properties")}
          onclick={() => (menu = menu === "properties" ? null : "properties")}
        >
          <SlidersHorizontal
            class="size-3.5"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span class="hidden @xl:inline">{$i18n.t("database.properties")}</span>
        </button>
        {#if menu === "properties"}
          <div
            class="absolute top-8 right-0 z-50 max-h-[60vh] w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-stone-200 bg-surface p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          >
            {#each table.columns as column (column.id)}
              <label
                class="flex items-center gap-2 rounded-md px-1 py-1 text-xs text-stone-600 hover:bg-stone-500/10 dark:text-stone-300"
              >
                <input
                  type="checkbox"
                  class="size-3.5 rounded border-stone-300 text-emerald-700 dark:border-stone-700 dark:bg-stone-950"
                  checked={!hidden.has(column.id)}
                  onchange={(event) =>
                    onUpdateView({
                      hidden: event.currentTarget.checked
                        ? (view.hidden ?? []).filter(
                            (entry) => entry !== column.id,
                          )
                        : [...(view.hidden ?? []), column.id],
                    })}
                />
                <span class="truncate">{column.name}</span>
              </label>
            {/each}
            <div
              class="mt-1 flex gap-1 border-t border-stone-200/70 pt-1 dark:border-stone-800"
            >
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10"
                onclick={() => onUpdateView({ hidden: [] })}
                >{$i18n.t("database.showAll")}</button
              >
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10"
                onclick={() =>
                  onUpdateView({
                    hidden: table.columns.map((column) => column.id),
                  })}>{$i18n.t("database.hideAll")}</button
              >
            </div>
          </div>
        {/if}
      </div>
      {#if view.type === "table"}
        <label
          class="flex items-center gap-1 text-xs text-stone-500"
          title={$i18n.t("database.rowHeight")}
        >
          <Rows3 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <Select
            value={view.rowHeight ?? "short"}
            options={[
              { value: "short", label: $i18n.t("database.rowHeightShort") },
              { value: "medium", label: $i18n.t("database.rowHeightMedium") },
              { value: "tall", label: $i18n.t("database.rowHeightTall") },
            ]}
            rootClassName=""
            className="h-7 w-24 rounded-md text-xs"
            onChange={(value) =>
              onUpdateView({ rowHeight: value as View["rowHeight"] })}
          />
        </label>
      {/if}
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label={$i18n.t("database.importCsv")}
        title={$i18n.t("database.importCsv")}
        onclick={onImportCsv}
      >
        <ArrowUpFromLine
          class="size-3.5"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label={$i18n.t("database.exportCsv")}
        title={$i18n.t("database.exportCsv")}
        onclick={onExportCsv}
      >
        <ArrowDownToLine
          class="size-3.5"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors {filterCount
          ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
          : 'text-stone-500 hover:bg-stone-500/10'}"
        title={$i18n.t("common.filter")}
        onclick={onToggleFilters}
      >
        <Filter class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        <span class="hidden @xl:inline">{$i18n.t("common.filter")}</span
        >{filterCount ? ` (${filterCount})` : ""}
      </button>
    </div>
  </div>
  {/if}

  {#if filtersOpen && !locked}
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
