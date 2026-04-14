import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedSeoBenchmarks, getSeoBenchmarks } from '$lib/server/seo-benchmarks';

/**
 * GET /api/benchmarks/seed-seo
 * Returns all current SEO benchmark standards from the database.
 */
export const GET: RequestHandler = () => {
  try {
    const benchmarks = getSeoBenchmarks();
    return json({ count: benchmarks.length, benchmarks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve SEO benchmarks: ${message}` }, { status: 500 });
  }
};

/**
 * POST /api/benchmarks/seed-seo
 * Seeds (or refreshes) all SEO benchmark standards into the database.
 * Idempotent — safe to call multiple times.
 */
export const POST: RequestHandler = () => {
  try {
    const result = seedSeoBenchmarks();
    const benchmarks = getSeoBenchmarks();
    return json({
      message: `SEO benchmarks seeded successfully`,
      ...result,
      benchmarks
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to seed SEO benchmarks: ${message}` }, { status: 500 });
  }
};
