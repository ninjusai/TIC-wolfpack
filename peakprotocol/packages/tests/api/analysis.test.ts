/**
 * API integration tests for correlation analysis.
 * Covers EVL-09: Correlation analysis returns valid Pearson coefficient (API level).
 * Covers EVL-09a: Analysis handles insufficient data gracefully (API level).
 *
 * Requires a running dev server with seeded data.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createWeightTrendData, createMacroSeriesData, createTestFoodEntry } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();

  // Seed 30 days of weight and macro data for correlation analysis
  const weightData = createWeightTrendData("2026-03-01", 14);
  for (const entry of weightData) {
    await client.upsertMetrics(entry.date, { weight: entry.weight, weightUnit: "lbs" });
  }

  // Seed daily macros via food entries
  const macroData = createMacroSeriesData("2026-03-01", 14);
  for (const day of macroData) {
    await client.createFoodEntry(
      createTestFoodEntry({
        date: day.date,
        foodName: "Daily Meal",
        meal: "lunch",
        calories: day.calories,
        protein: day.protein,
        carbs: day.carbs,
        fat: day.fat,
      }),
    );
  }
});

// ── EVL-09: Correlation Analysis via API ────────────────────────────

describe("EVL-09: Correlation Analysis Report", () => {
  it("returns an analysis report with correlations", async () => {
    const report = await client.getAnalysisReport(14);

    expect(report).toBeDefined();
    expect(report.period).toHaveProperty("start");
    expect(report.period).toHaveProperty("end");
    expect(report.correlations).toBeInstanceOf(Array);
    expect(report.correlations.length).toBeGreaterThan(0);

    // Each correlation should have the expected structure
    for (const corr of report.correlations) {
      expect(corr).toHaveProperty("metric1");
      expect(corr).toHaveProperty("metric2");
      expect(corr).toHaveProperty("correlation");
      expect(corr).toHaveProperty("interpretation");
      expect(corr).toHaveProperty("dataPoints");

      // If correlation is not null, it should be in [-1, 1]
      if (corr.correlation !== null) {
        expect(corr.correlation).toBeGreaterThanOrEqual(-1);
        expect(corr.correlation).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns a single correlation between two metrics", async () => {
    const corr = await client.getCorrelation("protein", "weight", 14);

    expect(corr.metric1).toBe("protein");
    expect(corr.metric2).toBe("weight");
    expect(corr.dataPoints).toBeGreaterThanOrEqual(0);

    if (corr.correlation !== null) {
      expect(corr.correlation).toBeGreaterThanOrEqual(-1);
      expect(corr.correlation).toBeLessThanOrEqual(1);
      expect(corr.interpretation).not.toBe("Insufficient data");
    }
  });
});

// ── EVL-09a: Insufficient Data via API ──────────────────────────────

describe("EVL-09a: Insufficient Data Handling (API)", () => {
  it("handles requests gracefully even with sparse data", async () => {
    // Request correlation for a period with possibly insufficient data
    const corr = await client.getCorrelation("training_volume", "weight", 14);

    expect(corr).toBeDefined();
    expect(corr).toHaveProperty("correlation");
    expect(corr).toHaveProperty("interpretation");

    // If insufficient data, correlation should be null with appropriate message
    if (corr.dataPoints < 5) {
      expect(corr.correlation).toBeNull();
      expect(corr.interpretation).toBe("Insufficient data");
    }
  });
});
