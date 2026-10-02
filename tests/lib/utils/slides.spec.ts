import { describe, expect, it } from "vitest";
import {
  NOTE_MARKER,
  splitNotes,
  splitSlides,
} from "../../../src/lib/utils/slides";
import { slideShellName } from "../../../src/lib/utils/slideShells";

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

describe("splitNotes", () => {
  const notes = (lines: string[]) =>
    splitNotes(lines, (line) => NOTE_MARKER.test(line));

  it("moves everything from Note: on into notes", () => {
    expect(notes(["# A", "a", "notes: say hi", "more"])).toEqual({
      content: ["# A", "a"],
      notes: ["notes: say hi", "more"],
    });
  });

  it("leaves a slide without notes alone", () => {
    expect(notes(["# A", "Notebook"])).toEqual({
      content: ["# A", "Notebook"],
      notes: [],
    });
  });
});

describe("slideShellName", () => {
  it("strips folders and the .css extension", () => {
    expect(slideShellName("/home/me/shells/Midnight.CSS")).toBe("Midnight");
    expect(slideShellName("C:\\shells\\swiss.css")).toBe("swiss");
  });
});
