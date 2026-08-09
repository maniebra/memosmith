export type ColumnType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date"
  | "url"
  | "relation";
export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  /** Choices for `select` and `multi_select`. */
  options?: string[];
  /** Id of the database a `relation` column links to. */
  relationDatabase?: string;
  /** Id of the table inside that database; defaults to its first table. */
  relationTable?: string;
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
export type View = {
  id: string;
  name: string;
  type: "table" | "board";
  /** Column the board groups cards by; ignored by table views. */
  groupBy?: string;
  filter: FilterGroup;
  sorts: Sort[];
  /** Pixel width of board columns; unset means the default. */
  cardWidth?: number;
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
