const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  fenceContext,
  hasLanguageServer,
  rankCompletions,
  shouldComplete,
  wordPrefix,
} from "./lsp";

const note = "intro\n\n```python\nvalue = 1\nva\n```\n\ntail\n";
const caret = note.indexOf("va\n```") + 2;
const context = fenceContext(note, caret);

assert(
  context?.language === "python",
  "the fence language comes from its opening line",
);
assert(
  context?.code === "value = 1\nva",
  "the block source stops before the closing fence",
);
assert(
  context?.line === 1,
  "lines are counted from the first line inside the fence",
);
assert(context?.character === 2, "the character is the column on that line");

assert(fenceContext(note, 2) === null, "text outside a fence has no context");
assert(
  fenceContext(note, note.length - 2) === null,
  "text after the fence has no context",
);
assert(
  fenceContext("```js\nlet a\n", 8)?.code === "let a\n",
  "an unclosed fence still gives its source",
);

assert(hasLanguageServer("ts") === true, "typescript has a server");
assert(
  hasLanguageServer("haskell") === false,
  "unknown languages have no server",
);

assert(
  wordPrefix("value.toUp", 10) === "toUp",
  "the prefix stops at the member access",
);
assert(wordPrefix("value.", 6) === "", "nothing is typed right after a dot");
assert(shouldComplete("value.", 6) === true, "a dot asks for members");
assert(shouldComplete("value ", 6) === false, "a bare space asks for nothing");

const items = [
  { label: "append", detail: "", insert: "append", filter: "append" },
  { label: "pop", detail: "", insert: "pop", filter: "pop" },
  { label: "reap", detail: "", insert: "reap", filter: "reap" },
];
const ranked = rankCompletions(items, "ap");

assert(ranked.length === 2, "only matching completions survive");
assert(
  ranked[0].label === "append",
  "a prefix match sorts ahead of a middle match",
);

console.log("lsp tests passed");
