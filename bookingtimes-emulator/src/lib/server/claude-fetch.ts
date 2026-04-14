/**
 * Claude API fetch wrapper with retry logic for 429 rate-limit errors.
 *
 * Consumer OAuth tokens (from Claude Code) have lower rate limits than
 * API keys. This module centralises the retry-with-backoff pattern so
 * both the streaming generate endpoint and the batch pipeline use the
 * same behaviour.
 */

import { getValidAccessToken, isAuthenticated, getTokenSource } from '$lib/server/oauth';

// ── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5_000; // 5 seconds — generous for consumer limits

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClaudeFetchOptions {
	model: string;
	max_tokens: number;
	system: string;
	messages: Array<{ role: 'user' | 'assistant'; content: string }>;
	stream?: boolean;
	/** If provided, use this API key instead of OAuth. */
	apiKey?: string;
}

export interface ClaudeFetchResult {
	response: Response;
	/** How many retries were needed (0 = first attempt succeeded). */
	retries: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the Retry-After header. Returns milliseconds to wait, or null if
 * the header is absent / unparseable.
 */
function parseRetryAfter(response: Response): number | null {
	const header = response.headers.get('retry-after');
	if (!header) return null;

	// Could be seconds (integer) or an HTTP date
	const seconds = Number(header);
	if (!Number.isNaN(seconds) && seconds > 0) {
		return seconds * 1000;
	}

	const date = Date.parse(header);
	if (!Number.isNaN(date)) {
		const wait = date - Date.now();
		return wait > 0 ? wait : null;
	}

	return null;
}

/**
 * Build appropriate headers for the current auth method.
 */
async function buildHeaders(apiKey?: string): Promise<Record<string, string>> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'anthropic-version': '2023-06-01'
	};

	if (apiKey) {
		headers['x-api-key'] = apiKey;
	} else {
		const accessToken = await getValidAccessToken();
		headers['Authorization'] = `Bearer ${accessToken}`;
		headers['anthropic-beta'] = 'oauth-2025-04-20';
	}

	return headers;
}

// ── Main fetch function ────────────────────────────────────────────────────

/**
 * Fetch the Claude API with automatic retry on 429.
 *
 * Uses exponential backoff, respecting the `Retry-After` header when
 * present. Throws only on non-retryable errors.
 */
export async function claudeFetch(options: ClaudeFetchOptions): Promise<ClaudeFetchResult> {
	const { model, max_tokens, system, messages, stream = false, apiKey } = options;

	const body = JSON.stringify({ model, max_tokens, stream, system, messages });

	let lastResponse: Response | null = null;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		// Re-build headers each attempt — token might have been refreshed
		const headers = await buildHeaders(apiKey);

		const response = await fetch(ANTHROPIC_API_URL, {
			method: 'POST',
			headers,
			body
		});

		if (response.status !== 429) {
			return { response, retries: attempt };
		}

		// 429 — rate limited
		lastResponse = response;

		if (attempt === MAX_RETRIES) {
			break; // Don't sleep after the last attempt
		}

		// Calculate backoff: use Retry-After if available, else exponential
		const retryAfterMs = parseRetryAfter(response);
		const backoffMs = retryAfterMs ?? INITIAL_BACKOFF_MS * Math.pow(2, attempt);

		// Cap at 60 seconds
		const waitMs = Math.min(backoffMs, 60_000);

		console.warn(
			`[claude-fetch] 429 rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
			`Retrying in ${(waitMs / 1000).toFixed(1)}s...`
		);

		// Consume the body so the connection can be reused
		await response.text();

		await sleep(waitMs);
	}

	// All retries exhausted — return the last 429 response
	return { response: lastResponse!, retries: MAX_RETRIES };
}

/**
 * Build a user-friendly error message for Claude API errors.
 */
export function formatClaudeError(status: number, responseText: string): string {
	if (status === 429) {
		const source = getTokenSource();
		if (source === 'claude_code') {
			return (
				'Rate limited by Claude API. You are using shared Claude Code OAuth tokens which have ' +
				'consumer-level rate limits and share a bucket with Claude Code CLI. To fix this, run ' +
				'`claude setup-token` to get a dedicated token, then restart with: ' +
				'ANTHROPIC_AUTH_TOKEN=<token> npm run dev. Or set ANTHROPIC_API_KEY for API-level limits.'
			);
		}
		if (source === 'auth_token') {
			return (
				'Rate limited by Claude API. You are using a dedicated OAuth token (ANTHROPIC_AUTH_TOKEN) ' +
				'which has consumer-level rate limits. Please wait a moment and try again, or set ' +
				'ANTHROPIC_API_KEY for higher limits.'
			);
		}
		return `Rate limited by Claude API. Please wait a moment and try again. (${responseText})`;
	}

	if (status === 401) {
		return 'Authentication failed. Your Claude token may be expired. Please visit /auth to reconnect.';
	}

	if (status === 403) {
		return 'Access denied. Your Claude token may not have the required scopes.';
	}

	return `Claude API error (${status}): ${responseText}`;
}
