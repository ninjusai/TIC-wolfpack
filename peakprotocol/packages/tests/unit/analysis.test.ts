/**
 * Unit tests for the analysis/correlation service.
 * Covers EVL-09: Correlation analysis returns valid Pearson coefficient.
 * Covers EVL-09a: Analysis handles insufficient data gracefully.
 * Covers EVL-07: Weight trend (7-day and 30-day data).
 *
 * Pure function tests — no server required.
 */
import { describe, it, expect } from "vitest";
import {
  pearsonCorrelation,
  interpretCorrelation,
  movingAverage,
  weightDelta,
  generateAnalysisReport,
  type WeightEntry,
  type AnalysisInput,
} from "@api/services/analysis";

// ── EVL-09: Correlation analysis returns valid Pearson coefficient ───

describe("EVL-09: Pearson Correlation", () => {
  it("returns a value between -1 and 1 for valid paired data", () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [2, 4, 5, 4, 5, 7, 8];

    const r = pearsonCorrelation(x, y);

    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThanOrEqual(-1);
    expect(r!).toBeLessThanOrEqual(1);
  });

  it("returns ~1.0 for perfectly positive linear relationship", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 20, 30, 40, 50];

    const r = pearsonCorrelation(x, y);

    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1.0, 5);
  });

  it("returns ~-1.0 for perfectly negative linear relationship", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [50, 40, 30, 20, 10];

    const r = pearsonCorrelation(x, y);

    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-1.0, 5);
  });

  it("returns ~0 for uncorrelated data", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [5, 3, 7, 2, 8, 1, 6, 4, 9, 5];

    const r = pearsonCorrelation(x, y);

    // With random-ish data, the correlation should be weak
    expect(r).not.toBeNull();
    expect(Math.abs(r!)).toBeLessThan(0.5);
  });

  it("returns null when denominator is zero (constant values)", () => {
    const x = [5, 5, 5, 5, 5];
    const y = [1, 2, 3, 4, 5];

    const r = pearsonCorrelation(x, y);

    expect(r).toBeNull();
  });
});

// ── EVL-09a: Analysis handles insufficient data gracefully ──────────

describe("EVL-09a: Insufficient Data Handling", () => {
  it("returns null when fewer than 5 data points", () => {
    const x = [1, 2, 3, 4];
    const y = [2, 4, 6, 8];

    const r = pearsonCorrelation(x, y);

    expect(
      r,
      "Pearson correlation should return null for fewer than 5 data points",
    ).toBeNull();
  });

  it("returns null for empty arrays", () => {
    expect(pearsonCorrelation([], [])).toBeNull();
  });

  it("uses min of both array lengths when they differ", () => {
    const x = [1, 2, 3]; // Only 3 points
    const y = [2, 4, 6, 8, 10, 12];

    const r = pearsonCorrelation(x, y);

    expect(
      r,
      "Should use min(x.length, y.length) = 3, which is < 5",
    ).toBeNull();
  });

  it("interpretCorrelation labels 'Insufficient data' for null in generateAnalysisReport", () => {
    const input: AnalysisInput = {
      weights: [
        { date: "2026-04-01", weight: 185 },
        { date: "2026-04-02", weight: 184 },
        { date: "2026-04-03", weight: 183 },
      ],
      dailyMacros: [
        { date: "2026-04-01", calories: 2000, protein: 150, carbs: 250, fat: 70 },
      ],
      trainingSessions: [],
      complianceRates: [],
      period: { start: "2026-04-01", end: "2026-04-03" },
    };

    const report = generateAnalysisReport(input);

    // With insufficient overlapping data points, correlations should show "Insufficient data"
    for (const corr of report.correlations) {
      if (corr.correlation === null) {
        expect(corr.interpretation).toBe("Insufficient data");
      }
    }
  });
});

// ── interpretCorrelation ────────────────────────────────────────────

describe("interpretCorrelation", () => {
  it("labels no meaningful correlation for |r| < 0.2", () => {
    expect(interpretCorrelation(0.1)).toBe("No meaningful correlation");
    expect(interpretCorrelation(-0.15)).toBe("No meaningful correlation");
  });

  it("labels weak correlation for 0.2 <= |r| < 0.4", () => {
    expect(interpretCorrelation(0.3)).toBe("Weak positive correlation");
    expect(interpretCorrelation(-0.25)).toBe("Weak negative correlation");
  });

  it("labels moderate correlation for 0.4 <= |r| < 0.6", () => {
    expect(interpretCorrelation(0.5)).toBe("Moderate positive correlation");
    expect(interpretCorrelation(-0.45)).toBe("Moderate negative correlation");
  });

  it("labels strong correlation for 0.6 <= |r| < 0.8", () => {
    expect(interpretCorrelation(0.7)).toBe("Strong positive correlation");
    expect(interpretCorrelation(-0.65)).toBe("Strong negative correlation");
  });

  it("labels very strong correlation for |r| >= 0.8", () => {
    expect(interpretCorrelation(0.9)).toBe("Very strong positive correlation");
    expect(interpretCorrelation(-0.95)).toBe("Very strong negative correlation");
    expect(interpretCorrelation(1.0)).toBe("Very strong positive correlation");
  });
});

