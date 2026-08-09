export type StrongTextDirection = "ltr" | "rtl";

const RTL_SCRIPT = /[\u0591-\u07ff\ufb1d-\ufdfd\ufe70-\ufefc]/;

export function preferredTextDirection(text: string): StrongTextDirection {
  return RTL_SCRIPT.test(text) ? "rtl" : "ltr";
}
