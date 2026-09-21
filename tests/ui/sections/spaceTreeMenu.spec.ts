import { describe, expect, it, vi } from "vitest";
// Icons are .svelte files vitest cannot load; only the entries matter here.
vi.mock("@lucide/svelte", () => ({
  BookOpen: "icon",
  Clapperboard: "icon",
  ChevronDown: "icon",
  ChevronRight: "icon",
  FolderOpen: "icon",
  FolderPlus: "icon",
  FolderSymlink: "icon",
  Pencil: "icon",
  Plus: "icon",
  Trash2: "icon",
}));

import { treeContextItems } from "../../../src/ui/sections/spaceTreeMenu";

const deps = (onConvertToFolder = vi.fn()) => ({
  collapsed: {},
  scopeLabel: "Scope",
  onSelect: vi.fn(),
  onToggle: vi.fn(),
  onScopeDirectory: vi.fn(),
  onStartCreate: vi.fn(),
  onExpand: vi.fn(),
  onStartRename: vi.fn(),
  onConvertToFolder,
  onDelete: vi.fn(),
});

const labels = (items: ReturnType<typeof treeContextItems>) =>
  items.map((item) => ("label" in item ? item.label : "-"));

describe("Convert to folder", () => {
  it("acts on the note behind a plain note row", () => {
    const convert = vi.fn();
    const items = treeContextItems(
      { name: "a.md", path: "a.md", note: "a.md" },
      deps(convert),
    );
    const entry = items.find(
      (item) => "label" in item && item.label === "Convert to folder",
    );

    (entry as { onSelect: () => void }).onSelect();
    expect(convert).toHaveBeenCalledWith("a.md");
  });

  it("stays off folders and readables", () => {
    const folder = treeContextItems(
      { name: "n", path: "n", note: "n/n.dir.md", children: [] },
      deps(),
    );
    const readable = treeContextItems(
      { name: "b.pdf", path: "read:/b.pdf", readable: "/b.pdf" },
      deps(),
    );

    expect(labels(folder)).not.toContain("Convert to folder");
    expect(labels(readable)).not.toContain("Convert to folder");
  });
});
