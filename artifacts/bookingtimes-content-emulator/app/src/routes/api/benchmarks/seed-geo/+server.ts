import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedGeoBenchmarks, getGeoBenchmarks } from '$lib/server/geo-benchmarks';

/**
 * GET /api/benchmarks/seed-geo
 * Returns all current GEO benchmarks from the benchmark_standards table.
 */
export const GET: RequestHandler = () => {
  const benchmarks = getGeoBenchmarks();

  return json({
    category: 'geo',
    count: benchmarks.length,
    benchmarks,
  });
};

/**
 * POST /api/benchmarks/seed-geo
 * Seeds the GEO benchmarks into the benchmark_standards table.
 * Safe to call multiple times — uses INSERT OR IGNORE.
 */
export const POST: RequestHandler = () => {
  const result = seedGeoBenchmarks();

  return json({
    category: 'geo',
    inserted: result.inserted,
    message:
      result.inserted > 0
        ? `Seeded ${result.inserted} GEO benchmark(s).`
        : 'All GEO benchmarks already present.',
  });
};
