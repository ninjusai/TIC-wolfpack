/**
 * Suburb Data Module (WRK-033)
 *
 * CRUD operations for suburb_data table in D1.
 * Manages suburb records used for localized content generation.
 */

import type { D1CompatDatabase, D1CompatStatement } from '$lib/server/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SuburbRecord {
	id: string;
	suburb_name: string;
	postcode: string | null;
	region: string | null;
	state: string;
	distance_to_cbd_km: number | null;
	landmarks: string[];
	population: number | null;
	extra_data: Record<string, unknown>;
}

/** Row shape from D1 — JSON fields stored as TEXT */
interface SuburbRow {
	id: string;
	suburb_name: string;
	postcode: string | null;
	region: string | null;
	state: string;
	distance_to_cbd_km: number | null;
	landmarks: string | null;
	population: number | null;
	extra_data: string | null;
	created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseSuburbRow(row: SuburbRow): SuburbRecord {
	return {
		id: row.id,
		suburb_name: row.suburb_name,
		postcode: row.postcode,
		region: row.region,
		state: row.state ?? 'QLD',
		distance_to_cbd_km: row.distance_to_cbd_km,
		landmarks: row.landmarks ? JSON.parse(row.landmarks) : [],
		population: row.population,
		extra_data: row.extra_data ? JSON.parse(row.extra_data) : {}
	};
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * List all suburbs, optionally filtered by region.
 */
export async function listSuburbs(
	db: D1CompatDatabase,
	region?: string
): Promise<SuburbRecord[]> {
	let result;

	if (region) {
		result = await db
			.prepare(
				'SELECT * FROM suburb_data WHERE region = ? COLLATE NOCASE ORDER BY suburb_name'
			)
			.bind(region)
			.all<SuburbRow>();
	} else {
		result = await db
			.prepare('SELECT * FROM suburb_data ORDER BY suburb_name')
			.all<SuburbRow>();
	}

	return (result.results ?? []).map(parseSuburbRow);
}

/**
 * Get a single suburb by ID.
 */
export async function getSuburb(
	db: D1CompatDatabase,
	id: string
): Promise<SuburbRecord | null> {
	const row = await db
		.prepare('SELECT * FROM suburb_data WHERE id = ?')
		.bind(id)
		.first<SuburbRow>();

	return row ? parseSuburbRow(row) : null;
}

/**
 * Create a single suburb record. Returns the created record.
 */
export async function createSuburb(
	db: D1CompatDatabase,
	data: Omit<SuburbRecord, 'id'> & { id?: string }
): Promise<SuburbRecord> {
	const id = data.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO suburb_data (id, suburb_name, postcode, region, state, distance_to_cbd_km, landmarks, population, extra_data, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			data.suburb_name,
			data.postcode ?? null,
			data.region ?? null,
			data.state ?? 'QLD',
			data.distance_to_cbd_km ?? null,
			data.landmarks.length > 0 ? JSON.stringify(data.landmarks) : null,
			data.population ?? null,
			Object.keys(data.extra_data).length > 0 ? JSON.stringify(data.extra_data) : null,
			now
		)
		.run();

	return {
		id,
		suburb_name: data.suburb_name,
		postcode: data.postcode ?? null,
		region: data.region ?? null,
		state: data.state ?? 'QLD',
		distance_to_cbd_km: data.distance_to_cbd_km ?? null,
		landmarks: data.landmarks ?? [],
		population: data.population ?? null,
		extra_data: data.extra_data ?? {}
	};
}

/**
 * Bulk import suburb records. Returns count of successfully inserted records.
 */
export async function bulkImportSuburbs(
	db: D1CompatDatabase,
	suburbs: Array<Omit<SuburbRecord, 'id'> & { id?: string }>
): Promise<{ inserted: number; errors: Array<{ suburb_name: string; error: string }> }> {
	const errors: Array<{ suburb_name: string; error: string }> = [];
	const statements: D1CompatStatement[] = [];
	const now = new Date().toISOString();

	for (const data of suburbs) {
		const id = data.id ?? crypto.randomUUID();
		try {
			statements.push(
				db
					.prepare(
						`INSERT OR IGNORE INTO suburb_data (id, suburb_name, postcode, region, state, distance_to_cbd_km, landmarks, population, extra_data, created_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						data.suburb_name,
						data.postcode ?? null,
						data.region ?? null,
						data.state ?? 'QLD',
						data.distance_to_cbd_km ?? null,
						data.landmarks && data.landmarks.length > 0 ? JSON.stringify(data.landmarks) : null,
						data.population ?? null,
						data.extra_data && Object.keys(data.extra_data).length > 0
							? JSON.stringify(data.extra_data)
							: null,
						now
					)
			);
		} catch (err) {
			errors.push({
				suburb_name: data.suburb_name ?? '(unknown)',
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	if (statements.length > 0) {
		// D1 batch has a limit; chunk into groups of 50
		const CHUNK_SIZE = 50;
		for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
			const chunk = statements.slice(i, i + CHUNK_SIZE);
			await db.batch(chunk);
		}
	}

	return { inserted: statements.length, errors };
}
