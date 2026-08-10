const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import {
  CREATED_AT,
  EDITED_AT,
  aggregate,
  computeRows,
  searchRows,
  visibleColumns,
} from "./database";
import type { Column, Database, Row, View } from "./database";
import { evaluateFormula } from "./formula";
import { fromCsv, parseCsv, toCsv } from "./databaseCsv";
import { movedBefore } from "../../ui/sections/databaseEdits";

// --- formula ---------------------------------------------------------------

const cells: Record<string, string | number | boolean | null> = {
  Size: 4,
  Name: "Alpha",
  Done: true,
  Due: "2026-01-10",
};
const run = (source: string) =>
  evaluateFormula(source, (name) => cells[name] ?? null);

assert(run("1 + 2 * 3") === 7, "precedence: * before +");
assert(run("(1 + 2) * 3") === 9, "parentheses win");
assert(run("{Size} / 2") === 2, "properties read cells");
assert(run("{Size} / 0") === null, "dividing by zero is empty, not Infinity");
assert(run('{Name} + "!"') === "Alpha!", "+ concatenates when a side is text");
assert(run("if({Done}, 1, 0)") === 1, "if picks the true branch");
assert(run("not {Done}") === false, "not works without parentheses");
assert(run("not({Done})") === false, "not works as a call");
assert(run("{Size} > 3 and {Size} < 10") === true, "comparison and boolean ops");
assert(run('upper(concat({Name}, "-x"))') === "ALPHA-X", "nested calls");
assert(run("round(10 / 3, 2)") === 3.33, "round takes digits");
assert(run('datediff("2026-01-01", {Due})') === 9, "datediff counts days");
assert(run('dateadd("2026-01-01", 5)') === "2026-01-06", "dateadd shifts days");
assert(String(run("{Size} +")).startsWith("⚠"), "a broken formula reports itself");
assert(String(run("nope(1)")).startsWith("⚠"), "an unknown function reports itself");
assert(run("-{Size} + 1") === -3, "unary minus");

// --- aggregate -------------------------------------------------------------

assert(aggregate([1, 2, 3], "sum") === 6, "sum adds numbers");
assert(aggregate([1, 2, null], "count") === 3, "count counts every row");
assert(aggregate([1, 2, null], "count_not_empty") === 2, "empties are skipped");
assert(aggregate([1, 2, null], "count_empty") === 1, "empties are counted");
assert(aggregate(["a", "a", "b"], "count_unique") === 2, "unique values");
assert(aggregate([2, 4], "average") === 3, "average divides by the count");
assert(aggregate([], "average") === null, "average of nothing is empty");
assert(aggregate([true, false], "percent_checked") === 50, "percent checked");
assert(aggregate([1, 5], "min") === 1 && aggregate([1, 5], "max") === 5, "min/max");

// --- computed columns ------------------------------------------------------

const people: Database = {
  id: "people",
  name: "People",
  tables: [
    {
      id: "t",
      name: "People",
      columns: [
        { id: "name", name: "Name", type: "text" },
        { id: "fee", name: "Fee", type: "number" },
      ],
      views: [],
    },
  ],
  rows: [
    { id: "p1", tableId: "t", position: 1, data: { name: "Ada", fee: 10 } },
    { id: "p2", tableId: "t", position: 2, data: { name: "Bo", fee: 5 } },
  ],
};

const columns: Column[] = [
  { id: "title", name: "Title", type: "text" },
  { id: "size", name: "Size", type: "number" },
  { id: "owners", name: "Owners", type: "relation", relationDatabase: "people" },
  { id: "double", name: "Double", type: "formula", formula: "{Size} * 2" },
  {
    id: "fees",
    name: "Fees",
    type: "rollup",
    rollupRelation: "owners",
    rollupTarget: "fee",
    rollupFunction: "sum",
  },
  { id: "made", name: "Made", type: "created_time" },
  { id: "touched", name: "Touched", type: "edited_time" },
];

