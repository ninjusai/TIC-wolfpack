import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCSS, cacheStylesheets } from '$lib/server/css-cache';

/**
 * GET /api/css/:siteId
 *
 * Serves the combined cached CSS for a site from R2.
 * If the cache is missing or stale (>24h), triggers a re-fetch and cache.
 * Returns text/css for direct use in <link> tags or iframe injection.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const storage = locals.storage;
	const db = locals.db;

	const { siteId } = params;

	// Try R2 cache first
	const cached = await getCachedCSS(siteId, storage);

	if (cached && cached.fresh) {
		return new Response(cached.body, {
			headers: {
				'Content-Type': 'text/css; charset=utf-8',
				'Cache-Control': 'public, max-age=3600',
				'X-Cached-At': cached.cached_at
			}
		});
	}

	// Cache miss or stale — rebuild from D1 source data
	try {
		const css = await cacheStylesheets(siteId, { BCE_DB: db, BCE_STORAGE: storage });

		return new Response(css, {
			headers: {
				'Content-Type': 'text/css; charset=utf-8',
				'Cache-Control': 'public, max-age=3600',
				'X-Cached-At': new Date().toISOString()
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(404, `CSS not available for site ${siteId}: ${message}`);
	}
};
