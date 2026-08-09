const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { normalizeFontStack } from "./theme.ts";

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

console.log("theme tests passed");
