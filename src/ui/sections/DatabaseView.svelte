<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "../../lib/i18n";
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
  import type {
    CellValue,
    Choice,
    Column,
    Database,
    Row,
    Table,
    View,
  } from "../../lib/utils/database";
  import {
    deleteDatabaseRow,
    deleteDatabaseTable,
    loadDatabase,
  } from "../../lib/tauri/databases";
  import DatabaseBoard from "./DatabaseBoard.svelte";
  import DatabaseViewHeader from "./DatabaseViewHeader.svelte";
  import DatabaseTable from "./DatabaseTable.svelte";
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
  const persistence = new DatabasePersistence(
    () => root,
    () => database,
    onStatus,
  );
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
    persistence.scheduleMetaSave();
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
      tables: database.tables.map((entry) =>
        entry.id === tableId ? { ...entry, ...patch } : entry,
      ),
    });
  }
  function updateView(patch: Partial<View>) {
    if (!table || !view) {
      return;
    }
    const viewId = view.id;
    updateTable({
      views: table.views.map((entry) =>
        entry.id === viewId ? { ...entry, ...patch } : entry,
      ),
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
      activeTableId =
        database.tables.find((entry) => entry.id !== tableId)?.id ?? null;
      activeViewId = null;
      database = {
        ...database,
        rows: database.rows.filter((row) => row.tableId !== tableId),
      };
      updateDatabase({
        tables: database.tables.filter((entry) => entry.id !== tableId),
      });
    } catch (error) {
      onStatus(error instanceof Error ? error.message : String(error));
    }
  }
  function persistRow(row: Row, immediate = false) {
    persistence.persistRow(row, immediate);
  }
  /**
   * Reorders rows to the order they are shown in.
   * ponytail: a sorted view fights this; positions win once the sort is cleared.
   */
  function reorderRows(orderedIds: string[]) {
    if (!database) {
      return;
    }
    const positions = new Map(
      orderedIds.map((rowId, index) => [rowId, index + 1]),
    );
    database = {
      ...database,
      rows: database.rows.map((row) =>
        positions.has(row.id)
          ? { ...row, position: positions.get(row.id)! }
          : row,
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
      row.id === rowId
        ? { ...row, data: { ...row.data, [columnId]: value } }
        : row,
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
    const groupColumn = table.columns.find(
      (column) => column.id === view?.groupBy,
    );
    const data: Row["data"] = {};
    if (groupValue !== null && groupColumn) {
      data[groupColumn.id] =
        groupColumn.type === "multi_select" ? [groupValue] : groupValue;
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
      database = {
        ...database,
        rows: database.rows.filter((row) => row.id !== rowId),
      };
    } catch (error) {
      onStatus(error instanceof Error ? error.message : String(error));
    }
  }
  function addColumn() {
    if (!table) {
      return;
    }
    const column: Column = {
      id: newId(),
      name: `Column ${table.columns.length + 1}`,
      type: "text",
    };
    updateTable({ columns: [...table.columns, column] });
  }
  function setColumns(columns: Column[]) {
    if (!table) {
      return;
    }
    const removed = table.columns.filter(
      (column) => !columns.some((entry) => entry.id === column.id),
    );
    updateTable({
      columns,
      views: table.views.map((entry) =>
        removed.some((column) => column.id === entry.groupBy)
          ? { ...entry, groupBy: undefined }
          : entry,
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
  onDestroy(persistence.destroy);
  function renameDatabase(name: string) {
    updateDatabase({ name });
    onRenamed(name);
  }
</script>
{#if database && table && view}
  <div class="flex min-h-0 flex-col {compact ? 'max-h-[32rem]' : 'h-full'}">
    <DatabaseViewHeader
      {database}
      {table}
      {view}
      {choices}
      {compact}
      {filtersOpen}
      {filterCount}
      {onOpen}
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
      onToggleFilters={() => (filtersOpen = !filtersOpen)}
    />
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
          databaseOptions={databaseOptions.filter(
            (option) => option.id !== database?.id,
          )}
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
  <p class="px-4 py-6 text-sm text-stone-400">{$i18n.t("database.loading")}</p>
{/if}
