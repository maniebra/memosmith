<script lang="ts">
  import { onDestroy } from "svelte";
  import { Filter, LayoutGrid, Plus, Table2, X } from "@lucide/svelte";
  import {
    choicesFor,
    defaultTable,
    emptyFilter,
    isGroup,
    newId,
    rowsOf,
    tableOf,
    visibleRows,
  } from "../../lib/utils/database";
  import type { CellValue, Choice, Column, Database, Row, Table, View } from "../../lib/utils/database";
  import {
    deleteDatabaseRow,
    deleteDatabaseTable,
    loadDatabase,
    saveDatabaseMeta,
    saveDatabaseRow,
  } from "../../lib/tauri/databases";
  import DatabaseBoard from "./DatabaseBoard.svelte";
  import DatabaseFilterGroup from "./DatabaseFilterGroup.svelte";
  import DatabaseTable from "./DatabaseTable.svelte";
  import Select from "../components/Select.svelte";

  export let root: string;
  export let databaseId: string;
  export let onStatus: (message: string) => void;
  export let onRenamed: (name: string) => void;
  /** Every database in the space, so relation columns can pick a target. */
  export let databaseOptions: { id: string; name: string }[] = [];
  /** Embedded in a note: trimmed chrome, own height, and the note keeps the tab choice. */
  export let compact = false;
  /** Already-loaded data, so an embed paints without a round trip. */
  export let preloaded: Database | null = null;
  export let tableId: string | null = null;
  export let viewId: string | null = null;
  export let onNavigate: (tableId: string, viewId: string) => void = () => {};
  /** Fires whenever the data changes, so callers can keep their own copy fresh. */
  export let onChange: (database: Database) => void = () => {};
  /** Opens this database in the full view; only shown when compact. */
  export let onOpen: (() => void) | null = null;

  let database: Database | null = null;
  let relations: Record<string, Database> = {};
  let activeTableId: string | null = null;
  let activeViewId: string | null = null;
  let filtersOpen = false;
  let loadedId: string | null = null;
  let metaSaveTimer: ReturnType<typeof setTimeout> | undefined;

  $: if (databaseId !== loadedId) {
    loadedId = databaseId;

    if (preloaded && preloaded.id === databaseId) {
      database = preloaded;
      activeTableId = tableId ?? preloaded.tables[0]?.id ?? null;
      activeViewId = viewId;
    } else {
      void load(databaseId);
    }
  }

  $: if (database) {
    onChange(database);
  }

  $: if (compact && table && view) {
    onNavigate(table.id, view.id);
  }

  $: table = database ? (tableOf(database, activeTableId ?? undefined) ?? null) : null;

  $: if (table) {
    void loadRelations(table.columns);
  }

  $: choices = Object.fromEntries(
    (table?.columns ?? []).map((column) => [column.id, choicesFor(column, relations)]),
  ) as Record<string, Choice[]>;

  $: view = table?.views.find((entry) => entry.id === activeViewId) ?? table?.views[0] ?? null;
  $: rows =
    database && table && view
      ? visibleRows(rowsOf(database, table.id), view, table.columns)
      : [];
  $: filterCount = view ? countConditions(view.filter) : 0;

  function countConditions(node: View["filter"]): number {
    return node.children.reduce(
      (total, child) => total + (isGroup(child) ? countConditions(child) : 1),
      0,
    );
  }

  /** Relation targets are read once each; their rows label the links and the board columns. */
  async function loadRelations(columns: Column[]) {
    const wanted = columns
      .filter((column) => column.type === "relation" && column.relationDatabase)
      .map((column) => column.relationDatabase!)
      .filter((id) => !(id in relations));

    for (const id of [...new Set(wanted)]) {
      try {
        relations = { ...relations, [id]: await loadDatabase(root, id) };
      } catch (error) {
        onStatus(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async function load(id: string) {
    try {
      relations = {};
      database = await loadDatabase(root, id);
      activeTableId = tableId ?? database.tables[0]?.id ?? null;
      activeViewId = viewId;
      filtersOpen = false;
    } catch (error) {
      database = null;
      onStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function scheduleMetaSave() {
    if (metaSaveTimer) {
      clearTimeout(metaSaveTimer);
    }

    metaSaveTimer = setTimeout(() => {
      metaSaveTimer = undefined;

      if (!database) {
        return;
      }

      void saveDatabaseMeta(root, database.id, database.name, database.tables).catch(
        (error) => onStatus(error instanceof Error ? error.message : String(error)),
      );
    }, 300);
  }

  function updateDatabase(patch: Partial<Database>) {
    if (!database) {
      return;
    }

    database = { ...database, ...patch };
    scheduleMetaSave();
  }

  function updateTable(patch: Partial<Table>) {
    if (!database || !table) {
      return;
    }

    const tableId = table.id;

    updateDatabase({
      tables: database.tables.map((entry) => (entry.id === tableId ? { ...entry, ...patch } : entry)),
    });
  }

  function updateView(patch: Partial<View>) {
    if (!table || !view) {
      return;
    }

    const viewId = view.id;

    updateTable({
      views: table.views.map((entry) => (entry.id === viewId ? { ...entry, ...patch } : entry)),
    });
  }

  function addTable() {
    if (!database) {
      return;
    }

    const created = defaultTable(`Table ${database.tables.length + 1}`);

    activeTableId = created.id;
    activeViewId = null;
    updateDatabase({ tables: [...database.tables, created] });
  }

  async function removeTable(tableId: string) {
    if (!database || database.tables.length < 2) {
      return;
    }

    try {
      await deleteDatabaseTable(root, database.id, tableId);
      activeTableId = database.tables.find((entry) => entry.id !== tableId)?.id ?? null;
      activeViewId = null;
      database = { ...database, rows: database.rows.filter((row) => row.tableId !== tableId) };
      updateDatabase({ tables: database.tables.filter((entry) => entry.id !== tableId) });
    } catch (error) {
      onStatus(error instanceof Error ? error.message : String(error));
    }
  }

  const rowSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function persistRow(row: Row, immediate = false) {
    if (!database) {
      return;
    }

    const databaseId = database.id;

    clearTimeout(rowSaveTimers.get(row.id));

    if (immediate) {
      rowSaveTimers.delete(row.id);
      void saveDatabaseRow(root, databaseId, row).catch((error) =>
        onStatus(error instanceof Error ? error.message : String(error)),
      );
      return;
    }

    // Typing a cell must not mean one write per character.
    rowSaveTimers.set(
      row.id,
      setTimeout(() => {
        rowSaveTimers.delete(row.id);
        void saveDatabaseRow(root, databaseId, row).catch((error) =>
          onStatus(error instanceof Error ? error.message : String(error)),
        );
      }, 400),
    );
  }

  /**
   * Reorders rows to the order they are shown in.
   * ponytail: a sorted view fights this; positions win once the sort is cleared.
   */
  function reorderRows(orderedIds: string[]) {
    if (!database) {
      return;
    }

    const positions = new Map(orderedIds.map((rowId, index) => [rowId, index + 1]));

    database = {
      ...database,
      rows: database.rows.map((row) =>
        positions.has(row.id) ? { ...row, position: positions.get(row.id)! } : row,
      ),
    };

    for (const row of database.rows) {
      if (positions.has(row.id)) {
        persistRow(row, true);
      }
    }
  }

  function setCell(rowId: string, columnId: string, value: CellValue) {
    if (!database) {
      return;
    }

    const next = database.rows.map((row) =>
      row.id === rowId ? { ...row, data: { ...row.data, [columnId]: value } } : row,
    );

    database = { ...database, rows: next };

    const row = next.find((entry) => entry.id === rowId);

    if (row) {
      persistRow(row);
    }
  }

  function addRow(groupValue: string | null = null) {
    if (!database || !table) {
      return;
    }

    const groupColumn = table.columns.find((column) => column.id === view?.groupBy);
    const data: Row["data"] = {};

    if (groupValue !== null && groupColumn) {
      data[groupColumn.id] = groupColumn.type === "multi_select" ? [groupValue] : groupValue;
    }

    const row: Row = {
      id: newId(),
      tableId: table.id,
      position: (database.rows[database.rows.length - 1]?.position ?? 0) + 1,
      data,
    };

    database = { ...database, rows: [...database.rows, row] };
    persistRow(row, true);
  }

  async function removeRow(rowId: string) {
    if (!database) {
      return;
    }

    try {
      await deleteDatabaseRow(root, database.id, rowId);
      database = { ...database, rows: database.rows.filter((row) => row.id !== rowId) };
    } catch (error) {
      onStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function addColumn() {
    if (!table) {
      return;
    }

    const column: Column = { id: newId(), name: `Column ${table.columns.length + 1}`, type: "text" };

    updateTable({ columns: [...table.columns, column] });
  }

  function setColumns(columns: Column[]) {
    if (!table) {
      return;
    }

    const removed = table.columns.filter((column) => !columns.some((entry) => entry.id === column.id));

    updateTable({
      columns,
      views: table.views.map((entry) =>
        removed.some((column) => column.id === entry.groupBy) ? { ...entry, groupBy: undefined } : entry,
      ),
    });
  }

  function addView(type: View["type"]) {
    if (!table) {
      return;
    }

    const created: View = {
      id: newId(),
      name: type === "board" ? "Board" : "Table",
      type,
      groupBy: table.columns.find((column) => column.type === "select")?.id,
      filter: emptyFilter(),
      sorts: [],
    };

    activeViewId = created.id;
    updateTable({ views: [...table.views, created] });
  }

  // A card can be torn down mid-edit; pending writes still have to land.
  onDestroy(() => {
    for (const [rowId, timer] of rowSaveTimers) {
      clearTimeout(timer);

      const row = database?.rows.find((entry) => entry.id === rowId);

      if (row && database) {
        void saveDatabaseRow(root, database.id, row).catch(() => {});
      }
    }

    rowSaveTimers.clear();

    if (metaSaveTimer) {
      clearTimeout(metaSaveTimer);

      if (database) {
        void saveDatabaseMeta(root, database.id, database.name, database.tables).catch(() => {});
      }
    }
  });

  function renameDatabase(name: string) {
    updateDatabase({ name });
    onRenamed(name);
  }
</script>

{#if database && table && view}
  <div class="flex min-h-0 flex-col {compact ? 'max-h-[32rem]' : 'h-full'}">
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
            oninput={(event) => renameDatabase(event.currentTarget.value)}
          />

          {#if onOpen}
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
              onclick={onOpen}
            >
              Open
            </button>
          {/if}
        </div>
      {:else}
        <input
          class="w-full bg-transparent text-2xl font-semibold text-stone-900 outline-none dark:text-stone-100"
          value={database.name}
          oninput={(event) => renameDatabase(event.currentTarget.value)}
        />
      {/if}

      <div class="flex flex-wrap items-center gap-1 border-b border-stone-200/50 pb-2 dark:border-stone-800/80">
        {#each database.tables as entry (entry.id)}
          <div class="group flex items-center">
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs transition-colors {entry.id === table.id
                ? 'bg-emerald-600/12 font-medium text-emerald-800 dark:text-emerald-300'
                : 'text-stone-500 hover:bg-stone-500/10'}"
              onclick={() => {
                activeTableId = entry.id;
                activeViewId = null;
              }}
            >
              {entry.name}
            </button>

            {#if database.tables.length > 1}
              <button
                type="button"
                class="flex size-5 items-center justify-center rounded text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600"
                aria-label="Delete table {entry.name}"
                onclick={() => void removeTable(entry.id)}
              >
                <X class="size-3" strokeWidth={2} aria-hidden="true" />
              </button>
            {/if}
          </div>
        {/each}

        <button
          type="button"
          class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
          aria-label="Add table"
          title="Add table"
          onclick={addTable}
        >
          <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        </button>

        <input
          class="ml-2 min-w-0 flex-1 bg-transparent text-xs text-stone-500 outline-none"
          aria-label="Table name"
          value={table.name}
          oninput={(event) => updateTable({ name: event.currentTarget.value })}
        />
      </div>

      <div class="flex flex-wrap items-center gap-1">
        {#each table.views as entry (entry.id)}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors {entry.id === view.id
              ? 'bg-stone-500/10 font-medium text-stone-900 dark:text-stone-100'
              : 'text-stone-500 hover:bg-stone-500/5'}"
            onclick={() => (activeViewId = entry.id)}
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
          aria-label="Add table view"
          title="Add table view"
          onclick={() => addView("table")}
        >
          <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div class="ml-auto flex items-center gap-1.5">
          {#if view.type === "board"}
            <label class="flex items-center gap-1 text-xs text-stone-500">
              Group by
              <Select
                value={view.groupBy ?? ""}
                options={[
                  { value: "", label: "—" },
                  ...table.columns
                    .filter((column) => ["select", "multi_select", "relation", "text"].includes(column.type))
                    .map((column) => ({ value: column.id, label: column.name })),
                ]}
                className="h-7 w-40 rounded-md text-xs"
                onChange={(groupBy) => updateView({ groupBy: groupBy || undefined })}
              />
            </label>
          {:else}
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
              onclick={() => addView("board")}
            >
              Add board view
            </button>
          {/if}

          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors {filterCount
              ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
              : 'text-stone-500 hover:bg-stone-500/10'}"
            onclick={() => (filtersOpen = !filtersOpen)}
          >
            <Filter class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            Filter{filterCount ? ` (${filterCount})` : ""}
          </button>
        </div>
      </div>

      {#if filtersOpen}
        <div class="rounded-lg border border-stone-200/80 p-2 dark:border-stone-700/70">
          <DatabaseFilterGroup
            group={view.filter}
            columns={table.columns}
            {choices}
            onChange={(filter) => updateView({ filter })}
          />
        </div>
      {/if}
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      {#if view.type === "board"}
        <DatabaseBoard
          columns={table.columns}
          {rows}
          {choices}
          groupBy={view.groupBy}
          cardWidth={view.cardWidth}
          onCardWidth={(cardWidth) => updateView({ cardWidth })}
          onCell={setCell}
          onAddRow={addRow}
          onDeleteRow={removeRow}
          commitCellsOnInput={!compact}
        />
      {:else}
        <DatabaseTable
          columns={table.columns}
          {rows}
          {choices}
          databaseOptions={databaseOptions.filter((option) => option.id !== database?.id)}
          onCell={setCell}
          onAddRow={() => addRow(null)}
          onDeleteRow={removeRow}
          onColumnsChange={setColumns}
          onAddColumn={addColumn}
          onReorderRows={reorderRows}
          commitCellsOnInput={!compact}
        />
      {/if}
    </div>
  </div>
{:else}
  <p class="px-4 py-6 text-sm text-stone-400">Loading database…</p>
{/if}
