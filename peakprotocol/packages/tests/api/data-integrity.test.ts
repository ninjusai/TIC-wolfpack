/**
 * API integration tests for data integrity.
 * Covers EVL-DI-01: Idempotency middleware prevents duplicate creation.
 * Covers EVL-DI-02: Idempotency returns cached response on replay.
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

// ── EVL-DI-01: Idempotency prevents duplicate creation ─────────────

describe("EVL-DI-01: Idempotency Middleware", () => {
  it("prevents duplicate supplement creation with same X-Request-Id", async () => {
    const requestId = `test-idemp-${Date.now()}`;
    const body = createTestSupplement({ name: "Idempotent Supplement" });

    // First request — should create
    const res1 = await client.requestWithIdempotency(
      "POST",
      "/api/supplements",
      requestId,
      body,
    );
    expect(res1.status).toBe(201);
    const data1 = (await res1.json()) as { supplement: { id: string; name: string } };
    const firstId = data1.supplement.id;

    // Second request with same request ID — should return cached response
    const res2 = await client.requestWithIdempotency(
      "POST",
      "/api/supplements",
      requestId,
      body,
    );

    const data2 = (await res2.json()) as { supplement: { id: string; name: string } };

    expect(
      data2.supplement.id,
      "Second request with same X-Request-Id should return the same resource (cached)",
    ).toBe(firstId);
  });

  it("allows creation with a different X-Request-Id", async () => {
    const body = createTestSupplement({ name: "Unique Supplement" });

    const res1 = await client.requestWithIdempotency(
      "POST",
      "/api/supplements",
      `req-a-${Date.now()}`,
      body,
    );
    const res2 = await client.requestWithIdempotency(
      "POST",
      "/api/supplements",
      `req-b-${Date.now()}`,
      body,
    );

    const data1 = (await res1.json()) as { supplement: { id: string } };
    const data2 = (await res2.json()) as { supplement: { id: string } };

    expect(
      data1.supplement.id,
      "Different request IDs should create different resources",
    ).not.toBe(data2.supplement.id);
  });
});

// ── EVL-DI-02: Idempotency returns cached response on replay ────────

describe("EVL-DI-02: Cached Response on Replay", () => {
  it("replayed request returns same status code and body", async () => {
    const requestId = `test-replay-${Date.now()}`;
    const body = createTestFoodEntry({
      date: new Date().toISOString().slice(0, 10),
      foodName: "Replay Test Food",
    });

    // First request
    const res1 = await client.requestWithIdempotency(
      "POST",
      "/api/food-entries",
      requestId,
      body,
    );
    const text1 = await res1.text();
    const status1 = res1.status;

    // Replay
    const res2 = await client.requestWithIdempotency(
      "POST",
      "/api/food-entries",
      requestId,
      body,
    );
    const text2 = await res2.text();
    const status2 = res2.status;

    expect(status2).toBe(status1);
    expect(
      text2,
      "Replayed request should return the exact same response body",
    ).toBe(text1);
  });

  it("request without X-Request-Id creates new resource each time", async () => {
    const body = createTestFoodEntry({
      date: new Date().toISOString().slice(0, 10),
      foodName: "No-Idemp Food",
    });

    const entry1 = await client.createFoodEntry(body);
    const entry2 = await client.createFoodEntry(body);

    expect(
      entry1.id,
      "Without idempotency key, each request should create a new resource",
    ).not.toBe(entry2.id);
  });
});
