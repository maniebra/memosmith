import type { FormulaValue } from "./formula";

function toNumber(value: FormulaValue) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toText(value: FormulaValue) {
  return value === null || value === undefined ? "" : String(value);
}

function truthy(value: FormulaValue) {
  return !(
    value === null ||
    value === undefined ||
    value === false ||
    value === "" ||
    value === 0
  );
}

function dateOf(value: FormulaValue) {
  const date = new Date(toText(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY = 86_400_000;

const functions: Record<string, (args: FormulaValue[]) => FormulaValue> = {
  if: ([test, whenTrue = null, whenFalse = null]) =>
    truthy(test) ? whenTrue : whenFalse,
  not: ([value]) => !truthy(value),
  and: (args) => args.every(truthy),
  or: (args) => args.some(truthy),
  empty: ([value]) => !truthy(value),
  concat: (args) => args.map(toText).join(""),
  join: ([separator, ...rest]) => rest.map(toText).join(toText(separator)),
  length: ([value]) => toText(value).length,
  lower: ([value]) => toText(value).toLowerCase(),
  upper: ([value]) => toText(value).toUpperCase(),
  trim: ([value]) => toText(value).trim(),
  contains: ([haystack, needle]) => toText(haystack).includes(toText(needle)),
  replace: ([value, from, to]) =>
    toText(value).split(toText(from)).join(toText(to)),
  slice: ([value, start, end]) =>
    toText(value).slice(
      toNumber(start),
      end === undefined ? undefined : toNumber(end),
    ),
  number: ([value]) => toNumber(value),
  text: ([value]) => toText(value),
  round: ([value, digits]) => {
    const factor = 10 ** toNumber(digits ?? 0);
    return Math.round(toNumber(value) * factor) / factor;
  },
  floor: ([value]) => Math.floor(toNumber(value)),
  ceil: ([value]) => Math.ceil(toNumber(value)),
  abs: ([value]) => Math.abs(toNumber(value)),
  sqrt: ([value]) => Math.sqrt(toNumber(value)),
  pow: ([value, exponent]) => toNumber(value) ** toNumber(exponent),
  min: (args) => Math.min(...args.map(toNumber)),
  max: (args) => Math.max(...args.map(toNumber)),
  now: () => new Date().toISOString().slice(0, 10),
  year: ([value]) => dateOf(value)?.getFullYear() ?? 0,
  month: ([value]) => (dateOf(value)?.getMonth() ?? -1) + 1,
  day: ([value]) => dateOf(value)?.getDate() ?? 0,
  /** Whole days from the first date to the second; negative when it is earlier. */
  datediff: ([from, to]) => {
    const start = dateOf(from);
    const end = dateOf(to);
    return start && end
      ? Math.round((end.getTime() - start.getTime()) / DAY)
      : 0;
  },
  dateadd: ([value, days]) => {
    const date = dateOf(value);
    if (!date) {
      return null;
    }
    date.setDate(date.getDate() + toNumber(days));
    return date.toISOString().slice(0, 10);
  },
};

export { functions, toNumber, toText, truthy };
