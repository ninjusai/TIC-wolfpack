/**
 * Date utility helpers for PeakProtocol scheduling engine (WRK-012).
 *
 * All dates are represented as YYYY-MM-DD strings (ISO date only, no time).
 * Pure functions — no side effects.
 */

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayName = (typeof DAY_NAMES)[number];

/**
 * Parse a YYYY-MM-DD string into a Date set to midnight UTC.
 * Throws if the format is invalid.
 */
export function parseDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}" — expected YYYY-MM-DD`);
  }
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1; // JS months are 0-indexed
  const day = Number(dayStr);
  const d = new Date(Date.UTC(year, month, day));
  // Verify the date components didn't roll over (e.g. Feb 30 → Mar 2)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    throw new Error(`Invalid date: "${dateStr}" is not a real calendar date`);
  }
  return d;
}

/** Format a Date to YYYY-MM-DD using UTC components. */
export function formatDate(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get the lowercase three-letter day of the week (mon, tue, ..., sun) for a UTC date. */
export function getDayOfWeek(date: Date): DayName {
  // getUTCDay() always returns 0-6, so the index is always valid
  return DAY_NAMES[date.getUTCDay()] as DayName;
}

/** Return a new Date that is `days` days after the given date (UTC). Supports negative values. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Number of whole days between two dates (b − a). Can be negative if a is after b. */
export function dateDiffDays(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  // Round to avoid DST edge cases (we use UTC, but belt-and-suspenders)
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Validate that a string is one of the known day names.
 *
 * Backward-compat: also accepts capitalized variants like "Mon", "Tuesday", etc.
 * that may exist in the DB from earlier broken frontend versions. The lowercase
 * 3-letter form is the canonical storage format.
 */
export function isDayName(value: string): value is DayName {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase().slice(0, 3);
  return (DAY_NAMES as readonly string[]).includes(normalized);
}

/** Normalize any accepted day-name variant to the canonical lowercase 3-letter form. */
export function normalizeDayName(value: string): DayName | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().slice(0, 3);
  return (DAY_NAMES as readonly string[]).includes(normalized)
    ? (normalized as DayName)
    : null;
}
