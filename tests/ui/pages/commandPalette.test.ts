const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  commandPaletteItems,
  headingItems,
  palettePrefix,
} from "../../../src/ui/pages/editorPageCommands";
import {
  paletteMatches,
  rankPaletteItems,
  scorePaletteMatch,
} from "../../../src/lib/utils/paletteRank";

assert(paletteMatches("Database view", "dbv"), "subsequence should match");
assert(paletteMatches("Notes/Todo", "todo"), "substring should match");
assert(!paletteMatches("Notes/Todo", "zz"), "missing letters should not match");
assert(!paletteMatches("abc", "cba"), "order should matter");

let opened = "";
const source = {
  actions: {
    runWithStatus: (action: () => Promise<void>) => action(),
    selectSpaceNote: async (path: string) => {
      opened = path;
    },
    selectDatabase: async (id: string) => {
      opened = id;
    },
    chooseSpace: async () => {},
    refreshSpace: async () => {},
    toggleSpacePane: () => {},
  } as any,
  databases: [{ id: "d1", name: "Tasks" }] as any,
  databasesEnabled: false,
  hasNote: false,
  spaceNotes: ["Notes/Todo.md"],
  contents: "# Alpha\n\ntext\n\n## Beta\n",
  jumpToLine: (line: number) => {
    opened = `line:${line}`;
  },
  t: (key: string) => key,
  openSettings: () => {},
  toggleReadOnly: () => {},
  exportPdf: () => {},
  templates: [{ folder: "", name: "daily", text: "# {{title}}" }],
} as any;

const items = commandPaletteItems(source);
assert(items[0].label === "Notes/Todo", "note label drops the extension");
assert(
  !items.some((item) => item.id === "db:d1"),
  "databases hidden when the feature is off",
);
assert(
  !items.some((item) => item.id === "action:pdf"),
  "PDF export hidden without an open note",
);
assert(
  items.some((item) => item.id === "action:template:daily"),
  "each root template is a new-note command",
);
items[0].run();
assert(opened === "Notes/Todo.md", "running a note item opens it");

const withExtras = commandPaletteItems({
  ...source,
  databasesEnabled: true,
  hasNote: true,
});
assert(
  withExtras.some((item) => item.id === "db:d1"),
  "databases listed when enabled",
);
assert(
  withExtras.some((item) => item.id === "action:pdf"),
  "PDF export listed with an open note",
);

// Scoring: a tighter, earlier match must outrank a loose one.
const tight = scorePaletteMatch("Todo", "todo") as number;
const loose = scorePaletteMatch("Tomorrow do this", "todo") as number;
assert(tight > loose, "contiguous prefix match should score higher");

const ranked = rankPaletteItems(
  [
    { id: "a", label: "Tomorrow do this" },
    { id: "b", label: "Todo" },
  ],
  "todo",
);
assert(ranked[0].id === "b", "ranking should put the tighter match first");

const byRecency = rankPaletteItems(
  [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ],
  "",
  ["b"],
);
assert(byRecency[0].id === "b", "recent picks float to the top");

// Prefixes.
assert(palettePrefix("todo").kind === null, "plain query has no mode");
assert(palettePrefix("> settings").kind === "action", "> selects actions");
assert(palettePrefix("#be").needle === "be", "# strips the prefix");

// Headings, skipping fenced code.
const headings = headingItems(
  "# One\n```\n# not a heading\n```\n## Two\n",
  (line) => {
    opened = `line:${line}`;
  },
  "Heading",
);
assert(headings.length === 2, "fenced lines are not headings");
assert(headings[1].label === "  Two", "depth is indented");
headings[1].run();
assert(opened === "line:4", "heading jumps to its source line");

const withHeadings = commandPaletteItems({ ...source, hasNote: true });
assert(
  withHeadings.some((item) => item.kind === "heading"),
  "headings listed when a note is open",
);
assert(
  !items.some((item) => item.kind === "heading"),
  "no headings without an open note",
);

console.log("commandPalette tests passed");
