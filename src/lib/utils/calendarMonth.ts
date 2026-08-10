/** `YYYY-MM-DD` from local date parts, so a day near midnight does not shift a timezone. */
export function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` (or a longer ISO stamp) as a local date; null when it is not one. */
export function dateFromIso(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) {
    return null;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** First of the month a date falls in. */
export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Six weeks starting on the Sunday on or before the first, so every month fills
 * the same grid and no row count jumps as you page through.
 */
export function monthDays(month: Date) {
  const start = startOfMonth(month);
  start.setDate(1 - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function addMonths(month: Date, step: number) {
  return new Date(month.getFullYear(), month.getMonth() + step, 1);
}

/** Localised one-letter-ish weekday headers, Sunday first. */
export function weekdayLabels(locale?: string) {
  return Array.from({ length: 7 }, (_, index) => {
    // 2024-01-07 was a Sunday, so the offsets line up with the grid.
    const date = new Date(2024, 0, 7 + index);
    return date.toLocaleDateString(locale, { weekday: "narrow" });
  });
}
