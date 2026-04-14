import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedSchemaBenchmarks, getSchemaBenchmarks } from '$lib/server/schema-benchmarks';

/**
 * GET /api/benchmarks/seed-schema
 * Returns all current Schema.org benchmark standards from the database.
 */
export const GET: RequestHandler = () => {
  try {
    const benchmarks = getSchemaBenchmarks();
    return json({ count: benchmarks.length, benchmarks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve schema benchmarks: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/benchmarks/seed-schema
 * Seeds (or refreshes) all Schema.org benchmark standards into the database.
 * Idempotent — safe to call multiple times.
 */
export const POST: RequestHandler = () => {
  try {
    const result = seedSchemaBenchmarks();
    const benchmarks = getSchemaBenchmarks();
    return json({
      message: 'Schema benchmarks seeded successfully',
      ...result,
      benchmarks
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to seed schema benchmarks: ${message}` }, { status: 500 });
  }
};
