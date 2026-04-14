/**
 * CSS Caching Utility (WRK-014)
 *
 * Fetches custom stylesheets for a site, combines them into a single CSS file,
 * and stores the result in local storage for same-origin serving in the preview iframe.
 */

import type { LocalStorage } from './storage';

const CSS_PREFIX = 'css/';
const COMBINED_FILENAME = 'combined.css';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedCSS {
	body: string;
	cached_at: string;
	fresh: boolean;
}

/**
 * Build the storage key for a site's combined CSS file.
 */
function storageKey(siteId: string): string {
	return `${CSS_PREFIX}${siteId}/${COMBINED_FILENAME}`;
}

/**
 * Retrieve cached CSS from local storage. Returns null if not found.
 * Includes freshness check based on 24-hour TTL.
 */
export async function getCachedCSS(
	siteId: string,
	storage: LocalStorage
): Promise<CachedCSS | null> {
	const key = storageKey(siteId);
	const object = await storage.get(key);

	if (!object) return null;

	const body = await object.text();
	const cachedAt = object.customMetadata?.cached_at ?? '';
	const fresh = cachedAt
		? Date.now() - new Date(cachedAt).getTime() < CACHE_MAX_AGE_MS
		: false;

	return { body, cached_at: cachedAt, fresh };
}

/**
 * Fetch all custom stylesheets for a site from DB source_urls data,
 * combine them, and store in local storage.
 *
 * Returns the combined CSS string.
 */
export async function cacheStylesheets(
	siteId: string,
	env: { BCE_DB: import('$lib/server/db').D1CompatDatabase; BCE_STORAGE: LocalStorage }
): Promise<string> {
	const db = env.BCE_DB;
	const catalogue = await db
		.prepare(
			`SELECT id, source_urls FROM css_catalogues
			 WHERE site_id = ? AND status = 'complete'
			 ORDER BY scraped_at DESC LIMIT 1`
		)
		.bind(siteId)
		.first<{ id: string; source_urls: string }>();

	if (!catalogue || !catalogue.source_urls) {
		throw new Error(`No completed CSS catalogue found for site ${siteId}`);
	}

	const sourceData = JSON.parse(catalogue.source_urls) as {
		raw_custom_css?: { url: string; content: string }[];
		raw_inline_css?: string[];
	};

	// Combine all custom CSS and inline styles into one file
	const parts: string[] = [];

	if (sourceData.raw_custom_css) {
		for (const sheet of sourceData.raw_custom_css) {
			parts.push(`/* Source: ${sheet.url} */`);
			parts.push(sheet.content);
			parts.push('');
		}
	}

	if (sourceData.raw_inline_css) {
		for (let i = 0; i < sourceData.raw_inline_css.length; i++) {
			parts.push(`/* Inline style block ${i + 1} */`);
			parts.push(sourceData.raw_inline_css[i]);
			parts.push('');
		}
	}

	const combinedCSS = parts.join('\n');

	// Store in local storage with metadata
	const key = storageKey(siteId);
	await env.BCE_STORAGE.put(key, combinedCSS, {
		customMetadata: { cached_at: new Date().toISOString() }
	});

	return combinedCSS;
}

/**
 * Invalidate (delete) cached CSS for a site.
 * Call this when a re-scrape happens so stale CSS is purged.
 */
export async function invalidateCachedCSS(
	siteId: string,
	storage: LocalStorage
): Promise<void> {
	const key = storageKey(siteId);
	await storage.delete(key);
}
