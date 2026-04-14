/**
 * GET /api/sites/[siteId]/status
 *
 * Returns the latest catalogue info for a site, including class counts
 * broken down by source (bootstrap, fontawesome, custom).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;
	const siteId = params.siteId;

	if (!siteId) {
		throw error(400, 'Missing site ID');
	}

	// Verify site exists
	const site = await db
		.prepare('SELECT id FROM sites WHERE id = ?')
		.bind(siteId)
		.first<{ id: string }>();

	if (!site) {
		throw error(404, `Site not found: ${siteId}`);
	}

	// Get the latest catalogue for this site
	const catalogue = await db
		.prepare(
			`SELECT id, site_id, scraped_at, status, source_urls, content_wrapper
			 FROM css_catalogues
			 WHERE site_id = ?
			 ORDER BY scraped_at DESC
			 LIMIT 1`
		)
		.bind(siteId)
		.first<{
			id: string;
			site_id: string;
			scraped_at: string;
			status: string;
			source_urls: string;
			content_wrapper: string | null;
		}>();

	if (!catalogue) {
		return json({
			site_id: siteId,
			has_catalogue: false,
			catalogue_id: null,
			scraped_at: null,
			total_classes: 0,
			bootstrap_classes: 0,
			fontawesome_classes: 0,
			custom_classes: 0,
			verified_classes: 0,
			status: 'none',
			stylesheet_urls: [],
			content_wrapper: null
		});
	}

	// Count classes by source
	const classCounts = await db
		.prepare(
			`SELECT
				COUNT(*) as total,
				SUM(CASE WHEN source = 'bootstrap' THEN 1 ELSE 0 END) as bootstrap,
				SUM(CASE WHEN source = 'fontawesome' THEN 1 ELSE 0 END) as fontawesome,
				SUM(CASE WHEN source = 'custom' THEN 1 ELSE 0 END) as custom,
				SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified
			 FROM catalogue_classes
			 WHERE catalogue_id = ?`
		)
		.bind(catalogue.id)
		.first<{
			total: number;
			bootstrap: number;
			fontawesome: number;
			custom: number;
			verified: number;
		}>();

	// Parse source_urls for stylesheet list
	let stylesheetUrls: string[] = [];
	let contentWrapper = null;
	try {
		const sourceData = JSON.parse(catalogue.source_urls || '{}');
		const cdnUrls = (sourceData.cdn_stylesheets ?? []).map(
			(s: { url: string }) => s.url
		);
		const customUrls = sourceData.custom_stylesheets ?? [];
		stylesheetUrls = [...cdnUrls, ...customUrls];
	} catch {
		// ignore parse errors
	}

	try {
		if (catalogue.content_wrapper) {
			contentWrapper = JSON.parse(catalogue.content_wrapper);
		}
	} catch {
		// ignore parse errors
	}

	return json({
		site_id: siteId,
		has_catalogue: true,
		catalogue_id: catalogue.id,
		scraped_at: catalogue.scraped_at,
		total_classes: classCounts?.total ?? 0,
		bootstrap_classes: classCounts?.bootstrap ?? 0,
		fontawesome_classes: classCounts?.fontawesome ?? 0,
		custom_classes: classCounts?.custom ?? 0,
		verified_classes: classCounts?.verified ?? 0,
		status: catalogue.status,
		stylesheet_urls: stylesheetUrls,
		content_wrapper: contentWrapper
	});
};
