const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { cleanPageMeta, parsePageIcon } from "../../../src/lib/utils/pageMeta";
assert(
  parsePageIcon("lucide:chart-pie")?.value === "ChartPie",
  "lucide names parse from kebab case",
);
assert(parsePageIcon("🚀")?.type === "emoji", "emoji falls through");

assert(
  cleanPageMeta({ cover: "a.png", coverPosition: 140 }).coverPosition === 100,
  "cover position clamps to 100",
);
assert(
  cleanPageMeta({ cover: "a.png", coverPosition: -5 }).coverPosition === 0,
  "cover position clamps to 0",
);
assert(
  cleanPageMeta({ coverPosition: 30 }).coverPosition === undefined,
  "position without a cover is dropped",
);

console.log("page meta ok");
