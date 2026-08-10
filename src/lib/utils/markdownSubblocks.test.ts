const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  DEFAULT_COLUMN_SUBBLOCKS,
  enterEdit,
  inlineMarkEdit,
  renderDocument,
  serializeColumnSubblocks,
  tabEdit,
} from "./markdown";

const columnBlock = renderDocument(DEFAULT_COLUMN_SUBBLOCKS);
assert(
  columnBlock.includes("md-subblocks-preview"),
  "column subblocks get a rendered preview",
);
assert(
  columnBlock.includes('data-subblock-body="0" contenteditable="true"'),
  "column subblocks are edited from the visual preview",
);
assert(
  columnBlock.includes('data-subblocks="0"'),
  "column subblocks source lines are grouped",
);
const columnSourceLines = columnBlock.match(/md-subblocks-line/g) ?? [];
assert(columnSourceLines.length === 5, "column source lines stay grouped");
assert(
  (columnBlock.match(/data-subblock-index=/g) ?? []).length === 2,
  "column subblock divider splits preview sections",
);
const markdownColumn = renderDocument(
  ":::columns\n# Left\n:::---\n$a^2$\n:::",
);
assert(
  markdownColumn.includes("md-h1") && markdownColumn.includes("md-math-rendered"),
  "column subblocks render markdown",
);
// A column is an editor of its own: fences and block math render inside it.
const richColumn = renderDocument(
  ":::columns\n```py\nx = 1\n```\n:::---\n$$E=mc^2$$\n:::",
);
assert(
  richColumn.includes("md-codeblock"),
  "column subblocks render code blocks",
);
assert(
  richColumn.includes("md-math-preview"),
  "column subblocks render block equations",
);
assert(
  !renderDocument(":::columns\nDraft").includes("md-subblocks-preview"),
  "unclosed column subblocks stay editable source only",
);
assert(
  serializeColumnSubblocks(["Left", "Right"]) ===
    ":::columns\nLeft\n:::---\nRight\n:::",
  "column subblocks serialize back to markdown source",
);
// A nested block keeps its own lines: only the outer divider splits columns.
const nestedColumns = renderDocument(
  ":::columns\nLeft\n:::columns\nA\n:::---\nB\n:::\n:::---\nRight\n:::",
);
assert(
  (nestedColumns.match(/data-subblock-index=/g) ?? []).length === 4,
  "nested columns split inside their own block only",
);
assert(
  (nestedColumns.match(/md-subblocks-line/g) ?? []).length === 15,
  "the outer block closes on its own fence, not the nested one",
);
// A rule is a rule: only ":::---" splits a block that uses the new divider.
assert(
  (
    renderDocument(":::columns\nA\n---\nB\n:::---\nRight\n:::").match(
      /data-subblock-index=/g,
    ) ?? []
  ).length === 2,
  "a plain rule stays inside its column",
);
assert(
  (
    renderDocument(":::columns\nA\n---\nB\n:::").match(
      /data-subblock-index=/g,
    ) ?? []
  ).length === 2,
  "blocks written with the old divider still split",
);
assert(
  enterEdit("- one", 5).text === "\n- ",
  "Enter continues a list",
);
assert(enterEdit("- ", 2).text === "" && enterEdit("- ", 2).start === 0,
  "Enter clears an empty list item");
assert(
  enterEdit("```\ncode", 8, true).text === "\n",
  "Enter inside a fence stays plain",
);
assert(tabEdit("x", 1, false).text === "  ", "Tab indents");
assert(
  tabEdit("  x", 3, true).text === "x" && tabEdit("  x", 3, true).start === 0,
  "Shift+Tab outdents",
);
assert(
  inlineMarkEdit("ab", 0, 2, "**").edit.text === "**ab**",
  "the mark wraps a selection",
);
assert(
  inlineMarkEdit("**ab**", 0, 6, "**").edit.text === "ab",
  "the mark toggles back off",
);

console.log("markdown subblocks ok");
