export type ColumnType =
  | "text"
  | "number"
  | "select"
  | "status"
  | "multi_select"
  | "checkbox"
  | "date"
  | "url"
  | "email"
  | "phone"
  | "files"
  | "relation"
  | "formula"
  | "rollup"
  | "created_time"
  | "edited_time";
/** Cells these types show are derived on read; nothing is stored for them. */
export const computedTypes: ColumnType[] = [
  "formula",
  "rollup",
  "created_time",
  "edited_time",
];
/** Row timestamps live in `data` under reserved keys, so the sqlite schema stays as is. */
export const CREATED_AT = "__created";
export const EDITED_AT = "__edited";
/** Page body, icon and cover of a row, shown when the row is opened. */
export const BODY = "__body";
export const ICON = "__icon";
export const COVER = "__cover";
export type Aggregate =
  | "none"
  | "count"
  | "count_empty"
  | "count_not_empty"
  | "count_unique"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "percent_checked"
  | "show_original";
export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  /** Choices for `select`, `status` and `multi_select`. */
  options?: string[];
  /** Id of the database a `relation` column links to. */
  relationDatabase?: string;
  /** Id of the table inside that database; defaults to its first table. */
  relationTable?: string;
  /** Expression of a `formula` column, e.g. `if({Done}, 1, 0) + {Size}`. */
  formula?: string;
  /** Id of the `relation` column a `rollup` column walks. */
  rollupRelation?: string;
  /** Id of the column read on each linked row. */
  rollupTarget?: string;
  /** How the linked values are folded into one cell. */
  rollupFunction?: Aggregate;
  /** Pixel width set by dragging the header edge; unset means the default width. */
  width?: number;
};
/** Selectable values for a column: literal options, or linked rows for a relation. */
export type Choice = { value: string; label: string };
export type CellValue = string | number | boolean | string[] | null;
export type Row = {
  id: string;
  /** Table this row belongs to; a database holds several. */
  tableId: string;
  position: number;
  data: Record<string, CellValue>;
};
export type FilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "on_or_after"
  | "on_or_before"
  | "is_empty"
  | "is_not_empty";
export type FilterCondition = {
  id: string;
  column: string;
  operator: FilterOperator;
  value?: CellValue;
};
export type FilterGroup = {
  id: string;
  conjunction: "and" | "or";
  children: FilterNode[];
};
export type FilterNode = FilterCondition | FilterGroup;
export type Sort = { column: string; direction: "asc" | "desc" };
export type ViewType = "table" | "board" | "gallery" | "list" | "calendar";
export type View = {
  id: string;
  name: string;
  type: ViewType;
  /**
   * Column the view keys on: board and grouped-table group by it, calendar places
   * rows on its date. List and gallery ignore it.
   */
  groupBy?: string;
  filter: FilterGroup;
  sorts: Sort[];
  /** Pixel width of board columns; unset means the default. */
  cardWidth?: number;
  /** Columns hidden in this view; they stay on the table and in other views. */
  hidden?: string[];
  /** Footer summary per column id; absent means `none`. */
  aggregations?: Record<string, Aggregate>;
  /** Row height of table views. */
  rowHeight?: "short" | "medium" | "tall";
};
export type Table = {
  id: string;
  name: string;
  columns: Column[];
  views: View[];
};
export type Database = {
  id: string;
  name: string;
  tables: Table[];
  /** Rows of every table, tagged by `tableId`. */
  rows: Row[];
};
export function tableOf(database: Database | undefined, tableId?: string) {
  return (
    database?.tables.find((table) => table.id === tableId) ??
    database?.tables[0]
  );
}
export function rowsOf(database: Database | undefined, tableId?: string) {
  const table = tableOf(database, tableId);
  return database && table
    ? database.rows.filter((row) => row.tableId === table.id)
    : [];
}
