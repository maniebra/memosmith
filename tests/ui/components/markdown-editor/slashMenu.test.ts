const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { createSlash } from "../../../../src/ui/components/markdown-editor/slash";
import type {
  Editor,
  EditorUi,
} from "../../../../src/ui/components/markdown-editor/types";

const databases = [
  {
    id: "db1",
    name: "Watchlist",
    tables: [
      {
        id: "t1",
        name: "Shows",
        views: [
          { id: "v1", name: "Grid", type: "table" },
          { id: "v2", name: "Gallery", type: "gallery" },
        ],
      },
    ],
  },
  {
    id: "db2",
    name: "Reading",
    tables: [
      {
        id: "t2",
        name: "Books",
        views: [{ id: "v3", name: "All", type: "table" }],
      },
    ],
  },
];

function editor() {
  const ui = {
    slashStart: 0,
    slashQuery: "",
    slashIndex: 0,
    slashPath: [] as string[],
    slashPathQuery: 0,
  } as EditorUi;

  const e = {
    ui,
    t: (key: string) => key,
    props: {
      slashCommands: true,
      callouts: false,
      drawings: false,
      diagrams: false,
      plantuml: false,
      mermaid: false,
      calloutDefinitions: [],
      databaseRoot: "/space",
      databaseOptions: databases,
    },
  } as unknown as Editor;

  return { ui, slash: createSlash(e) };
}

const { ui, slash } = editor();
const top = slash.slashMatches();

// The whole point: two databases with three views between them stay one entry.
assert(
  top.filter((command) => command.label.startsWith("editor.database"))
    .length === 1,
  "the slash menu offers databases as a single entry",
);
assert(
  !top.some((command) => command.label.includes("Gallery")),
  "table views do not flood the top level",
);

const group = top.find((command) => command.label === "editor.databaseGroup");

assert(group?.children?.length === 2, "the group holds one child per database");

slash.pickCommand(group!);

const level = slash.slashMatches();

assert(
  level.map((command) => command.label).join() === "Watchlist,Reading",
  "picking the group drills into the databases instead of inserting",
);
assert(ui.slashStart === 0, "drilling in leaves the menu open");

slash.pickCommand(level[0]);

const views = slash.slashMatches();

assert(
  views.map((command) => command.label).join() ===
    "editor.databaseWhole,Shows · Grid,Shows · Gallery",
  "a database offers itself whole and one entry per table view",
);

const pinned = views[2];

assert(
  pinned.prefix.includes('"view":"v2"') &&
    pinned.prefix.includes('"locked":true'),
  "a view entry inserts that view, pinned",
);

// Typing after drilling filters the submenu; backspacing past it leaves.
ui.slashQuery = "database";
ui.slashPathQuery = "database".length;
ui.slashQuery = "databasegal";

assert(
  slash
    .slashMatches()
    .map((command) => command.label)
    .join() === "Shows · Gallery",
  "what is typed after drilling filters the submenu",
);

// Callouts collapse to one entry that drills into the configured types.
const calloutEditor = (() => {
  const ui = {
    slashStart: 0,
    slashQuery: "",
    slashIndex: 0,
    slashPath: [] as string[],
    slashPathQuery: 0,
  } as EditorUi;
  const e = {
    ui,
    t: (key: string) => key,
    props: {
      slashCommands: true,
      callouts: true,
      drawings: false,
      diagrams: false,
      plantuml: false,
      mermaid: false,
      calloutDefinitions: [
        { id: "note", label: "Note", color: "#000000", icon: "Info" },
        { id: "warning", label: "Warning", color: "#000000", icon: "Star" },
      ],
      databaseRoot: "",
      databaseOptions: [],
    },
  } as unknown as Editor;
  return { ui, slash: createSlash(e) };
})();

const calloutEntry = calloutEditor
  .slash.slashMatches()
  .find((command) => command.label === "editor.callout");

assert(calloutEntry !== undefined, "callouts stay one top-level entry");
calloutEditor.slash.pickCommand(calloutEntry!);

assert(
  calloutEditor.ui.slashStart === 0,
  "picking the callout group opens its submenu instead of inserting",
);
assert(
  calloutEditor.slash
    .slashMatches()
    .map((command) => `${command.label}:${command.prefix}`)
    .join() === "Note:> [!note] ,Warning:> [!warning] ",
  "each configured callout is its own child that inserts that type",
);

console.log("slash menu ok");
