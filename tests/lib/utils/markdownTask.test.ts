const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { renderLine } from "../../../src/lib/utils/markdown";

// The checkbox is a real node so it can take focus and answer the keyboard.
const open = renderLine("- [ ] milk");
assert(open.includes('class="md-check"'), "open task renders a checkbox node");
assert(open.includes('aria-checked="false"'), "open task is unchecked");
assert(open.includes('tabindex="0"'), "checkbox is focusable");
assert(open.includes("milk"), "task text survives");

const done = renderLine("- [x] milk");
assert(done.includes('aria-checked="true"'), "done task is checked");

assert(!renderLine("- milk").includes("md-check"), "bullets get no checkbox");
assert(!renderLine("# head").includes("md-check"), "headings get no checkbox");

// A checkbox carrying source text would shift every caret offset on the line.
const box = /<span class="md-check"[^>]*><\/span>/.exec(renderLine("- [ ] a"));
assert(box, "checkbox node is empty");

console.log("markdownTask ok");
