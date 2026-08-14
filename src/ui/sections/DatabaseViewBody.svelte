<script lang="ts">
  import type {
    Aggregate,
    CellValue,
    Choice,
    Column,
    Row,
    Table,
    View,
  } from "../../lib/utils/database";
  import DatabaseBoard from "./DatabaseBoard.svelte";
  import DatabaseCalendar from "./DatabaseCalendar.svelte";
  import DatabaseGallery from "./DatabaseGallery.svelte";
  import DatabaseGantt from "./DatabaseGantt.svelte";
  import DatabaseList from "./DatabaseList.svelte";
  import DatabaseTable from "./DatabaseTable.svelte";

  export let view: View;
  export let table: Table;
  export let rows: Row[];
  export let choices: Record<string, Choice[]> = {};
  /** Columns this view shows, already stripped of the hidden ones. */
  export let shownColumns: Column[];
  export let relationColumns: Record<string, Column[]> = {};
  export let databaseOptions: { id: string; name: string }[] = [];
  export let compact = false;
  /** Pinned embed: the structure is fixed, only the data is editable. */
  export let locked = false;
  export let onCell: (
    rowId: string,
    columnId: string,
    value: CellValue,
  ) => void;
  /** Takes the group value, or the ISO date on a calendar; null means no value. */
  export let onAddRow: (groupValue: string | null) => void;
  export let onDeleteRow: (rowId: string) => void;
  export let onOpenRow: (rowId: string) => void;
  export let onColumnsChange: (columns: Column[]) => void;
  export let onAddColumn: () => void;
  export let onReorderRows: (rowIds: string[]) => void;
  export let onUpdateView: (patch: Partial<View>) => void;
  export let onAggregation: (columnId: string, fn: Aggregate) => void;
</script>

    {#if view.type === "board"}
      <DatabaseBoard
        columns={shownColumns}
        {rows}
        {choices}
        {onReorderRows}
        groupBy={view.groupBy}
        cardWidth={view.cardWidth}
        onCardWidth={(cardWidth) => onUpdateView({ cardWidth })}
        {onCell}
        {onAddRow}
        {onDeleteRow}
        {onOpenRow}
        commitCellsOnInput={!compact}
      />
    {:else if view.type === "gallery"}
      <DatabaseGallery
        columns={shownColumns}
        {rows}
        {choices}
        {onCell}
        onAddRow={() => onAddRow(null)}
        {onDeleteRow}
        {onOpenRow}
        commitCellsOnInput={!compact}
      />
    {:else if view.type === "list"}
      <DatabaseList
        columns={shownColumns}
        {rows}
        onAddRow={() => onAddRow(null)}
        {onDeleteRow}
        {onOpenRow}
      />
    {:else if view.type === "calendar"}
      <DatabaseCalendar
        columns={shownColumns}
        {rows}
        dateColumn={view.groupBy}
        {onCell}
        onAddRow={(isoDate) => onAddRow(isoDate)}
        {onOpenRow}
      />
    {:else if view.type === "gantt"}
      <DatabaseGantt
        columns={shownColumns}
        {rows}
        startColumn={view.groupBy}
        endColumn={view.endBy}
        {onOpenRow}
      />
    {:else}
      <DatabaseTable
        columns={shownColumns}
        allColumns={table.columns}
        {relationColumns}
        {rows}
        {choices}
        groupBy={view.groupBy}
        aggregations={view.aggregations ?? {}}
        {onAggregation}
        rowHeight={view.rowHeight ?? "short"}
        {databaseOptions}
        {onCell}
        onAddRow={() => onAddRow(null)}
        {onDeleteRow}
        {onColumnsChange}
        {onAddColumn}
        {onReorderRows}
        {onOpenRow}
        {locked}
        commitCellsOnInput={!compact}
      />
{/if}
