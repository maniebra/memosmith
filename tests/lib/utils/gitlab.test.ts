const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  gitlabTables,
  listPath,
  mergeItems,
} from "../../../src/lib/utils/gitlab";

const table = gitlabTables()[0];
const kept = {
  id: "issues-1",
  tableId: "issues",
  position: 3,
  data: { title: "old", note: "mine" },
};
const rows = mergeItems(
  table,
  [kept],
  [
    {
      id: 1,
      title: "new",
      state: "opened",
      labels: ["bug", { name: "ui" }],
      assignees: [{ username: "ann" }],
      updated_at: "2026-09-01T10:00:00Z",
    },
    { id: 2, title: "second", state: "closed" },
  ],
);

assert(rows[0].data.title === "new", "re-sync overwrites synced cells");
assert(rows[0].data.note === "mine", "re-sync keeps user cells");
assert(rows[0].position === 3, "re-sync keeps position");
assert(rows[1].position === 4, "new rows append");
assert(rows[0].data.updated === "2026-09-01", "dates are trimmed to a day");
assert(
  String(rows[0].data.labels) === "bug,ui",
  "labels accept strings and objects",
);
const state = table.columns.find((column) => column.id === "state");
assert(
  String(state?.options) === "opened,closed",
  "select options collect seen values",
);
assert(
  listPath("epics", "a/b").startsWith("/groups/a%2Fb/epics?"),
  "group paths are encoded",
);
assert(
  listPath("issues", " ").startsWith("/issues?"),
  "no group lists own items",
);
