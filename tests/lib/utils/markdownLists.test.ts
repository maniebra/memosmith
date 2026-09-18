const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { renderDocument } from "../../../src/lib/utils/markdown";

const listHtml = renderDocument("- a\n- [ ] b\n1. c\n\ntext\n- d");
const listGroups = [...listHtml.matchAll(/data-list="(\d+)"/g)].map(
  (match) => match[1],
);
assert(
  listGroups.join(",") === "1,1,1,2",
  `a list run shares one group, got ${listGroups.join(",")}`,
);
assert(
  !/md-block [^>]*data-list/.test(renderDocument("plain")),
  "plain lines carry no list group",
);
console.log("markdown list grouping ok");
