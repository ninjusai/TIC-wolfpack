/**
 * API integration tests for daily metrics (weight, hydration).
 * Covers EVL-07: Weight trend shows correct 7-day and 30-day data (API level).
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createTestMetrics, createWeightTrendData } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── Daily Metrics CRUD ──────────────────────────────────────────────

describe("Daily Metrics CRUD", () => {
  it("upserts metrics for a date", async () => {
    const metrics = await client.upsertMetrics("2026-04-01", createTestMetrics());

    expect(metrics.date).toBe("2026-04-01");
    expect(metrics.weight).toBe(184.5);
    expect(metrics.weightUnit).toBe("lbs");
    expect(metrics.waterMl).toBe(2500);
  });

  it("retrieves metrics for a single date", async () => {
    const metrics = await client.getMetrics("2026-04-01");

    expect(metrics.date).toBe("2026-04-01");
    expect(metrics.weight).toBe(184.5);
  });

  it("updates existing metrics (upsert merge)", async () => {
    // Only update water — weight should be preserved
    const metrics = await client.upsertMetrics("2026-04-01", { waterMl: 3000 });

    expect(metrics.weight).toBe(184.5);
    expect(metrics.waterMl).toBe(3000);
  });
});

// ── EVL-07: Weight Trend Data via API ───────────────────────────────

describe("EVL-07: Weight Trend Data", () => {
  beforeAll(async () => {
    // Seed 14 days of weight data with downward trend
    const trendData = createWeightTrendData("2026-03-18");
    for (const entry of trendData) {
      await client.upsertMetrics(entry.date, { weight: entry.weight, weightUnit: "lbs" });
    }
  });

  it("retrieves weight data for a date range", async () => {
    const metrics = await client.getMetricsRange("2026-03-18", "2026-03-31");

    expect(
      metrics.length,
      "Should have metrics for at least 14 days of seeded data",
    ).toBeGreaterThanOrEqual(14);
  });

  it("weight data shows all 14 data points with correct values", async () => {
    const metrics = await client.getMetricsRange("2026-03-18", "2026-03-31");
    const expectedWeights = [
      185.0, 184.8, 185.2, 184.5, 184.3, 184.0, 184.2,
      183.8, 183.5, 183.7, 183.2, 183.0, 182.8, 182.5,
    ];

    for (let i = 0; i < expectedWeights.length; i++) {
      const dayMetrics = metrics.find(
        (m) => m.date === `2026-03-${String(18 + i).padStart(2, "0")}`,
      );
      expect(
        dayMetrics,
        `Metrics for day ${18 + i} should exist`,
      ).toBeDefined();
      expect(dayMetrics!.weight).toBe(expectedWeights[i]);
    }
  });

  it("7-day average shows downward trend in most recent week", async () => {
    const metrics = await client.getMetricsRange("2026-03-18", "2026-03-31");
    const weights = metrics
      .filter((m) => m.weight !== null)
      .map((m) => m.weight!);

    const first7Avg = weights.slice(0, 7).reduce((s, v) => s + v, 0) / 7;
    const last7Avg = weights.slice(7, 14).reduce((s, v) => s + v, 0) / 7;

    expect(
      last7Avg,
      "Last 7-day average should be lower than first 7-day average (downward trend)",
    ).toBeLessThan(first7Avg);
  });
});
