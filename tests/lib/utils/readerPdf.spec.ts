import { describe, expect, it } from "vitest";
import { pageIndexAt } from "../../../src/lib/utils/readerPdf";

describe("pageIndexAt", () => {
  const offsets = [0, 100, 200, 300];

  it("finds the last page at or above the scroll position", () => {
    expect(pageIndexAt(offsets, 0)).toBe(0);
    expect(pageIndexAt(offsets, 99)).toBe(0);
    expect(pageIndexAt(offsets, 100)).toBe(1);
    expect(pageIndexAt(offsets, 250)).toBe(2);
  });

  it("clamps outside the document", () => {
    expect(pageIndexAt(offsets, -500)).toBe(0);
    expect(pageIndexAt(offsets, 9000)).toBe(3);
  });
});
