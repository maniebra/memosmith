<script lang="ts">
  import { Filter, LayoutGrid, Plus, Table2 } from "@lucide/svelte";
  import {
    choicesFor,
    emptyFilter,
    isGroup,
    newId,
    visibleRows,
  } from "../../lib/utils/database";
  import type { CellValue, Choice, Column, Database, Row, View } from "../../lib/utils/database";
  import {
    deleteDatabaseRow,
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

  let database: Database | null = null;
  let relations: Record<string, Database> = {};
  let activeViewId: string | null = null;
  let filtersOpen = false;
  let loadedId: string | null = null;
  let metaSaveTimer: ReturnType<typeof setTimeout> | undefined;

  $: if (databaseId !== loadedId) {
    loadedId = databaseId;
    void load(databaseId);
  }

  $: if (database) {
    void loadRelations(database.columns);
  }

  $: choices = Object.fromEntries(
    (database?.columns ?? []).map((column) => [column.id, choicesFor(column, relations)]),
  ) as Record<string, Choice[]>;

  $: view = database?.views.find((entry) => entry.id === activeViewId) ?? database?.views[0] ?? null;
  $: rows = database && view ? visibleRows(database.rows, view, database.columns) : [];
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
      activeViewId = database.views[0]?.id ?? null;
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

      void saveDatabaseMeta(root, database.id, database.name, database.columns, database.views).catch(
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

  function updateView(patch: Partial<View>) {
    if (!database || !view) {
      return;
    }

    const viewId = view.id;

    updateDatabase({
      views: database.views.map((entry) => (entry.id === viewId ? { ...entry, ...patch } : entry)),
    });
  }

  function persistRow(row: Row) {
    if (!database) {
      return;
    }

    void saveDatabaseRow(root, database.id, row).catch((error) =>
      onStatus(error instanceof Error ? error.message : String(error)),
    );
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
    if (!database) {
      return;
    }

    const groupColumn = database.columns.find((column) => column.id === view?.groupBy);
    const data: Row["data"] = {};

    if (groupValue !== null && groupColumn) {
      data[groupColumn.id] = groupColumn.type === "multi_select" ? [groupValue] : groupValue;
    }

    const row: Row = {
      id: newId(),
      position: (database.rows[database.rows.length - 1]?.position ?? 0) + 1,
      data,
    };

    database = { ...database, rows: [...database.rows, row] };
    persistRow(row);
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
    if (!database) {
      return;
    }

    const column: Column = { id: newId(), name: `Column ${database.columns.length + 1}`, type: "text" };

    updateDatabase({ columns: [...database.columns, column] });
  }

  function setColumns(columns: Column[]) {
    if (!database) {
      return;
    }

    const removed = database.columns.filter((column) => !columns.some((entry) => entry.id === column.id));

    updateDatabase({
      columns,
      views: database.views.map((entry) =>
        removed.some((column) => column.id === entry.groupBy) ? { ...entry, groupBy: undefined } : entry,
      ),
    });
  }

  function addView(type: View["type"]) {
    if (!database) {
      return;
    }

    const created: View = {
      id: newId(),
      name: type === "board" ? "Board" : "Table",
      type,
      groupBy: database.columns.find((column) => column.type === "select")?.id,
      filter: emptyFilter(),
      sorts: [],
    };

    activeViewId = created.id;
    updateDatabase({ views: [...database.views, created] });
  }

  function renameDatabase(name: string) {
    updateDatabase({ name });
    onRenamed(name);
  }
</script>

{#if database && view}
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 flex-col gap-2 border-b border-stone-200/70 px-4 py-3 dark:border-stone-800">
      <input
        class="w-full bg-transparent text-2xl font-semibold text-stone-900 outline-none dark:text-stone-100"
        value={database.name}
        oninput={(event) => renameDatabase(event.currentTarget.value)}
      />

      <div class="flex flex-wrap items-center gap-1">
        {#each database.views as entry (entry.id)}
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
                  ...database.columns
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
            columns={database.columns}
            {choices}
            onChange={(filter) => updateView({ filter })}
          />
        </div>
      {/if}
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      {#if view.type === "board"}
        <DatabaseBoard
          columns={database.columns}
          {rows}
          {choices}
          groupBy={view.groupBy}
          onCell={setCell}
          onAddRow={addRow}
          onDeleteRow={removeRow}
        />
      {:else}
        <DatabaseTable
          columns={database.columns}
          {rows}
          {choices}
          databaseOptions={databaseOptions.filter((option) => option.id !== database?.id)}
          onCell={setCell}
          onAddRow={() => addRow(null)}
          onDeleteRow={removeRow}
          onColumnsChange={setColumns}
          onAddColumn={addColumn}
        />
      {/if}
    </div>
  </div>
{:else}
  <p class="px-4 py-6 text-sm text-stone-400">Loading database…</p>
{/if}
