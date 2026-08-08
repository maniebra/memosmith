const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import { applyPrefix, continueList, DEFAULT_TABLE_MARKDOWN, editMarkdownTable, insideFence, isMediaLine, lineClass, mathUnclosed, mediaOptions, renderDocument, renderLine, withMediaOptions } from "./markdown";

assert(lineClass("# Title") === "md-h1", "h1 class");
assert(lineClass("#NoSpace") === "", "hash without space is not a heading");
assert(lineClass("- [x] done") === "md-task md-task-done", "done task before plain task");
assert(lineClass("- [ ] todo") === "md-task", "task before bullet");
assert(lineClass("- item") === "md-bullet", "bullet");
assert(renderLine("# Title").startsWith('<span class="md-mark"># </span>'), "heading marker is hideable");
assert(renderLine("<script>") === "&lt;script&gt;", "escapes html");
assert(renderLine("").includes("&#8203;"), "empty line keeps a caret anchor");
assert(renderLine("# ").includes("&#8203;"), "prefix-only line keeps a caret anchor");
assert(renderLine("a **b** c").includes("md-bold"), "bold");
assert(renderLine("**b**").includes("md-italic") === false, "bold is not re-matched as italic");
assert(renderLine("2 * 3 * 4").includes("md-italic") === false, "no stray italics");
assert(renderLine("[t](u)").includes("md-link"), "link");
assert(renderLine("[[Note]]").includes("md-wikilink"), "wikilink");
assert(renderLine("[[Missing]]", { resolveWikilink: () => ({ path: null, exists: false }) }).includes("md-wikilink-missing"), "missing wikilink");
assert(renderLine("[[Note|Alias]]").includes(">Alias<"), "wikilink alias is visible");
assert(renderLine("area $a^2$").includes("katex"), "inline math renders with katex");
assert(renderLine("area $a^2$").includes("md-math-source"), "inline math keeps editable source");
assert(renderDocument("$$E=mc^2$$").includes("md-math-preview"), "equation block gets a preview");
assert(renderDocument("$$\nE=mc^2\n$$").includes('data-math="0"'), "multiline equation block is grouped");
assert(!renderDocument("$$").includes("md-preview"), "bare equation opener has nothing to preview");
assert(!renderDocument("$$\nx").includes("data-closed"), "unclosed math keeps its source visible");
assert(!renderDocument("$$E=mc^2$$").includes("<img"), "math does not render as images");

