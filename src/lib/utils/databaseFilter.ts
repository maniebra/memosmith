import { asNumber, asText, isEmptyValue, isGroup } from "./database";
import type {
  CellValue,
  Column,
  FilterCondition,
  FilterNode,
  Row,
} from "./databaseTypes";

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
  if (
    column?.type === "number" ||
    condition.operator === "greater_than" ||
    condition.operator === "less_than"
  ) {
    return matchesNumberCondition(condition, cell);
  }
  // Relations and files hold lists, so membership works the same as multi-select.
  if (
    column?.type === "multi_select" ||
    column?.type === "relation" ||
    column?.type === "files"
  ) {
    return matchesMultiValueCondition(condition, cell);
  }
  // Timestamps are stored to the millisecond but filtered by day.
  if (column?.type === "created_time" || column?.type === "edited_time") {
    return matchesTextCondition(condition, String(cell ?? "").slice(0, 10));
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
