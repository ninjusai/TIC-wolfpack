/**
 * Single Page API
 *
 * GET /api/pages/:pageId — Get page with its latest version content
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLatestVersion } from '$lib/server/version-history';

interface PageRow {
	id: string;
	site_id: string;
	title: string;
	template_id: string | null;
	suburb: string | null;
	status: string;
	created_at: string;
	updated_at: string;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;
	const { pageId } = params;

	try {
		const page = await db
			.prepare(
				`SELECT id, site_id, title, template_id, suburb, status, created_at, updated_at
				 FROM pages WHERE id = ?`
			)
			.bind(pageId)
			.first<PageRow>();

		if (!page) {
			throw error(404, `Page not found: ${pageId}`);
		}

		// Fetch latest version
		const latestVersion = await getLatestVersion(db, pageId);

		return json({
			page,
			latest_version: latestVersion
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to get page: ${message}`);
	}
};
