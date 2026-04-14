/**
 * WRK-012: Catalogue Assembly & Storage
 *
 * POST /api/catalogue/assemble
 *
 * Takes a catalogue_id (from the scraper), parses its CSS, merges with BS5/FA6
 * static catalogues, marks verified classes, bulk-inserts into catalogue_classes,
 * and caches the result in the local cache.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCSS, extractClassesFromHTML } from '$lib/server/css-parser';

// Static catalogue imports (resolved at build time by Vite)
import bs5Catalogue from '../../../../../static/catalogues/bootstrap5-classes.json';
import fa6Catalogue from '../../../../../static/catalogues/fontawesome6-classes.json';

interface SourceUrlsData {
	raw_custom_css?: { url: string; content: string }[];
	raw_inline_css?: string[];
	html_classes?: string[];
}

interface CatalogueClassRow {
	class_name: string;
	source: 'bootstrap' | 'fontawesome' | 'custom';
	properties: string;
	verified: number;
}

const KV_TTL = 3600; // 1 hour
const BATCH_SIZE = 50; // D1 limit: 100 params / 2 params minimum per row => stay safe

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const kv = locals.cache;

	// ── Parse request ─────────────────────────────────────────────────────
	let body: { catalogue_id?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { catalogue_id } = body;
	if (!catalogue_id) throw error(400, 'Missing required field: catalogue_id');

	// ── 1. Read catalogue record from D1 ──────────────────────────────────
	const catalogue = await db
		.prepare('SELECT id, site_id, status, source_urls FROM css_catalogues WHERE id = ?')
		.bind(catalogue_id)
		.first<{ id: string; site_id: string; status: string; source_urls: string }>();

	if (!catalogue) throw error(404, `Catalogue not found: ${catalogue_id}`);

	let sourceData: SourceUrlsData;
	try {
		sourceData = JSON.parse(catalogue.source_urls || '{}');
	} catch {
		throw error(500, 'Corrupt source_urls JSON in catalogue record');
	}

	// ── 2. Parse custom CSS ───────────────────────────────────────────────
	const customCssTexts: string[] = [];
	if (sourceData.raw_custom_css) {
		for (const entry of sourceData.raw_custom_css) {
			if (entry.content) customCssTexts.push(entry.content);
		}
	}
	if (sourceData.raw_inline_css) {
		for (const inline of sourceData.raw_inline_css) {
			if (inline) customCssTexts.push(inline);
		}
	}

	const combinedCustomCss = customCssTexts.join('\n');
	const parseResult = parseCSS(combinedCustomCss);

	// ── 3. Load static catalogues ─────────────────────────────────────────
	const bs5Classes = bs5Catalogue.classes as { class_name: string }[];
	const fa6Classes = fa6Catalogue.classes as { class_name: string }[];

	// ── 4. Get HTML classes for verification ──────────────────────────────
	const htmlClasses = new Set<string>(sourceData.html_classes ?? []);

	// ── 5. Merge all sources into unified map ─────────────────────────────
	const classMap = new Map<string, CatalogueClassRow>();

	// BS5 classes
	for (const cls of bs5Classes) {
		classMap.set(cls.class_name, {
			class_name: cls.class_name,
			source: 'bootstrap',
			properties: '{}',
			verified: htmlClasses.has(cls.class_name) ? 1 : 0
		});
	}

	// FA6 classes
	for (const cls of fa6Classes) {
		if (!classMap.has(cls.class_name)) {
			classMap.set(cls.class_name, {
				class_name: cls.class_name,
				source: 'fontawesome',
				properties: '{}',
				verified: htmlClasses.has(cls.class_name) ? 1 : 0
			});
		}
	}

	// Custom classes (from parsed CSS)
	for (const parsed of parseResult.classes) {
		if (!classMap.has(parsed.class_name)) {
			classMap.set(parsed.class_name, {
				class_name: parsed.class_name,
				source: 'custom',
				properties: JSON.stringify(parsed.properties),
				verified: htmlClasses.has(parsed.class_name) ? 1 : 0
			});
		}
	}

	// ── 6. Bulk insert into catalogue_classes ─────────────────────────────
	const allRows = Array.from(classMap.values());

	// Chunk into batches of BATCH_SIZE
	for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
		const batch = allRows.slice(i, i + BATCH_SIZE);
		const placeholders = batch
			.map(() => '(?, ?, ?, ?, ?, ?)')
			.join(', ');
		const params: (string | number)[] = [];

		for (const row of batch) {
			params.push(
				crypto.randomUUID(),
				catalogue_id,
				row.class_name,
				row.source,
				row.properties,
				row.verified
			);
		}

		await db
			.prepare(
				`INSERT OR IGNORE INTO catalogue_classes (id, catalogue_id, class_name, source, properties, verified)
				 VALUES ${placeholders}`
			)
			.bind(...params)
			.run();
	}

	// ── 7. Update catalogue status to 'complete' ─────────────────────────
	await db
		.prepare("UPDATE css_catalogues SET status = 'complete' WHERE id = ?")
		.bind(catalogue_id)
		.run();

	// ── 8. Cache class list ──────────────────────────────────────────────
	let cached = false;
	if (kv) {
		const cachePayload = allRows.map((r) => ({
			class_name: r.class_name,
			source: r.source,
			verified: r.verified
		}));
		try {
			await kv.put(
				`catalogue:${catalogue_id}:classes`,
				JSON.stringify(cachePayload),
				{ expirationTtl: KV_TTL }
			);
			cached = true;
		} catch (kvErr) {
			console.warn('[catalogue/assemble] Cache write failed:', kvErr);
		}
	}

	// ── 9. Build response ─────────────────────────────────────────────────
	const bootstrapCount = allRows.filter((r) => r.source === 'bootstrap').length;
	const fontawesomeCount = allRows.filter((r) => r.source === 'fontawesome').length;
	const customCount = allRows.filter((r) => r.source === 'custom').length;
	const verifiedCount = allRows.filter((r) => r.verified === 1).length;

	return json({
		catalogue_id,
		total_classes: allRows.length,
		bootstrap_classes: bootstrapCount,
		fontawesome_classes: fontawesomeCount,
		custom_classes: customCount,
		verified_classes: verifiedCount,
		cached
	});
};
