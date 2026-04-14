/**
 * Claude CLI Integration Test — WRK-BCE2-007
 *
 * Manual test script. Run with:
 *   npx tsx src/lib/server/claude-cli.test.ts
 *
 * Prerequisites:
 *   - `claude` CLI must be installed and on PATH
 *   - User must be authenticated with Claude CLI
 */

import { callClaude } from './claude-cli.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(label: string, data: unknown): void {
	console.log(`\n=== ${label} ===`);
	console.log(JSON.stringify(data, null, 2));
}

async function assert(
	name: string,
	fn: () => Promise<boolean>,
): Promise<boolean> {
	try {
		const passed = await fn();
		console.log(passed ? `  PASS: ${name}` : `  FAIL: ${name}`);
		return passed;
	} catch (err) {
		console.log(`  FAIL: ${name} — ${err instanceof Error ? err.message : err}`);
		return false;
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	console.log('Claude CLI Integration Tests');
	console.log('============================\n');

	const results: boolean[] = [];

	// --- Test 1: Basic call ---
	console.log('\n--- Test 1: Basic prompt-response ---');
	const basic = await callClaude(
		'Respond with exactly the text: HELLO WORLD. Nothing else, no quotes, no punctuation after it.',
		{ maxRetries: 1, timeoutMs: 30_000 },
	);
	log('Result', basic);
	results.push(
		await assert('Response is successful', async () => basic.success),
		await assert('Response contains HELLO WORLD', async () =>
			basic.response.toUpperCase().includes('HELLO WORLD'),
		),
		await assert('Attempt is 1', async () => basic.attempt === 1),
		await assert('Duration is positive', async () => basic.durationMs > 0),
	);

	// --- Test 2: Timeout handling ---
	console.log('\n--- Test 2: Timeout handling ---');
	const timeout = await callClaude(
		'Write a 10,000 word essay on the history of computing.',
		{ timeoutMs: 1_000, maxRetries: 1 }, // 1 second — should timeout
	);
	log('Result', timeout);
	results.push(
		await assert('Timed-out call is not successful', async () => !timeout.success),
		await assert('Error mentions timeout', async () =>
			(timeout.error ?? '').toLowerCase().includes('timed out') ||
			(timeout.error ?? '').toLowerCase().includes('timeout'),
		),
	);

	// --- Test 3: Empty prompt safeguard ---
	console.log('\n--- Test 3: Long prompt (stdin piping) ---');
	const longContext = 'Context line. '.repeat(500); // ~7,000 chars
	const longPrompt = `${longContext}\n\nGiven the above context, respond with exactly: LONG_PROMPT_OK`;
	const longResult = await callClaude(longPrompt, { maxRetries: 1, timeoutMs: 60_000 });
	log('Result', longResult);
	results.push(
		await assert('Long prompt call succeeds', async () => longResult.success),
		await assert('Response contains LONG_PROMPT_OK', async () =>
			longResult.response.includes('LONG_PROMPT_OK'),
		),
	);

	// --- Summary ---
	const passed = results.filter(Boolean).length;
	const total = results.length;
	console.log(`\n============================`);
	console.log(`Results: ${passed}/${total} passed`);
	console.log(passed === total ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
	process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
