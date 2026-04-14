/**
 * WRK-040: Non-Destructive Rollback API
 *
 * POST /api/pages/:pageId/rollback  — Roll back to a specific version
 *
 * Creates a NEW version that copies content from the target version.
 * Full history is preserved — no deletion.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollbackToVersion } from '$lib/server/version-history';

interface RollbackBody {
	version_id: string;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = locals.db;

	const { pageId } = params;

	let body: RollbackBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.version_id) {
		throw error(400, 'Missing required field: version_id');
	}

	try {
		const version = await rollbackToVersion(db, pageId, body.version_id);
		return json({ version, message: `Rolled back to version ${version.change_summary}` }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (message.includes('not found')) {
			throw error(404, message);
		}
		if (message.includes('does not belong')) {
			throw error(400, message);
		}

		throw error(500, `Failed to rollback: ${message}`);
	}
};
