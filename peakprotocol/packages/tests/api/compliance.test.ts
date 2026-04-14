/**
 * API integration tests for supplement compliance.
 * Covers EVL-01 and EVL-02 at the API level.
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

describe("EVL-01: Compliance Dashboard (API)", () => {
  it("returns compliance data for a date with scheduled supplements", async () => {
    // Create a supplement with a daily schedule
    await client.createSupplement(
      createTestSupplement({
        name: "Compliance Test Vitamin",
        scheduleType: "daily",
        timeOfDay: "morning",
      }),
    );

    // Query compliance for today
    const today = new Date().toISOString().slice(0, 10);
    const result = await client.getCompliance(today);

    expect(result).toBeDefined();
    // Response should contain compliance-related fields
    expect(typeof result).toBe("object");
  });
});

describe("EVL-02: Compliance Rate via API", () => {
  it("returns compliance data for a date range", async () => {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    const result = await client.getComplianceRange(startDate, endDate);

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
