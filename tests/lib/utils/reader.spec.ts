import { describe, expect, it } from "vitest";
import { quoteMatches } from "../../../src/lib/utils/reader";

describe("quoteMatches", () => {
  it("finds a quote that reads the same", () => {
    expect(quoteMatches("the network edge", "network")).toEqual([[4, 11]]);
  });

  it("ignores the line breaks a selection reports", () => {
    // The text layer runs the lines together; the selection has a newline.
    expect(quoteMatches("end userscall it", "users\ncall")).toEqual([[4, 13]]);
  });

  it("ignores spaces the text layer drops", () => {
    expect(quoteMatches("end users call", "userscall")).toEqual([[4, 14]]);
  });

  it("matches whatever the case", () => {
    expect(quoteMatches("The Network", "network")).toEqual([[4, 11]]);
  });

  it("finds every occurrence", () => {
    expect(quoteMatches("ab ab", "ab")).toEqual([
      [0, 2],
      [3, 5],
    ]);
  });

  it("has nothing to find in an empty quote", () => {
    expect(quoteMatches("text", "  ")).toEqual([]);
  });
});
