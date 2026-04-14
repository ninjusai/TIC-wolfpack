/**
 * Catalogue Loader (WRK-024)
 *
 * Fetches a site's CSS catalogue classes and content wrapper from DB,
 * with local cache for fast access during AI generation.
 */

import type { D1CompatDatabase } from '$lib/server/db';
import type { LocalCache } from './cache';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SiteCatalogue {
	catalogue_id: string;
	classes: string[];
	content_wrapper: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const KV_PREFIX = 'catalogue:';
const KV_TTL_SECONDS = 3600; // 1 hour

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load the CSS catalogue for a site. Checks KV cache first, falls back to D1.
 *
 * Returns the list of allowed class names and the content wrapper HTML.
 */
export async function loadSiteCatalogue(
	siteId: string,
	db: D1CompatDatabase,
	cache?: LocalCache
): Promise<SiteCatalogue> {
	const kvKey = `${KV_PREFIX}${siteId}`;

	// Try cache first
	if (cache) {
		try {
			const cached = await cache.get(kvKey);
			if (cached) return JSON.parse(cached) as SiteCatalogue;
		} catch {
			// Cache miss or parse error — fall through to DB
		}
	}

	// Fetch from D1: get the most recent completed catalogue
	const catalogue = await db
		.prepare(
			`SELECT id, content_wrapper FROM css_catalogues
			 WHERE site_id = ? AND status = 'complete'
			 ORDER BY scraped_at DESC LIMIT 1`
		)
		.bind(siteId)
		.first<{ id: string; content_wrapper: string | null }>();

	if (!catalogue) {
		// No catalogue yet — return empty (the prompt builder handles empty class lists gracefully)
		return { catalogue_id: '', classes: [], content_wrapper: null };
	}

	// Fetch all class names for this catalogue
	const classRows = await db
		.prepare(
			'SELECT class_name FROM catalogue_classes WHERE catalogue_id = ? ORDER BY class_name'
		)
		.bind(catalogue.id)
		.all<{ class_name: string }>();

	const classes = (classRows.results ?? []).map((r) => r.class_name);

	const result: SiteCatalogue = {
		catalogue_id: catalogue.id,
		classes,
		content_wrapper: catalogue.content_wrapper ?? null
	};

	// Store in local cache
	if (cache) {
		try {
			await cache.put(kvKey, JSON.stringify(result), { expirationTtl: KV_TTL_SECONDS });
		} catch {
			// Non-critical — cache miss on next call
		}
	}

	return result;
}

/**
 * Load suburb data from D1 by suburb name.
 */
export async function loadSuburbData(
	suburbName: string,
	db: D1CompatDatabase
): Promise<{
	suburb_name: string;
	postcode?: string;
	region?: string;
	state?: string;
	distance_to_cbd_km?: number;
	landmarks?: string[];
	population?: number;
} | null> {
	const row = await db
		.prepare(
			'SELECT * FROM suburb_data WHERE suburb_name = ? COLLATE NOCASE LIMIT 1'
		)
		.bind(suburbName)
		.first<{
			suburb_name: string;
			postcode: string | null;
			region: string | null;
			state: string | null;
			distance_to_cbd_km: number | null;
			landmarks: string | null;
			population: number | null;
		}>();

	if (!row) return null;

	return {
		suburb_name: row.suburb_name,
		...(row.postcode && { postcode: row.postcode }),
		...(row.region && { region: row.region }),
		...(row.state && { state: row.state }),
		...(row.distance_to_cbd_km != null && { distance_to_cbd_km: row.distance_to_cbd_km }),
		...(row.landmarks && { landmarks: JSON.parse(row.landmarks) }),
		...(row.population != null && { population: row.population })
	};
}

/**
 * Load template section rules from D1.
 */
export async function loadTemplateSectionRules(
	templateId: string,
	sectionId: string | undefined,
	db: D1CompatDatabase
): Promise<{
	section_name: string;
	html_skeleton?: string;
	required_classes?: string[];
	content_rules?: {
		min_words?: number;
		max_words?: number;
		tone?: string;
		structure?: string;
	};
} | null> {
	if (!sectionId) return null;

	const row = await db
		.prepare(
			'SELECT * FROM template_sections WHERE template_id = ? AND id = ? LIMIT 1'
		)
		.bind(templateId, sectionId)
		.first<{
			name: string;
			html_skeleton: string | null;
			required_classes: string | null;
			content_rules: string | null;
		}>();

	if (!row) return null;

	return {
		section_name: row.name,
		...(row.html_skeleton && { html_skeleton: row.html_skeleton }),
		...(row.required_classes && { required_classes: JSON.parse(row.required_classes) }),
		...(row.content_rules && { content_rules: JSON.parse(row.content_rules) })
	};
}
