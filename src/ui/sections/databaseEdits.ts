import {
  CREATED_AT,
  EDITED_AT,
  emptyFilter,
  newId,
} from "../../lib/utils/database";
import type {
  CellValue,
  Column,
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

export function createColumn(columns: Column[]): Column {
  return { id: newId(), name: `Column ${columns.length + 1}`, type: "text" };
}

export function createView(type: View["type"], columns: Column[]): View {
  // Calendars key on a date, the rest on the first select they can group by.
  const keyType = type === "calendar" ? "date" : "select";
  return {
    id: newId(),
    name: type[0].toUpperCase() + type.slice(1),
    type,
    groupBy: columns.find((column) => column.type === keyType)?.id,
    filter: emptyFilter(),
    sorts: [],
  };
}

/** Views with a `groupBy` pointing at a deleted column cleared. */
export function withoutMissingGroups(views: View[], columns: Column[]) {
  return views.map((view) =>
    view.groupBy && !columns.some((column) => column.id === view.groupBy)
      ? { ...view, groupBy: undefined }
      : view,
  );
}
