import { describe, expect, it } from "vitest";

import { enterEdit } from "../../../src/lib/utils/markdownCommands";

describe("enterEdit inside a code fence", () => {
  it("carries the current line's indentation to the new line", () => {
    const value = "```go\npackage routes {\n    [User Route]";
    const edit = enterEdit(value, value.length, true);

    expect(edit.text).toBe("\n    ");
    expect(edit.caret).toBe(value.length + 5);
  });

  it("stays at column zero for an unindented line", () => {
    const value = "```go\npackage routes {";
    const edit = enterEdit(value, value.length, true);

    expect(edit.text).toBe("\n");
  });
});
