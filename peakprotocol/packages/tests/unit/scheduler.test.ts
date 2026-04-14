/**
 * Unit tests for the supplement scheduling engine.
 * Covers EVL-03: Flexible scheduling accuracy (all 4 schedule types).
 * Covers EVL-03a: Future start date edge case.
 *
 * Pure function tests — no server required.
 */
import { describe, it, expect } from "vitest";
import {
  getOccurrences,
  getTodaySchedule,
  getNextOccurrences,
  type SchedulableSupplement,
} from "@api/services/scheduler";

// ── Helpers ─────────────────────────────────────────────────────────

function makeSupplement(overrides: Partial<SchedulableSupplement> = {}): SchedulableSupplement {
  return {
    id: "supp-001",
    name: "Test Supplement",
    scheduleType: "daily",
    scheduleValue: null,
    timeOfDay: "morning",
    active: true,
    ...overrides,
  };
}

// ── EVL-03: Schedule generates correct occurrences for all 4 types ──

describe("EVL-03: Flexible Scheduling Accuracy", () => {
  const startDate = "2026-04-01";
  const endDate = "2026-04-30"; // 30 days

  it("daily schedule produces an occurrence for every day in the range", () => {
    const supp = makeSupplement({ name: "Creatine", scheduleType: "daily" });
    const occurrences = getOccurrences(supp, startDate, endDate);

    expect(occurrences).toHaveLength(30);
    expect(occurrences[0]!.date).toBe("2026-04-01");
    expect(occurrences[29]!.date).toBe("2026-04-30");
    expect(occurrences.every((o) => o.supplementName === "Creatine")).toBe(true);
  });

  it("every_2_days schedule produces 15 occurrences over 30 days", () => {
    const supp = makeSupplement({
      name: "BPC-157",
      scheduleType: "every_n_days",
      scheduleValue: { n: 2, startDate: "2026-04-01" },
    });
    const occurrences = getOccurrences(supp, startDate, endDate);

    expect(occurrences).toHaveLength(15);
    expect(occurrences[0]!.date).toBe("2026-04-01");
    expect(occurrences[1]!.date).toBe("2026-04-03");
    expect(occurrences[2]!.date).toBe("2026-04-05");
  });

  it("every_3_days schedule produces 10 occurrences over 30 days", () => {
    const supp = makeSupplement({
      name: "MK-677",
      scheduleType: "every_n_days",
      scheduleValue: { n: 3, startDate: "2026-04-01" },
    });
    const occurrences = getOccurrences(supp, startDate, endDate);

    expect(occurrences).toHaveLength(10);
    expect(occurrences[0]!.date).toBe("2026-04-01");
    expect(occurrences[1]!.date).toBe("2026-04-04");
    expect(occurrences[2]!.date).toBe("2026-04-07");
  });

  it("weekly schedule (sunday) produces occurrences only on Sundays", () => {
    const supp = makeSupplement({
      name: "B12 Injection",
      scheduleType: "weekly",
      scheduleValue: { day: "sun" },
    });
    const occurrences = getOccurrences(supp, startDate, endDate);

    // April 2026: Sundays are 5th, 12th, 19th, 26th
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(occurrences.length).toBeLessThanOrEqual(5);

    for (const occ of occurrences) {
      const d = new Date(occ.date + "T00:00:00Z");
      expect(d.getUTCDay()).toBe(0); // 0 = Sunday
    }
  });

  it("specific_days schedule produces occurrences only on specified days", () => {
    const supp = makeSupplement({
      name: "Specific Days Supp",
      scheduleType: "specific_days",
      scheduleValue: { days: ["mon", "wed", "fri"] },
    });
    const occurrences = getOccurrences(supp, startDate, endDate);

    const validDays = new Set([1, 3, 5]); // Mon, Wed, Fri
    for (const occ of occurrences) {
      const d = new Date(occ.date + "T00:00:00Z");
      expect(
        validDays.has(d.getUTCDay()),
        `Expected ${occ.date} to be Mon, Wed, or Fri but was day ${d.getUTCDay()}`,
      ).toBe(true);
    }

    // April 2026 has about 13 Mon/Wed/Fri days
    expect(occurrences.length).toBeGreaterThanOrEqual(12);
    expect(occurrences.length).toBeLessThanOrEqual(14);
  });

  it("inactive supplement returns no occurrences", () => {
    const supp = makeSupplement({ active: false });
    const occurrences = getOccurrences(supp, startDate, endDate);

    expect(occurrences).toHaveLength(0);
  });

  it("invalid date range (start > end) returns no occurrences", () => {
    const supp = makeSupplement();
    const occurrences = getOccurrences(supp, "2026-04-30", "2026-04-01");

    expect(occurrences).toHaveLength(0);
  });
});

// ── EVL-03a: Future start date edge case ────────────────────────────

describe("EVL-03a: Schedule with Start Date in Future", () => {
  it("every_n_days with future start shows no occurrences before start date", () => {
    const supp = makeSupplement({
      name: "Future Start",
      scheduleType: "every_n_days",
      scheduleValue: { n: 2, startDate: "2026-04-08" }, // 7 days in future from 2026-04-01
    });

    // Check first 7 days — should have no occurrences
    const earlyOccurrences = getOccurrences(supp, "2026-04-01", "2026-04-07");
    expect(
      earlyOccurrences,
      "No occurrences should appear before the start date",
    ).toHaveLength(0);

    // Check from day 8 onward
    const laterOccurrences = getOccurrences(supp, "2026-04-08", "2026-04-30");
    expect(laterOccurrences.length).toBeGreaterThan(0);
    expect(laterOccurrences[0]!.date).toBe("2026-04-08");

    // Verify pattern is every 2 days after start
    if (laterOccurrences.length >= 2) {
      expect(laterOccurrences[1]!.date).toBe("2026-04-10");
    }
  });
});

// ── getTodaySchedule ────────────────────────────────────────────────

describe("getTodaySchedule", () => {
  it("combines multiple supplements and sorts by time-of-day priority", () => {
    const supplements: SchedulableSupplement[] = [
      makeSupplement({ id: "s1", name: "Evening Supp", timeOfDay: "evening", scheduleType: "daily" }),
      makeSupplement({ id: "s2", name: "Morning Supp", timeOfDay: "morning", scheduleType: "daily" }),
      makeSupplement({ id: "s3", name: "With Food Supp", timeOfDay: "with_food", scheduleType: "daily" }),
    ];

    const schedule = getTodaySchedule(supplements, "2026-04-01");

    expect(schedule).toHaveLength(3);
    expect(schedule[0]!.timeOfDay).toBe("morning");
    expect(schedule[1]!.timeOfDay).toBe("with_food");
    expect(schedule[2]!.timeOfDay).toBe("evening");
  });
});

// ── getNextOccurrences ──────────────────────────────────────────────

describe("getNextOccurrences", () => {
  it("returns the requested number of future occurrences", () => {
    const supp = makeSupplement({ scheduleType: "daily" });
    const next5 = getNextOccurrences(supp, 5, "2026-04-01");

    expect(next5).toHaveLength(5);
    expect(next5[0]!.date).toBe("2026-04-01");
    expect(next5[4]!.date).toBe("2026-04-05");
  });

  it("returns empty array for count <= 0", () => {
    const supp = makeSupplement();
    expect(getNextOccurrences(supp, 0)).toHaveLength(0);
    expect(getNextOccurrences(supp, -1)).toHaveLength(0);
  });
});
