/**
 * WRK-039: Page Versions API
 *
 * GET  /api/pages/:pageId/versions  — List all versions for a page
 * POST /api/pages/:pageId/versions  — Create a new version manually
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVersion, getVersionHistory } from '$lib/server/version-history';

// ─── GET /api/pages/:pageId/versions ───────────────────────────────────────

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;

	const { pageId } = params;

	try {
		const versions = await getVersionHistory(db, pageId);
		return json({ versions });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list versions: ${message}`);
	}
};

// ─── POST /api/pages/:pageId/versions ──────────────────────────────────────

interface CreateVersionBody {
	html_content: string;
	source?: string;
	change_summary?: string;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const db = locals.db;

	const { pageId } = params;

	let body: CreateVersionBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.html_content) {
		throw error(400, 'Missing required field: html_content');
	}

	const source = body.source ?? 'manual';
	const validSources = ['manual', 'ai', 'batch', 'rollback', 'exported'];
	if (!validSources.includes(source)) {
		throw error(400, `Invalid source. Must be one of: ${validSources.join(', ')}`);
	}

	try {
		const version = await createVersion(db, pageId, body.html_content, source, body.change_summary);
		return json({ version }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create version: ${message}`);
	}
};
