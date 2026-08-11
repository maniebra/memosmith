const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  choicesFor,
  emptyFilter,
  rowsOf,
  tableOf,
  groupRows,
  matchesFilter,
  rowTitle,
  slugify,
  sortRows,
  uncategorized,
  visibleRows,
} from "../../../src/lib/utils/database";
import type { Column, Database, FilterGroup, Row, View } from "../../../src/lib/utils/database";

const columns: Column[] = [
  { id: "name", name: "Name", type: "text" },
  { id: "size", name: "Size", type: "number" },
  { id: "status", name: "Status", type: "select", options: ["todo", "done"] },
  { id: "tags", name: "Tags", type: "multi_select", options: ["a", "b"] },
  { id: "done", name: "Done", type: "checkbox" },
  { id: "due", name: "Due", type: "date" },
  { id: "owner", name: "Owner", type: "relation", relationDatabase: "people" },
];

const rows: Row[] = [
  {
    id: "1",
    tableId: "t",
    position: 0,
    data: {
      name: "Alpha",
      size: 3,
      status: "todo",
      tags: ["a"],
      done: false,
      due: "2026-01-02",
      owner: ["p1"],
    },
  },
  {
    id: "2",
    tableId: "t",
    position: 1,
    data: {
      name: "Beta",
      size: 10,
      status: "done",
      tags: ["a", "b"],
      done: true,
      due: "2026-03-04",
      owner: ["p2"],
    },
  },
  {
    id: "3",
    tableId: "t",
    position: 2,
    data: {
      name: "Gamma",
      size: null,
      status: null,
      tags: [],
      done: false,
      due: "",
      owner: [],
    },
  },
];

const people: Database = {
  id: "people",
  name: "People",
  tables: [
    {
      id: "main",
      name: "People",
      columns: [{ id: "n", name: "Name", type: "text" }],
      views: [],
    },
  ],
  rows: [
    { id: "p1", tableId: "main", position: 0, data: { n: "Ada" } },
    { id: "p2", tableId: "main", position: 1, data: { n: "Lin" } },
  ],
};

const group = (
  conjunction: "and" | "or",
  children: FilterGroup["children"],
): FilterGroup => ({
  id: "g",
  conjunction,
  children,
});

const ids = (filter: FilterGroup) =>
  rows
    .filter((row) => matchesFilter(filter, columns, row))
    .map((row) => row.id)
    .join();

assert(ids(group("and", [])) === "1,2,3", "empty filter keeps every row");
assert(
  ids(
    group("and", [
      { id: "c", column: "name", operator: "contains", value: "a" },
    ]),
  ) === "1,2,3",
  "contains is case-insensitive",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "name", operator: "starts_with", value: "be" },
    ]),
  ) === "2",
  "starts_with matches one row",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "size", operator: "greater_than", value: 5 },
    ]),
  ) === "2",
  "number comparison uses numeric order",
);
assert(
  ids(group("and", [{ id: "c", column: "status", operator: "is_empty" }])) ===
    "3",
  "is_empty finds blank cells",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "tags", operator: "contains", value: "b" },
    ]),
  ) === "2",
  "multi_select checks membership",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "tags", operator: "does_not_contain", value: "b" },
    ]),
  ) === "1,3",
  "multi_select negation",
);
assert(
  ids(
    group("and", [{ id: "c", column: "done", operator: "is", value: true }]),
  ) === "2",
  "checkbox compares booleans",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "due", operator: "on_or_after", value: "2026-02-01" },
    ]),
  ) === "2",
  "dates compare chronologically",
);

assert(
  ids(
    group("or", [
      { id: "c1", column: "size", operator: "greater_than", value: 5 },
      { id: "c2", column: "status", operator: "is", value: "todo" },
    ]),
  ) === "1,2",
  "or unions its children",
);

assert(
  ids(
    group("and", [
      { id: "c1", column: "done", operator: "is", value: false },
      group("or", [
        { id: "c2", column: "name", operator: "is", value: "Alpha" },
        { id: "c3", column: "name", operator: "is", value: "Gamma" },
      ]),
    ]),
  ) === "1,3",
  "nested groups combine conjunctions",
);

const sorted = sortRows(rows, [{ column: "size", direction: "desc" }], columns);
assert(sorted.map((row) => row.id).join() === "2,1,3", "desc number sort");

const view: View = {
  id: "v",
  name: "Table",
  type: "table",
  filter: group("and", [
    { id: "c", column: "done", operator: "is", value: false },
  ]),
  sorts: [{ column: "name", direction: "desc" }],
};
assert(
  visibleRows(rows, view, columns)
    .map((row) => row.id)
    .join() === "3,1",
  "filter then sort",
);

const groups = groupRows(rows, columns[2]);
assert(
  groups.map((entry) => entry.key).join() === `todo,done,${uncategorized}`,
  "board keeps option order plus empty bucket",
);
assert(
  groups[2].rows.map((row) => row.id).join() === "3",
  "empty cells land in the uncategorized bucket",
);

const relationChoices = choicesFor(columns[6], { people });
assert(
  relationChoices.map((choice) => `${choice.value}:${choice.label}`).join() ===
    "p1:Ada,p2:Lin",
  "relation choices are the linked rows",
);
assert(
  choicesFor(columns[6], {}).length === 0,
  "missing relation target yields no choices",
);
assert(
  ids(
    group("and", [
      { id: "c", column: "owner", operator: "contains", value: "p1" },
    ]),
  ) === "1",
  "relation filters by linked row id",
);
assert(
  ids(group("and", [{ id: "c", column: "owner", operator: "is_empty" }])) ===
    "3",
  "unlinked rows count as empty",
);

const relationGroups = groupRows(
  rows,
  columns[6],
  relationChoices.map((choice) => choice.value),
);
assert(
  relationGroups.map((entry) => `${entry.key}=${entry.rows.length}`).join() ===
    `p1=1,p2=1,${uncategorized}=1`,
  "board groups by linked row",
);

assert(
  rowTitle(rows[0], columns) === "Alpha",
  "row title comes from the first text column",
);

assert(/^my-db-[a-z0-9]+$/.test(slugify("My DB!")), "slug is file-name safe");
assert(/^[a-z0-9]+$/.test(slugify("!!!")), "slug never ends up empty");

const tasksTable = {
  id: "t",
  name: "Tasks",
  columns,
  views: [
    {
      id: "v1",
      name: "Table",
      type: "table" as const,
      filter: emptyFilter(),
      sorts: [],
    },
  ],
};
const embedDatabase: Database = {
  id: "tasks",
  name: "Tasks",
  tables: [tasksTable, { id: "t2", name: "Other", columns: [], views: [] }],
  rows,
};

assert(rowsOf(embedDatabase, "t").length === 3, "rows follow their table");
assert(rowsOf(embedDatabase, "t2").length === 0, "an empty table has no rows");
assert(
  tableOf(embedDatabase, undefined)?.id === "t",
  "a missing table id falls back to the first",
);

const shuffled = [{ ...rows[2], position: 0 }, rows[0], rows[1]];

assert(
  sortRows(shuffled, [], columns)
    .map((row) => row.id)
    .join() === "3,1,2",
  "with no sorts, rows follow their dragged position",
);

console.log("database ok");
