const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  gitlabTables,
  listPath,
  mergeItems,
  staleRowIds,
  rowCard,
  labelHtml,
  gitlabEmbed,
  gitlabPreview,
  gitlabResolver,
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
      description: "body text",
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
assert(rows[0].data.__body === "body text", "description fills the page");
const stale = staleRowIds(
  table,
  [
    kept,
    { ...kept, id: "issues-9" },
    { ...kept, id: "abc123" },
    { ...kept, id: "merge_requests-9" },
  ],
  rows,
);
assert(String(stale) === "issues-9", "only vanished synced rows go");

const card = rowCard("gitlab-x", rows[0]);
const html = gitlabPreview(0, gitlabEmbed(card).split("\n")[1]);
assert(html.includes("md-gitlab-opened"), "card shows state");
assert(html.includes(">new<"), "card shows title");
const live = gitlabPreview(
  0,
  JSON.stringify(card),
  gitlabResolver([{ ...card, title: "<fresh>" }]),
);
assert(live.includes("&lt;fresh&gt;"), "synced data wins and is escaped");
assert(gitlabPreview(0, "nope").includes("Invalid"), "bad source is flagged");

const scoped = labelHtml("priority::high", "#ff0000");
assert(
  scoped.includes('md-gitlab-scope">priority<') &&
    scoped.includes('md-gitlab-value">high<'),
  "scoped labels split into scope and value",
);
assert(
  labelHtml("a::b::c").includes('md-gitlab-scope">a::b<'),
  "the last :: splits nested scopes",
);
assert(
  labelHtml("x", "red;background:url(x)").includes("--label-bg:#6b7280"),
  "only hex colours reach the style",
);
const colored = mergeItems(
  gitlabTables()[0],
  [],
  [{ id: 5, labels: [{ name: "type::bug", color: "#dc143c" }] }],
)[0];
assert(
  rowCard("db", colored).labelColors?.["type::bug"] === "#dc143c",
  "label colours survive the sync",
);
