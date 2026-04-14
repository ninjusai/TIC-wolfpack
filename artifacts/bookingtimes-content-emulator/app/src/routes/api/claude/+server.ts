import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callClaude } from '$lib/server/claude-cli';
import type { ClaudeCliOptions } from '$lib/server/claude-cli';

export const POST: RequestHandler = async ({ request }) => {
	let body: { prompt?: string; options?: ClaudeCliOptions };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { prompt, options } = body;

	if (!prompt || typeof prompt !== 'string') {
		throw error(400, 'Missing or invalid "prompt" field — must be a non-empty string');
	}

	if (prompt.trim().length === 0) {
		throw error(400, 'Prompt must not be empty or whitespace-only');
	}

	// Validate options if provided
	if (options !== undefined) {
		if (typeof options !== 'object' || options === null) {
			throw error(400, '"options" must be an object');
		}
		if (options.timeoutMs !== undefined && (typeof options.timeoutMs !== 'number' || options.timeoutMs <= 0)) {
			throw error(400, '"options.timeoutMs" must be a positive number');
		}
		if (options.maxRetries !== undefined && (typeof options.maxRetries !== 'number' || options.maxRetries < 1)) {
			throw error(400, '"options.maxRetries" must be a number >= 1');
		}
		if (options.retryDelayMs !== undefined && (typeof options.retryDelayMs !== 'number' || options.retryDelayMs < 0)) {
			throw error(400, '"options.retryDelayMs" must be a non-negative number');
		}
		if (options.model !== undefined && typeof options.model !== 'string') {
			throw error(400, '"options.model" must be a string');
		}
	}

	const result = await callClaude(prompt, options);
	return json(result);
};
