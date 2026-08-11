const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { matchCommands } from "../../../src/lib/utils/slashMatching";
import { SLASH_COMMANDS } from "../../../src/lib/utils/markdownCommands";

const commands = [
  ...SLASH_COMMANDS.map((command) => ({ ...command, source: command.label })),
  { label: "Database Tasks", hint: "embed", source: "Database" },
];
const labels = (query: string) =>
  matchCommands(commands, query).map((command) => command.label);

assert(
  matchCommands(commands, "").length === commands.length,
  "an empty query keeps every command, in the authored order",
);
assert(
  matchCommands(commands, "   ").length === commands.length,
  "a whitespace query counts as empty",
);

assert(labels("head")[0] === "Heading 1", "a prefix match ranks first");
assert(
  labels("head").length === 3,
  "every heading matches, and nothing else does",
);
assert(labels("h1")[0] === "Heading 1", "an alias finds its command");
assert(labels("h2")[0] === "Heading 2", "aliases are per command");
assert(labels("db")[0] === "Database Tasks", "short aliases work");
assert(
  labels("data")[0] === "Database Tasks",
  "the typed word that started this finds the database embed",
);
assert(labels("todo")[0] === "To-do", "punctuation in a label is not required");
assert(
  labels("list").join() === "Bulleted list,Numbered list",
  "a word match beats nothing else, and keeps the authored order on ties",
);
assert(
  labels("bullet")[0] === "Bulleted list",
  "an alias matches a word inside the label",
);
assert(labels("###")[0] === "Heading 3", "hints match too");
assert(
  labels("nothinglikethis").length === 0,
  "a query matching nothing hides the menu",
);

// Fuzzy is the last resort, so it must not outrank a real match.
assert(labels("tbl")[0] === "Table", "a subsequence still finds its command");
assert(
  labels("code")[0] === "Code",
  "an exact label wins over any fuzzy candidate",
);

console.log("slash matching ok");
