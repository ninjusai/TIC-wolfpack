import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateOutput } from '$lib/server/output-validator';
import { loadSiteCatalogue } from '$lib/server/catalogue-loader';

// ── Types ──────────────────────────────────────────────────────────────────

interface ValidateRequest {
	html: string;
	site_id: string;
}

// ── POST Handler ───────────────────────────────────────────────────────────

/**
 * POST /api/ai/validate
 *
 * Validates HTML content against a site's CSS catalogue.
 * Allows the frontend to re-validate content after manual edits.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const kv = locals.cache;

	// Parse & validate request body
	let body: ValidateRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { html, site_id } = body;

	if (!html || !site_id) {
		throw error(400, 'Missing required fields: html, site_id');
	}

	// Load the site's CSS catalogue
	const catalogue = await loadSiteCatalogue(site_id, db, kv);
	const allowedClassSet = new Set(catalogue.classes);

	// Run validation
	const result = validateOutput(html, allowedClassSet);

	return json({
		valid: result.valid,
		errors: result.errors,
		warnings: result.warnings,
		stats: result.stats,
		catalogue_id: catalogue.catalogue_id || null
	});
};
