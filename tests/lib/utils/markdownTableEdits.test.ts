const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { editMarkdownTable } from "../../../src/lib/utils/markdown";

const table = "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";

assert(
  editMarkdownTable(table, { type: "delete-row", row: 1 }) ===
    "| a | b |\n| --- | --- |\n| 3 | 4 |",
  "delete-row drops that row only",
);

assert(
  editMarkdownTable(table, { type: "delete-column", column: 0 }) ===
    "| b |\n| --- |\n| 2 |\n| 4 |",
  "delete-column drops that column from every row",
);

assert(
  editMarkdownTable("| a |\n| --- |", { type: "delete-column", column: 0 }) ===
    "| a |\n| --- |",
  "the last column is kept",
);

assert(
  editMarkdownTable("| a |\n| --- |", { type: "delete-row", row: 0 }) ===
    "| a |\n| --- |",
  "the last row is kept",
);

console.log("table edits ok");
