const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { shortcutKey } from "../../../src/lib/utils/shortcutKey";

const persian = { key: "ش", code: "KeyW" } as KeyboardEvent;
const latin = { key: "w", code: "KeyW" } as KeyboardEvent;
const comma = { key: ",", code: "Comma" } as KeyboardEvent;
const noCode = { key: "W", code: "" } as KeyboardEvent;

assert(shortcutKey(persian) === "w", "persian layout maps to the physical key");
assert(shortcutKey(latin) === "w", "latin layout unchanged");
assert(shortcutKey(comma) === ",", "non-letter keys fall back to key");
assert(shortcutKey(noCode) === "w", "missing code falls back to key");

console.log("shortcut key ok");
