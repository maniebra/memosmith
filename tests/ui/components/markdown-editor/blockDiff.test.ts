const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import {
  changedSpan,
  skeleton,
} from "../../../../src/ui/components/markdown-editor/blockDiff";

const span = (a: string[], b: string[]) => {
  const { head, tail } = changedSpan(a, b);

  return `${head}/${tail}`;
};

// Enter in the middle: the new block is the only one built.
assert(span(["a", "b"], ["a", "new", "b"]) === "1/1", "block inserted");
assert(span(["a", "new", "b"], ["a", "b"]) === "1/1", "block removed");
assert(span(["a", "b"], ["a", "b", "c"]) === "2/0", "block appended");
assert(span([], ["a"]) === "0/0", "first render");
// Two blocks that render the same never stand in for each other.
assert(span(["a", "x", "a"], ["a", "a"]) === "1/1", "equal blocks stay put");

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
