import { describe, expect, it } from "vitest";
import { enterEdit, tabEdit } from "../../../src/lib/utils/markdownCommands";
import { renderDocument } from "../../../src/lib/utils/markdown";

type Edit = { start: number; end: number; text: string };

const apply = (value: string, edit: Edit) =>
  value.slice(0, edit.start) + edit.text + value.slice(edit.end);

describe("list Tab", () => {
  const doc = "- a\n- b\n  - c\n- d";

  it("indents an item with its children, caret following", () => {
    const tab = tabEdit(doc, 6, 6, false)!;
    expect(apply(doc, tab.edit)).toBe("- a\n  - b\n    - c\n- d");
    expect(tab.edit.caret).toBe(8);
  });

  it("outdents an item with its children", () => {
    const nested = "- a\n  - b\n    - c\n- d";
    expect(apply(nested, tabEdit(nested, 9, 9, true)!.edit)).toBe(doc);
  });

  it("refuses to nest the first item or outdent the top level", () => {
    expect(tabEdit(doc, 2, 2, false)).toBeNull();
    expect(tabEdit(doc, 2, 2, true)).toBeNull();
    expect(tabEdit("text\n- a", 7, 7, false)).toBeNull();
  });

  it("refuses to skip a level", () => {
    const nested = "- a\n  - b\n  - c";
    expect(tabEdit(nested, 14, 14, false)).not.toBeNull();
    const deeper = apply(nested, tabEdit(nested, 14, 14, false)!.edit);
    expect(tabEdit(deeper, 16, 16, false)).toBeNull();
  });

  it("shifts every selected line and keeps the selection", () => {
    const tab = tabEdit(doc, 6, 12, false)!;
    expect(apply(doc, tab.edit)).toBe("- a\n  - b\n    - c\n- d");
    expect(tab.select).toEqual({ start: 8, end: 16 });
  });

  it("treats a tab as one level", () => {
    const tabbed = "- a\n\t- b";
    expect(apply(tabbed, tabEdit(tabbed, 7, 7, true)!.edit)).toBe("- a\n- b");
  });
});

describe("list Enter", () => {
  it("steps an empty child back out a level", () => {
    const value = "- a\n  - ";
    const edit = enterEdit(value, value.length);
    expect(apply(value, edit)).toBe("- a\n- ");
    expect(edit.caret).toBe(6);
  });

  it("still clears an empty top-level item", () => {
    expect(apply("- a\n- ", enterEdit("- a\n- ", 6))).toBe("- a\n");
  });
});

describe("list render", () => {
  it("nests tab-indented items and marks guides", () => {
    const html = renderDocument("- a\n\t- b");
    expect(html).toContain("padding-left:1.5rem;--md-guides:1.5rem");
  });
});
