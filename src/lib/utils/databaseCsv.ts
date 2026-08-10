import { asDisplay, computedTypes, newId } from "./database";
import type { CellValue, Column, Row } from "./database";

/** RFC 4180: quote when the field holds a comma, quote or newline; `"` doubles. */
function quote(field: string) {
  return /[",\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function toCsv(columns: Column[], rows: Row[]) {
  const lines = [columns.map((column) => quote(column.name)).join(",")];
  for (const row of rows) {
    lines.push(
      columns.map((column) => quote(asDisplay(row.data[column.id]))).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      endField();
    } else if (character === "\n") {
      endRow();
    } else if (character !== "\r") {
      field += character;
    }
    index += 1;
  }

  if (field || row.length) {
    endRow();
  }

  return rows.filter((entry) => entry.some(Boolean));
}

/** Splits a cell back into the shape its column stores. */
function parseCell(column: Column, text: string): CellValue {
  const trimmed = text.trim();
  if (!trimmed) {
    return column.type === "multi_select" ||
      column.type === "relation" ||
      column.type === "files"
      ? []
      : null;
  }
  if (column.type === "number") {
    const number = Number(trimmed);
    return Number.isFinite(number) ? number : null;
  }
  if (column.type === "checkbox") {
    return ["true", "yes", "1", "✓"].includes(trimmed.toLowerCase());
  }
  if (
    column.type === "multi_select" ||
    column.type === "relation" ||
    column.type === "files"
  ) {
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return trimmed;
}

/** Column each header maps to, creating text columns for headers nothing matches. */
function matchHeaders(header: string[], columns: Column[]) {
  const nextColumns = [...columns];
  const mapped = header.map((name) => {
    const existing = nextColumns.find(
      (column) =>
        column.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        !computedTypes.includes(column.type),
    );
    if (existing) {
      return existing;
    }
    const created: Column = {
      id: newId(),
      name: name.trim() || `Column ${nextColumns.length + 1}`,
      type: "text",
    };
    nextColumns.push(created);
    return created;
  });
  return { nextColumns, mapped };
}

/** A select column imported from a file needs the new values as options. */
function withImportedOptions(columns: Column[], rows: Row[]) {
  return columns.map((column) => {
    if (column.type !== "select" && column.type !== "status") {
      return column;
    }
    const seen = new Set(column.options ?? []);
    for (const row of rows) {
      const value = row.data[column.id];
      if (typeof value === "string" && value) {
        seen.add(value);
      }
    }
    return { ...column, options: [...seen] };
  });
}

/**
 * Rows built from a CSV, matched to existing columns by header name.
 * Unknown headers become new text columns, so nothing in the file is dropped.
 */
export function fromCsv(
  text: string,
  columns: Column[],
  tableId: string,
  startPosition: number,
) {
  const [header, ...body] = parseCsv(text);
  if (!header) {
    return { columns, rows: [] as Row[] };
  }

  const { nextColumns, mapped } = matchHeaders(header, columns);
  const rows = body.map((cells, index) => ({
    id: newId(),
    tableId,
    position: startPosition + index + 1,
    data: Object.fromEntries(
      mapped.map((column, cellIndex) => [
        column.id,
        parseCell(column, cells[cellIndex] ?? ""),
      ]),
    ) as Row["data"],
  }));

  return { columns: withImportedOptions(nextColumns, rows), rows };
}
