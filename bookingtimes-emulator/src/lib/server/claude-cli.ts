/**
 * Claude CLI subprocess wrapper.
 *
 * Replaces direct Anthropic API fetch with `claude -p` subprocess calls.
 * Uses the Claude Code CLI which runs under the Max subscription with
 * full rate limits, avoiding the 429 errors from consumer OAuth tokens.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClaudeRequest {
	prompt: string;
	systemPrompt?: string;
	model?: string;
	maxTokens?: number;
	sessionId?: string;
	timeoutMs?: number;
}

export interface ClaudeResponse {
	content: string;
	session_id: string;
	model: string;
	usage?: { input_tokens: number; output_tokens: number };
}

export interface ClaudeStreamChunk {
	type: string;
	text?: string;
	session_id?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_TIMEOUT_MS = 120_000;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build CLI args. Returns { args, systemPromptFile } where systemPromptFile
 * is a temp file path that the caller must clean up after the process exits,
 * or undefined if no temp file was created.
 */
function buildArgs(req: ClaudeRequest, streaming: boolean): { args: string[]; systemPromptFile?: string } {
	const args: string[] = [
		'-p',   // REQUIRED: non-interactive print mode
		'--output-format', streaming ? 'stream-json' : 'json',
		'--model', req.model ?? DEFAULT_MODEL
	];

	if (streaming) {
		args.push('--verbose');
	}

	if (req.sessionId) {
		args.push('--resume', req.sessionId);
	}

	// Handle system prompt: write to temp file to avoid cmd line length limits
	let systemPromptFile: string | undefined;
	if (req.systemPrompt) {
		systemPromptFile = join(tmpdir(), `claude-sysprompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
		writeFileSync(systemPromptFile, req.systemPrompt, 'utf-8');
		args.push('--system-prompt-file', systemPromptFile);
	}

	return { args, systemPromptFile };
}

/**
 * Build the user prompt to pipe via stdin.
 * System prompt is handled separately via --system-prompt-file flag.
 */
function buildStdinPrompt(req: ClaudeRequest): string {
	return req.prompt;
}

// ── Non-streaming ──────────────────────────────────────────────────────────

/**
 * Call Claude CLI in non-streaming mode. Returns parsed JSON response.
 */
export async function claudeGenerate(req: ClaudeRequest): Promise<ClaudeResponse> {
	const { args, systemPromptFile } = buildArgs(req, false);
	const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const stdinPrompt = buildStdinPrompt(req);

	/** Clean up temp system-prompt file if one was created */
	const cleanup = () => {
		if (systemPromptFile) {
			try { unlinkSync(systemPromptFile); } catch { /* ignore */ }
		}
	};

	return new Promise<ClaudeResponse>((resolve, reject) => {
		const cleanEnv = { ...process.env };
		delete cleanEnv.ANTHROPIC_AUTH_TOKEN;
		delete cleanEnv.ANTHROPIC_API_KEY;

		const proc = spawn('claude', args, {
			stdio: ['pipe', 'pipe', 'pipe'],
			shell: true,
			env: cleanEnv
		});

		// Pipe user prompt via stdin
		proc.stdin.write(stdinPrompt);
		proc.stdin.end();

		let stdout = '';
		let stderr = '';

		const timer = setTimeout(() => {
			proc.kill('SIGTERM');
			cleanup();
			reject(new Error(`Claude CLI timed out after ${timeoutMs / 1000}s`));
		}, timeoutMs);

		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		proc.on('error', (err) => {
			clearTimeout(timer);
			cleanup();
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				reject(new Error('Claude Code CLI not installed or not in PATH'));
			} else {
				reject(err);
			}
		});

		proc.on('close', (code) => {
			clearTimeout(timer);
			cleanup();

			if (code !== 0) {
				reject(new Error(
					`Claude CLI exited with code ${code}: ${stderr.trim() || stdout.trim()}`
				));
				return;
			}

			try {
				const parsed = JSON.parse(stdout);

				// The JSON output format returns { result: "text", session_id, model, ... }
				// or it may return the text directly. Handle both.
				const content = typeof parsed === 'string'
					? parsed
					: parsed.result ?? parsed.content ?? parsed.text ?? stdout.trim();

				const response: ClaudeResponse = {
					content: typeof content === 'string' ? content : JSON.stringify(content),
					session_id: parsed.session_id ?? '',
					model: parsed.model ?? req.model ?? DEFAULT_MODEL,
					usage: parsed.usage
				};

				resolve(response);
			} catch {
				// If JSON parsing fails, treat the raw stdout as the content
				resolve({
					content: stdout.trim(),
					session_id: '',
					model: req.model ?? DEFAULT_MODEL
				});
			}
		});
	});
}

// ── Streaming ──────────────────────────────────────────────────────────────

/**
 * Call Claude CLI in streaming mode. Yields chunks as they arrive.
 *
 * stream-json format outputs one JSON object per line on stdout.
 */
export async function* claudeStream(req: ClaudeRequest): AsyncGenerator<ClaudeStreamChunk> {
	const { args, systemPromptFile } = buildArgs(req, true);
	const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const stdinPrompt = buildStdinPrompt(req);

	/** Clean up temp system-prompt file if one was created */
	const cleanup = () => {
		if (systemPromptFile) {
			try { unlinkSync(systemPromptFile); } catch { /* ignore */ }
		}
	};

	const cleanEnv = { ...process.env };
	delete cleanEnv.ANTHROPIC_AUTH_TOKEN;
	delete cleanEnv.ANTHROPIC_API_KEY;

	const proc = spawn('claude', args, {
		stdio: ['pipe', 'pipe', 'pipe'],
		shell: true,
		env: cleanEnv
	});

	// Pipe user prompt via stdin
	proc.stdin.write(stdinPrompt);
	proc.stdin.end();

	let stderr = '';
	let sessionId = '';
	let timedOut = false;

	const timer = setTimeout(() => {
		timedOut = true;
		proc.kill('SIGTERM');
		cleanup();
	}, timeoutMs);

	proc.stderr.on('data', (chunk: Buffer) => {
		stderr += chunk.toString();
	});

	// Create an async iterator from the stdout stream
	const iterator = createLineIterator(proc.stdout);

	try {
		for await (const line of iterator) {
			if (!line.trim()) continue;

			try {
				const event = JSON.parse(line);

				// Extract session_id from initial messages
				if (event.session_id) {
					sessionId = event.session_id;
				}

				// Handle different event types from stream-json format
				if (event.type === 'assistant' && event.message?.content) {
					// Full message events (may contain accumulated text)
					for (const block of event.message.content) {
						if (block.type === 'text' && block.text) {
							yield { type: 'content', text: block.text, session_id: sessionId };
						}
					}
				} else if (event.type === 'content_block_delta' && event.delta?.text) {
					// Delta events
					yield { type: 'content', text: event.delta.text, session_id: sessionId };
				} else if (event.type === 'content_block_start' && event.content_block?.text) {
					yield { type: 'content', text: event.content_block.text, session_id: sessionId };
				} else if (event.type === 'result') {
					// Final result event from stream-json
					if (event.result) {
						yield { type: 'content', text: event.result, session_id: sessionId };
					}
					if (event.session_id) {
						sessionId = event.session_id;
					}
				} else if (event.type === 'message_start' || event.type === 'message_stop') {
					// Metadata events - capture session_id if present
					if (event.session_id) sessionId = event.session_id;
				}
			} catch {
				// Non-JSON line or malformed — skip
			}
		}
	} finally {
		clearTimeout(timer);
		cleanup();
	}

	// Wait for process to exit
	const exitCode = await new Promise<number | null>((resolve) => {
		proc.on('close', resolve);
		// If already closed, this fires immediately
		if (proc.exitCode !== null) resolve(proc.exitCode);
	});

	if (timedOut) {
		throw new Error(`Claude CLI timed out after ${timeoutMs / 1000}s`);
	}

	if (exitCode !== 0 && exitCode !== null) {
		throw new Error(
			`Claude CLI exited with code ${exitCode}: ${stderr.trim()}`
		);
	}

	// Yield final session_id event
	if (sessionId) {
		yield { type: 'session', session_id: sessionId };
	}
}

/**
 * Convert a Node.js readable stream into an async iterator of lines.
 */
async function* createLineIterator(
	stream: import('node:stream').Readable
): AsyncGenerator<string> {
	let buffer = '';

	for await (const chunk of stream) {
		buffer += chunk.toString();

		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			yield line;
		}
	}

	// Yield any remaining content in buffer
	if (buffer.trim()) {
		yield buffer;
	}
}
