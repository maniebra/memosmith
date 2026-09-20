import { describe, expect, it } from "vitest";
import { parseTiles } from "../../../src/lib/storage/tabs";

describe("parseTiles", () => {
  it("reads a stored split tree", () => {
    const tree = {
      kind: "split",
      axis: "column",
      ratio: 0.25,
      start: { kind: "leaf", id: null },
      end: { kind: "leaf", id: "note.md" },
    };
    expect(parseTiles(tree)).toEqual(tree);
  });

  it("rejects anything that is not a tile tree", () => {
    expect(parseTiles(null)).toBeNull();
    expect(parseTiles({ kind: "leaf", id: 7 })).toBeNull();
    expect(parseTiles({ kind: "split", axis: "row" })).toBeNull();
    expect(
      parseTiles({
        kind: "split",
        axis: "diagonal",
        start: { kind: "leaf", id: null },
        end: { kind: "leaf", id: "a.md" },
      }),
    ).toBeNull();
  });

  it("defaults a missing ratio", () => {
    const parsed = parseTiles({
      kind: "split",
      axis: "row",
      start: { kind: "leaf", id: null },
      end: { kind: "leaf", id: "a.md" },
    });
    expect(parsed && parsed.kind === "split" && parsed.ratio).toBe(0.5);
  });
});
