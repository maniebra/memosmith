<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "../../lib/i18n";
  import {
    choicesFor,
    computeRows,
    defaultTable,
    relationColumnsOf,
    rowsOf,
    searchRows,
    tableOf,
    visibleColumns,
    visibleRows,
  } from "../../lib/utils/database";
  import type {
    Aggregate,
    CellValue,
    Choice,
    Column,
    Database,
    Row,
    Table,
    View,
  } from "../../lib/utils/database";
  import { exportTableCsv, importTableCsv } from "./databaseCsvActions";
  import {
    countConditions,
    patched,
    createColumn,
    createRow,
    createView,
    reordered,
    withCell,
    withDefaults,
    withoutMissingGroups,
  } from "./databaseEdits";
  import {
    deleteDatabaseRow,
    deleteDatabaseTable,
    loadDatabase,
  } from "../../lib/tauri/databases";
  import DatabaseRowPage from "./DatabaseRowPage.svelte";
  import DatabaseViewBody from "./DatabaseViewBody.svelte";
  import DatabaseViewHeader from "./DatabaseViewHeader.svelte";
  import { DatabasePersistence } from "./databasePersistence";
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
  /** Embedded only: pinned to one table view, chrome hidden. */
  export let locked = false;
  export let onLock: ((locked: boolean) => void) | null = null;
  /** Fires whenever the data changes, so callers can keep their own copy fresh. */
  export let onChange: (database: Database) => void = () => {};
  /** Opens this database in the full view; only shown when compact. */
  export let onOpen: (() => void) | null = null;
  let database: Database | null = null;
  let relations: Record<string, Database> = {};
  let activeTableId: string | null = null;
  let activeViewId: string | null = null;
  /** Own copy: the embed keeps its mounted props, so the toggle drives this. */
  let pinned = false;
  $: pinned = locked;
  const setPinned = (v: boolean) => { pinned = v; onLock?.(v); };
  let filtersOpen = false;
  let loadedId: string | null = null;
  let search = "";
  let openRowId: string | null = null;
  const persistence = new DatabasePersistence(
    () => root,
    () => database,
    onStatus,
  );
  $: if (databaseId !== loadedId) {
    loadedId = databaseId;
    if (preloaded && preloaded.id === databaseId) {
      database = withDefaults(preloaded);
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
  $: table = database
    ? (tableOf(database, activeTableId ?? undefined) ?? null)
    : null;
  $: if (table) {
    void loadRelations(table.columns);
  }
  $: choices = Object.fromEntries(
    (table?.columns ?? []).map((column) => [
      column.id,
      choicesFor(column, relations),
    ]),
  ) as Record<string, Choice[]>;
  $: view =
    table?.views.find((entry) => entry.id === activeViewId) ??
    table?.views[0] ??
    null;
  /** Formulas, rollups and timestamps are filled before filtering, so views agree on values. */
  $: computed =
    database && table
      ? computeRows(rowsOf(database, table.id), table.columns, relations)
      : [];
  $: shownColumns = table && view ? visibleColumns(table.columns, view) : [];
  $: relationColumns = relationColumnsOf(table?.columns ?? [], relations);
  $: rows =
    database && table && view
      ? searchRows(
          visibleRows(computed, view, table.columns),
          shownColumns,
          search,
        )
      : [];
  $: openRow = rows.find((row) => row.id === openRowId) ?? null;
  $: filterCount = view ? countConditions(view.filter) : 0;
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
        report(error);
      }
    }
  }
  function report(error: unknown) {
    onStatus(error instanceof Error ? error.message : String(error));
  }
  async function load(id: string) {
    try {
      relations = {};
      const loaded = withDefaults(await loadDatabase(root, id));
      database = loaded;
      activeTableId = tableId ?? loaded.tables[0]?.id ?? null;
      activeViewId = viewId;
      filtersOpen = false;
    } catch (error) {
      database = null;
      report(error);
    }
  }
  function updateDatabase(patch: Partial<Database>) {
    if (!database) {
      return;
    }
    database = { ...database, ...patch };
    persistence.scheduleMetaSave();
  }
  function updateTable(patch: Partial<Table>) {
    if (database && table) {
      updateDatabase({ tables: patched(database.tables, table.id, patch) });
    }
  }
  function updateView(patch: Partial<View>) {
    if (table && view) {
      updateTable({ views: patched(table.views, view.id, patch) });
    }
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
      activeTableId =
        database.tables.find((entry) => entry.id !== tableId)?.id ?? null;
      activeViewId = null;
      const rows = database.rows.filter((row) => row.tableId !== tableId);
      const tables = database.tables.filter((entry) => entry.id !== tableId);
      database = { ...database, rows };
      updateDatabase({ tables });
    } catch (error) {
      report(error);
    }
  }
  function persistRow(row: Row, immediate = false) {
    persistence.persistRow(row, immediate);
  }
  /**
   * Reorders rows to the order they are shown in.
   */
  function reorderRows(orderedIds: string[]) {
    if (!database) {
      return;
    }
    const rows = reordered(database.rows, orderedIds);
    database = { ...database, rows };
    for (const row of rows.filter((entry) => orderedIds.includes(entry.id))) {
      persistRow(row, true);
    }
  }
  function setCell(rowId: string, columnId: string, value: CellValue) {
    if (!database) {
      return;
    }
    const rows = withCell(database.rows, rowId, columnId, value);
    database = { ...database, rows };
    const row = rows.find((entry) => entry.id === rowId);
    if (row) {
      persistRow(row);
    }
  }
  function addRow(groupValue: string | null = null) {
    if (!database || !table) {
      return;
    }
    const row = createRow(
      table,
      table.columns.find((column) => column.id === view?.groupBy),
      groupValue,
      database.rows[database.rows.length - 1]?.position ?? 0,
    );
    database = { ...database, rows: [...database.rows, row] };
    persistRow(row, true);
  }
  async function removeRow(rowId: string) {
    if (!database) {
      return;
    }
    try {
      await deleteDatabaseRow(root, database.id, rowId);
      const rows = database.rows.filter((row) => row.id !== rowId);
      database = { ...database, rows };
    } catch (error) {
      report(error);
    }
  }
  function addColumn() {
    if (table) {
      updateTable({ columns: [...table.columns, createColumn(table.columns)] });
    }
  }
  function setColumns(columns: Column[]) {
    if (table) {
      updateTable({
        columns,
        views: withoutMissingGroups(table.views, columns),
      });
    }
  }
  function addView(type: View["type"]) {
    if (!table) {
      return;
    }
    const created = createView(type, table.columns);
    activeViewId = created.id;
    updateTable({ views: [...table.views, created] });
  }
  function removeView(id: string) {
    if (!table || table.views.length < 2) {
      return;
    }
    if (activeViewId === id) {
      activeViewId = table.views.find((entry) => entry.id !== id)?.id ?? null;
    }
    updateTable({ views: table.views.filter((entry) => entry.id !== id) });
  }
  function setAggregation(columnId: string, fn: Aggregate) {
    updateView({
      aggregations: { ...(view?.aggregations ?? {}), [columnId]: fn },
    });
  }
  async function exportCsv() {
    if (!table) {
      return;
    }
    const message = await exportTableCsv(table.name, shownColumns, rows);
    if (message) {
      onStatus(message);
    }
  }
  async function importCsv() {
    if (!database || !table) {
      return;
    }
    const result = await importTableCsv(
      table,
      database.rows[database.rows.length - 1]?.position ?? 0,
    );
    if (!result) {
      return;
    }
    if (result.error) {
      onStatus(result.error);
      return;
    }
    database = { ...database, rows: [...database.rows, ...result.rows] };
    updateTable({ columns: result.columns });
    for (const row of result.rows) {
      persistRow(row, true);
    }
    onStatus($i18n.t("database.imported", { count: result.rows.length }));
  }
  onDestroy(() => persistence.destroy());
  function renameDatabase(name: string) {
    updateDatabase({ name });
    onRenamed(name);
  }
