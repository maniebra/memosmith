const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  normalizeFontStack,
  parseMemoTheme,
} from "../../../src/lib/utils/theme.ts";

assert(
  normalizeFontStack("Vazirmatn, IRANSans, system-ui") ===
    '"Vazirmatn", "IRANSans", system-ui',
  "custom font stacks quote local family names and keep generic families bare",
);

assert(
  normalizeFontStack('"SF Pro Text", Segoe UI, sans-serif') ===
    '"SF Pro Text", "Segoe UI", sans-serif',
  "quoted input is normalized without losing multi-word names",
);

assert(
  normalizeFontStack("Good Font; color:red, Other") === '"Other"',
  "unsafe font-family fragments are dropped",
);

const theme = parseMemoTheme(
  JSON.stringify({
    name: "Nord",
    mode: "dark",
    accent: { "600": "#88c0d0", "601": "#000" },
    neutral: { "900": "#2e3440" },
    variables: { "--ms-editor-line-height": "1.8", color: "red", "--x": "a;b" },
  }),
);
assert(
  JSON.stringify(theme) ===
    JSON.stringify({
      name: "Nord",
      mode: "dark",
      variables: {
        "--color-emerald-600": "#88c0d0",
        "--color-stone-900": "#2e3440",
        "--ms-editor-line-height": "1.8",
      },
    }),
  "memotheme maps shorthands and drops unsafe or non-custom properties",
);
assert(parseMemoTheme("not json") === null, "invalid json is rejected");
assert(
  parseMemoTheme({ name: "Empty" }) === null,
  "themes need at least one variable",
);

console.log("theme tests passed");