// The caret maps by counting source blocks, so previews must never be counted as lines.
const sourceBlocks = (text: string) =>
  (renderDocument(text).match(/<div class="md-block/g) ?? []).length;
assert(sourceBlocks("$$\nE=mc^2\n$$") === 3, "closed math is exactly its three source lines");
assert(sourceBlocks("a\n$$\nx\n\ny\n$$\nb") === 7, "preview does not add a line");
assert(mathUnclosed("$$\nx"), "lone opener is unclosed");
assert(!mathUnclosed("$$\nx\n$$"), "paired openers are closed");
assert(renderDocument("a\nb").split("<div").length === 3, "one block per line");
assert(renderDocument("  - x").includes("padding-left:1.5rem"), "indent becomes padding");
const table = renderDocument("| Name | Count |\n| --- | ---: |\n| **Tea** | 2 |");
assert(table.includes('<table class="md-table">'), "table gets a rendered preview");
assert(table.includes(">Name</th>"), "table header renders");
assert(table.includes("text-align:right"), "table alignment renders");
assert(table.includes("md-bold"), "table cells render inline markdown");
assert(sourceBlocks("| Name | Count |\n| --- | ---: |\n| Tea | 2 |") === 3, "table source lines remain editable blocks");
assert(
  renderDocument("| Code | Value |\n| --- | --- |\n| `a|b` | x \\| y |").match(/<td/g)?.length === 2,
  "table parser ignores pipes in code and escaped pipes",
);
assert(renderDocument(DEFAULT_TABLE_MARKDOWN).includes("md-table-tools"), "default table renders editing tools");
assert(renderDocument(DEFAULT_TABLE_MARKDOWN).includes("md-table-tools-shell"), "table tools render inside a toolbar shell");
assert(renderDocument(DEFAULT_TABLE_MARKDOWN).includes("md-table-scroll"), "table body has a separate scroll area");
assert(
  renderDocument(DEFAULT_TABLE_MARKDOWN, undefined, { fancyTableEditor: false }).includes("md-table-preview"),
  "table preview still renders when the fancy editor is disabled",
);
assert(
  !renderDocument(DEFAULT_TABLE_MARKDOWN, undefined, { fancyTableEditor: false }).includes("md-table-tools-shell"),
  "disabled fancy table editor skips only the toolbar",
);
const editedCell = editMarkdownTable(DEFAULT_TABLE_MARKDOWN, { type: "set-cell-text", row: 1, column: 0, text: "Hello" });
assert(editedCell.includes("| Hello |"), "table cell text edits serialize");
assert(editMarkdownTable(DEFAULT_TABLE_MARKDOWN, { type: "insert-column", column: 0 }).split("\n")[0].split("|").length === 5, "table column insertion serializes");
const coloredCell = editMarkdownTable(DEFAULT_TABLE_MARKDOWN, {
  type: "set-cell-background",
  row: 1,
  column: 0,
  background: "#fef3c7",
});
assert(coloredCell.includes("bg=#fef3c7"), "table cell color serializes");
const mergedCell = editMarkdownTable(DEFAULT_TABLE_MARKDOWN, { type: "merge-right", row: 1, column: 0 });
assert(mergedCell.includes("colspan=2") && mergedCell.includes("covered"), "merged table cells serialize metadata");
assert(renderDocument(mergedCell).includes("colspan=\"2\""), "merged table cells render colspan");
assert(editMarkdownTable(mergedCell, { type: "split-cell", row: 1, column: 0 }).includes("covered") === false, "split table cells clear merge metadata");
assert(continueList("- item") === "- ", "bullet continues");
assert(continueList("  3. item") === "  4. ", "ordinal increments");
assert(continueList("- [x] done") === "- [ ] ", "task resets");
assert(continueList("- ") === "", "empty bullet stops");
assert(continueList("plain") === "", "plain line");
assert(applyPrefix("- old", "## ") === "## old", "prefix replaces prefix");
assert(applyPrefix("plain", "> ") === "> plain", "prefix on plain line");
assert(applyPrefix("# h", "") === "h", "Text command clears prefix");

const fenced = renderDocument("a\n```js\nconst x = **1**;\n```\nb");
assert(fenced.includes("md-fence-open") && fenced.includes("md-fence-close"), "fences are distinguishable");
assert(fenced.includes("hljs-keyword"), "code is highlighted with the fence language");
assert(fenced.includes("md-codeblock"), "lines inside a fence are code");
assert(!fenced.includes("md-bold"), "code block content is not inline-rendered");
assert(renderDocument("```\na").includes("md-codeblock"), "unclosed fence runs to the end");
assert(renderDocument("```\na").includes("hljs") === false, "no language means no highlighting");
assert(renderDocument("```js\na\n```\n```js\nb\n```").split("md-fence-open").length === 3, "fences pair up");
assert(!renderDocument("a\nb").includes("md-codeblock"), "no fence, no code block");

console.log("markdown ok");

assert(insideFence("```js\na"), "unclosed fence is inside");
assert(!insideFence("```js\na\n```\n"), "closed fence is outside");
assert(renderDocument("```js\na\n```\n```\nb\n```").includes('data-code="1"'), "code blocks are grouped");

assert(isMediaLine("![a.png](assets/images/a.png)"), "image line is media");
assert(!isMediaLine("text ![a](b) tail"), "inline image is not a media line");
assert(mediaOptions("![a|center|300](x.png)").width === 300, "width option parsed");
assert(mediaOptions("![a|center|300](x.png)").align === "center", "align option parsed");
assert(withMediaOptions("![a](x.png)", { width: 200 }) === "![a|200](x.png)", "width added");
assert(withMediaOptions("![a|200](x.png)", { align: "right" }) === "![a|right|200](x.png)", "align added, width kept");
assert(withMediaOptions("![a|left|200](x.png)", { width: 50 }) === "![a|left|50](x.png)", "width replaced");
assert(withMediaOptions("plain", { width: 50 }) === "plain", "non-media line untouched");
assert(renderDocument("![a|center|300](x.png)", (s) => s).includes("width:300px"), "preview uses the width option");
assert(renderDocument("![a](x.png)", (s) => s).includes("md-resize"), "image preview gets a resize handle");

const drawing = renderDocument('```excalidraw\n{"elements":[]}\n```', undefined, { drawings: true });
assert(drawing.includes("md-drawing-preview"), "drawing fence gets a preview card");
assert((drawing.match(/md-drawing-line/g) ?? []).length === 3, "fences and scene line are collapsed");
assert(
  !renderDocument('```excalidraw\n{}\n```').includes("md-drawing"),
  "drawing block stays a plain code block while the feature is off",
);
assert(
  !renderDocument("```js\nlet a\n```", undefined, { drawings: true }).includes("md-drawing"),
  "other languages are untouched",
);

const diagram = renderDocument('```drawio\n{"xml":"","svg":""}\n```', undefined, { diagrams: true });
assert(diagram.includes("md-diagram-preview"), "drawio fence gets a preview card");
assert((diagram.match(/md-diagram-line/g) ?? []).length === 3, "diagram fences and source are collapsed");
assert(
  !renderDocument('```drawio\n{}\n```').includes("md-diagram"),
  "diagram block stays a plain code block while the feature is off",
);
assert(
  renderDocument('```drawio\n{}\n```\n\n```js\nlet a\n```', undefined, { diagrams: true }).includes("md-codeblock"),
  "a code block after a diagram block is still code",
);
