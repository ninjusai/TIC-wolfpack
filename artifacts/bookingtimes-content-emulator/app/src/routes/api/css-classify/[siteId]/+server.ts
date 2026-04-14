/**
 * CSS Classification API — WRK-BCE2-010, WRK-BCE2-056
 *
 * POST /api/css-classify/:siteId  — Trigger classification for a site
 *   - Automatically snapshots previous catalogue and generates a change report
 *     if a prior catalogue exists (WRK-BCE2-056)
 * GET  /api/css-classify/:siteId  — Return current css_audit data for the site
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { classifySiteCSS } from '$lib/server/css-classifier';
import {
	snapshotCurrentCatalogue,
	detectCssChanges
} from '$lib/server/css-change-detector';
import db from '$lib/db';

export const POST: RequestHandler = async ({ params }) => {
	const siteId = parseInt(params.siteId, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}

	// WRK-BCE2-056: Snapshot current catalogue before re-scrape overwrites it
	const existingCount = (
		db.prepare('SELECT COUNT(*) as cnt FROM css_audit WHERE site_id = ?').get(siteId) as { cnt: number }
	).cnt;

	if (existingCount > 0) {
		snapshotCurrentCatalogue(siteId);
	}

	const result = await classifySiteCSS(siteId);

	if (result.errors.length > 0 && result.totalClasses === 0) {
		throw error(500, `Classification failed: ${result.errors.join('; ')}`);
	}

	// WRK-BCE2-056: Generate change report if there was a previous catalogue
	let changeReport = undefined;
	if (existingCount > 0) {
		try {
			changeReport = detectCssChanges(siteId);
		} catch {
			// Non-fatal: change detection failure should not block classification
		}
	}

	return json({
		...result,
		...(changeReport
			? {
					cssChanges: {
						detectedAt: changeReport.detectedAt,
						summary: changeReport.summary
					}
				}
			: {})
	});
};

interface CSSAuditRow {
	id: number;
	site_id: number;
	class_name: string;
	tier: number;
	source_file: string | null;
	properties: string | null;
	usage_count: number;
	specificity_score: number | null;
	quality: string | null;
	notes: string | null;
	created_at: string;
}

export const GET: RequestHandler = async ({ params }) => {
	const siteId = parseInt(params.siteId, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}

	const rows = db
		.prepare('SELECT * FROM css_audit WHERE site_id = ? ORDER BY tier, class_name')
		.all(siteId) as CSSAuditRow[];

	// Parse properties JSON for each row
	const parsed = rows.map((row) => ({
		...row,
		properties: row.properties ? JSON.parse(row.properties) : null
	}));

	const tier1 = parsed.filter((r) => r.tier === 1).length;
	const tier2 = parsed.filter((r) => r.tier === 2).length;
	const tier3 = parsed.filter((r) => r.tier === 3).length;

	return json({
		siteId,
		totalClasses: parsed.length,
		tier1Count: tier1,
		tier2Count: tier2,
		tier3Count: tier3,
		classes: parsed
	});
};