// ── movingAverage ───────────────────────────────────────────────────

describe("movingAverage", () => {
  it("computes correct 3-day moving average", () => {
    const values = [10, 20, 30, 40, 50];
    const result = movingAverage(values, 3);

    expect(result).toHaveLength(5);
    expect(result[0]).toBeCloseTo(10);      // Only 1 point in window
    expect(result[1]).toBeCloseTo(15);      // (10+20)/2
    expect(result[2]).toBeCloseTo(20);      // (10+20+30)/3
    expect(result[3]).toBeCloseTo(30);      // (20+30+40)/3
    expect(result[4]).toBeCloseTo(40);      // (30+40+50)/3
  });

  it("handles null values by skipping them", () => {
    const values: (number | null)[] = [10, null, 30, null, 50];
    const result = movingAverage(values, 3);

    expect(result[0]).toBeCloseTo(10);
    expect(result[1]).toBeCloseTo(10);      // Only non-null is 10
    expect(result[2]).toBeCloseTo(20);      // (10 + 30) / 2
  });

  it("returns null when all values in window are null", () => {
    const values: (number | null)[] = [null, null, null];
    const result = movingAverage(values, 3);

    // With no non-null values the function returns null
    for (const v of result) {
      expect(v).toBeNull();
    }
  });
});

// ── EVL-07: Weight trend (7-day and 30-day data) ────────────────────

describe("EVL-07: Weight Trend Analysis", () => {
  it("weightDelta returns negative value for downward trend over 14 days", () => {
    const weights: WeightEntry[] = [
      { date: "2026-03-18", weight: 185.0 },
      { date: "2026-03-19", weight: 184.8 },
      { date: "2026-03-20", weight: 185.2 },
      { date: "2026-03-21", weight: 184.5 },
      { date: "2026-03-22", weight: 184.3 },
      { date: "2026-03-23", weight: 184.0 },
      { date: "2026-03-24", weight: 184.2 },
      { date: "2026-03-25", weight: 183.8 },
      { date: "2026-03-26", weight: 183.5 },
      { date: "2026-03-27", weight: 183.7 },
      { date: "2026-03-28", weight: 183.2 },
      { date: "2026-03-29", weight: 183.0 },
      { date: "2026-03-30", weight: 182.8 },
      { date: "2026-03-31", weight: 182.5 },
    ];

    const delta = weightDelta(weights);

    expect(delta).not.toBeNull();
    expect(
      delta!,
      "Weight delta should be negative for a downward trend",
    ).toBeLessThan(0);
  });

  it("weightDelta returns null for fewer than 14 entries", () => {
    const weights: WeightEntry[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      weight: 180 - i * 0.2,
    }));

    const delta = weightDelta(weights);

    expect(
      delta,
      "Weight delta should be null with fewer than 14 data points",
    ).toBeNull();
  });

  it("weightDelta filters out null weight entries", () => {
    const weights: WeightEntry[] = [
      ...Array.from({ length: 14 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, "0")}`,
        weight: 180 - i * 0.1,
      })),
      { date: "2026-04-15", weight: null }, // null should be filtered
    ];

    const delta = weightDelta(weights);

    expect(delta).not.toBeNull();
  });

  it("generateAnalysisReport computes weight trend direction correctly", () => {
    // Create 30 days of declining weight data
    const weights: WeightEntry[] = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      weight: 190 - i * 0.3,
    }));

    const macros = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      calories: 2200,
      protein: 150,
      carbs: 250,
      fat: 70,
    }));

    const report = generateAnalysisReport({
      weights,
      dailyMacros: macros,
      trainingSessions: [],
      complianceRates: [],
      period: { start: "2026-03-01", end: "2026-03-30" },
    });

    expect(report.weightTrend.trend).toBe("down");
    expect(report.weightTrend.delta).not.toBeNull();
    expect(report.weightTrend.delta!).toBeLessThan(0);
    expect(report.weightTrend.current7DayAvg).not.toBeNull();
    expect(report.weightTrend.previous7DayAvg).not.toBeNull();
    expect(report.dataPoints).toBe(30);
  });
});
