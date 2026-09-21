import { describe, expect, it } from "vitest";
import { buildTree, withReadables } from "../../../src/lib/utils/tree";
import { readableKind } from "../../../src/lib/storage/readables";

describe("withReadables", () => {
  const tree = buildTree(["notes/one.md", "two.md"]);

  it("files a readable into its folder, unfiled ones at the root", () => {
    const merged = withReadables(tree, [
      { path: "/books/a.pdf", name: "a.pdf", folder: "notes" },
      { path: "/books/b.pdf", name: "b.pdf", folder: "" },
      { path: "/books/c.pdf", name: "c.pdf" },
    ]);

    expect(merged.find((n) => n.path === "read:/books/b.pdf")?.folder).toBe("");
    expect(merged.some((n) => n.path === "read:/books/c.pdf")).toBe(true);
    expect(
      merged
        .find((n) => n.path === "notes")
        ?.children?.map((n) => n.readable)
        .filter(Boolean),
    ).toEqual(["/books/a.pdf"]);
  });

  it("orders readable rows with the notes around them", () => {
    const merged = withReadables(
      tree,
      [{ path: "/books/a.pdf", name: "a.pdf", folder: "" }],
      { "read:/books/a.pdf": { order: 0 }, "two.md": { order: 1 } },
    );

    expect(merged.map((n) => n.path)).toEqual([
      "read:/books/a.pdf",
      "two.md",
      "notes",
    ]);
  });
});

describe("readableKind", () => {
  it("names every supported kind and rejects the rest", () => {
    expect(readableKind("/a/book.PDF")).toBe("pdf");
    expect(readableKind("/a/book.epub")).toBe("epub");
    expect(readableKind("/a/shot.webp")).toBe("image");
    expect(readableKind("/a/clip.mkv")).toBe("video");
    expect(readableKind("/a/track.flac")).toBe("audio");
    expect(readableKind("/a/notes.md")).toBe(null);
    expect(readableKind("/a/noext")).toBe(null);
  });
});
