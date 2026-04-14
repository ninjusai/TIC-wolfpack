/**
 * Unit tests for date utility functions.
 * Tests all pure date helpers used by the scheduling and compliance engines.
 *
 * Pure function tests — no server required.
 */
import { describe, it, expect } from "vitest";
import {
  parseDate,
  formatDate,
  getDayOfWeek,
  addDays,
  dateDiffDays,
  isDayName,
  type DayName,
} from "@api/lib/dates";

// ── parseDate ───────────────────────────────────────────────────────

describe("parseDate", () => {
  it("parses a valid YYYY-MM-DD string to midnight UTC", () => {
    const d = parseDate("2026-04-01");

    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // April = 3 (0-indexed)
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("throws for invalid format (no dashes)", () => {
    expect(() => parseDate("20260401")).toThrow("Invalid date format");
  });

  it("throws for partial date", () => {
    expect(() => parseDate("2026-04")).toThrow("Invalid date format");
  });

  it("throws for impossible calendar date (Feb 30)", () => {
    expect(() => parseDate("2026-02-30")).toThrow("not a real calendar date");
  });

  it("throws for empty string", () => {
    expect(() => parseDate("")).toThrow("Invalid date format");
  });

  it("handles leap year Feb 29 correctly", () => {
    // 2028 is a leap year
    const d = parseDate("2028-02-29");
    expect(d.getUTCDate()).toBe(29);
    expect(d.getUTCMonth()).toBe(1);
  });

  it("throws for Feb 29 on a non-leap year", () => {
    expect(() => parseDate("2026-02-29")).toThrow("not a real calendar date");
  });
});

// ── formatDate ──────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a Date object to YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2026, 3, 1)); // April 1
    expect(formatDate(d)).toBe("2026-04-01");
  });

  it("zero-pads single-digit months and days", () => {
    const d = new Date(Date.UTC(2026, 0, 5)); // January 5
    expect(formatDate(d)).toBe("2026-01-05");
  });

  it("handles December 31 correctly", () => {
    const d = new Date(Date.UTC(2026, 11, 31));
    expect(formatDate(d)).toBe("2026-12-31");
  });

  it("roundtrips with parseDate", () => {
    const original = "2026-07-15";
    expect(formatDate(parseDate(original))).toBe(original);
  });
});

// ── getDayOfWeek ────────────────────────────────────────────────────

describe("getDayOfWeek", () => {
  it("returns correct day name for known dates", () => {
    // 2026-04-01 is a Wednesday
    expect(getDayOfWeek(parseDate("2026-04-01"))).toBe("wed");
    // 2026-04-05 is a Sunday
    expect(getDayOfWeek(parseDate("2026-04-05"))).toBe("sun");
    // 2026-04-06 is a Monday
    expect(getDayOfWeek(parseDate("2026-04-06"))).toBe("mon");
  });

  it("returns a valid DayName type", () => {
    const validDays: readonly string[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const result = getDayOfWeek(parseDate("2026-04-01"));
    expect(validDays).toContain(result);
  });
});

// ── addDays ─────────────────────────────────────────────────────────

describe("addDays", () => {
  it("adds positive days correctly", () => {
    const d = parseDate("2026-04-01");
    const result = addDays(d, 10);
    expect(formatDate(result)).toBe("2026-04-11");
  });

  it("subtracts days with negative value", () => {
    const d = parseDate("2026-04-10");
    const result = addDays(d, -5);
    expect(formatDate(result)).toBe("2026-04-05");
  });

  it("crosses month boundary correctly", () => {
    const d = parseDate("2026-04-28");
    const result = addDays(d, 5);
    expect(formatDate(result)).toBe("2026-05-03");
  });

  it("crosses year boundary correctly", () => {
    const d = parseDate("2026-12-30");
    const result = addDays(d, 5);
    expect(formatDate(result)).toBe("2027-01-04");
  });

  it("adding zero days returns the same date", () => {
    const d = parseDate("2026-04-15");
    const result = addDays(d, 0);
    expect(formatDate(result)).toBe("2026-04-15");
  });

  it("does not mutate the original date", () => {
    const d = parseDate("2026-04-01");
    const originalTime = d.getTime();
    addDays(d, 10);
    expect(d.getTime()).toBe(originalTime);
  });
});

// ── dateDiffDays ────────────────────────────────────────────────────

describe("dateDiffDays", () => {
  it("returns positive difference when b > a", () => {
    const a = parseDate("2026-04-01");
    const b = parseDate("2026-04-11");
    expect(dateDiffDays(a, b)).toBe(10);
  });

  it("returns negative difference when a > b", () => {
    const a = parseDate("2026-04-11");
    const b = parseDate("2026-04-01");
    expect(dateDiffDays(a, b)).toBe(-10);
  });

  it("returns zero for same date", () => {
    const a = parseDate("2026-04-01");
    const b = parseDate("2026-04-01");
    expect(dateDiffDays(a, b)).toBe(0);
  });

  it("handles month and year boundaries", () => {
    const a = parseDate("2025-12-25");
    const b = parseDate("2026-01-04");
    expect(dateDiffDays(a, b)).toBe(10);
  });
});

// ── isDayName ───────────────────────────────────────────────────────

describe("isDayName", () => {
  it("returns true for all valid day names", () => {
    const validDays: DayName[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    for (const day of validDays) {
      expect(isDayName(day), `"${day}" should be a valid day name`).toBe(true);
    }
  });

  it("returns false for invalid strings", () => {
    expect(isDayName("monday")).toBe(false);
    expect(isDayName("Sunday")).toBe(false);
    expect(isDayName("")).toBe(false);
    expect(isDayName("xyz")).toBe(false);
  });
});
