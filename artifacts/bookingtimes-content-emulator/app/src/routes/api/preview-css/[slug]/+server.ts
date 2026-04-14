/**
 * Preview CSS Endpoint — WRK-BCE2-006
 *
 * GET /api/preview-css/:slug
 *
 * Returns the combined Bootstrap + custom CSS for a given site slug
 * from the filesystem cache. UIKit CSS is excluded per DEC-029.
 *
 * The slug is the DB slug (e.g. "metro-driving"), but the css-cache
 * directory is keyed by hostname (e.g. "metrodriving.com.au") because
 * the CSS scraper uses the URL hostname. This route resolves the slug
 * to a hostname via the sites table.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import db from '$lib/db';

/**
 * Derive the filesystem-safe cache key from a URL hostname.
 * Must match the siteSlug() function in css-scraper.ts.
 */
function hostnameToCacheKey(url: string): string {
	try {
		const host = new URL(url).hostname;
		return host.replace(/[^a-z0-9.-]/gi, '_');
	} catch {
		return 'unknown-site';
	}
}

/** Resolve the css-cache directory for a given site slug. */
function cacheDir(slug: string): string {
	// Look up the site URL from the DB so we can derive the hostname-based cache key
	const row = db.prepare('SELECT url FROM sites WHERE slug = ?').get(slug) as
		| { url: string }
		| undefined;

	if (row?.url) {
		const cacheKey = hostnameToCacheKey(row.url);
		return join(process.cwd(), 'data', 'css-cache', cacheKey);
	}

	// Fallback: try the slug directly (backwards compat if someone cached by slug)
	return join(process.cwd(), 'data', 'css-cache', slug);
}

/** Check if a CSS filename/content looks like UIKit (excluded per DEC-029). */
function isUIKit(filename: string, contentSnippet: string): boolean {
	const lower = filename.toLowerCase();
	if (lower.includes('uikit')) return true;
	const snippet = contentSnippet.slice(0, 2000).toLowerCase();
	return snippet.includes('uikit') || snippet.includes('.uk-container');
}

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug;
	if (!slug || /[^a-z0-9._-]/i.test(slug)) {
		throw error(400, 'Invalid site slug');
	}

	const dir = cacheDir(slug);

	let files: string[];
	try {
		files = await readdir(dir);
	} catch {
		throw error(404, `No cached CSS found for site "${slug}". Run the CSS scraper first.`);
	}

	// Only include .css files, sorted by index prefix for deterministic order
	const cssFiles = files
		.filter((f) => f.endsWith('.css'))
		.sort((a, b) => {
			const idxA = parseInt(a.split('_')[0], 10) || 0;
			const idxB = parseInt(b.split('_')[0], 10) || 0;
			return idxA - idxB;
		});

	if (cssFiles.length === 0) {
		throw error(404, `No CSS files found in cache for site "${slug}".`);
	}

	const parts: string[] = [];

	for (const file of cssFiles) {
		const content = await readFile(join(dir, file), 'utf-8');
		// Exclude UIKit CSS per DEC-029
		if (isUIKit(file, content)) continue;
		parts.push(`/* === ${file} === */\n${content}`);
	}

	const combined = parts.join('\n\n');

	return new Response(combined, {
		headers: {
			'Content-Type': 'text/css; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
