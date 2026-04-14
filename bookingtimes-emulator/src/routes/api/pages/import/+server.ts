/**
 * Page Import Endpoint
 *
 * POST /api/pages/import
 * Creates a new page record from scraped content and stores the
 * initial version with source='manual'.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVersion } from '$lib/server/version-history';

interface ImportBody {
	site_id: string;
	url: string;
	title: string;
	content_html: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: ImportBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { site_id, url, title, content_html } = body;

	if (!site_id || !title || !content_html) {
		throw error(400, 'Missing required fields: site_id, title, content_html');
	}

	// Verify the site exists
	const site = await db
		.prepare('SELECT id FROM sites WHERE id = ?')
		.bind(site_id)
		.first<{ id: string }>();

	if (!site) {
		throw error(404, `Site not found: ${site_id}`);
	}

	const pageId = crypto.randomUUID();
	const now = new Date().toISOString();

	try {
		// Create the page record
		await db
			.prepare(
				`INSERT INTO pages (id, site_id, title, template_id, suburb, status, created_at, updated_at)
				 VALUES (?, ?, ?, NULL, NULL, 'draft', ?, ?)`
			)
			.bind(pageId, site_id, title, now, now)
			.run();

		// Create the initial version with the scraped content
		const version = await createVersion(
			db,
			pageId,
			content_html,
			'manual',
			`Imported from ${url || 'scraped page'}`
		);

		return json(
			{
				page: {
					id: pageId,
					site_id,
					title,
					status: 'draft',
					created_at: now,
					updated_at: now
				},
				version
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to import page: ${message}`);
	}
};
