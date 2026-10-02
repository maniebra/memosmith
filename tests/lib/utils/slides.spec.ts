import { describe, expect, it } from "vitest";
import { splitSlides } from "../../../src/lib/utils/slides";

const split = (lines: string[]) =>
  splitSlides(
    lines,
    (line) => line.startsWith("# "),
    (line) => !line.trim(),
  );

describe("splitSlides", () => {
  it("starts a slide at every H1 and keeps the intro", () => {
    expect(split(["intro", "# A", "a", "## sub", "# B"])).toEqual([
      ["intro"],
      ["# A", "a", "## sub"],
      ["# B"],
    ]);
  });

  it("drops a blank intro", () => {
    expect(split(["", " ", "# A"])).toEqual([["# A"]]);
  });
});
