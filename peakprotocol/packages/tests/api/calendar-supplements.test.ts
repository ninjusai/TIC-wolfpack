/**
 * API integration tests for Phase 6 Calendar Supplement endpoints.
 *
 * Covers:
 * - EVL-P6-01: Calendar supplements monthly API returns correct shape
 * - EVL-P6-04: Batch mark all taken (atomicity)
 * - EVL-P6-04a: Batch mark all with some already taken (skip duplicates)
 * - EVL-P6-DI-04: Batch mark all taken atomicity (data integrity)
 *
 * Requires a running dev server: cd peakprotocol/packages/api && npx wrangler dev --local
 */
import { describe, it, expect, beforeAll } from "vitest";
import { TestClient } from "../helpers/api-client";
import { createTestSupplement } from "../helpers/fixtures";

const client = new TestClient();

beforeAll(async () => {
  await client.getDeviceToken();
});

// ── EVL-P6-01: Calendar supplements monthly API ─────────────────────

describe("EVL-P6-01: Calendar Supplements Monthly API", () => {
  it("returns correct shape with days and compliance for a month", async () => {
    // Create a supplement so there is data
    await client.createSupplement(
      createTestSupplement({ name: "Calendar Test Vitamin", scheduleType: "daily", timeOfDay: "morning" }),
    );

    const res = await client.request("GET", "/api/calendar-supplements/2026-04");
    expect(res.status, "GET /api/calendar-supplements/2026-04 should return 200").toBe(200);

    const body = (await res.json()) as {
      days: Record<string, Array<{
        supplementId: string;
        name: string;
        color: string;
        status: string;
        logId: string | null;
      }>>;
      compliance: Record<string, string | null>;
    };

    expect(body, "Response should have 'days' field").toHaveProperty("days");
    expect(body, "Response should have 'compliance' field").toHaveProperty("compliance");

    // days should be keyed by YYYY-MM-DD dates
    const dateKeys = Object.keys(body.days);
    expect(
      dateKeys.length,
      "Month should have at least some day entries",
    ).toBeGreaterThan(0);

    // Each day's dots should have required fields
    for (const [date, dots] of Object.entries(body.days)) {
      expect(date, `Date key '${date}' should match YYYY-MM-DD format`).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      for (const dot of dots) {
        expect(dot, `Dot on ${date} should have supplementId`).toHaveProperty("supplementId");
        expect(dot, `Dot on ${date} should have name`).toHaveProperty("name");
        expect(dot, `Dot on ${date} should have color`).toHaveProperty("color");
        expect(dot, `Dot on ${date} should have status`).toHaveProperty("status");
        expect(
          ["taken", "skipped", "pending"],
          `Dot status on ${date} should be taken/skipped/pending`,
        ).toContain(dot.status);
        expect(
          dot.color,
          `Dot color on ${date} should be a hex color string`,
        ).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }

    // compliance should have the same date keys
    for (const [date, value] of Object.entries(body.compliance)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        [null, "full", "partial", "none"],
        `Compliance for ${date} should be full/partial/none/null`,
      ).toContain(value);
    }
  });

  it("rejects invalid month format with 400", async () => {
    const res = await client.request("GET", "/api/calendar-supplements/2026-4");
    expect(res.status, "Invalid month format should return 400").toBe(400);
  });
});

// ── EVL-P6-04: Batch Mark All Taken ─────────────────────────────────

describe("EVL-P6-04: Batch Mark All Taken", () => {
  const supplementIds: string[] = [];

  beforeAll(async () => {
    // Create 5 supplements for batch testing
    for (let i = 0; i < 5; i++) {
      const supp = await client.createSupplement(
        createTestSupplement({
          name: `Batch Test Supp ${i + 1}`,
          scheduleType: "daily",
          timeOfDay: "morning",
        }),
      );
      supplementIds.push(supp.id);
    }
  });

  it("creates log records for all pending supplements in a single batch", async () => {
    const date = "2026-04-05";

    const res = await client.request("POST", "/api/supplements/batch-log", {
      date,
      supplementIds,
    });

    expect(res.status, "Batch log should return 201").toBe(201);

    const body = (await res.json()) as { created: number; alreadyLogged: number };

    expect(
      body.created,
      `All ${supplementIds.length} pending supplements should be logged`,
    ).toBe(supplementIds.length);

    expect(
      body.alreadyLogged,
      "No supplements should have been already logged",
    ).toBe(0);
  });

  // EVL-P6-04a: Batch with some already taken
  it("skips already-logged supplements without duplicates (EVL-P6-04a)", async () => {
    const date = "2026-04-05";

    // Second batch call with the same IDs — all already taken
    const res = await client.request("POST", "/api/supplements/batch-log", {
      date,
      supplementIds,
    });

    expect(res.status, "Second batch should still return 200 (or 201 with 0 created)").toBeLessThan(300);

    const body = (await res.json()) as { created: number; alreadyLogged: number };

    expect(
      body.created,
      "No new logs should be created for already-taken supplements",
    ).toBe(0);

    expect(
      body.alreadyLogged,
      "All supplements should be reported as already logged",
    ).toBe(supplementIds.length);
  });
});

// ── EVL-P6-DI-04: Batch atomicity with 10 supplements ──────────────

describe("EVL-P6-DI-04: Batch Mark All Taken Atomicity", () => {
  it("creates all 10 log records atomically within CPU time limit", async () => {
    // Create 10 supplements
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const supp = await client.createSupplement(
        createTestSupplement({
          name: `Atomicity Test Supp ${i + 1}`,
          scheduleType: "daily",
          timeOfDay: "morning",
        }),
      );
      ids.push(supp.id);
    }

    const start = Date.now();

    const res = await client.request("POST", "/api/supplements/batch-log", {
      date: "2026-04-06",
      supplementIds: ids,
    });

    const elapsed = Date.now() - start;

    expect(res.status, "Batch of 10 should succeed").toBeLessThan(300);

    const body = (await res.json()) as { created: number; alreadyLogged: number };

    expect(
      body.created,
      "All 10 supplements should be logged atomically",
    ).toBe(10);

    expect(
      elapsed,
      "Batch operation should complete within 30s CPU time limit",
    ).toBeLessThan(30_000);
  });

  it("rejects batch exceeding max 10 supplements", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `fake-id-${i}`);

    const res = await client.request("POST", "/api/supplements/batch-log", {
      date: "2026-04-06",
      supplementIds: ids,
    });

    expect(
      res.status,
      "Batch exceeding 10 supplements should be rejected with 400",
    ).toBe(400);
  });
});
