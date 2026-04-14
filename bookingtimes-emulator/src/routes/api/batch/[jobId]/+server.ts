/**
 * Batch Job — single-item endpoint
 *
 * PATCH /api/batch/:jobId — Update a batch job's status
 */

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

const ALLOWED_STATUSES = ['pending', 'processing', 'complete', 'failed', 'needs_review'] as const;
type JobStatus = (typeof ALLOWED_STATUSES)[number];

interface PatchBody {
	status: JobStatus;
}

export async function PATCH({ params, request, locals }: RequestEvent) {
	const db = locals.db;

	const jobId = params.jobId;
	if (!jobId) throw error(400, 'Job ID is required');

	let body: PatchBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.status || !(ALLOWED_STATUSES as readonly string[]).includes(body.status)) {
		throw error(400, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
	}

	try {
		// Verify the job exists
		const existing = await db
			.prepare('SELECT id, status FROM batch_jobs WHERE id = ?')
			.bind(jobId)
			.first<{ id: string; status: string }>();

		if (!existing) {
			throw error(404, `Batch job not found: ${jobId}`);
		}

		const now = new Date().toISOString();
		await db
			.prepare('UPDATE batch_jobs SET status = ?, updated_at = ? WHERE id = ?')
			.bind(body.status, now, jobId)
			.run();

		return json({
			job: {
				id: jobId,
				previous_status: existing.status,
				status: body.status,
				updated_at: now
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to update batch job: ${message}`);
	}
}
