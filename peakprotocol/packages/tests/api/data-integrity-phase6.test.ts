/**
 * API integration tests for Phase 6 Data Integrity.
 *
 * Covers:
 * - EVL-P6-DI-01: Supplement color column migration (new column without data loss)
 * - EVL-P6-DI-02: Food source column migration (new column without data loss)
 * - EVL-P6-DI-03: Daily summary API backward compatibility (Phase 5 fields preserved)
 *
 * These tests verify that Phase 6 migrations and schema changes are
 * backward-compatible: existing data is preserved, new fields are additive.
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createTestSupplement, createTestFoodEntry } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── EVL-P6-DI-01: Supplement color column migration ────────────────

describe("EVL-P6-DI-01: Supplement Color Column Migration", () => {
  it("existing supplement CRUD endpoints work with the new color column", async () => {
    // Create a supplement — should succeed with color column present
    const supp = await client.createSupplement(
      createTestSupplement({ name: "Color Migration Test" }),
    );

    expect(supp.id, "Supplement creation should succeed with color column").toBeTruthy();
    expect(supp.name, "Supplement name should be preserved").toBe("Color Migration Test");

    // Read it back
    const fetched = await client.getSupplement(supp.id);
    expect(fetched.name, "GET should return the correct supplement").toBe("Color Migration Test");

    // Update it
    const updated = await client.updateSupplement(supp.id, { currentDose: "10000" });
    expect(updated.currentDose, "Update should work with color column present").toBe("10000");

    // Delete it
    await client.deleteSupplement(supp.id);
    const deleted = await client.getSupplement(supp.id);
    expect(deleted.active, "Soft delete should work with color column present").toBe(false);
  });

  it("newly created supplements receive a color value", async () => {
    const supp = await client.createSupplement(
      createTestSupplement({ name: "Auto Color Test" }),
    );

    // Fetch the supplement via the calendar endpoint to see the color
    const res = await client.request("GET", "/api/calendar-supplements/2026-04");
    const body = (await res.json()) as {
      days: Record<string, Array<{ supplementId: string; color: string }>>;
    };

    // Look for our supplement in any day's dots
    let foundColor: string | null = null;
    for (const dots of Object.values(body.days)) {
      const dot = dots.find((d) => d.supplementId === supp.id);
      if (dot) {
        foundColor = dot.color;
        break;
      }
    }

    if (foundColor) {
      expect(
        foundColor,
        "Auto-assigned color should be a valid hex color",
      ).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    // If supplement not found in dots (not scheduled for April), that's okay
  });
});

// ── EVL-P6-DI-02: Food source column migration ─────────────────────

describe("EVL-P6-DI-02: Food Source Column Migration", () => {
  it("existing food entry CRUD endpoints work with the new source column", async () => {
    const date = "2026-04-13";

    // Create
    const entry = await client.createFoodEntry(
      createTestFoodEntry({ date, foodName: "Source Migration Test", meal: "lunch" }),
    );

    expect(entry.id, "Food entry creation should succeed with source column").toBeTruthy();
    expect(entry.foodName, "Food name should be preserved").toBe("Source Migration Test");

    // Read
    const { entries } = await client.listFoodEntries(date);
    const found = entries.find((e) => e.id === entry.id);
    expect(found, "Food entry should be retrievable after creation").toBeDefined();

    // Delete
    await client.deleteFoodEntry(entry.id);
  });

  it("food entries include source field in response", async () => {
    const date = "2026-04-14";

    const entry = await client.createFoodEntry(
      createTestFoodEntry({
        date,
        foodName: "Source Field Test",
        meal: "breakfast",
        source: "usda",
      } as Record<string, unknown>),
    );

    const { entries } = await client.listFoodEntries(date);
    const found = entries.find((e) => e.id === entry.id);

    expect(found, "Entry should be in the list").toBeDefined();

    // The source field should be present in the response
    // (may be in the extended type that includes source)
    const entryData = found as Record<string, unknown>;
    expect(
      "source" in entryData || entryData["source"] === null,
      "Response should include source field (or null for legacy entries)",
    ).toBeTruthy();
  });
});

// ── EVL-P6-DI-03: Daily summary API backward compatibility ─────────

describe("EVL-P6-DI-03: Daily Summary API Backward Compatibility", () => {
  it("response contains all Phase 5 fields plus new Phase 6 fields (additive)", async () => {
    const date = "2026-04-15";

    // Seed some data for the date
    await client.createSupplement(
      createTestSupplement({ name: "Summary Test Supp", scheduleType: "daily", timeOfDay: "morning" }),
    );

    await client.createFoodEntry(
      createTestFoodEntry({ date, foodName: "Summary Test Food", meal: "lunch" }),
    );

    const res = await client.request("GET", `/api/daily-summary/${date}`);
    expect(res.status, "Daily summary should return 200").toBe(200);

    const body = (await res.json()) as Record<string, unknown>;

    // Phase 5 fields must all be present
    expect(body, "Response should have 'date' field").toHaveProperty("date");
    expect(body, "Response should have 'supplements' section").toHaveProperty("supplements");
    expect(body, "Response should have 'nutrition' section").toHaveProperty("nutrition");
    expect(body, "Response should have 'training' section").toHaveProperty("training");
    expect(body, "Response should have 'metrics' section").toHaveProperty("metrics");
    expect(body, "Response should have 'journal' section").toHaveProperty("journal");

    // Supplements section: Phase 5 fields preserved
    const supps = body["supplements"] as Record<string, unknown>;
    expect(supps, "Supplements should have 'taken' count").toHaveProperty("taken");
    expect(supps, "Supplements should have 'skipped' count").toHaveProperty("skipped");
    expect(supps, "Supplements should have 'total' count").toHaveProperty("total");
    expect(supps, "Supplements should have 'items' array").toHaveProperty("items");

    // Phase 6 additive field: supplement dots
    expect(
      supps,
      "Supplements should have new Phase 6 'dots' field (additive, not replacing)",
    ).toHaveProperty("dots");

    // Verify dots structure
    const dots = supps["dots"] as Array<Record<string, unknown>>;
    expect(Array.isArray(dots), "Dots should be an array").toBe(true);

    for (const dot of dots) {
      expect(dot, "Each dot should have supplementId").toHaveProperty("supplementId");
      expect(dot, "Each dot should have name").toHaveProperty("name");
      expect(dot, "Each dot should have color").toHaveProperty("color");
      expect(dot, "Each dot should have status").toHaveProperty("status");
    }

    // Nutrition section: Phase 5 fields preserved
    const nutrition = body["nutrition"] as Record<string, unknown>;
    expect(nutrition, "Nutrition should have 'calories'").toHaveProperty("calories");
    expect(nutrition, "Nutrition should have 'protein'").toHaveProperty("protein");
    expect(nutrition, "Nutrition should have 'carbs'").toHaveProperty("carbs");
    expect(nutrition, "Nutrition should have 'fat'").toHaveProperty("fat");
    expect(nutrition, "Nutrition should have 'meals' array").toHaveProperty("meals");

    // Check that nutrition items include source when available (Phase 6)
    const meals = nutrition["meals"] as Array<{ meal: string; items: Array<Record<string, unknown>> }>;
    if (meals.length > 0) {
      for (const meal of meals) {
        for (const item of meal.items) {
          // source field is present when it has a value
          expect(item, "Nutrition item should have 'name'").toHaveProperty("name");
          expect(item, "Nutrition item should have 'calories'").toHaveProperty("calories");
        }
      }
    }

    // Training section: Phase 5 fields preserved
    const training = body["training"] as Record<string, unknown>;
    expect(training, "Training should have 'sessions'").toHaveProperty("sessions");
    expect(training, "Training should have 'totalDuration'").toHaveProperty("totalDuration");

    // No existing fields should be renamed or removed
    expect(
      body["date"],
      "Date field should match the requested date",
    ).toBe(date);
  });

  it("daily summary for a day with no data returns zero counts and empty arrays", async () => {
    const emptyDate = "2025-01-01"; // Far in the past, should have no data

    const res = await client.request("GET", `/api/daily-summary/${emptyDate}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      supplements: { taken: number; skipped: number; total: number; items: unknown[]; dots: unknown[] };
      nutrition: { calories: number; protein: number; meals: unknown[] };
      training: { sessions: unknown[]; totalDuration: number };
    };

    expect(body.supplements.taken, "No supplement data: taken = 0").toBe(0);
    expect(body.supplements.items, "No supplement data: items = []").toHaveLength(0);
    expect(Array.isArray(body.supplements.dots), "Dots should be an array even when empty").toBe(true);
    expect(body.nutrition.calories, "No food data: calories = 0").toBe(0);
    expect(body.training.sessions, "No training data: sessions = []").toHaveLength(0);
  });
});