</script>
{#if database && table && view}
  <div class="@container flex min-h-0 flex-col {compact ? 'max-h-[32rem]' : 'h-full'}">
    <DatabaseViewHeader
      {database}
      {table}
      {view}
      {choices}
      {compact}
      {filtersOpen}
      {filterCount}
      {onOpen}
      locked={pinned}
      onLock={onLock && setPinned}
      onRenameDatabase={renameDatabase}
      onSelectTable={(id) => {
        activeTableId = id;
        activeViewId = null;
      }}
      onRemoveTable={removeTable}
      onAddTable={addTable}
      onRenameTable={(name) => updateTable({ name })}
      onSelectView={(id) => (activeViewId = id)}
      onAddView={addView}
      onUpdateView={updateView}
      onDeleteView={removeView}
      onToggleFilters={() => (filtersOpen = !filtersOpen)}
      {search}
      onSearch={(query) => (search = query)}
      onExportCsv={() => void exportCsv()}
      onImportCsv={() => void importCsv()}
    />
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DatabaseViewBody
        {view}
        {table}
        {rows}
        {choices}
        {shownColumns}
        {relationColumns}
        {compact}
        locked={pinned}
        databaseOptions={databaseOptions.filter(
          (option) => option.id !== database?.id,
        )}
        onCell={setCell}
        onAddRow={addRow}
        onDeleteRow={removeRow}
        onOpenRow={(id) => (openRowId = id)}
        onColumnsChange={setColumns}
        onAddColumn={addColumn}
        onReorderRows={reorderRows}
        onUpdateView={updateView}
        onAggregation={setAggregation}
      />
    </div>
  </div>
  {#if openRow}
    <DatabaseRowPage
      row={openRow}
      columns={table.columns}
      {choices}
      onCell={setCell}
      onClose={() => (openRowId = null)}
    />
  {/if}
{:else}
  <p class="px-4 py-6 text-sm text-stone-400">{$i18n.t("database.loading")}</p>
{/if}
