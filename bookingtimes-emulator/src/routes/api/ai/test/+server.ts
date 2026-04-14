/**
 * GET /api/ai/test — Minimal Claude CLI test endpoint.
 *
 * Spawns `claude -p` to verify the CLI is available and working.
 * Returns the response or detailed error info for debugging.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { claudeGenerate } from '$lib/server/claude-cli';
import { execSync } from 'node:child_process';

export const GET: RequestHandler = async () => {
	const diagnostics: Record<string, unknown> = {
		authMethod: 'claude-cli-subprocess',
		timestamp: new Date().toISOString()
	};

	// Check CLI availability and version
	try {
		const version = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
		diagnostics.cliVersion = version;
		diagnostics.cliFound = true;
	} catch {
		diagnostics.cliFound = false;
		return json({
			ok: false,
			error: 'Claude Code CLI not found in PATH. Ensure `claude` is installed and accessible.',
			diagnostics
		}, { status: 200 });
	}

	// Make minimal CLI call
	try {
		const result = await claudeGenerate({
			prompt: 'Say hello in exactly 5 words',
			maxTokens: 30,
			timeoutMs: 30_000
		});

		return json({
			ok: true,
			model: result.model,
			response: result.content,
			usage: result.usage,
			session_id: result.session_id,
			diagnostics
		});
	} catch (err) {
		return json({
			ok: false,
			error: err instanceof Error ? err.message : String(err),
			diagnostics
		}, { status: 200 });
	}
};
