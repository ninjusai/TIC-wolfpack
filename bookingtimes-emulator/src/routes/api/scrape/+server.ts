import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cacheStylesheets, invalidateCachedCSS } from '$lib/server/css-cache';
import { discoverContentWrapper } from '$lib/server/wrapper-discovery';

// Known CDN patterns — mark but don't re-download
const CDN_PATTERNS: { pattern: RegExp; label: string }[] = [
	{ pattern: /bootstrap/i, label: 'bootstrap' },
	{ pattern: /font-?awesome/i, label: 'fontawesome' },
	{ pattern: /cdn\.jsdelivr\.net/i, label: 'jsdelivr-cdn' },
	{ pattern: /cdnjs\.cloudflare\.com/i, label: 'cloudflare-cdn' },
	{ pattern: /unpkg\.com/i, label: 'unpkg-cdn' },
	{ pattern: /googleapis\.com\/css/i, label: 'google-fonts' },
	{ pattern: /fonts\.gstatic\.com/i, label: 'google-fonts' }
];

/** Additional page paths to scrape for broader CSS coverage */
const EXTRA_PATHS = ['/services', '/about', '/contact'];

/** Resolve a potentially relative URL against a base */
function resolveUrl(href: string, baseUrl: string): string {
	try {
		return new URL(href, baseUrl).href;
	} catch {
		return '';
	}
}

/** Check if a stylesheet URL matches a known CDN */
function identifyCdn(url: string): string | null {
	for (const { pattern, label } of CDN_PATTERNS) {
		if (pattern.test(url)) return label;
	}
	return null;
}

/** Extract stylesheet link hrefs from HTML */
function extractStylesheetLinks(html: string): string[] {
	const links: string[] = [];
	// Match <link> tags with rel="stylesheet"
	const linkRegex = /<link\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = linkRegex.exec(html)) !== null) {
		const tag = match[0];
		// Check rel="stylesheet" (handle single/double quotes and varied spacing)
		if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
		const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
		if (hrefMatch?.[1]) {
			links.push(hrefMatch[1]);
		}
	}
	return links;
}

/** Extract inline <style> block contents from HTML */
function extractInlineStyles(html: string): string[] {
	const styles: string[] = [];
	const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
	let match: RegExpExecArray | null;
	while ((match = styleRegex.exec(html)) !== null) {
		const content = match[1].trim();
		if (content) styles.push(content);
	}
	return styles;
}

/** Extract all CSS class names used in class="..." attributes */
function extractHtmlClasses(html: string): Set<string> {
	const classes = new Set<string>();
	const classRegex = /class\s*=\s*["']([^"']+)["']/gi;
	let match: RegExpExecArray | null;
	while ((match = classRegex.exec(html)) !== null) {
		const classString = match[1];
		for (const cls of classString.split(/\s+/)) {
			const trimmed = cls.trim();
			if (trimmed) classes.add(trimmed);
		}
	}
	return classes;
}

