import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSessions } from '$lib/server/ai-sessions';

/**
 * GET /api/ai/sessions?site_id=xxx
 *
 * List AI sessions, optionally filtered by site_id.
 * Returns sessions ordered by most recently updated first.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.db;

	const siteId = url.searchParams.get('site_id') ?? undefined;

	try {
		const sessions = await listSessions(db, siteId);
		return json({ sessions });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list sessions: ${message}`);
	}
};
