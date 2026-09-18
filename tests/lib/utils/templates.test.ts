const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { fillTemplate } from "../../../src/lib/utils/templates";

const now = new Date(2026, 0, 5, 9, 7);
const filled = fillTemplate(
  "# {{title}} {{ date }} {{time}} {{other}}",
  "Plan",
  now,
);
assert(
  filled === "# Plan 2026-01-05 09:07 {{other}}",
  `fillTemplate: ${filled}`,
);
console.log("templates ok");

import { noteFromTemplate } from "../../../src/lib/utils/templates";

const dated = noteFromTemplate(
  {
    folder: "Work",
    name: "Work / Meeting",
    path: "Work/.templates/Meeting {{date}}.md",
    text: "# {{title}}",
  },
  "Untitled",
);
assert(
  /^Meeting \d{4}-\d\d-\d\d$/.test(dated.title),
  `dated title: ${dated.title}`,
);
assert(dated.text === `# ${dated.title}`, "body title follows the note name");
const plain = noteFromTemplate(
  { folder: "", name: "daily", path: ".templates/daily.md", text: "x" },
  "Untitled",
);
assert(plain.title === "Untitled", "plain template names stay untitled");
