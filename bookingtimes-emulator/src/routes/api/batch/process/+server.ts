/**
 * WRK-035: Batch Process API
 *
 * POST /api/batch/process — Process the next pending batch job
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processNextPendingJob } from '$lib/server/batch-pipeline';

export const POST: RequestHandler = async ({ locals }) => {
	const db = locals.db;
	const kv = locals.cache;
	const apiKey = process.env.ANTHROPIC_API_KEY;

	if (!apiKey) throw error(503, 'AI service not configured');

	try {
		const result = await processNextPendingJob(db, kv, apiKey);

		if (!result) {
			return json({ message: 'No pending batch jobs', result: null });
		}

		return json({ result });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Batch processing failed: ${message}`);
	}
};
