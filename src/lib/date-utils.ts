// ── UTC date helpers ──────────────────────────────────────────────────────────
// All functions use UTC methods to avoid timezone drift when working with dates
// stored as timestamps in SQLite.

/** Add `n` days to a date, returning a new Date. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Return the UTC date portion as a `"YYYY-MM-DD"` string. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Return the `"YYYY-MM-DD"` key for the calendar day after the given date. */
export function nextCalendarDayKey(date: Date): string {
  return toDateKey(addDays(date, 1));
}

// ── Schedule grid helpers ─────────────────────────────────────────────────────

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Return the weekday abbreviation and day-month label for a schedule grid header. */
export function formatDayHeader(date: Date): { weekday: string; label: string } {
  return {
    weekday: DAY_SHORT[date.getUTCDay()]!,
    label: `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`,
  };
}

/** Index a slot array by `"YYYY-MM-DD|mealTime"` for O(1) grid lookups. */
export function indexSlotsByDateAndTime<S extends { date: Date; mealTime: string }>(
  slots: S[],
): Map<string, S> {
  return new Map(slots.map((s) => [`${toDateKey(s.date)}|${s.mealTime}`, s]));
}
