const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import { buildTree } from "./tree";

const tree = buildTree(["b.md", "notes/deep/x.md", "notes/a.md", "notes/deep/y.md"]);

assert(tree[0].name === "notes" && Boolean(tree[0].children), "folders sort before files");
assert(tree[1].name === "b.md" && !tree[1].children, "root file is a leaf");
assert(tree[0].children!.map((n) => n.name).join() === "deep,a.md", "nested folder first, then file");
assert(tree[0].children![0].children!.length === 2, "siblings share one folder node");
assert(tree[0].children![0].children![0].path === "notes/deep/x.md", "leaf keeps full relative path");


const withDirNotes = buildTree(["notes/notes.dir.md", "notes/a.md", "b.md"]);

assert(withDirNotes[0].note === "notes/notes.dir.md", "folder adopts its own markdown");
assert(withDirNotes[0].children!.map((n) => n.name).join() === "a.md", "dir note is not a child row");
assert(withDirNotes[1].note === "b.md", "leaf note points at its file");
assert(buildTree(["notes/a.md"])[0].note === undefined, "folder without its markdown has no page");

console.log("tree ok");
