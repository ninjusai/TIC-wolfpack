/**
 * CSS Tier Decisions API — WRK-BCE2-030
 *
 * POST /api/css-decisions/:siteId  — Trigger CSS tier assignment for all section_specs
 * GET  /api/css-decisions/:siteId  — Return current css_decisions for the site
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assignCssTiers, getCssDecisions } from '$lib/server/css-tier-engine';

export const POST: RequestHandler = async ({ params }) => {
	const siteId = parseInt(params.siteId, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}

	try {
		const result = assignCssTiers(siteId);
		return json(result);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(500, `CSS tier assignment failed: ${msg}`);
	}
};

export const GET: RequestHandler = async ({ params }) => {
	const siteId = parseInt(params.siteId, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid siteId — must be a positive integer');
	}

	const decisions = getCssDecisions(siteId);

	return json({
		siteId,
		totalDecisions: decisions.length,
		decisions
	});
};
