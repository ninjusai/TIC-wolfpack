import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePageContent, runCoherencePass } from '$lib/server/content-generator';

export const POST: RequestHandler = async ({ params, request }) => {
	const blueprintId = Number(params.blueprintId);
	if (!Number.isInteger(blueprintId) || blueprintId <= 0) {
		throw error(400, 'Invalid blueprintId — must be a positive integer');
	}

	// Optional body for configuration
	let delayMs: number | undefined;
	let skipCompleted: boolean | undefined;
	let coherencePass = false;

	try {
		const body = await request.json().catch(() => ({}));
		if (typeof body === 'object' && body !== null) {
			const b = body as Record<string, unknown>;
			if (b.delayMs !== undefined) {
				if (typeof b.delayMs !== 'number' || b.delayMs < 0) {
					throw error(400, '"delayMs" must be a non-negative number');
				}
				delayMs = b.delayMs;
			}
			if (b.skipCompleted !== undefined) {
				if (typeof b.skipCompleted !== 'boolean') {
					throw error(400, '"skipCompleted" must be a boolean');
				}
				skipCompleted = b.skipCompleted;
			}
			if (b.coherencePass !== undefined) {
				coherencePass = !!b.coherencePass;
			}
		}
	} catch (e) {
		// If it's already an HTTP error from our validation, re-throw
		if (e && typeof e === 'object' && 'status' in e) throw e;
		// Otherwise ignore — body is optional
	}

	try {
		const result = await generatePageContent(blueprintId, { delayMs, skipCompleted });

		// Run optional coherence pass if requested and at least some sections succeeded
		let coherence = null;
		if (coherencePass && result.sectionsGenerated > 0) {
			coherence = await runCoherencePass(blueprintId);
		}

		return json({ ...result, coherence });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('not found')) {
			throw error(404, msg);
		}
		throw error(500, `Generation failed: ${msg}`);
	}
};
