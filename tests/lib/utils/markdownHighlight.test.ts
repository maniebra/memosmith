const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  highlightEdit,
  highlightedAt,
  renderLine,
} from "../../../src/lib/utils/markdown";

// Highlights: `==text==` plain, `==bg|text==` and `==bg:fg|text==` when
// palette swatches were picked.
const plain = renderLine("say ==big== now");
assert(
  plain.includes('class="md-highlight"') && plain.includes("--chip-bg"),
  "plain highlight renders a coloured span",
);
assert(
  renderLine("say ==green|big== now").includes("==green|"),
  "the colour id stays in the hidden marker",
);
const overridden = renderLine("say ==green:pink|big== now");
assert(
  overridden.includes("--chip-fg: #ec4899") &&
    overridden.includes("--chip-fg-dark: #ec4899"),
  "a picked text colour overrides the fill's own pair",
);
assert(
  !renderLine("a == b == c").includes("md-highlight"),
  "spaced equals are not a highlight",
);

const wrap = highlightEdit("say big now", 4, 7, { bg: "green" });
assert(wrap.edit.text === "==green|big==", "wrapping uses the picked fill");
const recolor = highlightEdit("say ==green|big== now", 4, 17, { bg: "pink" });
assert(recolor.edit.text === "==pink|big==", "an existing highlight recolours");
const textColor = highlightEdit("say ==green|big== now", 4, 17, { fg: "pink" });
assert(
  textColor.edit.text === "==green:pink|big==",
  "a text colour keeps the fill it was added to",
);
const strip = highlightEdit("say ==green|big== now", 4, 17, null);
assert(strip.edit.text === "big", "removing drops both markers");
const stripInside = highlightEdit("say ==green|big== now", 12, 15, null);
assert(
  stripInside.edit.start === 4 && stripInside.edit.text === "big",
  "markers just outside the selection are removed too",
);

// A block selection is highlighted line by line: each line renders on its own.
const block = highlightEdit("- one\n- two", 0, 11, { bg: "green" });
assert(
  block.edit.text === "==green|- one==\n==green|- two==",
  "every line in the selection gets its own markers",
);
assert(
  highlightEdit(block.edit.text, 0, block.edit.text.length, null).edit.text ===
    "- one\n- two",
  "removing a block highlight strips every line",
);
const indented = highlightEdit("  deep\n\n  end", 0, 13, { bg: "green" });
assert(
  indented.edit.text === "  ==green|deep==\n\n  ==green|end==",
  "indentation and blank lines stay outside the markers",
);

assert(
  highlightedAt("say ==green|big== now", 4, 17) &&
    highlightedAt("say ==green|big== now", 12, 15) &&
    !highlightedAt("say big now", 4, 7),
  "a selection knows whether it already sits in a highlight",
);

console.log("markdown highlight ok");