/** Fetch a URL with timeout, return null on failure */
async function safeFetch(url: string, timeoutMs = 10000): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'BookingtimesEmulator/1.0 (CSS Scraper)',
				Accept: 'text/html,text/css,*/*'
			}
		});
		clearTimeout(timer);
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;
	const storage = locals.storage;

	// Parse request body
	let body: { site_id?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { site_id } = body;
	if (!site_id) {
		throw error(400, 'Missing required field: site_id');
	}

	// Look up site
	const site = await db
		.prepare('SELECT id, name, url FROM sites WHERE id = ?')
		.bind(site_id)
		.first<{ id: string; name: string; url: string }>();

	if (!site) {
		throw error(404, `Site not found: ${site_id}`);
	}

	// Normalise base URL (ensure trailing slash)
	const baseUrl = site.url.endsWith('/') ? site.url : site.url + '/';

	// ----- Fetch pages -----
	const pagesToScrape = [baseUrl, ...EXTRA_PATHS.map((p) => baseUrl + p.replace(/^\//, ''))];
	const fetchResults = await Promise.allSettled(pagesToScrape.map((url) => safeFetch(url)));

	const htmlPages: { url: string; html: string }[] = [];
	for (let i = 0; i < pagesToScrape.length; i++) {
		const result = fetchResults[i];
		if (result.status === 'fulfilled' && result.value) {
			htmlPages.push({ url: pagesToScrape[i], html: result.value });
		}
	}

	if (htmlPages.length === 0) {
		throw error(502, `Could not fetch any pages from ${baseUrl}`);
	}

	// ----- Aggregate CSS data across all fetched pages -----
	const allStylesheetHrefs = new Set<string>();
	const allInlineStyles: string[] = [];
	const allHtmlClasses = new Set<string>();

	for (const { url, html } of htmlPages) {
		// Stylesheet links
		for (const href of extractStylesheetLinks(html)) {
			const resolved = resolveUrl(href, url);
			if (resolved) allStylesheetHrefs.add(resolved);
		}

		// Inline styles
		for (const style of extractInlineStyles(html)) {
			allInlineStyles.push(style);
		}

		// HTML classes
		for (const cls of extractHtmlClasses(html)) {
			allHtmlClasses.add(cls);
		}
	}

	// ----- Classify stylesheets -----
	const cdnStylesheets: { url: string; label: string }[] = [];
	const customStylesheetUrls: string[] = [];

	for (const url of allStylesheetHrefs) {
		const cdnLabel = identifyCdn(url);
		if (cdnLabel) {
			cdnStylesheets.push({ url, label: cdnLabel });
		} else {
			customStylesheetUrls.push(url);
		}
	}

	// ----- Download custom stylesheets -----
	const customStylesheetContents: { url: string; content: string }[] = [];
	const customFetchResults = await Promise.allSettled(
		customStylesheetUrls.map((url) => safeFetch(url))
	);

	for (let i = 0; i < customStylesheetUrls.length; i++) {
		const result = customFetchResults[i];
		if (result.status === 'fulfilled' && result.value) {
			customStylesheetContents.push({
				url: customStylesheetUrls[i],
				content: result.value
			});
		}
	}

	// ----- Build source_urls JSON -----
	const sourceUrls = JSON.stringify({
		pages_scraped: htmlPages.map((p) => p.url),
		cdn_stylesheets: cdnStylesheets,
		custom_stylesheets: customStylesheetContents.map((s) => s.url),
		inline_style_count: allInlineStyles.length,
		raw_custom_css: customStylesheetContents.map((s) => ({
			url: s.url,
			content: s.content
		})),
		raw_inline_css: allInlineStyles,
		html_classes: Array.from(allHtmlClasses)
	});

	// ----- Store in D1 -----
	const catalogueId = crypto.randomUUID();

	try {
		await db
			.prepare(
				`INSERT INTO css_catalogues (id, site_id, scraped_at, status, source_urls, created_at)
				 VALUES (?, ?, datetime('now'), 'complete', ?, datetime('now'))`
			)
			.bind(catalogueId, site_id, sourceUrls)
			.run();
	} catch (dbError) {
		console.error('D1 insert error:', dbError);
		throw error(500, 'Failed to store catalogue in database');
	}

	// ----- Cache CSS to storage (WRK-014) -----
	if (storage) {
		try {
			// Invalidate any stale cache first, then rebuild
			await invalidateCachedCSS(site_id, storage);
			await cacheStylesheets(site_id, { BCE_DB: db, BCE_STORAGE: storage });
		} catch (cssErr) {
			// Non-fatal: log but don't fail the scrape
			console.error('CSS caching error:', cssErr);
		}
	}

	// ----- Discover content wrapper (WRK-016) -----
	// Use the homepage HTML (first page fetched) for wrapper detection
	const homepageHtml = htmlPages[0]?.html;
	let contentWrapper = null;
	if (homepageHtml) {
		try {
			contentWrapper = discoverContentWrapper(homepageHtml);
			await db
				.prepare('UPDATE css_catalogues SET content_wrapper = ? WHERE id = ?')
				.bind(JSON.stringify(contentWrapper), catalogueId)
				.run();
		} catch (wrapperErr) {
			console.error('Wrapper discovery error:', wrapperErr);
		}
	}

	// ----- Extract filenames for response -----
	const getFilename = (url: string): string => {
		try {
			const pathname = new URL(url).pathname;
			return pathname.split('/').pop() || url;
		} catch {
			return url;
		}
	};

	return json({
		catalogue_id: catalogueId,
		site_id,
		stylesheets_found: allStylesheetHrefs.size,
		cdn_stylesheets: cdnStylesheets.map((s) => getFilename(s.url)),
		custom_stylesheets: customStylesheetContents.map((s) => getFilename(s.url)),
		custom_stylesheets_failed: customStylesheetUrls.length - customStylesheetContents.length,
		inline_styles: allInlineStyles.length,
		classes_in_html: allHtmlClasses.size,
		pages_scraped: htmlPages.length,
		pages_failed: pagesToScrape.length - htmlPages.length,
		content_wrapper: contentWrapper,
		status: 'complete'
	});
};
