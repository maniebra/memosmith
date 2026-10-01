import { describe, expect, it } from "vitest";
import { isImage, transferredAssets } from "../../../src/lib/utils/transfer";

const transfer = (
  files: File[],
  items: { kind: string; getAsFile: () => File | null }[],
  uris = "",
) =>
  ({
    files,
    items,
    getData: (type: string) => (type === "text/uri-list" ? uris : ""),
  }) as unknown as DataTransfer;

describe("transferredAssets", () => {
  const shot = new File(["x"], "shot.png", { type: "image/png" });

  it("takes files straight from the list", () => {
    expect(transferredAssets(transfer([shot], [])).files).toEqual([shot]);
  });

  it("falls back to file items when the list is empty", () => {
    const items = [
      { kind: "string", getAsFile: () => null },
      { kind: "file", getAsFile: () => shot },
    ];
    expect(transferredAssets(transfer([], items))).toEqual({
      files: [shot],
      paths: [],
    });
  });

  it("reads file URIs as paths and skips web links", () => {
    const uris = "file:///home/me/My%20Pics/a.png\r\nhttps://x.dev/b.png";
    expect(transferredAssets(transfer([], [], uris)).paths).toEqual([
      "/home/me/My Pics/a.png",
    ]);
  });
});

describe("isImage", () => {
  it("trusts the type, else the extension", () => {
    expect(isImage("blob", "image/png")).toBe(true);
    expect(isImage("/a/b.JPG")).toBe(true);
    expect(isImage("notes.md", "")).toBe(false);
  });
});
