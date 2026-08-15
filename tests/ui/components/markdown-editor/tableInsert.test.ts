const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { DEFAULT_TABLE_MARKDOWN } from "../../../../src/lib/utils/markdown";
import { createSlash } from "../../../../src/ui/components/markdown-editor/slash";
import type {
  Editor,
  EditorUi,
} from "../../../../src/ui/components/markdown-editor/types";

(globalThis as unknown as { getSelection: () => null }).getSelection = () =>
  null;

/** Runs the table command with the caret at the end of `value`. */
function insertTable(value: string) {
  const ui = { slashStart: value.length, slashQuery: "" } as EditorUi;
  let result = value;
  const editor = {
    ui,
    value,
    caretOffset: () => value.length,
    blockAtOffset: () => undefined,
    selectionOffsets: () => null,
    subblockBodyForNode: () => null,
    replace: (start: number, end: number, text: string) => {
      result = value.slice(0, start) + text + value.slice(end);
    },
  } as unknown as Editor;

  createSlash(editor).runCommand(DEFAULT_TABLE_MARKDOWN);
  return result;
}

assert(
  insertTable("/") === DEFAULT_TABLE_MARKDOWN,
  "a table on the first line is inserted as is",
);

assert(
  insertTable("| a | b |\n| --- | --- |\n| 1 | 2 |\n/") ===
    `| a | b |\n| --- | --- |\n| 1 | 2 |\n\n${DEFAULT_TABLE_MARKDOWN}`,
  "a table right under another one is separated by a blank line",
);

assert(
  insertTable("text\n\n/") === `text\n\n${DEFAULT_TABLE_MARKDOWN}`,
  "an already blank line above adds no second one",
);

console.log("table insert ok");
