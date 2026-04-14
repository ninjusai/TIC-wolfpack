/**
 * CSS Change Detection API — WRK-BCE2-056
 *
 * GET  /api/css-decisions/:siteId/changes — Latest change report for a site
 * POST /api/css-decisions/:siteId/changes — Trigger a re-scrape comparison
 *
 * Traces: REQ-BCE2-038, EVAL-BCE2-058
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getLatestChangeReport,
	getAllChangeReports,
	runRescrapeWithChangeDetection,
	flagDeprecatedContent
} from '$lib/server/css-change-detector';
import { classifySiteCSS } from '$lib/server/css-classifier';
import db from '$lib/db';

function parseSiteId(raw: string): number {
	const siteId = parseInt(raw, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}
	return siteId;
}

function siteExists(siteId: number): boolean {
	const row = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
	return !!row;
}

/**
 * GET: Return the latest change report for a site.
 * Query params:
 *   ?all=true — return all reports (newest first)
 *   ?flagged=true — also return deprecated content details for latest report
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const siteId = parseSiteId(params.siteId);

	if (!siteExists(siteId)) {
		throw error(404, `Site ${siteId} not found`);
	}

	const returnAll = url.searchParams.get('all') === 'true';
	const includeFlagged = url.searchParams.get('flagged') === 'true';

	if (returnAll) {
		const reports = getAllChangeReports(siteId);
		return json({
			siteId,
			totalReports: reports.length,
			reports: reports.map((r) => ({
				...r,
				added_classes: JSON.parse(r.added_classes),
				removed_classes: JSON.parse(r.removed_classes),
				changed_classes: JSON.parse(r.changed_classes)
			}))
		});
	}

	const latest = getLatestChangeReport(siteId);
	if (!latest) {
		return json({
			siteId,
			message: 'No change reports found. Trigger a re-scrape comparison via POST.',
			report: null
		});
	}

	const parsedReport = {
		...latest,
		added_classes: JSON.parse(latest.added_classes),
		removed_classes: JSON.parse(latest.removed_classes),
		changed_classes: JSON.parse(latest.changed_classes)
	};

	// Optionally include deprecated content flagging
	let flaggedContent = undefined;
	if (includeFlagged && parsedReport.removed_classes.length > 0) {
		flaggedContent = flagDeprecatedContent(siteId, parsedReport.removed_classes);
	}

	return json({
		siteId,
		report: parsedReport,
		...(flaggedContent ? { flaggedContent } : {})
	});
};

/**
 * POST: Trigger a re-scrape comparison.
 * Snapshots the current catalogue, re-classifies, then diffs.
 */
export const POST: RequestHandler = async ({ params }) => {
	const siteId = parseSiteId(params.siteId);

	if (!siteExists(siteId)) {
		throw error(404, `Site ${siteId} not found`);
	}

	try {
		const { changeReport, classificationResult } = await runRescrapeWithChangeDetection(
			siteId,
			classifySiteCSS
		);

		return json({
			siteId,
			changeReport: {
				detectedAt: changeReport.detectedAt,
				summary: changeReport.summary,
				addedClasses: changeReport.addedClasses.map((c) => ({
					className: c.className,
					tier: c.tier
				})),
				removedClasses: changeReport.removedClasses.map((c) => ({
					className: c.className,
					tier: c.tier
				})),
				changedClasses: changeReport.changedClasses
			},
			classification: {
				totalClasses: classificationResult.totalClasses,
				errors: classificationResult.errors
			}
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(500, `Re-scrape comparison failed: ${msg}`);
	}
};
