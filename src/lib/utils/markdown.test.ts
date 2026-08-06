const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import { continueList, lineClass, renderDocument, renderLine } from "./markdown";

assert(lineClass("# Title").includes("text-3xl"), "h1 class");
assert(lineClass("#NoSpace") === "", "hash without space is not a heading");
assert(lineClass("> quote").includes("border-l-2"), "quote class");
assert(renderLine("<script>") === "&lt;script&gt;", "escapes html");
assert(renderLine("").includes("br"), "empty line keeps height");
assert(renderLine("a **b** c").includes("font-bold"), "bold");
assert(renderLine("2 * 3 * 4").includes("italic") === false, "no stray italics");
assert(renderDocument("a\nb").split("<div").length === 3, "one block per line");
assert(continueList("- item") === "- ", "bullet continues");
assert(continueList("  3. item") === "  4. ", "ordinal increments");
assert(continueList("- [x] done") === "- [ ] ", "task resets");
assert(continueList("- ") === "", "empty bullet stops");
assert(continueList("plain") === "", "plain line");
console.log("markdown ok");
