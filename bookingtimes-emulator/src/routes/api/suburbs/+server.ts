/**
 * WRK-033: Suburb Data API — collection endpoints
 *
 * GET  /api/suburbs          — List all suburbs (optional ?region=xxx filter)
 * POST /api/suburbs          — Create a single suburb record
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSuburbs, createSuburb } from '$lib/server/suburb-data';

// ─── GET /api/suburbs ───────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.db;

	const region = url.searchParams.get('region') ?? undefined;

	try {
		const suburbs = await listSuburbs(db, region);
		return json({ suburbs });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list suburbs: ${message}`);
	}
};

// ─── POST /api/suburbs ─────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.suburb_name || typeof body.suburb_name !== 'string') {
		throw error(400, 'suburb_name is required');
	}

	try {
		const suburb = await createSuburb(db, {
			suburb_name: body.suburb_name as string,
			postcode: (body.postcode as string) ?? null,
			region: (body.region as string) ?? null,
			state: (body.state as string) ?? 'QLD',
			distance_to_cbd_km: (body.distance_to_cbd_km as number) ?? null,
			landmarks: (body.landmarks as string[]) ?? [],
			population: (body.population as number) ?? null,
			extra_data: (body.extra_data as Record<string, unknown>) ?? {}
		});

		return json({ suburb }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create suburb: ${message}`);
	}
};
