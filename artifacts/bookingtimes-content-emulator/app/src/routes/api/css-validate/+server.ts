/**
 * CSS Validation API — WRK-BCE2-037
 *
 * POST /api/css-validate
 *   Body: { html: string, siteId: number, sectionSpecId?: number }
 *   Returns: CssValidationResult
 *
 * GET /api/css-validate?siteId=N
 *   Returns: Site CSS palette (all classes grouped by tier)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	validateAndGenerateCss,
	getSiteCssPalette,
} from '$lib/server/css-generator';

export const POST: RequestHandler = async ({ request }) => {
	let body: { html?: string; siteId?: number; sectionSpecId?: number };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { html, siteId, sectionSpecId } = body;

	if (typeof html !== 'string' || !html.trim()) {
		throw error(400, 'Missing or empty "html" field');
	}
	if (typeof siteId !== 'number' || !Number.isInteger(siteId) || siteId < 1) {
		throw error(400, 'Invalid "siteId" — must be a positive integer');
	}

	try {
		const result = validateAndGenerateCss(html, siteId, sectionSpecId ?? 0);
		return json(result);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(500, `CSS validation failed: ${msg}`);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const siteIdParam = url.searchParams.get('siteId');
	if (!siteIdParam) {
		throw error(400, 'Missing "siteId" query parameter');
	}

	const siteId = parseInt(siteIdParam, 10);
	if (isNaN(siteId) || siteId < 1) {
		throw error(400, 'Invalid "siteId" — must be a positive integer');
	}

	try {
		const palette = getSiteCssPalette(siteId);
		return json({
			siteId,
			tier1Count: palette.tier1.length,
			tier2Count: palette.tier2.length,
			tier3Count: palette.tier3.length,
			...palette,
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to load CSS palette: ${msg}`);
	}
};
