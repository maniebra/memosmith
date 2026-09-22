import { describe, expect, it } from "vitest";
import {
  DRAFT,
  pageIndexAt,
  pixelRatio,
  renderVisible,
} from "../../../src/lib/utils/readerPdf";

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

describe("pixelRatio", () => {
  const small = { width: 800, height: 1000 };
  const big = { width: 2000, height: 2500 };
  const huge = { width: 4000, height: 5000 };

  it("never draws above the screen in cpu mode", () => {
    expect(pixelRatio(small, "cpu")).toBe(1);
  });

  const pixels = (
    size: { width: number; height: number },
    mode: "cpu" | "gpu",
  ) => pixelRatio(size, mode) ** 2 * size.width * size.height;

  it("caps a zoomed page at the pixel budget", () => {
    expect(pixels(big, "cpu")).toBeLessThanOrEqual(4e6);
    expect(pixels(big, "gpu")).toBeLessThanOrEqual(12e6);
  });

  it("stops shrinking at half resolution, however big the page", () => {
    expect(pixelRatio(huge, "cpu")).toBe(0.5);
  });
});

describe("renderVisible", () => {
  const stub = (quality: number) =>
    ({
      number: 1,
      wrapper: { querySelector: () => null },
      textLayer: { replaceChildren: () => {} },
      rendered: quality > 0,
      task: null,
      quality,
    }) as any;

  const host = { scrollTop: 0, clientHeight: 100 } as any;

  it("leaves pages already drawn at the wanted quality alone", async () => {
    const pages = [stub(1), stub(1)];

    expect(
      await renderVisible(
        null,
        host,
        pages,
        [0, 100],
        { scale: 1, rotation: 0 },
        "cpu",
        DRAFT,
      ),
    ).toBe(false);
  });

  it("drops the pages far from the screen", async () => {
    const pages = Array.from({ length: 40 }, () => stub(1));

    await renderVisible(
      null,
      host,
      pages,
      pages.map((_, index) => index * 100),
      { scale: 1, rotation: 0 },
      "cpu",
      DRAFT,
    );

    expect(pages[39].rendered).toBe(false);
    expect(pages[39].quality).toBe(0);
    expect(pages[0].rendered).toBe(true);
  });
});
