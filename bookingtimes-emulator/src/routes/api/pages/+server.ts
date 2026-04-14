/**
 * WRK-031: Pages API
 *
 * GET  /api/pages?site_id=xxx  — List pages for a site
 * POST /api/pages              — Create a new page
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

// ─── GET /api/pages ─────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.db;

	const siteId = url.searchParams.get('site_id');

	try {
		let pages: PageRow[];

		if (siteId) {
			const { results } = await db
				.prepare(
					`SELECT id, site_id, title, template_id, suburb, status, created_at, updated_at
					 FROM pages
					 WHERE site_id = ?
					 ORDER BY updated_at DESC`
				)
				.bind(siteId)
				.all<PageRow>();
			pages = results ?? [];
		} else {
			const { results } = await db
				.prepare(
					`SELECT id, site_id, title, template_id, suburb, status, created_at, updated_at
					 FROM pages
					 ORDER BY updated_at DESC`
				)
				.all<PageRow>();
			pages = results ?? [];
		}

		return json({ pages });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list pages: ${message}`);
	}
};

// ─── POST /api/pages ────────────────────────────────────────────────────────

interface CreatePageBody {
	site_id: string;
	title: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: CreatePageBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.site_id || !body.title) {
		throw error(400, 'Missing required fields: site_id, title');
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	try {
		await db
			.prepare(
				`INSERT INTO pages (id, site_id, title, template_id, suburb, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
			)
			.bind(id, body.site_id, body.title, null, null, now, now)
			.run();

		return json(
			{
				page: {
					id,
					site_id: body.site_id,
					title: body.title,
					template_id: null,
					suburb: null,
					status: 'draft',
					created_at: now,
					updated_at: now
				}
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create page: ${message}`);
	}
};
