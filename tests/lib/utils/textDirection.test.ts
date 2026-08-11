const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { preferredTextDirection } from "../../../src/lib/utils/textDirection.ts";

assert(
  preferredTextDirection("UML درسنامه") === "rtl",
  "mixed Latin and Farsi prefers rtl",
);
assert(preferredTextDirection("نکته") === "rtl", "Farsi prefers rtl");
assert(preferredTextDirection("Heads up") === "ltr", "English stays ltr");
assert(preferredTextDirection("") === "ltr", "empty text falls back to ltr");

console.log("textDirection ok");
