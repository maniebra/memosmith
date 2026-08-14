const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { moveTarget, pathTaken } from "../../../src/ui/pages/editorPageUtils";
import { buildTree, reorderedSiblings } from "../../../src/lib/utils/tree";

assert(moveTarget("a.md", "notes") === "notes/a.md", "root file into folder");
assert(moveTarget("notes/a.md", "") === "a.md", "file back to root");
assert(moveTarget("notes/a.md", "notes") === null, "same parent is a no-op");
assert(moveTarget("a.md", "") === null, "root file to root is a no-op");
assert(moveTarget("notes", "notes/deep") === null, "no folder into itself");
assert(moveTarget("notes", "notes") === null, "no folder onto itself");
assert(
  moveTarget("notes/deep", "other") === "other/deep",
  "nested folder into sibling",
);

const notes = ["a.md", "notes/deep/x.md"];
assert(pathTaken(notes, "a.md") === true, "existing note is taken");
assert(pathTaken(notes, "notes") === true, "existing folder is taken");
assert(pathTaken(notes, "notes/deep/y.md") === false, "free path is free");
assert(pathTaken(notes, "a") === false, "prefix of a name is not a folder");

const siblings = ["a.md", "b.md", "c.md"];
assert(
  reorderedSiblings(siblings, "c.md", "a.md", false).join() === "c.md,a.md,b.md",
  "drop before first",
);
assert(
  reorderedSiblings(siblings, "a.md", "c.md", true).join() === "b.md,c.md,a.md",
  "drop after last",
);
assert(
  reorderedSiblings(siblings, "z.md", "b.md", false).join() ===
    "a.md,z.md,b.md,c.md",
  "insert an entry moved in from another folder",
);
assert(
  reorderedSiblings(siblings, "a.md", "z.md", false) === siblings,
  "unknown target leaves the list alone",
);

const ordered = buildTree(["a.md", "b.md", "notes/x.md"], {
  "b.md": { order: 0 },
  "a.md": { order: 1 },
});
assert(
  ordered.map((node) => node.path).join() === "b.md,a.md,notes",
  "manual order wins over folders-first name sorting",
);

console.log("moveTarget ok");
