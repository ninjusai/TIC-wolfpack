/**
 * Tier 3 CSS Preview Endpoint — WRK-BCE2-046
 *
 * GET /api/preview-css/tier3/:siteId
 *
 * Returns generated Tier 3 CSS for a site based on css_decisions.
 * These are system-generated custom classes (decision_type='custom')
 * rendered into actual CSS rules by the css-generator.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateTier3Css } from '$lib/server/css-generator';
import db from '$lib/db';

interface CssDecisionRow {
	class_name: string;
	decision_type: string;
}

export const GET: RequestHandler = async ({ params }) => {
	const siteId = parseInt(params.siteId, 10);

	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}

	// Verify site exists
	const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
	if (!site) {
		throw error(404, `Site ${siteId} not found`);
	}

	// Fetch Tier 3 class names from css_decisions
	const rows = db.prepare(
		`SELECT class_name FROM css_decisions
		 WHERE site_id = ? AND decision_type = 'custom' AND class_name IS NOT NULL`
	).all(siteId) as CssDecisionRow[];

	if (rows.length === 0) {
		// Return empty CSS with a comment — not an error
		return new Response(
			'/* No Tier 3 CSS decisions found for this site */\n',
			{
				headers: {
					'Content-Type': 'text/css; charset=utf-8',
					'Cache-Control': 'public, max-age=300',
				},
			}
		);
	}

	const classNames = rows.map((r) => r.class_name);
	const css = generateTier3Css(classNames, siteId);

	return new Response(css, {
		headers: {
			'Content-Type': 'text/css; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
		},
	});
};
