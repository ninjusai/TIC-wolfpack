/**
 * WRK-042: CSS Change Detection API
 *
 * POST /api/css/changes
 *
 * Two modes:
 * 1. Compare two specific catalogues:
 *    { site_id, old_catalogue_id, new_catalogue_id }
 *
 * 2. Scrape fresh and compare with latest catalogue:
 *    { site_id }
 *    (Triggers a new scrape, then compares old latest vs new catalogue)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detectCSSChanges, getLatestCatalogueId } from '$lib/server/css-change-detector';

interface ChangeRequestBody {
	site_id: string;
	old_catalogue_id?: string;
	new_catalogue_id?: string;
}

export const POST: RequestHandler = async ({ request, locals, fetch: svelteFetch }) => {
	const db = locals.db;

	let body: ChangeRequestBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.site_id) {
		throw error(400, 'Missing required field: site_id');
	}

	const { site_id } = body;

	try {
		// Mode 1: Compare two specific catalogues
		if (body.old_catalogue_id && body.new_catalogue_id) {
			const report = await detectCSSChanges(db, site_id, body.old_catalogue_id, body.new_catalogue_id);
			return json({ report });
		}

		// Mode 2: Scrape fresh and compare with latest
		const oldCatalogueId = await getLatestCatalogueId(db, site_id);
		if (!oldCatalogueId) {
			throw error(404, `No existing catalogue found for site ${site_id}. Run a scrape first.`);
		}

		// Trigger a new scrape via the existing scrape endpoint
		const scrapeResponse = await svelteFetch('/api/scrape', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ site_id })
		});

		if (!scrapeResponse.ok) {
			const scrapeError = await scrapeResponse.text();
			throw error(502, `Scrape failed: ${scrapeError}`);
		}

		const scrapeResult = await scrapeResponse.json() as { catalogue_id: string };
		const newCatalogueId = scrapeResult.catalogue_id;

		// Compare old vs new
		const report = await detectCSSChanges(db, site_id, oldCatalogueId, newCatalogueId);
		return json({
			report,
			scrape: {
				new_catalogue_id: newCatalogueId,
				triggered: true
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) throw err;

		const message = err instanceof Error ? err.message : String(err);

		if (message.includes('not found') || message.includes('does not belong')) {
			throw error(404, message);
		}

		throw error(500, `CSS change detection failed: ${message}`);
	}
};
