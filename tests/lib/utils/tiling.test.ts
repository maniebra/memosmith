import { describe, expect, it } from "vitest";
import {
  leaf,
  leafIds,
  pruneTiles,
  removeLeaf,
  replaceLeaf,
  setRatio,
  splitLeaf,
  type TileSplit,
} from "../../../src/lib/utils/tiling";

describe("tiling tree", () => {
  it("splits a leaf on the requested side", () => {
    const tree = splitLeaf(leaf(null), null, "row", "end", "a.md");
    expect(tree).toMatchObject({ kind: "split", axis: "row", ratio: 0.5 });
    expect(leafIds(tree)).toEqual(["a.md"]);
    expect((tree as TileSplit).start).toEqual(leaf(null));
  });

  it("nests further splits inside the pane that was dropped on", () => {
    let tree = splitLeaf(leaf(null), null, "row", "end", "a.md");
    tree = splitLeaf(tree, "a.md", "column", "start", "b.md");
    expect(leafIds(tree)).toEqual(["b.md", "a.md"]);
  });

  it("gives a removed pane's space back to its sibling", () => {
    let tree = splitLeaf(leaf(null), null, "row", "end", "a.md");
    tree = splitLeaf(tree, "a.md", "column", "end", "b.md");
    expect(leafIds(removeLeaf(tree, "b.md"))).toEqual(["a.md"]);
    expect(removeLeaf(removeLeaf(tree, "b.md"), "a.md")).toEqual(leaf(null));
  });

});

describe("tiling edits", () => {
  it("swaps the note a pane shows", () => {
    const tree = replaceLeaf(
      splitLeaf(leaf(null), null, "row", "end", "a.md"),
      "a.md",
      "b.md",
    );
    expect(leafIds(tree)).toEqual(["b.md"]);
  });

  it("keeps other branches identical when a ratio changes", () => {
    const tree = splitLeaf(
      splitLeaf(leaf(null), null, "row", "end", "a.md"),
      "a.md",
      "column",
      "end",
      "b.md",
    ) as TileSplit;
    const inner = tree.end as TileSplit;
    const next = setRatio(tree, inner, 0.25) as TileSplit;
    expect((next.end as TileSplit).ratio).toBe(0.25);
    expect(next.start).toBe(tree.start);
  });

  it("closes panes for notes that left the tabs or took the main pane", () => {
    let tree = splitLeaf(leaf(null), null, "row", "end", "a.md");
    tree = splitLeaf(tree, "a.md", "row", "end", "b.md");
    expect(leafIds(pruneTiles(tree, ["a.md", "b.md"], null))).toEqual([
      "a.md",
      "b.md",
    ]);
    expect(leafIds(pruneTiles(tree, ["a.md"], null))).toEqual(["a.md"]);
    expect(leafIds(pruneTiles(tree, ["a.md", "b.md"], "a.md"))).toEqual([
      "b.md",
    ]);
    expect(pruneTiles(tree, ["a.md", "b.md"], null)).toBe(tree);
  });
});
