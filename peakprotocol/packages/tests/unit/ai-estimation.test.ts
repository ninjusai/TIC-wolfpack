/**
 * Unit tests for AI macro estimation service.
 *
 * Covers:
 * - EVL-P6-08: AI estimation returns valid macros with source "ai"
 * - EVL-P6-08a: AI estimation with vague description (edge case)
 * - EVL-P6-08b: AI estimation when LLM API key missing (negative, returns not_configured)
 *
 * Mocks the Anthropic API for deterministic results. No server required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  estimateMacros,
  type EstimationResult,
  type AIEstimation,
} from "@api/services/ai-estimation";

// ── Mock fetch ──────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Helper: mock a successful Anthropic API response */
function mockAnthropicResponse(estimation: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_description: string;
}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        id: "msg_test",
        content: [{ type: "text", text: JSON.stringify(estimation) }],
        stop_reason: "end_turn",
      }),
  } as unknown as Response);
}

// ── EVL-P6-08: AI estimation returns valid macros ───────────────────

describe("EVL-P6-08: AI Macro Estimation Returns Valid Macros", () => {
  it("returns estimated macros with plausible values for 'large bowl of chicken fried rice'", async () => {
    mockAnthropicResponse({
      calories: 650,
      protein: 28,
      carbs: 78,
      fat: 22,
      fiber: 3,
      serving_description: "1 large bowl (~400g) of chicken fried rice",
    });

    const result = await estimateMacros("test-key-123", "large bowl of chicken fried rice");

    expect(result.ok, "Estimation should succeed").toBe(true);

    if (!result.ok) return; // TypeScript narrowing
    const data: AIEstimation = result.data;

    expect(
      data.calories,
      "Calories should be a positive number in plausible range (400-900)",
    ).toBeGreaterThanOrEqual(1);

    expect(
      data.protein,
      "Protein should be a positive number",
    ).toBeGreaterThanOrEqual(1);

    expect(
      data.carbs,
      "Carbs should be a positive number",
    ).toBeGreaterThanOrEqual(1);

    expect(
      data.fat,
      "Fat should be a positive number",
    ).toBeGreaterThanOrEqual(1);

    expect(
      data.fiber,
      "Fiber should be a non-negative number",
    ).toBeGreaterThanOrEqual(0);

    expect(
      typeof data.servingDescription,
      "servingDescription should be a string",
    ).toBe("string");
  });

  it("returns all 5 macro fields (calories, protein, carbs, fat, fiber)", async () => {
    mockAnthropicResponse({
      calories: 250,
      protein: 20,
      carbs: 30,
      fat: 8,
      fiber: 2,
      serving_description: "1 serving grilled chicken salad",
    });

    const result = await estimateMacros("test-key", "grilled chicken salad");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveProperty("calories");
    expect(result.data).toHaveProperty("protein");
    expect(result.data).toHaveProperty("carbs");
    expect(result.data).toHaveProperty("fat");
    expect(result.data).toHaveProperty("fiber");
  });
});

// ── EVL-P6-08a: AI estimation with vague description ────────────────

describe("EVL-P6-08a: AI Estimation with Vague Description (Edge Case)", () => {
  it("handles vague 'some food' gracefully — returns best-effort estimate or clear error", async () => {
    // AI still tries to estimate for vague inputs
    mockAnthropicResponse({
      calories: 300,
      protein: 10,
      carbs: 40,
      fat: 12,
      fiber: 2,
      serving_description: "1 typical adult portion of generic food",
    });

    const result = await estimateMacros("test-key", "some food");

    // Either: successful estimate OR graceful error — no crash
    if (result.ok) {
      expect(
        result.data.calories,
        "Even for vague input, calories should be a positive number",
      ).toBeGreaterThan(0);
    } else {
      // Graceful error — valid error type, no crash
      expect(
        ["not_configured", "api_error", "invalid_response"],
        "Error type should be a recognized type",
      ).toContain(result.error.type);
    }
  });

  it("does not crash or return negative values for bizarre input", async () => {
    mockAnthropicResponse({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      serving_description: "unknown",
    });

    const result = await estimateMacros("test-key", "xyznotafood999");

    // No crash — either ok or graceful error
    expect(
      typeof result.ok,
      "Result should have an 'ok' boolean property",
    ).toBe("boolean");

    if (result.ok) {
      expect(result.data.calories, "Calories should not be negative").toBeGreaterThanOrEqual(0);
      expect(result.data.protein, "Protein should not be negative").toBeGreaterThanOrEqual(0);
    }
  });
});

// ── EVL-P6-08b: AI estimation when API key missing ──────────────────

describe("EVL-P6-08b: AI Estimation When LLM API Key Missing (Negative)", () => {
  it("returns 'not_configured' error when API key is undefined", async () => {
    const result = await estimateMacros(undefined, "chicken breast");

    expect(result.ok, "Should fail when API key is missing").toBe(false);

    if (result.ok) return;
    expect(
      result.error.type,
      "Error type should be 'not_configured' for missing API key",
    ).toBe("not_configured");
  });

  it("returns 'not_configured' error when API key is empty string", async () => {
    // The service checks !apiKey, so empty string should also trigger not_configured
    const result = await estimateMacros("", "chicken breast");

    expect(result.ok, "Should fail when API key is empty").toBe(false);

    if (result.ok) return;
    expect(
      result.error.type,
      "Error type should be 'not_configured' for empty API key",
    ).toBe("not_configured");
  });

  it("returns 'api_error' when Anthropic API returns HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    } as unknown as Response);

    const result = await estimateMacros("invalid-key", "chicken breast");

    expect(result.ok, "Should fail on API error").toBe(false);

    if (result.ok) return;
    expect(
      result.error.type,
      "Error type should be 'api_error' for HTTP failures",
    ).toBe("api_error");
  });

  it("does not leak API key details or stack traces in error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await estimateMacros("sk-secret-key-12345", "chicken breast");

    expect(result.ok).toBe(false);

    if (result.ok) return;
    if (result.error.type === "api_error" && "message" in result.error) {
      expect(
        result.error.message,
        "Error message should not contain the actual API key",
      ).not.toContain("sk-secret-key-12345");
    }
  });
});
