const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { reusePlan, skeleton } from "../../../../src/ui/components/markdown-editor/blockDiff";

const plan = (a: string[], b: string[]) => reusePlan(a, b).join(",");

// A letter typed into one block rebuilds that block and reuses the rest.
assert(plan(["a", "b", "c"], ["a", "bx", "c"]) === "0,-1,2", "one block rebuilt");
assert(plan(["a", "b"], ["a", "b"]) === "0,1", "nothing rebuilt");
// Enter in the middle: the new block is the only one built.
assert(plan(["a", "b"], ["a", "new", "b"]) === "0,-1,1", "block inserted");
assert(plan(["a", "new", "b"], ["a", "b"]) === "0,2", "block removed");
// A moved block keeps its node, so its images and previews survive.
assert(plan(["a", "b", "c"], ["c", "a", "b"]) === "2,0,1", "blocks reordered");
assert(plan([], ["a"]) === "-1", "first render");
// Repeats are matched in order, never twice.
assert(plan(["a", "a"], ["a", "a", "a"]) === "0,1,-1", "repeats matched once");

const skeletonsMatch = (a: string, b: string) => skeleton(a) === skeleton(b);

// Typed characters leave the markup alone, so the live node is kept as it is.
assert(
  skeletonsMatch("<div>hell</div>", "<div>hello</div>"),
  "plain text is not markup",
);
assert(
  skeletonsMatch(
    "<div>a <em>*bold</em> b</div>",
    "<div>ab <em>*bold</em> c</div>",
  ),
  "text around markup is still text",
);
// Markdown that builds an element has to render.
assert(
  !skeletonsMatch("<div>hi *a</div>", "<div>hi <em>*a*</em></div>"),
  "new element renders",
);
assert(
  !skeletonsMatch('<div class="md-p">#</div>', '<div class="md-h1">#</div>'),
  "a changed class renders",
);
