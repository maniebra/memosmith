const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import {
  addMonths,
  dateFromIso,
  isoDate,
  monthDays,
  startOfMonth,
} from "./calendarMonth";

assert(isoDate(new Date(2026, 0, 5)) === "2026-01-05", "months and days pad");
assert(
  isoDate(new Date(2026, 5, 30, 23, 59)) === "2026-06-30",
  "a late-evening date keeps its local day",
);

assert(dateFromIso("") === null, "an empty value is not a date");
assert(dateFromIso(null) === null, "null is not a date");
assert(dateFromIso("nope") === null, "junk is not a date");
assert(
  isoDate(dateFromIso("2026-03-04T10:00:00.000Z")!) === "2026-03-04",
  "a full timestamp reads back as its own day, not a shifted one",
);
assert(
  isoDate(dateFromIso("2026-03-04")!) === "2026-03-04",
  "a round trip returns the same day",
);

const march = startOfMonth(new Date(2026, 2, 17));
assert(isoDate(march) === "2026-03-01", "startOfMonth lands on the first");
assert(isoDate(addMonths(march, 1)) === "2026-04-01", "next month");
assert(isoDate(addMonths(march, -3)) === "2025-12-01", "back across a year");

const days = monthDays(march);
assert(days.length === 42, "the grid is always six weeks");
assert(days[0].getDay() === 0, "the grid starts on a Sunday");
assert(
  days.some((date) => isoDate(date) === "2026-03-01") &&
    days.some((date) => isoDate(date) === "2026-03-31"),
  "the whole month is in the grid",
);

console.log("calendar month ok");
