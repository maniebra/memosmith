import { describe, expect, it, vi } from "vitest";
import {
  draggedOutOfWindow,
  dropMove,
} from "../../../src/ui/sections/spaceTreeDrag";
import type { TreeNode } from "../../../src/lib/utils/tree";

const note = (path: string): TreeNode => ({ name: path, path }) as TreeNode;
const folder = (path: string): TreeNode =>
  ({ name: path, path, children: [] }) as TreeNode;

describe("draggedOutOfWindow", () => {
  vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });

  const at = (x: number, y: number) =>
    ({ clientX: x, clientY: y }) as DragEvent;

  it("is true only for a file let go past the edge", () => {
    expect(draggedOutOfWindow(at(-5, 100), note("a.md"))).toBe(true);
    expect(draggedOutOfWindow(at(100, 100), note("a.md"))).toBe(false);
  });

  it("never detaches a folder", () => {
    expect(draggedOutOfWindow(at(-5, -5), folder("notes"))).toBe(false);
  });
});

describe("dropMove", () => {
  it("drops into the folder it landed on", () => {
    expect(dropMove("a.md", folder("notes"), "inside", []).destFolder).toBe(
      "notes",
    );
  });

  it("reorders beside the row it landed between", () => {
    const nodes = [note("notes/a.md"), note("notes/b.md")];
    const move = dropMove("a.md", nodes[1], "before", nodes);

    expect(move.destFolder).toBe("notes");
    expect(move.order).toEqual(["notes/a.md", "notes/b.md"]);
  });
});
