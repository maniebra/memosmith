const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import {
  backlinksForNote,
  parseWikilinks,
  resolveWikilinkTarget,
  wikilinkCreatePath,
} from "../../../src/lib/utils/wikilinks";

const notes = [
  "Index.md",
  "Projects/Alpha.md",
  "Projects/Beta.md",
  "Archive/Alpha.md",
  "Areas/Areas.dir.md",
];

const [link] = parseWikilinks(
  "See [[Projects/Alpha|the alpha note]] and ![[ignored.png]]",
);

assert(link.target === "Projects/Alpha", "target parses before alias");
assert(link.alias === "the alpha note", "alias parses after pipe");
assert(
  parseWikilinks("![[image.png]]").length === 0,
  "embedded wikilinks are ignored",
);
assert(
  resolveWikilinkTarget("Alpha", notes, "Projects/Beta.md").path ===
    "Projects/Alpha.md",
  "bare note names prefer the current folder",
);
assert(
  resolveWikilinkTarget("Areas", notes, "Index.md").path ===
    "Areas/Areas.dir.md",
  "folder notes resolve by displayed name",
);
assert(
  wikilinkCreatePath("New Note", "Projects/Beta.md") === "Projects/New Note.md",
  "missing bare links are created next to the current note",
);
assert(
  wikilinkCreatePath("../Bad", "Index.md") === null,
  "unsafe paths are rejected",
);

const backlinks = backlinksForNote("Projects/Alpha.md", notes, {
  "Index.md": "See [[Alpha]].",
  "Projects/Beta.md": "Related to [[Alpha|Alpha work]].",
  "Archive/Alpha.md": "Different note.",
});

assert(
  backlinks.length === 2,
  "backlinks include notes that resolve to the active note",
);
assert(
  backlinks[0].matches[0].line === 1,
  "backlink line numbers are one-based",
);

console.log("wikilinks ok");
