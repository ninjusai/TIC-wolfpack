/**
 * Supplement scheduling engine for PeakProtocol (WRK-012).
 *
 * Pure functions — no D1 access, no side effects.
 * All dates as YYYY-MM-DD strings.
 */

import {
  parseDate,
  formatDate,
  getDayOfWeek,
  addDays,
  dateDiffDays,
  isDayName,
  normalizeDayName,
  type DayName,
} from "../lib/dates";

// ── Types ──────────────────────────────────────────────────────────────

export interface ScheduleOccurrence {
  date: string;            // YYYY-MM-DD
  timeOfDay: string;       // morning, evening, with_food, anytime
  supplementId: string;
  supplementName: string;
}

/** The subset of Supplement data the scheduler needs. */
export interface SchedulableSupplement {
  id: string;
  name: string;
  scheduleType: string;
  scheduleValue: unknown;
  timeOfDay: string;
  active: boolean;
  createdAt?: string;      // ISO datetime — used as fallback start for every_n_days
}

// ── Schedule value shapes ──────────────────────────────────────────────

interface EveryNDaysValue {
  n: number;
  startDate?: string;
}

interface WeeklyValue {
  day: string;
}

interface SpecificDaysValue {
  days: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function isEveryNDaysValue(v: unknown): v is EveryNDaysValue {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  // Accept both { n: 3 } (correct) and legacy { every_n_days: 3 } format
  const n = typeof obj.n === "number" ? obj.n : typeof obj.every_n_days === "number" ? obj.every_n_days : 0;
  if (n > 0 && typeof obj.n !== "number") (obj as Record<string, unknown>).n = n;
  return n > 0;
}

function isWeeklyValue(v: unknown): v is WeeklyValue {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.day === "string" && isDayName(obj.day);
}

function isSpecificDaysValue(v: unknown): v is SpecificDaysValue {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return Array.isArray(obj.days) && obj.days.every((d) => typeof d === "string" && isDayName(d));
}

/**
 * Extract just the YYYY-MM-DD portion from an ISO datetime string.
 * Falls back to today if the input is unusable.
 */
function extractDatePart(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? fallback;
}

// ── Core functions ─────────────────────────────────────────────────────

/**
 * Get all scheduled occurrences for a supplement within [startDate, endDate] (inclusive).
 */
export function getOccurrences(
  supplement: SchedulableSupplement,
  startDate: string,
  endDate: string,
): ScheduleOccurrence[] {
  if (!supplement.active) return [];
  if (!supplement.scheduleType || !supplement.timeOfDay) return [];

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start > end) return [];

  const occurrences: ScheduleOccurrence[] = [];
  // Normalize timeOfDay for backward compat with any legacy capitalized values
  // ("Morning" → "morning", "With Food" → "with_food").
  const rawTime = (supplement.timeOfDay ?? "").toLowerCase().replace(/\s+/g, "_");
  const timeOfDay = ["morning", "evening", "with_food", "anytime"].includes(rawTime)
    ? rawTime
    : supplement.timeOfDay;
  const id = supplement.id;
  const name = supplement.name;

  switch (supplement.scheduleType) {
    case "daily": {
      let cursor = start;
      while (cursor <= end) {
        occurrences.push({ date: formatDate(cursor), timeOfDay, supplementId: id, supplementName: name });
        cursor = addDays(cursor, 1);
      }
      break;
    }

    case "every_n_days": {
      if (!isEveryNDaysValue(supplement.scheduleValue)) break;
      const { n, startDate: anchorStr } = supplement.scheduleValue;
      const anchor = parseDate(
        anchorStr ?? extractDatePart(supplement.createdAt, startDate),
      );

      // Find first occurrence on or after `start`
      const daysSinceAnchor = dateDiffDays(anchor, start);
      let offset: number;
      if (daysSinceAnchor < 0) {
        // start is before anchor — first occurrence is anchor itself (if in range)
        offset = dateDiffDays(start, anchor);
      } else {
        const remainder = daysSinceAnchor % n;
        offset = remainder === 0 ? 0 : n - remainder;
      }

      let cursor = addDays(start, offset);
      while (cursor <= end) {
        occurrences.push({ date: formatDate(cursor), timeOfDay, supplementId: id, supplementName: name });
        cursor = addDays(cursor, n);
      }
      break;
    }

    case "weekly": {
      if (!isWeeklyValue(supplement.scheduleValue)) break;
      const targetDay = normalizeDayName(supplement.scheduleValue.day) as DayName | null;
      if (!targetDay) break;

      let cursor = start;
      while (cursor <= end) {
        if (getDayOfWeek(cursor) === targetDay) {
          occurrences.push({ date: formatDate(cursor), timeOfDay, supplementId: id, supplementName: name });
        }
        cursor = addDays(cursor, 1);
      }
      break;
    }

    case "specific_days": {
      if (!isSpecificDaysValue(supplement.scheduleValue)) break;
      const targetDays = new Set<string>(
        supplement.scheduleValue.days
          .map((d) => normalizeDayName(d))
          .filter((d): d is DayName => d !== null),
      );

      let cursor = start;
      while (cursor <= end) {
        if (targetDays.has(getDayOfWeek(cursor))) {
          occurrences.push({ date: formatDate(cursor), timeOfDay, supplementId: id, supplementName: name });
        }
        cursor = addDays(cursor, 1);
      }
      break;
    }

    default:
      // Unknown schedule type — return nothing
      break;
  }

  return occurrences;
}

/**
 * Get today's schedule for a list of supplements.
 * Combines and sorts by timeOfDay priority: morning → with_food → evening → anytime.
 */
export function getTodaySchedule(
  supplements: SchedulableSupplement[],
  today?: string,
): ScheduleOccurrence[] {
  const dateStr = today ?? formatDate(new Date());
  const all: ScheduleOccurrence[] = [];

  for (const supp of supplements) {
    const hits = getOccurrences(supp, dateStr, dateStr);
    all.push(...hits);
  }

  const ORDER: Record<string, number> = { morning: 0, with_food: 1, evening: 2, anytime: 3 };
  all.sort((a, b) => (ORDER[a.timeOfDay] ?? 9) - (ORDER[b.timeOfDay] ?? 9));

  return all;
}

/**
 * Get the next `count` occurrences for a single supplement starting from `fromDate`.
 * Useful for calendar preview.
 */
export function getNextOccurrences(
  supplement: SchedulableSupplement,
  count: number,
  fromDate?: string,
): ScheduleOccurrence[] {
  if (!supplement.active || count <= 0) return [];

  const start = fromDate ?? formatDate(new Date());
  const results: ScheduleOccurrence[] = [];

  // Search in expanding windows to avoid scanning too far at once.
  // Start with 30 days, double each iteration.
  let windowDays = 30;
  let windowStart = start;

  while (results.length < count && windowDays <= 3650) {
    const windowEnd = formatDate(addDays(parseDate(windowStart), windowDays - 1));
    const batch = getOccurrences(supplement, windowStart, windowEnd);

    for (const occ of batch) {
      if (results.length >= count) break;
      results.push(occ);
    }

    if (results.length < count) {
      // Move window forward
      windowStart = formatDate(addDays(parseDate(windowEnd), 1));
      windowDays *= 2;
    }
  }

  return results;
}
