/**
 * Batch Job Queue — D1 CRUD for the batch_jobs table.
 *
 * Provides queue-style operations for bulk page generation:
 * create jobs, fetch next pending, update status, retry tracking,
 * and summary reporting.
 *
 * Consumed by the batch pipeline (WRK-035).
 */

import type { D1CompatDatabase, D1CompatStatement } from '$lib/server/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BatchJob {
	id: string;
	template_id: string;
	site_id: string;
	suburb: string;
	status: 'pending' | 'processing' | 'complete' | 'failed' | 'needs_review';
	page_id: string | null;
	error_message: string | null;
	retry_count: number;
	created_at: string;
	updated_at: string;
}

export interface BatchSummary {
	total: number;
	pending: number;
	processing: number;
	complete: number;
	failed: number;
	needs_review: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Max rows per INSERT to stay within D1 parameter limits. */
const CHUNK_SIZE = 50;

// ── Queue Operations ──────────────────────────────────────────────────────

/**
 * Insert one batch_job record per suburb, all starting as 'pending'.
 * Inserts are chunked at 50 rows to respect D1 parameter limits.
 * Returns the list of generated job IDs.
 */
export async function createBatchJobs(
	db: D1CompatDatabase,
	templateId: string,
	siteId: string,
	suburbs: string[]
): Promise<string[]> {
	const now = new Date().toISOString();
	const ids: string[] = [];

	for (let i = 0; i < suburbs.length; i += CHUNK_SIZE) {
		const chunk = suburbs.slice(i, i + CHUNK_SIZE);
		const stmts: D1CompatStatement[] = [];

		for (const suburb of chunk) {
			const id = crypto.randomUUID();
			ids.push(id);

			stmts.push(
				db
					.prepare(
						`INSERT INTO batch_jobs (id, template_id, site_id, suburb, status, retry_count, created_at, updated_at)
						 VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`
					)
					.bind(id, templateId, siteId, suburb, now, now)
			);
		}

		await db.batch(stmts);
	}

	return ids;
}

/**
 * Fetch the oldest pending job and atomically mark it as 'processing'.
 * Returns null when the queue is empty.
 */
export async function getNextPendingJob(
	db: D1CompatDatabase
): Promise<BatchJob | null> {
	const now = new Date().toISOString();

	// Select oldest pending job
	const job = await db
		.prepare(
			`SELECT id FROM batch_jobs
			 WHERE status = 'pending'
			 ORDER BY created_at ASC
			 LIMIT 1`
		)
		.first<{ id: string }>();

	if (!job) return null;

	// Atomically mark as processing (only if still pending)
	await db
		.prepare(
			`UPDATE batch_jobs
			 SET status = 'processing', updated_at = ?
			 WHERE id = ? AND status = 'pending'`
		)
		.bind(now, job.id)
		.run();

	// Return the full row
	const updated = await db
		.prepare(`SELECT * FROM batch_jobs WHERE id = ?`)
		.bind(job.id)
		.first<BatchJob>();

	return updated ?? null;
}

/**
 * Update a job's status and timestamp. Optionally set page_id or error_message.
 */
export async function updateJobStatus(
	db: D1CompatDatabase,
	jobId: string,
	status: string,
	extras?: { page_id?: string; error_message?: string }
): Promise<void> {
	const now = new Date().toISOString();
	const sets: string[] = ['status = ?', 'updated_at = ?'];
	const binds: (string | null)[] = [status, now];

	if (extras?.page_id !== undefined) {
		sets.push('page_id = ?');
		binds.push(extras.page_id);
	}

	if (extras?.error_message !== undefined) {
		sets.push('error_message = ?');
		binds.push(extras.error_message);
	}

	binds.push(jobId);

	await db
		.prepare(`UPDATE batch_jobs SET ${sets.join(', ')} WHERE id = ?`)
		.bind(...binds)
		.run();
}

/**
 * Increment a job's retry_count and return the new value.
 */
export async function incrementRetry(
	db: D1CompatDatabase,
	jobId: string
): Promise<number> {
	const now = new Date().toISOString();

	await db
		.prepare(
			`UPDATE batch_jobs
			 SET retry_count = retry_count + 1, updated_at = ?
			 WHERE id = ?`
		)
		.bind(now, jobId)
		.run();

	const row = await db
		.prepare(`SELECT retry_count FROM batch_jobs WHERE id = ?`)
		.bind(jobId)
		.first<{ retry_count: number }>();

	return row?.retry_count ?? 0;
}

/**
 * Return counts grouped by status. Optionally filter by template_id.
 */
export async function getBatchSummary(
	db: D1CompatDatabase,
	templateId?: string
): Promise<BatchSummary> {
	const where = templateId ? 'WHERE template_id = ?' : '';
	const binds = templateId ? [templateId] : [];

	const rows = await db
		.prepare(
			`SELECT status, COUNT(*) as count
			 FROM batch_jobs ${where}
			 GROUP BY status`
		)
		.bind(...binds)
		.all<{ status: string; count: number }>();

	const summary: BatchSummary = {
		total: 0,
		pending: 0,
		processing: 0,
		complete: 0,
		failed: 0,
		needs_review: 0,
	};

	for (const row of rows.results) {
		const key = row.status === 'needs_review' ? 'needs_review' : row.status;
		if (key in summary) {
			(summary as unknown as Record<string, number>)[key] = row.count;
		}
		summary.total += row.count;
	}

	return summary;
}

/**
 * List batch jobs with optional filters for status, template_id, and site_id.
 */
export async function listBatchJobs(
	db: D1CompatDatabase,
	filters?: { status?: string; template_id?: string; site_id?: string }
): Promise<BatchJob[]> {
	const conditions: string[] = [];
	const binds: string[] = [];

	if (filters?.status) {
		conditions.push('status = ?');
		binds.push(filters.status);
	}

	if (filters?.template_id) {
		conditions.push('template_id = ?');
		binds.push(filters.template_id);
	}

	if (filters?.site_id) {
		conditions.push('site_id = ?');
		binds.push(filters.site_id);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	const rows = await db
		.prepare(
			`SELECT * FROM batch_jobs ${where}
			 ORDER BY created_at ASC`
		)
		.bind(...binds)
		.all<BatchJob>();

	return rows.results;
}
