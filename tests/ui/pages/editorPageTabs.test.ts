const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { cycleTab, moveTab, orderTabs, syncTabs } from "../../../src/ui/pages/editorPageUtils";

const notes = ["a.md", "b.md"];
const databases = [{ id: "tasks" }];

assert(
  syncTabs([], "a.md", notes, databases).join() === "a.md",
  "active note joins the tab list",
);
assert(
  syncTabs(["a.md"], "a.md", notes, databases)[0] === "a.md",
  "already open note is not duplicated",
);
assert(
  syncTabs(["a.md"], "db:tasks", notes, databases).join() === "a.md,db:tasks",
  "active database opens as a tab",
);
assert(
  syncTabs(["a.md", "gone.md"], "a.md", notes, databases).join() === "a.md",
  "deleted note drops out",
);
assert(
  syncTabs(["db:old"], "a.md", notes, databases).join() === "a.md",
  "deleted database drops out",
);
const stable = ["a.md", "b.md"];
assert(
  syncTabs(stable, "a.md", notes, databases) === stable,
  "unchanged list keeps its identity",
);
assert(
  syncTabs(["a.md"], "renamed.md", notes, databases).join() ===
    "a.md,renamed.md",
  "active tab survives even before the space list refreshes",
);

assert(
  orderTabs(["a.md", "b.md", "c.md"], ["c.md"]).join() === "c.md,a.md,b.md",
  "pinned tabs move to the front",
);
assert(
  syncTabs(["a.md"], "b.md", notes, databases, ["b.md"]).join() ===
    "b.md,a.md",
  "a newly opened pinned tab lands in the pinned block",
);

assert(
  moveTab(["a.md", "b.md", "c.md"], "c.md", "a.md", []).join() ===
    "c.md,a.md,b.md",
  "dragging a tab left takes the target slot",
);
assert(
  moveTab(["a.md", "b.md", "c.md"], "a.md", "c.md", []).join() ===
    "b.md,c.md,a.md",
  "dragging a tab right takes the target slot",
);
assert(
  moveTab(["a.md", "b.md"], "b.md", "a.md", ["a.md"]).join() === "a.md,b.md",
  "a drag cannot push an unpinned tab past a pinned one",
);
const unmoved = ["a.md", "b.md"];
assert(
  moveTab(unmoved, "gone.md", "a.md", []) === unmoved,
  "dragging an unknown tab changes nothing",
);

assert(cycleTab(["a.md", "b.md"], "a.md", 1) === "b.md", "Ctrl+Tab goes next");
assert(
  cycleTab(["a.md", "b.md"], "b.md", 1) === "a.md",
  "cycling wraps to the first tab",
);
assert(
  cycleTab(["a.md", "b.md"], "a.md", -1) === "b.md",
  "Ctrl+Shift+Tab wraps backwards",
);
assert(cycleTab([], null, 1) === null, "cycling with no tabs stays empty");

console.log("tabs ok");
