import { describe, expect, it } from "vitest";
import {
  detachedTabFromSearch,
  detachedTabUrl,
  tabDroppedOutsideViewport,
} from "../../../src/lib/utils/detachedTab";

describe("detached tabs", () => {
  it("round-trips a tab id through the child window URL", () => {
    const tab = "plans/next steps.md";
    expect(detachedTabFromSearch(detachedTabUrl(tab).slice(1))).toBe(tab);
  });

  it("only detaches once the drag leaves the app viewport", () => {
    expect(tabDroppedOutsideViewport(20, 20, 800, 600)).toBe(false);
    expect(tabDroppedOutsideViewport(800, 20, 800, 600)).toBe(true);
    expect(tabDroppedOutsideViewport(20, -1, 800, 600)).toBe(true);
  });
});
