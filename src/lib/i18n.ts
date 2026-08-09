import { derived, writable } from "svelte/store";
import { en, type I18nKey } from "./locales/en";
import { fa } from "./locales/fa";

export type { I18nKey } from "./locales/en";

export type Locale = "en" | "fa";
export type TextDirection = "ltr" | "rtl";

export const localeOptions: { label: string; value: Locale }[] = [
  { label: "English", value: "en" },
  { label: "فارسی", value: "fa" },
];

export const rtlLocales = new Set<Locale>(["fa"]);

const dictionaries = { en, fa } satisfies Record<
  Locale,
  Record<I18nKey, string>
>;
let activeLocale: Locale = "en";

export const locale = writable<Locale>("en");

locale.subscribe((nextLocale) => {
  activeLocale = nextLocale;
});

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fa";
}

export function directionForLocale(nextLocale: Locale): TextDirection {
  return rtlLocales.has(nextLocale) ? "rtl" : "ltr";
}

function format(
  template: string,
  values: Record<string, string | number> = {},
) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match,
  );
}

export function translate(
  key: I18nKey,
  values?: Record<string, string | number>,
  nextLocale = activeLocale,
) {
  return format(dictionaries[nextLocale][key] ?? dictionaries.en[key], values);
}

export const i18n = derived(locale, ($locale) => ({
  locale: $locale,
  dir: directionForLocale($locale),
  t: (key: I18nKey, values?: Record<string, string | number>) =>
    translate(key, values, $locale),
}));
