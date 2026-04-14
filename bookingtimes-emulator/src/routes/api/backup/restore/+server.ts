/**
 * WRK-041: Backup restore endpoint
 *
 * POST /api/backup/restore  — Restore from a specific backup
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restoreFromBackup } from '$lib/server/backup';

// ─── POST /api/backup/restore ───────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const storage = locals.storage;

	let body: { backup_key: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.backup_key || typeof body.backup_key !== 'string') {
		throw error(400, 'backup_key is required');
	}

	try {
		const result = await restoreFromBackup(db, storage, body.backup_key);
		return json({ restored: result });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to restore backup: ${message}`);
	}
};
