import { enterEdit } from "../../../src/lib/utils/markdownCommands";

const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

const indented = "```go\npackage routes {\n    [User Route]";
const indentedEdit = enterEdit(indented, indented.length, true);

assert(
  indentedEdit.text === "\n    ",
  "enter carries the current line's indentation inside a code fence",
);
assert(
  indentedEdit.caret === indented.length + 5,
  "enter places the caret after the inserted indentation",
);

const unindented = "```go\npackage routes {";
const unindentedEdit = enterEdit(unindented, unindented.length, true);

assert(
  unindentedEdit.text === "\n",
  "enter stays at column zero for an unindented line",
);

console.log("markdown enter indent ok");
