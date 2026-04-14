/**
 * WRK-012: Catalogue Lookup
 *
 * GET /api/catalogue/:catalogueId
 *
 * Returns all classes for a catalogue. Reads from KV cache first, falls back to D1.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ClassEntry {
	class_name: string;
	source: string;
	verified: number;
	properties?: string;
}

const KV_TTL = 3600;

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;
	const kv = locals.cache;

	const { catalogueId } = params;
	if (!catalogueId) throw error(400, 'Missing catalogue ID');

	// ── Try KV cache first ────────────────────────────────────────────────
	if (kv) {
		try {
			const cached = await kv.get(`catalogue:${catalogueId}:classes`);
			if (cached) {
				const classes: ClassEntry[] = JSON.parse(cached);
				return json({
					catalogue_id: catalogueId,
					source: 'cache',
					total_classes: classes.length,
					classes
				});
			}
		} catch {
			// Cache miss or parse error — fall through to D1
		}
	}

	// ── Verify catalogue exists ───────────────────────────────────────────
	const catalogue = await db
		.prepare('SELECT id, site_id, status FROM css_catalogues WHERE id = ?')
		.bind(catalogueId)
		.first<{ id: string; site_id: string; status: string }>();

	if (!catalogue) throw error(404, `Catalogue not found: ${catalogueId}`);

	// ── Query D1 ──────────────────────────────────────────────────────────
	const { results } = await db
		.prepare(
			'SELECT class_name, source, properties, verified FROM catalogue_classes WHERE catalogue_id = ? ORDER BY source, class_name'
		)
		.bind(catalogueId)
		.all<ClassEntry>();

	const classes = results ?? [];

	// ── Backfill KV cache ─────────────────────────────────────────────────
	if (kv && classes.length > 0) {
		const cachePayload = classes.map((c: ClassEntry) => ({
			class_name: c.class_name,
			source: c.source,
			verified: c.verified
		}));
		try {
			await kv.put(
				`catalogue:${catalogueId}:classes`,
				JSON.stringify(cachePayload),
				{ expirationTtl: KV_TTL }
			);
		} catch {
			// Non-critical — ignore KV write failures
		}
	}

	return json({
		catalogue_id: catalogueId,
		site_id: catalogue.site_id,
		status: catalogue.status,
		source: 'database',
		total_classes: classes.length,
		classes
	});
};
