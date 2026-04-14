/**
 * WRK-041: Backup API endpoints
 *
 * GET  /api/backup  — List all backups
 * POST /api/backup  — Create a new backup
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBackup, listBackups } from '$lib/server/backup';

// ─── GET /api/backup ────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ locals }) => {
	const storage = locals.storage;

	try {
		const backups = await listBackups(storage);
		return json({ backups });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list backups: ${message}`);
	}
};

// ─── POST /api/backup ───────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ locals }) => {
	const db = locals.db;
	const storage = locals.storage;

	try {
		const result = await createBackup(db, storage);
		return json({ backup: result }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create backup: ${message}`);
	}
};
