/**
 * Unit tests for compliance calculation service.
 * Covers EVL-01: Dashboard compliance indicator (missed supplements).
 * Covers EVL-02: Compliance rate calculation accuracy.
 * Covers EVL-02a: Edge case — supplement with no scheduled time (all complete).
 * Covers EVL-02b: Edge case — all supplements taken.
 *
 * Pure function tests — no server required.
 */
import { describe, it, expect } from "vitest";
import {
  calculateDailyCompliance,
  calculateRangeCompliance,
  calculateStreak,
  type SupplementLogRow,
  type ComplianceSummary,
} from "@api/services/compliance";
import type { ScheduleOccurrence } from "@api/services/scheduler";

// ── Helpers ─────────────────────────────────────────────────────────

function makeOccurrence(overrides: Partial<ScheduleOccurrence> = {}): ScheduleOccurrence {
  return {
    date: "2026-04-01",
    timeOfDay: "morning",
    supplementId: "supp-001",
    supplementName: "Vitamin D",
    ...overrides,
  };
}

function makeLog(overrides: Partial<SupplementLogRow> = {}): SupplementLogRow {
  return {
    id: "log-001",
    supplement_id: "supp-001",
    scheduled_date: "2026-04-01",
    scheduled_time: null,
    taken_at: "2026-04-01T08:30:00Z",
    actual_dose: null,
    skipped: 0,
    notes: null,
    ...overrides,
  };
}

// ── EVL-01: Dashboard shows red indicator for missed supplements ────

describe("EVL-01: Missed Supplement Compliance Indicator", () => {
  it("marks a supplement as missed when scheduled time has passed with no log", () => {
    const occurrences = [
      makeOccurrence({
        supplementId: "supp-vd",
        supplementName: "Vitamin D",
        timeOfDay: "morning",
        date: "2026-04-01",
      }),
    ];
    const logs: SupplementLogRow[] = []; // No logs — supplement was not taken
    const now = new Date("2026-04-01T14:00:00Z"); // 2pm UTC — past morning cutoff (12:00)

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.missed).toBe(1);
    expect(result.items[0]!.status).toBe("missed");
    expect(result.items[0]!.supplementName).toBe("Vitamin D");
    expect(
      result.completionRate,
      "Completion rate should be 0% when all supplements are missed",
    ).toBe(0);
  });

  it("marks a supplement as pending when it is still before the cutoff time", () => {
    const occurrences = [
      makeOccurrence({ timeOfDay: "evening", date: "2026-04-01" }),
    ];
    const logs: SupplementLogRow[] = [];
    const now = new Date("2026-04-01T10:00:00Z"); // 10am — before evening cutoff (22:00)

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.pending).toBe(1);
    expect(result.items[0]!.status).toBe("pending");
  });
});

// ── EVL-02: Compliance rate calculation accuracy ────────────────────

describe("EVL-02: Compliance Rate Calculation", () => {
  it("calculates 100% when all scheduled supplements are taken", () => {
    const occurrences = [
      makeOccurrence({ supplementId: "s1", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s2", supplementName: "Omega-3", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s3", supplementName: "Creatine", date: "2026-04-01" }),
    ];
    const logs = [
      makeLog({ supplement_id: "s1", scheduled_date: "2026-04-01" }),
      makeLog({ id: "log-002", supplement_id: "s2", scheduled_date: "2026-04-01" }),
      makeLog({ id: "log-003", supplement_id: "s3", scheduled_date: "2026-04-01" }),
    ];
    const now = new Date("2026-04-02T00:00:00Z"); // Next day

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.completionRate).toBe(100);
    expect(result.taken).toBe(3);
    expect(result.missed).toBe(0);
  });

  it("calculates partial compliance correctly (2 of 3 taken = 66.7%)", () => {
    const occurrences = [
      makeOccurrence({ supplementId: "s1", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s2", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s3", date: "2026-04-01" }),
    ];
    const logs = [
      makeLog({ supplement_id: "s1", scheduled_date: "2026-04-01" }),
      makeLog({ id: "log-002", supplement_id: "s2", scheduled_date: "2026-04-01" }),
      // s3 not taken
    ];
    const now = new Date("2026-04-02T00:00:00Z");

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.completionRate).toBe(66.7);
    expect(result.taken).toBe(2);
    expect(result.missed).toBe(1);
  });

  it("calculates 0% when no supplements are taken", () => {
    const occurrences = [
      makeOccurrence({ supplementId: "s1", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s2", date: "2026-04-01" }),
    ];
    const logs: SupplementLogRow[] = [];
    const now = new Date("2026-04-02T00:00:00Z");

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.completionRate).toBe(0);
    expect(result.missed).toBe(2);
  });

  it("returns 0% completion rate when there are no scheduled occurrences", () => {
    const occurrences: ScheduleOccurrence[] = [];
    const logs: SupplementLogRow[] = [];
    const now = new Date("2026-04-01T12:00:00Z");

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.totalScheduled).toBe(0);
    expect(result.completionRate).toBe(0);
  });
});

