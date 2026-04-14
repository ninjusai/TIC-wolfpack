/**
 * WRK-035: Batch Job API — collection endpoints
 *
 * POST /api/batch — Create batch jobs for a set of suburbs
 * GET  /api/batch — List batch jobs (optional ?status=xxx filter)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBatchJobs } from '$lib/server/batch-pipeline';

// ─── GET /api/batch ─────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.db;

	const status = url.searchParams.get('status');

	try {
		let result;

		if (status) {
			result = await db
				.prepare(
					'SELECT * FROM batch_jobs WHERE status = ? ORDER BY created_at DESC'
				)
				.bind(status)
				.all();
		} else {
			result = await db
				.prepare('SELECT * FROM batch_jobs ORDER BY created_at DESC')
				.all();
		}

		return json({ jobs: result.results ?? [] });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list batch jobs: ${message}`);
	}
};

// ─── POST /api/batch ────────────────────────────────────────────────────────

interface CreateBatchBody {
	template_id: string;
	site_id: string;
	suburb_ids: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: CreateBatchBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.template_id || typeof body.template_id !== 'string') {
		throw error(400, 'template_id is required');
	}
	if (!body.site_id || typeof body.site_id !== 'string') {
		throw error(400, 'site_id is required');
	}
	if (!Array.isArray(body.suburb_ids) || body.suburb_ids.length === 0) {
		throw error(400, 'suburb_ids must be a non-empty array');
	}

	try {
		const result = await createBatchJobs(db, {
			template_id: body.template_id,
			site_id: body.site_id,
			suburb_ids: body.suburb_ids
		});

		return json(
			{
				batch: {
					template_id: body.template_id,
					site_id: body.site_id,
					total_jobs: result.jobs.length,
					jobs: result.jobs
				}
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create batch jobs: ${message}`);
	}
};
