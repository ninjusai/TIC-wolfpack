/**
 * Export Validation Pipeline (WRK-030)
 *
 * POST /api/export
 *
 * Validates HTML against a site's CSS catalogue and optionally creates
 * a new page version. Integrates class isolation check (WRK-032) to
 * prevent cross-site class leakage.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateOutput } from '$lib/server/output-validator';
import { loadSiteCatalogue } from '$lib/server/catalogue-loader';
import { extractClassesFromHTML } from '$lib/server/css-parser';
import { checkClassIsolation } from '$lib/server/class-isolation';
import { createVersion } from '$lib/server/version-history';

// ── Types ──────────────────────────────────────────────────────────────────

interface ExportRequest {
	html: string;
	site_id: string;
	page_id?: string;
	force?: boolean;
}

// ── POST Handler ───────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const kv = locals.cache;

	// Parse & validate request body
	let body: ExportRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { html, site_id, page_id, force } = body;

	if (!html || !site_id) {
		throw error(400, 'Missing required fields: html, site_id');
	}

	// ── 1. Load the site's CSS catalogue ──────────────────────────────────

	const catalogue = await loadSiteCatalogue(site_id, db, kv);
	const allowedClassSet = new Set(catalogue.classes);

	if (catalogue.classes.length === 0) {
		throw error(404, `No CSS catalogue found for site ${site_id}`);
	}

	// ── 2. Run the full validation chain ──────────────────────────────────

	const validation = validateOutput(html, allowedClassSet);

	// ── 3. Run class isolation check (WRK-032) ────────────────────────────
	// Load catalogues for all sites to detect cross-site leakage

	let isolationResult = null;
	try {
		const allSiteRows = await db
			.prepare('SELECT DISTINCT site_id FROM css_catalogues WHERE status = ?')
			.bind('complete')
			.all<{ site_id: string }>();

		const siteIds = (allSiteRows.results ?? []).map((r) => r.site_id);

		if (siteIds.length > 1) {
			const allCatalogues = new Map<string, Set<string>>();
			allCatalogues.set(site_id, allowedClassSet);

			// Load other site catalogues for isolation check
			for (const otherId of siteIds) {
				if (otherId === site_id) continue;
				const otherCatalogue = await loadSiteCatalogue(otherId, db, kv);
				if (otherCatalogue.classes.length > 0) {
					allCatalogues.set(otherId, new Set(otherCatalogue.classes));
				}
			}

			isolationResult = checkClassIsolation(html, site_id, allCatalogues);

			// Add isolation leaks as validation errors
			if (!isolationResult.isolated) {
				for (const leak of isolationResult.leaks) {
					validation.errors.push({
						type: 'unknown_class',
						severity: 'error',
						message: `Class "${leak.class_name}" belongs to site(s) [${leak.belongs_to.join(', ')}], not target site "${site_id}"`,
						context: leak.class_name
					});
				}
				// Re-evaluate validity
				validation.valid = validation.errors.length === 0;
			}
		}
	} catch {
		// Non-critical — isolation check is best-effort
		// The core validation still runs
	}

	// ── 4. Handle results ─────────────────────────────────────────────────

	const hasErrors = validation.errors.length > 0;

	// If there are errors and force is not set, return failure
	if (hasErrors && !force) {
		return json({
			valid: false,
			errors: validation.errors,
			warnings: validation.warnings,
			stats: validation.stats,
			html,
			...(isolationResult && { isolation: isolationResult })
		});
	}

	// ── 5. Create page version if page_id provided ────────────────────────

	let versionId: string | null = null;

	if (page_id) {
		try {
			const changeSummary = hasErrors ? 'Export (forced with validation errors)' : 'Export (validated)';
			const version = await createVersion(db, page_id, html, 'manual', changeSummary);
			versionId = version.id;
		} catch (err) {
			// Log but don't fail — the validation result is still useful
			console.error('[export] Failed to create page version:', err);
			versionId = null;
		}
	}

	return json({
		valid: !hasErrors,
		html,
		validation: {
			errors: validation.errors,
			warnings: validation.warnings,
			stats: validation.stats
		},
		...(versionId && { version_id: versionId }),
		...(force && hasErrors && { forced: true }),
		...(isolationResult && { isolation: isolationResult })
	});
};
