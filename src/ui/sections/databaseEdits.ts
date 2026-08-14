import type { I18nKey } from "../../lib/i18n";
import {
  columnTypes,
  CREATED_AT,
  defaultTable,
  EDITED_AT,
  emptyFilter,
  isGroup,
  newId,
} from "../../lib/utils/database";
import type {
  CellValue,
  Column,
  Database,
  FilterGroup,
  Row,
  Table,
  View,
} from "../../lib/utils/database";

/** `entries` with the one carrying `id` merged with `patch`. */
export function patched<T extends { id: string }>(
  entries: T[],
  id: string,
  patch: Partial<T>,
) {
  return entries.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
}

/** Rows with one cell replaced; the row also gets a fresh edited stamp. */
export function withCell(
  rows: Row[],
  rowId: string,
  columnId: string,
  value: CellValue,
) {
  const editedAt = new Date().toISOString();
  return rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          data: { ...row.data, [columnId]: value, [EDITED_AT]: editedAt },
        }
      : row,
  );
}

/** `ids` with `moving` taken out and put back ahead of `before`. */
export function movedBefore(ids: string[], moving: string, before: string) {
  const ordered = ids.filter((id) => id !== moving);
  const target = ordered.indexOf(before);
  if (target === -1) {
    return ids;
  }
  ordered.splice(target, 0, moving);
  return ordered;
}

/** Rows renumbered to the order they are listed in. */
export function reordered(rows: Row[], orderedIds: string[]) {
  const positions = new Map(orderedIds.map((id, index) => [id, index + 1]));
  return rows.map((row) =>
    positions.has(row.id)
      ? { ...row, position: positions.get(row.id) ?? row.position }
      : row,
  );
}

/** A row already carrying the group it was added under, in that column's shape. */
export function createRow(
  table: Table,
  groupColumn: Column | undefined,
  groupValue: string | null,
  lastPosition: number,
): Row {
  const now = new Date().toISOString();
  const data: Row["data"] = { [CREATED_AT]: now, [EDITED_AT]: now };
  if (groupValue !== null && groupColumn) {
    data[groupColumn.id] =
      groupColumn.type === "multi_select" || groupColumn.type === "relation"
        ? [groupValue]
        : groupColumn.type === "checkbox"
          ? groupValue === "true"
          : groupValue;
  }
  return { id: newId(), tableId: table.id, position: lastPosition + 1, data };
}

/**
 * A table with no views paints nothing, and databases written before views
 * existed load exactly like that. Fill the gaps in memory, on every load.
 */
export function withDefaults(database: Database): Database {
  const tables = database.tables.length
    ? database.tables
    : [defaultTable("Table 1")];
  return {
    ...database,
    tables: tables.map((table) =>
      table.views.length
        ? table
        : { ...table, views: [createView("table", table.columns)] },
    ),
  };
}

export function createColumn(columns: Column[]): Column {
  return { id: newId(), name: `Column ${columns.length + 1}`, type: "text" };
}

export function createView(type: View["type"], columns: Column[]): View {
  // Calendars key on a date, the rest on the first select they can group by.
  const keyType = type === "calendar" || type === "gantt" ? "date" : "select";
  return {
    id: newId(),
    name: type[0].toUpperCase() + type.slice(1),
    type,
    groupBy: columns.find((column) => column.type === keyType)?.id,
    filter: emptyFilter(),
    sorts: [],
  };
}

/** Conditions in a filter tree, nested groups included. */
export function countConditions(group: FilterGroup): number {
  return group.children.reduce(
    (total, child) => total + (isGroup(child) ? countConditions(child) : 1),
    0,
  );
}

/** Views with a `groupBy` pointing at a deleted column cleared. */
export function withoutMissingGroups(views: View[], columns: Column[]) {
  const exists = (id?: string) =>
    !id || columns.some((column) => column.id === id);
  return views.map((view) =>
    exists(view.groupBy) && exists(view.endBy)
      ? view
      : {
          ...view,
          groupBy: exists(view.groupBy) ? view.groupBy : undefined,
          endBy: exists(view.endBy) ? view.endBy : undefined,
        },
  );
}

/** `multi_select` -> `database.columnMultiSelect`, so a new type needs no branch here. */
export function columnTypeOptions(translate: (key: I18nKey) => string) {
  return columnTypes.map((type) => ({
    ...type,
    label: translate(
      `database.column${type.value
        .split("_")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("")}` as I18nKey,
    ),
  }));
}
