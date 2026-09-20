import { describe, expect, it } from "vitest";
import { syncTabs } from "../../../src/ui/pages/editorPageUtils";

describe("syncTabs", () => {
  it("drops every tab while the space listing is empty", () => {
    // Why the editor page only syncs once the space has loaded: before that,
    // syncing would wipe the restored tabs and their panes.
    expect(syncTabs(["a.md", "b.md"], null, [], [])).toEqual([]);
  });

  it("keeps tabs whose notes exist", () => {
    const tabs = ["a.md", "b.md"];
    expect(syncTabs(tabs, null, ["a.md", "b.md"], [])).toBe(tabs);
  });
});