// ── EVL-02a: Edge case — all supplements complete (no missed) ───────

describe("EVL-02a: All Supplements Complete — No False Positives", () => {
  it("shows all green (taken) with 100% completion when every dose is logged", () => {
    const occurrences = [
      makeOccurrence({ supplementId: "s1", timeOfDay: "morning", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s2", timeOfDay: "with_food", date: "2026-04-01" }),
      makeOccurrence({ supplementId: "s3", timeOfDay: "evening", date: "2026-04-01" }),
    ];
    const logs = [
      makeLog({ supplement_id: "s1", scheduled_date: "2026-04-01", taken_at: "2026-04-01T08:00:00Z" }),
      makeLog({ id: "log-002", supplement_id: "s2", scheduled_date: "2026-04-01", taken_at: "2026-04-01T12:30:00Z" }),
      makeLog({ id: "log-003", supplement_id: "s3", scheduled_date: "2026-04-01", taken_at: "2026-04-01T20:00:00Z" }),
    ];
    const now = new Date("2026-04-01T23:00:00Z");

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.completionRate).toBe(100);
    expect(result.taken).toBe(3);
    expect(result.missed).toBe(0);
    expect(result.pending).toBe(0);

    for (const item of result.items) {
      expect(
        item.status,
        `${item.supplementId} should be 'taken' but was '${item.status}'`,
      ).toBe("taken");
    }
  });
});

// ── EVL-02b: Edge case — skipped supplements ────────────────────────

describe("EVL-02b: Skipped Supplement Handling", () => {
  it("records skipped status separately from missed", () => {
    const occurrences = [
      makeOccurrence({ supplementId: "s1", date: "2026-04-01" }),
    ];
    const logs = [
      makeLog({ supplement_id: "s1", scheduled_date: "2026-04-01", taken_at: null, skipped: 1 }),
    ];
    const now = new Date("2026-04-02T00:00:00Z");

    const result = calculateDailyCompliance(occurrences, logs, "2026-04-01", now);

    expect(result.skipped).toBe(1);
    expect(result.missed).toBe(0);
    expect(result.items[0]!.status).toBe("skipped");
  });
});

// ── Streak calculation ──────────────────────────────────────────────

describe("calculateStreak", () => {
  it("calculates current and longest streaks correctly", () => {
    const summaries: ComplianceSummary[] = [
      { date: "2026-04-01", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
      { date: "2026-04-02", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
      { date: "2026-04-03", totalScheduled: 3, taken: 2, missed: 1, skipped: 0, pending: 0, completionRate: 66.7, items: [] },
      { date: "2026-04-04", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
      { date: "2026-04-05", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
      { date: "2026-04-06", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
    ];

    const streak = calculateStreak(summaries);

    expect(streak.current).toBe(3);   // Last 3 days are perfect
    expect(streak.longest).toBe(3);   // First 2 + last 3, but broken by day 3
    expect(streak.lastPerfectDate).toBe("2026-04-06");
  });

  it("ignores days with zero scheduled supplements", () => {
    const summaries: ComplianceSummary[] = [
      { date: "2026-04-01", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
      { date: "2026-04-02", totalScheduled: 0, taken: 0, missed: 0, skipped: 0, pending: 0, completionRate: 0, items: [] },
      { date: "2026-04-03", totalScheduled: 3, taken: 3, missed: 0, skipped: 0, pending: 0, completionRate: 100, items: [] },
    ];

    const streak = calculateStreak(summaries);

    expect(
      streak.current,
      "Days with zero scheduled supplements should not break the streak",
    ).toBe(2);
  });
});

// ── Range compliance ────────────────────────────────────────────────

describe("calculateRangeCompliance", () => {
  it("returns one summary per day in the range", () => {
    const occurrences = [
      makeOccurrence({ date: "2026-04-01" }),
      makeOccurrence({ date: "2026-04-02" }),
      makeOccurrence({ date: "2026-04-03" }),
    ];
    const logs = [
      makeLog({ supplement_id: "supp-001", scheduled_date: "2026-04-01" }),
    ];
    const now = new Date("2026-04-04T00:00:00Z");

    const summaries = calculateRangeCompliance(
      occurrences, logs, "2026-04-01", "2026-04-03", now,
    );

    expect(summaries).toHaveLength(3);
    expect(summaries[0]!.date).toBe("2026-04-01");
    expect(summaries[0]!.completionRate).toBe(100);
    expect(summaries[1]!.date).toBe("2026-04-02");
    expect(summaries[1]!.completionRate).toBe(0);
    expect(summaries[2]!.date).toBe("2026-04-03");
    expect(summaries[2]!.completionRate).toBe(0);
  });
});
