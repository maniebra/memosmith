import { evaluateFormula } from "./formula";
import type { FormulaValue } from "./formula";
import { CREATED_AT, EDITED_AT, computedTypes } from "./databaseTypes";
import {
  asNumber,
  asText,
  isEmptyValue,
  rowsOf,
  tableOf,
} from "./database";
import type {
  Aggregate,
  CellValue,
  Column,
  Database,
  Row,
  View,
} from "./database";

/** Rows of the table a relation column points at, keyed by row id. */
function relationTargetRows(
  column: Column,
  relations: Record<string, Database>,
) {
  const target = column.relationDatabase
    ? relations[column.relationDatabase]
    : undefined;
  const table = tableOf(target, column.relationTable);
  return {
    table,
    rows: new Map(
      (target && table ? rowsOf(target, table.id) : []).map((row) => [
        row.id,
        row,
      ]),
    ),
  };
}
/** Relation column id -> columns of the table it links to, for rollup pickers. */
export function relationColumnsOf(
  columns: Column[],
  relations: Record<string, Database>,
) {
  return Object.fromEntries(
    columns
      .filter((column) => column.type === "relation")
      .map((column) => [
        column.id,
        relationTargetRows(column, relations).table?.columns ?? [],
      ]),
  ) as Record<string, Column[]>;
}
export function aggregate(
  values: CellValue[],
  fn: Aggregate | undefined,
): CellValue {
  const filled = values.filter((value) => !isEmptyValue(value));
  const numbers = filled
    .map((value) => asNumber(value))
    .filter((value): value is number => value !== null);
  switch (fn) {
    case "count":
      return values.length;
    case "count_empty":
      return values.length - filled.length;
    case "count_not_empty":
      return filled.length;
    case "count_unique":
      return new Set(filled.map((value) => asText(value))).size;
    case "sum":
      return numbers.reduce((total, value) => total + value, 0);
    case "average":
      return numbers.length
        ? numbers.reduce((total, value) => total + value, 0) / numbers.length
        : null;
    case "min":
      return numbers.length ? Math.min(...numbers) : null;
    case "max":
      return numbers.length ? Math.max(...numbers) : null;
    case "percent_checked":
      return values.length
        ? Math.round(
            (values.filter((value) => value === true).length /
              values.length) *
              100,
          )
        : null;
    case "show_original":
      return filled.map((value) => asDisplay(value)).join(", ");
    default:
      return null;
  }
}
export const aggregateOptions: Aggregate[] = [
  "none",
  "count",
  "count_not_empty",
  "count_empty",
  "count_unique",
  "sum",
  "average",
  "min",
  "max",
  "percent_checked",
];
/** Plain text of a cell, for formulas, rollups and CSV — arrays become a comma list. */
export function asDisplay(value: CellValue | undefined) {
  if (isEmptyValue(value)) {
    return "";
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function computeRollup(
  column: Column,
  row: Row,
  columns: Column[],
  relations: Record<string, Database>,
  depth: number,
): CellValue {
  const relation = columns.find((entry) => entry.id === column.rollupRelation);
  if (!relation || relation.type !== "relation" || !column.rollupTarget) {
    return null;
  }
  const { table, rows } = relationTargetRows(relation, relations);
  const linked = row.data[relation.id];
  const target = table?.columns.find(
    (entry) => entry.id === column.rollupTarget,
  );
  const values = (Array.isArray(linked) ? linked : [])
    .map((id) => rows.get(String(id)))
    .filter((entry): entry is Row => Boolean(entry))
    .map((entry) =>
      // A rollup over a computed column needs that column resolved first.
      target && computedTypes.includes(target.type)
        ? computeCell(target, entry, table?.columns ?? [], relations, depth + 1)
        : (entry.data[column.rollupTarget ?? ""] ?? null),
    );
  return aggregate(values, column.rollupFunction ?? "show_original");
}
function computeFormula(
  column: Column,
  row: Row,
  columns: Column[],
  relations: Record<string, Database>,
  depth: number,
): CellValue {
  if (!column.formula) {
    return null;
  }
  // ponytail: a formula referencing another formula resolves one level per pass;
  // `depth` stops a cycle rather than ordering the dependency graph.
  return evaluateFormula(column.formula, (name) => {
    const referenced = columns.find(
      (entry) => entry.name.toLowerCase() === name.toLowerCase(),
    );
    if (!referenced) {
      return null;
    }
    const value =
      computedTypes.includes(referenced.type) && depth < 8
        ? computeCell(referenced, row, columns, relations, depth + 1)
        : (row.data[referenced.id] ?? null);
    return (Array.isArray(value) ? value.join(", ") : value) as FormulaValue;
  });
}
function computeCell(
  column: Column,
  row: Row,
  columns: Column[],
  relations: Record<string, Database>,
  depth: number,
): CellValue {
  switch (column.type) {
    case "created_time":
      return (row.data[CREATED_AT] as string) ?? null;
    case "edited_time":
      return (row.data[EDITED_AT] as string) ?? row.data[CREATED_AT] ?? null;
    case "rollup":
      return computeRollup(column, row, columns, relations, depth);
    case "formula":
      return computeFormula(column, row, columns, relations, depth);
    default:
      return row.data[column.id] ?? null;
  }
}
/**
 * Fills the computed cells of every row, so filtering, sorting, grouping and
 * rendering all read one shape. The stored rows keep only what the user typed.
 */
export function computeRows(
  rows: Row[],
  columns: Column[],
  relations: Record<string, Database> = {},
) {
  const computed = columns.filter((column) =>
    computedTypes.includes(column.type),
  );
  if (!computed.length) {
    return rows;
  }
  return rows.map((row) => ({
    ...row,
    data: {
      ...row.data,
      ...Object.fromEntries(
        computed.map((column) => [
          column.id,
          computeCell(column, row, columns, relations, 0),
        ]),
      ),
    },
  }));
}
/** Columns a view shows, in table order, minus the ones it hides. */
export function visibleColumns(columns: Column[], view: View) {
  const hidden = new Set(view.hidden ?? []);
  return columns.filter((column) => !hidden.has(column.id));
}
/** Rows whose text matches `query`, across every column the view shows. */
export function searchRows(rows: Row[], columns: Column[], query: string) {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return rows;
  }
  return rows.filter((row) =>
    columns.some((column) =>
      asDisplay(row.data[column.id]).toLowerCase().includes(wanted),
    ),
  );
}
