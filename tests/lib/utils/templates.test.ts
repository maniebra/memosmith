const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { fillTemplate } from "../../../src/lib/utils/templates";

const now = new Date(2026, 0, 5, 9, 7);
const filled = fillTemplate(
  "# {{title}} {{ date }} {{time}} {{other}}",
  "Plan",
  now,
);
assert(
  filled === "# Plan 2026-01-05 09:07 {{other}}",
  `fillTemplate: ${filled}`,
);
console.log("templates ok");
