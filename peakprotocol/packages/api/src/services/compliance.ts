/**
 * Supplement compliance calculation service for PeakProtocol (WRK-015).
 *
 * Pure functions -- no D1 access, no side effects.
 * Routes handle data fetching; this module matches scheduled occurrences
 * against supplement logs and computes compliance metrics.
 */

import type { ScheduleOccurrence } from "./scheduler";

// ── Types ──────────────────────────────────────────────────────────────

/** Raw row shape for supplement_logs from D1. */
export interface SupplementLogRow {
  id: string;
  supplement_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  taken_at: string | null;
  actual_dose: string | null;
  skipped: number;
  notes: string | null;
}

export interface ComplianceItem {
  supplementId: string;
  supplementName: string;
  scheduledDate: string;
  timeOfDay: string;
  status: "taken" | "missed" | "skipped" | "pending";
  takenAt: string | null;
}

export interface ComplianceSummary {
  date: string;
  totalScheduled: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  completionRate: number; // 0-100 percentage, 1 decimal
  items: ComplianceItem[];
}

export interface StreakInfo {
  current: number; // consecutive days with 100% compliance
  longest: number; // all-time longest streak
  lastPerfectDate: string | null;
}

// ── Time-of-day cutoffs (UTC hours) ───────────────────────────────────

/**
 * Map timeOfDay labels to the UTC hour after which a dose is considered
 * missed if not yet logged on the current day.
 *
 * morning  -> 12:00 UTC
 * with_food -> 14:00 UTC
 * evening  -> 22:00 UTC
 * anytime  -> 23:59 UTC (end of day)
 */
const TIME_CUTOFFS: Record<string, number> = {
  morning: 12,
  with_food: 14,
  evening: 22,
  anytime: 24,
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Build a lookup key for matching occurrences to logs. */
function logKey(supplementId: string, scheduledDate: string): string {
  return `${supplementId}::${scheduledDate}`;
}

/**
 * Determine the status of a single occurrence given its matching log
 * (if any), the occurrence date, and the current moment.
 */
function resolveStatus(
  occurrence: ScheduleOccurrence,
  log: SupplementLogRow | undefined,
  dateStr: string,
  now: Date,
): { status: ComplianceItem["status"]; takenAt: string | null } {
  if (log) {
    if (log.skipped === 1) {
      return { status: "skipped", takenAt: null };
    }
    if (log.taken_at) {
      return { status: "taken", takenAt: log.taken_at };
    }
  }

  // No matching log -- decide between pending and missed.
  const todayStr = formatUTCDate(now);

  if (dateStr < todayStr) {
    // Date is in the past -- missed.
    return { status: "missed", takenAt: null };
  }

  if (dateStr > todayStr) {
    // Date is in the future -- pending.
    return { status: "pending", takenAt: null };
  }

  // Date is today -- check time-of-day cutoff.
  const cutoffHour = TIME_CUTOFFS[occurrence.timeOfDay] ?? 24;
  const currentHour = now.getUTCHours();

  if (currentHour >= cutoffHour) {
    return { status: "missed", takenAt: null };
  }

  return { status: "pending", takenAt: null };
}

/** Format a Date to YYYY-MM-DD using UTC. */
function formatUTCDate(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Round a number to 1 decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Core functions ─────────────────────────────────────────────────────

/**
 * Calculate compliance for a single day.
 *
 * @param occurrences - All scheduled occurrences (may span multiple days; filtered internally).
 * @param logs        - All relevant supplement log rows.
 * @param date        - The target date (YYYY-MM-DD).
 * @param now         - Current time, used for pending/missed determination.
 */
export function calculateDailyCompliance(
  occurrences: ScheduleOccurrence[],
  logs: SupplementLogRow[],
  date: string,
  now: Date,
): ComplianceSummary {
  // Filter occurrences to the target date.
  const dayOccurrences = occurrences.filter((o) => o.date === date);

  // Index logs by (supplement_id, scheduled_date).
  const logMap = new Map<string, SupplementLogRow>();
  for (const log of logs) {
    const key = logKey(log.supplement_id, log.scheduled_date);
    // If duplicate logs exist, prefer one with taken_at set.
    const existing = logMap.get(key);
    if (!existing || (log.taken_at && !existing.taken_at)) {
      logMap.set(key, log);
    }
  }

  const items: ComplianceItem[] = [];
  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let pending = 0;

  for (const occ of dayOccurrences) {
    const key = logKey(occ.supplementId, occ.date);
    const matchingLog = logMap.get(key);
    const { status, takenAt } = resolveStatus(occ, matchingLog, date, now);

    items.push({
      supplementId: occ.supplementId,
      supplementName: occ.supplementName,
      scheduledDate: occ.date,
      timeOfDay: occ.timeOfDay,
      status,
      takenAt,
    });

    switch (status) {
      case "taken":
        taken++;
        break;
      case "missed":
        missed++;
        break;
      case "skipped":
        skipped++;
        break;
      case "pending":
        pending++;
        break;
    }
  }

  const totalScheduled = dayOccurrences.length;
  const completionRate =
    totalScheduled > 0 ? round1((taken / totalScheduled) * 100) : 0;

  return {
    date,
    totalScheduled,
    taken,
    missed,
    skipped,
    pending,
    completionRate,
    items,
  };
}

/**
 * Calculate compliance over a date range (inclusive).
 *
 * @param occurrences - All scheduled occurrences spanning the range.
 * @param logs        - All relevant supplement log rows for the range.
 * @param startDate   - Range start (YYYY-MM-DD).
 * @param endDate     - Range end (YYYY-MM-DD).
 * @param now         - Current time.
 */
export function calculateRangeCompliance(
  occurrences: ScheduleOccurrence[],
  logs: SupplementLogRow[],
  startDate: string,
  endDate: string,
  now: Date,
): ComplianceSummary[] {
  const summaries: ComplianceSummary[] = [];

  // Iterate day by day from startDate to endDate.
  let cursor = startDate;
  while (cursor <= endDate) {
    summaries.push(calculateDailyCompliance(occurrences, logs, cursor, now));
    cursor = nextDay(cursor);
  }

  return summaries;
}

/**
 * Calculate streak information from an array of daily summaries.
 * Summaries MUST be sorted in ascending date order.
 *
 * A "perfect day" is one where completionRate === 100 and totalScheduled > 0.
 * Days with zero scheduled supplements are ignored (neither break nor extend streaks).
 */
export function calculateStreak(dailySummaries: ComplianceSummary[]): StreakInfo {
  let current = 0;
  let longest = 0;
  let lastPerfectDate: string | null = null;
  let tempStreak = 0;

  for (const day of dailySummaries) {
    // Skip days with nothing scheduled -- they don't affect streaks.
    if (day.totalScheduled === 0) {
      continue;
    }

    if (day.completionRate === 100) {
      tempStreak++;
      lastPerfectDate = day.date;
      if (tempStreak > longest) {
        longest = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // The current streak is the tempStreak at the end of the array,
  // since summaries are sorted ascending and the last entries are the most recent.
  current = tempStreak;

  return { current, longest, lastPerfectDate };
}

// ── Internal date helper ──────────────────────────────────────────────

/** Advance a YYYY-MM-DD string by one day. */
function nextDay(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return formatUTCDate(date);
}
