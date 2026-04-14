/**
 * WRK-033: Suburb Bulk Import API
 *
 * POST /api/suburbs/bulk — Bulk import suburb records from JSON array
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bulkImportSuburbs } from '$lib/server/suburb-data';

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: { suburbs?: unknown[] };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const suburbs = body.suburbs;
	if (!Array.isArray(suburbs) || suburbs.length === 0) {
		throw error(400, 'Request body must contain a non-empty "suburbs" array');
	}

	// Validate each entry has at minimum suburb_name
	for (let i = 0; i < suburbs.length; i++) {
		const s = suburbs[i] as Record<string, unknown>;
		if (!s.suburb_name || typeof s.suburb_name !== 'string') {
			throw error(400, `suburbs[${i}] is missing required field "suburb_name"`);
		}
	}

	try {
		const result = await bulkImportSuburbs(
			db,
			suburbs.map((s: unknown) => {
				const rec = s as Record<string, unknown>;
				return {
				suburb_name: rec.suburb_name as string,
				postcode: (rec.postcode as string) ?? null,
				region: (rec.region as string) ?? null,
				state: (rec.state as string) ?? 'QLD',
				distance_to_cbd_km: (rec.distance_to_cbd_km as number) ?? null,
				landmarks: (rec.landmarks as string[]) ?? [],
				population: (rec.population as number) ?? null,
				extra_data: (rec.extra_data as Record<string, unknown>) ?? {}
				};
			})
		);

		return json(
			{
				imported: result.inserted,
				errors: result.errors
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Bulk import failed: ${message}`);
	}
};
