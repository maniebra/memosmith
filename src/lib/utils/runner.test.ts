const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { isRunnable, kernelFor, outputKey } from "./runner";

assert(kernelFor("Python") === "python", "language matching ignores case");
assert(kernelFor("ts") === "node", "typescript shares the node kernel");
assert(kernelFor("javascript") === "node", "javascript shares the node kernel");
assert(kernelFor("sh") === "bash", "sh runs on the bash kernel");
assert(kernelFor("kt") === "kotlin", "kt is a kotlin cell");
assert(kernelFor("c++") === "cpp", "c++ spells the same kernel as cpp");
assert(kernelFor("R") === "r", "R is its own kernel");
assert(kernelFor("java") === "java", "java runs on jshell");
assert(kernelFor("rs") === "rust", "rs is a rust cell");
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

console.log("runner tests passed");
