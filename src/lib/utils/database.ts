import { matchesFilter } from "./databaseFilter";
import { rowsOf, tableOf } from "./databaseTypes";
import type {
  CellValue,
  Choice,
  Column,
  ColumnType,
  Database,
  FilterGroup,
  FilterNode,
  FilterOperator,
  Row,
  Sort,
  Table,
  View,
  ViewType,
} from "./databaseTypes";
export {
  BODY,
  COVER,
  CREATED_AT,
  EDITED_AT,
  ICON,
  computedTypes,
  rowsOf,
  tableOf,
} from "./databaseTypes";
export type {
  Aggregate,
  CellValue,
  Choice,
  Column,
  ColumnType,
  Database,
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  Row,
  Sort,
  Table,
  View,
  ViewType,
} from "./databaseTypes";
export const columnTypes: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "status", label: "Status" },
  { value: "multi_select", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "files", label: "Files" },
  { value: "relation", label: "Relation" },
  { value: "formula", label: "Formula" },
  { value: "rollup", label: "Rollup" },
  { value: "created_time", label: "Created time" },
  { value: "edited_time", label: "Last edited time" },
];
export const viewTypes: ViewType[] = [
  "table",
  "board",
  "gallery",
  "list",
  "calendar",
];
const emptyOperators: FilterOperator[] = ["is_empty", "is_not_empty"];
const textOperators: FilterOperator[] = [
  "is",
  "is_not",
  "contains",
  "does_not_contain",
  "starts_with",
  "ends_with",
  ...emptyOperators,
];
const dateOperators: FilterOperator[] = [
  "is",
  "is_not",
  "on_or_after",
  "on_or_before",
  ...emptyOperators,
];
const listOperators: FilterOperator[] = [
  "contains",
  "does_not_contain",
  ...emptyOperators,
];
const operatorsByType: Record<ColumnType, FilterOperator[]> = {
  text: textOperators,
  url: textOperators,
  email: textOperators,
  phone: textOperators,
  number: ["is", "is_not", "greater_than", "less_than", ...emptyOperators],
  select: ["is", "is_not", ...emptyOperators],
  status: ["is", "is_not", ...emptyOperators],
  multi_select: listOperators,
  relation: listOperators,
  files: listOperators,
  checkbox: ["is"],
  date: dateOperators,
  created_time: dateOperators,
  edited_time: dateOperators,
  // Formulas and rollups can hold text or numbers, so both sets are offered.
  formula: [...textOperators, "greater_than", "less_than"],
  rollup: [...textOperators, "greater_than", "less_than"],
};
export const operatorLabels: Record<FilterOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: "greater than",
  less_than: "less than",
  on_or_after: "on or after",
  on_or_before: "on or before",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};
export function operatorsFor(type: ColumnType) {
  return operatorsByType[type] ?? operatorsByType.text;
}
export function needsValue(operator: FilterOperator) {
  return !emptyOperators.includes(operator);
}
export function isGroup(node: FilterNode): node is FilterGroup {
  return "children" in node;
}
export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
/** Ids become sqlite file names, so anything outside `[a-z0-9_-]` is dropped. */
export function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug ? `${slug}-${newId()}` : newId();
}
export function emptyFilter(): FilterGroup {
  return { id: newId(), conjunction: "and", children: [] };
}
export function isEmptyValue(value: CellValue | undefined) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
/** Lower-cased text of a cell, for case-insensitive compares. */
export function asText(value: CellValue | undefined) {
  if (isEmptyValue(value)) {
    return "";
  }
  return (
    Array.isArray(value) ? value.join(", ") : String(value)
  ).toLowerCase();
}
/** Numeric value of a cell, or null when it does not read as a number. */
export function asNumber(value: CellValue | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export { matchesFilter } from "./databaseFilter";
export function sortRows(rows: Row[], sorts: Sort[], columns: Column[]) {
  // Position is the hand-dragged order, so it is the default sort, not the load order.
  if (!sorts.length) {
    return [...rows].sort((left, right) => left.position - right.position);
  }
  return [...rows].sort((left, right) => {
    for (const sort of sorts) {
      const column = columns.find((entry) => entry.id === sort.column);
      const direction = sort.direction === "desc" ? -1 : 1;
      let comparison = 0;
      if (column?.type === "number") {
        comparison =
          (asNumber(left.data[sort.column]) ?? 0) -
          (asNumber(right.data[sort.column]) ?? 0);
      } else {
        comparison = asText(left.data[sort.column]).localeCompare(
          asText(right.data[sort.column]),
        );
      }
      if (comparison) {
        return comparison * direction;
      }
    }
    return left.position - right.position;
  });
}
export function visibleRows(rows: Row[], view: View, columns: Column[]) {
  return sortRows(
    rows.filter((row) => matchesFilter(view.filter, columns, row)),
    view.sorts,
    columns,
  );
}
export const uncategorized = "__none__";
/** Title cell of a row, used for cards and for labelling rows linked by a relation. */
export function rowTitle(row: Row, columns: Column[]) {
  const column = columns.find((entry) => entry.type === "text") ?? columns[0];
  const value = column ? row.data[column.id] : null;
  return isEmptyValue(value) ? "Untitled" : String(value);
}
/** Selectable values of a column: its options, or the linked rows of its relation. */
export function choicesFor(
  column: Column,
  relations: Record<string, Database>,
): Choice[] {
  if (column.type === "relation") {
    const target = column.relationDatabase
      ? relations[column.relationDatabase]
      : undefined;
    const table = tableOf(target, column.relationTable);
    if (!target || !table) {
      return [];
    }
    return rowsOf(target, table.id).map((row) => ({
      value: row.id,
      label: rowTitle(row, table.columns),
    }));
  }
  return (column.options ?? []).map((option) => ({
    value: option,
    label: option,
  }));
}
/** Board columns: one per choice of the grouping column, plus a bucket for empty cells. */
export function groupRows(
  rows: Row[],
  column: Column | undefined,
  keys: string[] = column?.options ?? [],
) {
  const groups = new Map<string, Row[]>();
  for (const key of keys) {
    groups.set(key, []);
  }
  groups.set(uncategorized, []);
  for (const row of rows) {
    const cell = column ? row.data[column.id] : null;
    const key = isEmptyValue(cell)
      ? uncategorized
      : String(Array.isArray(cell) ? cell[0] : cell);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }
  return [...groups.entries()].map(([key, groupedRows]) => ({
    key,
    rows: groupedRows,
  }));
}
export {
  aggregate,
  aggregateOptions,
  asDisplay,
  computeRows,
  relationColumnsOf,
  searchRows,
  visibleColumns,
} from "./databaseCompute";
export function defaultColumns(): Column[] {
  return [
    { id: newId(), name: "Name", type: "text" },
    {
      id: newId(),
      name: "Status",
      type: "select",
      options: ["Not started", "In progress", "Done"],
    },
  ];
}
export function defaultViews(columns: Column[]): View[] {
  return [
    {
      id: newId(),
      name: "Table",
      type: "table",
      filter: emptyFilter(),
      sorts: [],
    },
    {
      id: newId(),
      name: "Board",
      type: "board",
      groupBy: columns.find((column) => column.type === "select")?.id,
      filter: emptyFilter(),
      sorts: [],
    },
  ];
}
export function defaultTable(name = "Table"): Table {
  const columns = defaultColumns();
  return { id: newId(), name, columns, views: defaultViews(columns) };
}
