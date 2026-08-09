import { rowsOf, tableOf } from "./databaseTypes";
import type {
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
} from "./databaseTypes";
export { rowsOf, tableOf } from "./databaseTypes";
export type {
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
} from "./databaseTypes";
export const columnTypes: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "relation", label: "Relation" },
];
const emptyOperators: FilterOperator[] = ["is_empty", "is_not_empty"];
const operatorsByType: Record<ColumnType, FilterOperator[]> = {
  text: [
    "is",
    "is_not",
    "contains",
    "does_not_contain",
    "starts_with",
    "ends_with",
    ...emptyOperators,
  ],
  url: [
    "is",
    "is_not",
    "contains",
    "does_not_contain",
    "starts_with",
    "ends_with",
    ...emptyOperators,
  ],
  number: ["is", "is_not", "greater_than", "less_than", ...emptyOperators],
  select: ["is", "is_not", ...emptyOperators],
  multi_select: ["contains", "does_not_contain", ...emptyOperators],
  relation: ["contains", "does_not_contain", ...emptyOperators],
  checkbox: ["is"],
  date: ["is", "is_not", "on_or_after", "on_or_before", ...emptyOperators],
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
function asText(value: CellValue | undefined) {
  if (isEmptyValue(value)) {
    return "";
  }
  return (
    Array.isArray(value) ? value.join(", ") : String(value)
  ).toLowerCase();
}
function asNumber(value: CellValue | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function matchesNumberCondition(
  condition: FilterCondition,
  cell: CellValue | undefined,
) {
  const cellNumber = asNumber(cell);
  const targetNumber = asNumber(condition.value);
  if (cellNumber === null || targetNumber === null) {
    return false;
  }
  switch (condition.operator) {
    case "is":
      return cellNumber === targetNumber;
    case "is_not":
      return cellNumber !== targetNumber;
    case "greater_than":
      return cellNumber > targetNumber;
    case "less_than":
      return cellNumber < targetNumber;
    default:
      return true;
  }
}
function matchesMultiValueCondition(
  condition: FilterCondition,
  cell: CellValue | undefined,
) {
  const values = (Array.isArray(cell) ? cell : []).map((entry) =>
    String(entry).toLowerCase(),
  );
  const wanted = String(condition.value).toLowerCase();
  return condition.operator === "does_not_contain"
    ? !values.includes(wanted)
    : values.includes(wanted);
}
function matchesTextCondition(
  condition: FilterCondition,
  cell: CellValue | undefined,
) {
  const cellText = asText(cell);
  const targetText = asText(condition.value);
  switch (condition.operator) {
    case "is":
      return cellText === targetText;
    case "is_not":
      return cellText !== targetText;
    case "contains":
      return cellText.includes(targetText);
    case "does_not_contain":
      return !cellText.includes(targetText);
    case "starts_with":
      return cellText.startsWith(targetText);
    case "ends_with":
      return cellText.endsWith(targetText);
    case "on_or_after":
      return cellText >= targetText;
    case "on_or_before":
      return cellText <= targetText;
    default:
      return true;
  }
}
function matchesCondition(
  condition: FilterCondition,
  column: Column | undefined,
  row: Row,
) {
  const cell = row.data[condition.column];
  if (condition.operator === "is_empty") {
    return isEmptyValue(cell);
  }
  if (condition.operator === "is_not_empty") {
    return !isEmptyValue(cell);
  }
  const target = condition.value;
  if (isEmptyValue(target) && column?.type !== "checkbox") {
    return true;
  }
  if (column?.type === "checkbox") {
    return Boolean(cell) === Boolean(target);
  }
  if (column?.type === "number") {
    return matchesNumberCondition(condition, cell);
  }
  // Relations hold linked row ids, so membership works the same as multi-select.
  if (column?.type === "multi_select" || column?.type === "relation") {
    return matchesMultiValueCondition(condition, cell);
  }
  return matchesTextCondition(condition, cell);
}
export function matchesFilter(
  node: FilterNode,
  columns: Column[],
  row: Row,
): boolean {
  if (!isGroup(node)) {
    return matchesCondition(
      node,
      columns.find((column) => column.id === node.column),
      row,
    );
  }
  if (!node.children.length) {
    return true;
  }
  return node.conjunction === "and"
    ? node.children.every((child) => matchesFilter(child, columns, row))
    : node.children.some((child) => matchesFilter(child, columns, row));
}
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