const rows: Row[] = [
  {
    id: "1",
    tableId: "t",
    position: 1,
    data: {
      title: "Alpha",
      size: 3,
      owners: ["p1", "p2"],
      [CREATED_AT]: "2026-02-01T00:00:00.000Z",
    },
  },
  {
    id: "2",
    tableId: "t",
    position: 2,
    data: {
      title: "Beta",
      size: 1,
      owners: [],
      [CREATED_AT]: "2026-02-02T00:00:00.000Z",
      [EDITED_AT]: "2026-03-02T00:00:00.000Z",
    },
  },
];

const resolved = computeRows(rows, columns, { people });

assert(resolved[0].data.double === 6, "formula columns are filled in");
assert(resolved[0].data.fees === 15, "a rollup sums the linked rows");
assert(resolved[1].data.fees === 0, "a rollup with no links sums to zero");
assert(
  resolved[0].data.made === "2026-02-01T00:00:00.000Z",
  "created time reads the stored timestamp",
);
assert(
  resolved[0].data.touched === "2026-02-01T00:00:00.000Z",
  "an unedited row falls back to its created time",
);
assert(
  resolved[1].data.touched === "2026-03-02T00:00:00.000Z",
  "edited time wins once the row changes",
);
assert(rows[0].data.double === undefined, "stored rows keep no computed cells");

const cyclic: Column[] = [
  { id: "a", name: "A", type: "formula", formula: "{B} + 1" },
  { id: "b", name: "B", type: "formula", formula: "{A} + 1" },
];
assert(
  typeof computeRows([rows[0]], cyclic)[0].data.a === "number",
  "a formula cycle stops instead of hanging",
);

// --- view helpers ----------------------------------------------------------

const view: View = {
  id: "v",
  name: "V",
  type: "table",
  filter: { id: "f", conjunction: "and", children: [] },
  sorts: [],
  hidden: ["size"],
};

assert(
  !visibleColumns(columns, view).some((column) => column.id === "size"),
  "hidden columns leave the view",
);
assert(
  searchRows(resolved, columns, "alph").length === 1,
  "search matches cell text",
);
assert(searchRows(resolved, columns, "  ").length === 2, "a blank search matches all");

// --- csv -------------------------------------------------------------------

const csv = toCsv(
  [
    { id: "title", name: "Title", type: "text" },
    { id: "owners", name: "Owners", type: "multi_select" },
  ],
  [
    {
      id: "1",
      tableId: "t",
      position: 1,
      data: { title: 'He said "hi", loudly', owners: ["a", "b"] },
    },
  ],
);

assert(
  csv.split("\n")[1] === '"He said ""hi"", loudly","a, b"',
  `quotes and commas are escaped, got ${csv.split("\n")[1]}`,
);
assert(
  parseCsv(csv)[1][0] === 'He said "hi", loudly',
  "a round trip returns the original text",
);
assert(
  parseCsv('a,b\n1,"two\nlines"\n')[1][1] === "two\nlines",
  "a quoted newline stays inside its field",
);

const imported = fromCsv(
  'Title,Status,Extra\nAlpha,Done,1\nBeta,Todo,2\n',
  [
    { id: "title", name: "Title", type: "text" },
    { id: "status", name: "Status", type: "select", options: ["Todo"] },
  ],
  "t",
  7,
);

assert(imported.rows.length === 2, "every data line becomes a row");
assert(imported.rows[0].data.title === "Alpha", "cells map by header name");
assert(imported.rows[0].position === 8, "imported rows continue the positions");
assert(
  imported.columns.length === 3 &&
    imported.columns[2].name === "Extra" &&
    imported.rows[1].data[imported.columns[2].id] === "2",
  "an unknown header becomes a new text column",
);
assert(
  imported.columns[1].options?.includes("Done"),
  "imported select values become options",
);

// --- board reordering ------------------------------------------------------

assert(
  movedBefore(["a", "b", "c", "d"], "d", "b").join() === "a,d,b,c",
  "a card lands ahead of the one it was dropped on",
);
assert(
  movedBefore(["a", "b", "c"], "a", "c").join() === "b,a,c",
  "moving forwards keeps the target behind the moved card",
);
assert(
  movedBefore(["a", "b", "c"], "b", "b").join() === "a,b,c",
  "dropping a card on itself changes nothing",
);
assert(
  movedBefore(["a", "b"], "a", "zz").join() === "a,b",
  "an unknown target leaves the order alone",
);

console.log("database features ok");
