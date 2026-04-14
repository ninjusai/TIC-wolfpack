/**
 * AI macro estimation service (WRK-PP6-009).
 *
 * Calls Anthropic Claude (Haiku-class) to estimate macronutrient
 * content from free-text food descriptions. Uses raw fetch to keep
 * the bundle lightweight for Cloudflare Workers.
 */

// ── Public Types ──────────────────────────────────────────────────────

export interface AIEstimation {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingDescription: string;
}

// ── Anthropic API Types ──────────────────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicContentBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: string;
}

// ── Constants ────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_TIMEOUT_MS = 12_000;

const ESTIMATION_SYSTEM_PROMPT = `You are a nutritional estimation assistant. Given a food description, estimate the macronutrient content. Return ONLY valid JSON with this exact structure:
{
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "fiber": <number in grams>,
  "serving_description": "<what you estimated for>"
}
Be reasonable and conservative. If the description is vague, estimate for a typical adult portion. All numbers should be realistic for the described food and portion size. Do not include any text outside the JSON object.`;

// ── Helpers ───────────────────────────────────────────────────────────

interface EstimationJSON {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  serving_description?: string;
}

/**
 * Parse and validate the AI response JSON.
 * Returns null if the JSON is malformed or missing required fields.
 */
function parseEstimation(text: string): AIEstimation | null {
  try {
    // Extract JSON from the response (in case there's surrounding text)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as EstimationJSON;

    if (
      typeof parsed.calories !== "number" ||
      typeof parsed.protein !== "number" ||
      typeof parsed.carbs !== "number" ||
      typeof parsed.fat !== "number" ||
      typeof parsed.fiber !== "number"
    ) {
      return null;
    }

    return {
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      fiber: parsed.fiber,
      servingDescription: parsed.serving_description ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Call the Anthropic Messages API with the given description.
 * Returns the raw text response or throws on failure.
 */
async function callAnthropic(
  apiKey: string,
  description: string,
): Promise<string> {
  const messages: AnthropicMessage[] = [
    {
      role: "user",
      content: `Estimate the macronutrients for: ${description}`,
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: ESTIMATION_SYSTEM_PROMPT,
        messages,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error: ${String(res.status)} ${body}`);
  }

  const data = (await res.json()) as AnthropicResponse;

  if (!data.content || data.content.length === 0) {
    throw new Error("Anthropic API returned empty content");
  }

  return data.content[0].text;
}

// ── Public API ────────────────────────────────────────────────────────

export type EstimationError =
  | { type: "not_configured" }
  | { type: "api_error"; message: string }
  | { type: "invalid_response" };

export type EstimationResult =
  | { ok: true; data: AIEstimation }
  | { ok: false; error: EstimationError };

/**
 * Estimate macronutrients for a free-text food description using AI.
 *
 * Error handling:
 * - Missing API key: returns not_configured error
 * - API failure: retries once, then returns api_error
 * - Invalid JSON response: retries once, then returns invalid_response
 */
export async function estimateMacros(
  apiKey: string | undefined,
  description: string,
): Promise<EstimationResult> {
  if (!apiKey) {
    return { ok: false, error: { type: "not_configured" } };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callAnthropic(apiKey, description);
      const estimation = parseEstimation(text);

      if (estimation) {
        return { ok: true, data: estimation };
      }

      // Invalid JSON — retry once
      if (attempt === 0) {
        continue;
      }

      return { ok: false, error: { type: "invalid_response" } };
    } catch (err: unknown) {
      if (attempt === 0) {
        // Retry once on API failure
        continue;
      }

      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { type: "api_error", message } };
    }
  }

  // Should not reach here, but satisfy TypeScript
  return { ok: false, error: { type: "api_error", message: "Max retries exceeded" } };
}
