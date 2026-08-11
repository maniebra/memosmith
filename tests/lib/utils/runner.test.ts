const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  isRunnable,
  kernelFor,
  outputKey,
  parseRunStore,
  runStoreLine,
  RUN_STORE_LINE,
} from "../../../src/lib/utils/runner";

assert(kernelFor("Python") === "python", "language matching ignores case");
assert(kernelFor("ts") === "node", "typescript shares the node kernel");
assert(kernelFor("javascript") === "node", "javascript shares the node kernel");
assert(kernelFor("sh") === "bash", "sh runs on the bash kernel");
assert(kernelFor("kt") === "kotlin", "kt is a kotlin cell");
assert(kernelFor("c++") === "cpp", "c++ spells the same kernel as cpp");
assert(kernelFor("R") === "r", "R is its own kernel");
assert(kernelFor("java") === "java", "java runs on jshell");
assert(kernelFor("rs") === "rust", "rs is a rust cell");
assert(kernelFor("cs") === "csharp", "cs is a csharp cell");
assert(kernelFor("C#") === "csharp", "c# spells the same kernel as csharp");
assert(kernelFor("haskell") === null, "unknown languages are not runnable");
assert(
  isRunnable(" bash ") === true,
  "padding does not hide a runnable language",
);

assert(
  outputKey("python", "x = 1") === outputKey("python", "x = 1"),
  "same cell, same key",
);
assert(
  outputKey("python", "x = 1") !== outputKey("python", "x = 2"),
  "edited cell, new key",
);
assert(
  outputKey("python", "x = 1") !== outputKey("bash", "x = 1"),
  "language is part of the key",
);

const stored = { key: "k1", state: "ok", text: "hi --> there", seconds: 0.5 };
const storeLine = runStoreLine(stored);
const note = `\`\`\`python\nprint(1)\n\`\`\`\n${storeLine}\n${runStoreLine({
  key: "k2",
  state: "error",
  text: "boom",
})}`;

assert(RUN_STORE_LINE.test(storeLine), "a stored line is recognised as one");
assert(
  !storeLine.slice(0, -3).includes("-->"),
  "output text cannot close the comment early",
);

const parsed = parseRunStore<typeof stored>(note);

assert(
  JSON.stringify(parsed.get("k1")) === JSON.stringify(stored),
  "a cell's result survives a round trip through the note",
);
assert(parsed.size === 2, "every cell in the note keeps its own result");
assert(parseRunStore("# note").size === 0, "a note without results stores none");
assert(
  parseRunStore("<!--memosmith:run {oops-->").size === 0,
  "a damaged line loses its results, not the note",
);

console.log("runner tests passed");
