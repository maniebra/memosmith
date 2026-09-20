import { beforeEach, describe, expect, it } from "vitest";
import {
  addReadable,
  isReadableTab,
  loadAnnotations,
  newAnnotation,
  saveAnnotations,
  loadPositions,
  loadReadables,
  readableKind,
  readableTabId,
  readableTabPath,
  removeReadable,
  savePosition,
  saveReadables,
} from "../../../src/lib/storage/readables";

// Node has no localStorage; the store only needs get/set/clear.
const store = new Map<string, string>();

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

describe("readables", () => {
  beforeEach(() => localStorage.clear());

  it("only accepts PDF and EPUB files", () => {
    expect(readableKind("/books/a.PDF")).toBe("pdf");
    expect(readableKind("/books/a.epub")).toBe("epub");
    expect(readableKind("/books/a.mobi")).toBeNull();
    expect(addReadable([], "/books/a.mobi")).toEqual([]);
  });

  it("adds each file once and removes it again", () => {
    const added = addReadable([], "/books/a.pdf");
    expect(added).toEqual([{ path: "/books/a.pdf", kind: "pdf", name: "a.pdf" }]);
    expect(addReadable(added, "/books/a.pdf")).toBe(added);
    expect(removeReadable(added, "/books/a.pdf")).toEqual([]);
  });

  it("round-trips the list, dropping entries that lost their path", () => {
    saveReadables([
      { path: "/books/a.epub", kind: "epub", name: "a.epub" },
      { path: "", kind: "pdf", name: "gone" },
    ]);
    expect(loadReadables()).toEqual([
      { path: "/books/a.epub", kind: "epub", name: "a.epub" },
    ]);
  });

  it("keeps a position per file", () => {
    savePosition("/books/a.pdf", "12");
    savePosition("/books/b.epub", "epubcfi(/6/4)");
    expect(loadPositions()).toEqual({
      "/books/a.pdf": "12",
      "/books/b.epub": "epubcfi(/6/4)",
    });
  });

  it("maps a path to a tab id and back", () => {
    const id = readableTabId("/books/a.pdf");
    expect(isReadableTab(id)).toBe(true);
    expect(isReadableTab("a.md")).toBe(false);
    expect(readableTabPath(id)).toBe("/books/a.pdf");
  });
});

describe("annotations", () => {
  beforeEach(() => localStorage.clear());

  it("keeps highlights per file and drops malformed ones", () => {
    const highlight = newAnnotation("12", "  a quote  ");
    expect(highlight.text).toBe("a quote");

    saveAnnotations("/books/a.pdf", [highlight, { id: 1 } as never]);
    expect(loadAnnotations("/books/a.pdf")).toEqual([highlight]);
    expect(loadAnnotations("/books/b.epub")).toEqual([]);
  });

  it("gives every highlight its own id", () => {
    expect(newAnnotation("12", "a").id).not.toBe(newAnnotation("12", "a").id);
  });
});
