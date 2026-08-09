export type TableAlignment = "left" | "center" | "right" | null;
export type TableCell = {
  text: string;
  colspan: number;
  rowspan: number;
  background?: string;
  covered: boolean;
};
export type MarkdownTable = {
  alignments: TableAlignment[];
  rows: TableCell[][];
};
export type TableEdit =
  | { type: "set-cell-text"; row: number; column: number; text: string }
  | { type: "insert-row"; row: number }
  | { type: "insert-column"; column: number }
  | { type: "merge-right"; row: number; column: number }
  | { type: "merge-down"; row: number; column: number }
  | { type: "split-cell"; row: number; column: number }
  | {
      type: "set-cell-background";
      row: number;
      column: number;
      background?: string;
    };
export const DEFAULT_TABLE_MARKDOWN =
  "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |";
const TABLE_CELL_META = /^\s*\{::\s*([^]*?)\s*::\}\s*/;
export const TABLE_BACKGROUNDS = new Set([
  "#fee2e2",
  "#fef3c7",
  "#dcfce7",
  "#dbeafe",
  "#f3e8ff",
]);
function endsWithTableDelimiter(line: string) {
  const trimmed = line.trimEnd();
  if (!trimmed.endsWith("|")) {
    return false;
  }
  let backslashes = 0;
  for (
    let index = trimmed.length - 2;
    index >= 0 && trimmed[index] === "\\";
    index--
  ) {
    backslashes++;
  }
  return backslashes % 2 === 0;
}
export function splitTableRow(line: string) {
  const trimmed = line.trim();
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  let inCode = false;
  let bracketDepth = 0;
  for (const char of trimmed) {
    if (escaped) {
      cell += char === "|" ? "|" : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "`") {
      inCode = !inCode;
    } else if (!inCode && char === "[") {
      bracketDepth++;
    } else if (!inCode && char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }
    if (char === "|" && !inCode && bracketDepth === 0) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  if (escaped) {
    cell += "\\";
  }
  cells.push(cell.trim());
  if (trimmed.startsWith("|")) {
    cells.shift();
  }
  if (endsWithTableDelimiter(trimmed)) {
    cells.pop();
  }
  return cells;
}
function separatorAlign(cell: string): TableAlignment | false {
  const match = /^\s*(:?)-{3,}(:?)\s*$/.exec(cell);
  if (!match) {
    return false;
  }
  return match[1] && match[2]
    ? "center"
    : match[2]
      ? "right"
      : match[1]
        ? "left"
        : null;
}
export function tableSeparator(line: string) {
  const cells = splitTableRow(line);
  const alignments = cells.map(separatorAlign);
  return alignments.length > 0 &&
    alignments.every((alignment) => alignment !== false)
    ? (alignments as TableAlignment[])
    : null;
}
function emptyTableCell(): TableCell {
  return {
    text: "",
    colspan: 1,
    rowspan: 1,
    covered: false,
  };
}
export function parseTableCell(source: string): TableCell {
  const cell = emptyTableCell();
  const meta = TABLE_CELL_META.exec(source);
  if (!meta) {
    return { ...cell, text: source };
  }
  for (const token of meta[1].trim().split(/\s+/)) {
    const [key, value] = token.split("=");
    if (key === "covered") {
      cell.covered = true;
    } else if (key === "colspan") {
      cell.colspan = Math.max(1, Number(value) || 1);
    } else if (key === "rowspan") {
      cell.rowspan = Math.max(1, Number(value) || 1);
    } else if (key === "bg" && /^#[\da-f]{6}$/i.test(value ?? "")) {
      cell.background = value.toLowerCase();
    }
  }
  return {
    ...cell,
    text: source.slice(meta[0].length),
  };
}
export function tableWidth(table: MarkdownTable) {
  return Math.max(
    table.alignments.length,
    ...table.rows.map((row) => row.length),
  );
}
function normalizeTable(table: MarkdownTable): MarkdownTable {
  const width = Math.max(1, tableWidth(table));
  const alignments = [
    ...table.alignments,
    ...Array<TableAlignment>(width - table.alignments.length).fill(null),
  ];
  const rows = table.rows.map((row) => {
    const cells = row.map((cell) => ({ ...cell }));
    return [
      ...cells,
      ...Array.from({ length: width - cells.length }, emptyTableCell),
    ];
  });
  return { alignments, rows };
}
export function parseMarkdownTable(lines: string[]): MarkdownTable | null {
  const alignments = tableSeparator(lines[1]);
  if (!alignments || lines.length < 2) {
    return null;
  }
  return normalizeTable({
    alignments,
    rows: lines
      .filter((_, index) => index !== 1)
      .map((line) => splitTableRow(line).map(parseTableCell)),
  });
}
function escapedTableText(text: string) {
  return text.replace(/\n/g, " ").replace(/\|/g, "\\|");
}
export function serializedTableCell(cell: TableCell) {
  const meta = [
    cell.covered ? "covered" : "",
    cell.colspan > 1 ? `colspan=${cell.colspan}` : "",
    cell.rowspan > 1 ? `rowspan=${cell.rowspan}` : "",
    cell.background ? `bg=${cell.background}` : "",
  ].filter(Boolean);
  const text = escapedTableText(cell.text);
  return `${meta.length ? `{:: ${meta.join(" ")} ::} ` : ""}${text}`;
}
function alignmentMarker(alignment: TableAlignment) {
  return alignment === "center"
    ? ":---:"
    : alignment === "right"
      ? "---:"
      : alignment === "left"
        ? ":---"
        : "---";
}
export function serializeMarkdownTable(table: MarkdownTable) {
  const normalized = normalizeTable(table);
  const rows = normalized.rows.map(
    (row) => `| ${row.map(serializedTableCell).join(" | ")} |`,
  );
  const separator = `| ${normalized.alignments.map(alignmentMarker).join(" | ")} |`;
  return [rows[0], separator, ...rows.slice(1)].join("\n");
}
function tableCellAt(table: MarkdownTable, row: number, column: number) {
  return table.rows[row]?.[column];
}
function ensureCell(table: MarkdownTable, row: number, column: number) {
  const normalized = normalizeTable(table);
  while (normalized.rows.length <= row) {
    normalized.rows.push(
      Array.from({ length: tableWidth(normalized) }, emptyTableCell),
    );
  }
  while (normalized.rows[row].length <= column) {
    normalized.rows[row].push(emptyTableCell());
    normalized.alignments.push(null);
  }
  return normalized;
}
function mergeTableCellRight(
  table: MarkdownTable,
  row: number,
  column: number,
  cell: TableCell,
) {
  const width = tableWidth(table);
  const targetColumn = column + cell.colspan;
  const target = tableCellAt(table, row, targetColumn);
  if (!target || target.covered) {
    return;
  }
  cell.text = [cell.text, target.text].filter(Boolean).join(" ");
  cell.colspan += target.colspan;
  for (
    let coveredColumn = targetColumn;
    coveredColumn < Math.min(width, targetColumn + target.colspan);
    coveredColumn++
  ) {
    table.rows[row][coveredColumn] = { ...emptyTableCell(), covered: true };
  }
}
function mergeTableCellDown(
  table: MarkdownTable,
  row: number,
  column: number,
  cell: TableCell,
) {
  const width = tableWidth(table);
  const targetRow = row + cell.rowspan;
  if (targetRow >= table.rows.length) {
    return;
  }
  const target = tableCellAt(table, targetRow, column);
  if (!target || target.covered) {
    return;
  }
  cell.text = [cell.text, target.text].filter(Boolean).join(" ");
  cell.rowspan += target.rowspan;
  for (
    let coveredRow = targetRow;
    coveredRow < Math.min(table.rows.length, targetRow + target.rowspan);
    coveredRow++
  ) {
    for (
      let coveredColumn = column;
      coveredColumn < Math.min(width, column + cell.colspan);
      coveredColumn++
    ) {
      table.rows[coveredRow][coveredColumn] = {
        ...emptyTableCell(),
        covered: true,
      };
    }
  }
}
function splitTableCell(
  table: MarkdownTable,
  row: number,
  column: number,
  cell: TableCell,
) {
  const width = tableWidth(table);
  const { colspan, rowspan } = cell;
  cell.colspan = 1;
  cell.rowspan = 1;
  for (
    let splitRow = row;
    splitRow < Math.min(table.rows.length, row + rowspan);
    splitRow++
  ) {
    for (
      let splitColumn = column;
      splitColumn < Math.min(width, column + colspan);
      splitColumn++
    ) {
      if (splitRow !== row || splitColumn !== column) {
        table.rows[splitRow][splitColumn] = emptyTableCell();
      }
    }
  }
}
function applyTableEdit(table: MarkdownTable, edit: TableEdit): MarkdownTable {
  const row = "row" in edit ? Math.max(0, edit.row) : 0;
  const column = "column" in edit ? Math.max(0, edit.column) : 0;
  const next = ensureCell(table, row, column);
  const width = tableWidth(next);
  const cell = tableCellAt(next, row, column);
  if (!cell || cell.covered) {
    return next;
  }
  if (edit.type === "set-cell-text") {
    cell.text = edit.text;
  } else if (edit.type === "insert-row") {
    next.rows.splice(
      Math.max(1, row + 1),
      0,
      Array.from({ length: width }, emptyTableCell),
    );
  } else if (edit.type === "insert-column") {
    const insertionColumn = Math.min(width, column + 1);
    next.alignments.splice(insertionColumn, 0, null);
    for (const tableRow of next.rows) {
      tableRow.splice(insertionColumn, 0, emptyTableCell());
    }
  } else if (edit.type === "merge-right") {
    mergeTableCellRight(next, row, column, cell);
  } else if (edit.type === "merge-down") {
    mergeTableCellDown(next, row, column, cell);
  } else if (edit.type === "split-cell") {
    splitTableCell(next, row, column, cell);
  } else if (edit.type === "set-cell-background") {
    cell.background =
      edit.background && TABLE_BACKGROUNDS.has(edit.background)
        ? edit.background
        : undefined;
  }
  return normalizeTable(next);
}
export function editMarkdownTable(text: string, edit: TableEdit) {
  const table = parseMarkdownTable(text.split("\n"));
  return table ? serializeMarkdownTable(applyTableEdit(table, edit)) : text;
}
