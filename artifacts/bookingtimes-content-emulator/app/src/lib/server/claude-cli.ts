/**
 * Claude CLI Subprocess Module — WRK-BCE2-007
 *
 * Spawns `claude -p` as a subprocess for single-turn, stateless AI calls.
 * The application is the memory; Claude is the muscle. (ADR-014)
 *
 * - Prompt piped via stdin (handles long prompts, avoids Windows cmd length limits)
 * - Environment sanitized (no API keys leaked to subprocess)
 * - Retry with exponential backoff on transient failures
 * - No streaming — each call blocks until complete
 */

import { spawn } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeCliOptions {
	timeoutMs?: number;       // Default: 120000 (120 seconds)
	maxRetries?: number;      // Default: 3
	retryDelayMs?: number;    // Base delay for exponential backoff, default: 2000
	model?: string;           // Optional model override
}

export interface ClaudeCliResult {
	success: boolean;
	response: string;         // Claude's response text
	durationMs: number;       // How long the call took
	attempt: number;          // Which attempt succeeded (1-based)
	error?: string;           // Error message if failed
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a sanitized copy of process.env without API key variables. */
function sanitizedEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	delete env.ANTHROPIC_AUTH_TOKEN;
	delete env.ANTHROPIC_API_KEY;
	return env;
}

/** Sleep for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine whether an error is transient (worth retrying).
 * We retry on: timeout, process crash / non-zero exit, spawn failure.
 * We do NOT retry when Claude returned a valid response (even if it
 * contains an error message — that's a prompt issue, not transient).
 */
function isTransientError(error: string): boolean {
	const transientPatterns = [
		'timed out',
		'ETIMEDOUT',
		'ECONNRESET',
		'ENOENT',
		'EPERM',
		'spawn',
		'process exited',
		'killed',
		'signal',
	];
	const lower = error.toLowerCase();
	return transientPatterns.some((p) => lower.includes(p.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Execute a single `claude -p` subprocess call.
 * Returns a promise that resolves with stdout or rejects on error/timeout.
 */
function execClaude(
	prompt: string,
	timeoutMs: number,
	model?: string,
): Promise<{ stdout: string; stderr: string; durationMs: number }> {
	return new Promise((resolve, reject) => {
		const start = Date.now();

		const args = ['-p'];
		if (model) {
			args.push('--model', model);
		}

		const child = spawn('claude', args, {
			env: sanitizedEnv(),
			stdio: ['pipe', 'pipe', 'pipe'],
			shell: true,           // Required on Windows to resolve `claude` via PATH
			windowsHide: true,     // Don't flash a console window
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

		// --- Timeout ---
		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			// Give it a moment, then force-kill
			setTimeout(() => {
				if (!child.killed) child.kill('SIGKILL');
			}, 2_000);
			reject(new Error(`Claude CLI timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		// --- Process exit ---
		child.on('close', (code) => {
			clearTimeout(timer);
			const durationMs = Date.now() - start;
			const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
			const stderr = Buffer.concat(stderrChunks).toString('utf-8');

			if (code !== 0) {
				reject(
					new Error(
						`Claude CLI process exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
					),
				);
				return;
			}

			resolve({ stdout, stderr, durationMs });
		});

		// --- Spawn error ---
		child.on('error', (err) => {
			clearTimeout(timer);
			reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
		});

		// --- Pipe prompt via stdin ---
		child.stdin.write(prompt, 'utf-8');
		child.stdin.end();
	});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single-turn Claude CLI call with retry logic.
 *
 * Spawns `claude -p` as a subprocess, pipes the prompt via stdin,
 * captures stdout as the response.
 */
export async function callClaude(
	prompt: string,
	options?: ClaudeCliOptions,
): Promise<ClaudeCliResult> {
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
	const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
	const model = options?.model;

	let lastError = '';

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const { stdout, stderr, durationMs } = await execClaude(prompt, timeoutMs, model);

			// Log stderr if present (diagnostics, not necessarily an error)
			if (stderr.trim()) {
				console.warn(`[claude-cli] stderr (attempt ${attempt}):`, stderr.trim().slice(0, 300));
			}

			const response = stdout.trim();

			// Treat a completely empty response as a transient failure
			if (!response) {
				lastError = 'Claude returned an empty response';
				if (attempt < maxRetries) {
					const delay = retryDelayMs * Math.pow(2, attempt - 1);
					console.warn(
						`[claude-cli] Empty response on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`,
					);
					await sleep(delay);
					continue;
				}
				return {
					success: false,
					response: '',
					durationMs,
					attempt,
					error: lastError,
				};
			}

			return {
				success: true,
				response,
				durationMs,
				attempt,
			};
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			lastError = errorMsg;

			console.error(`[claude-cli] Attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);

			// Only retry on transient errors
			if (!isTransientError(errorMsg)) {
				return {
					success: false,
					response: '',
					durationMs: 0,
					attempt,
					error: errorMsg,
				};
			}

			if (attempt < maxRetries) {
				const delay = retryDelayMs * Math.pow(2, attempt - 1);
				console.warn(`[claude-cli] Retrying in ${delay}ms...`);
				await sleep(delay);
			}
		}
	}

	// All retries exhausted
	return {
		success: false,
		response: '',
		durationMs: 0,
		attempt: maxRetries,
		error: `All ${maxRetries} attempts failed. Last error: ${lastError}`,
	};
}
