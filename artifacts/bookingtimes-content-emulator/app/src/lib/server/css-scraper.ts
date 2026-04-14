/**
 * CSS Scraper Module — WRK-BCE2-005
 *
 * Fetches all stylesheets and inline styles from a target BookingTimes site,
 * classifies them (Bootstrap, UIKit, Font Awesome, LoadCSS), and caches
 * the raw CSS to the filesystem for later analysis.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedStylesheet {
	url: string;
	content: string;
	sourceType: 'external' | 'inline';
	isBootstrap: boolean;
	isUIKit: boolean;
	isFontAwesome: boolean;
	isLoadCSS: boolean;
	loadCSSKey?: string;
	fileSize: number;
}

export interface ScrapeResult {
	siteUrl: string;
	scrapedAt: string;
	stylesheets: ScrapedStylesheet[];
	totalSize: number;
	errors: string[];
}

export interface ScrapeOptions {
	/** Per-request timeout in milliseconds (default 30 000) */
	timeout?: number;
	/** Root directory for the CSS cache (default: app/data/css-cache) */
	cacheDir?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 30_000;

/** Derive a filesystem-safe slug from a URL hostname. */
function siteSlug(url: string): string {
	try {
		const host = new URL(url).hostname;
		return host.replace(/[^a-z0-9.-]/gi, '_');
	} catch {
		return 'unknown-site';
	}
}

/** Derive a filename from a stylesheet URL. */
function cssFileName(url: string, index: number): string {
	try {
		const u = new URL(url);
		const pathname = u.pathname.replace(/[^a-z0-9._-]/gi, '_');
		const query = u.search ? '_' + u.search.replace(/[^a-z0-9._-]/gi, '_') : '';
		const name = (pathname + query).slice(0, 120);
		return `${index}_${name}.css`;
	} catch {
		return `${index}_inline.css`;
	}
}

/** Resolve a potentially-relative href against a base URL. */
function resolveUrl(href: string, base: string): string {
	try {
		return new URL(href, base).href;
	} catch {
		return href;
	}
}

/** Classify a stylesheet by inspecting its URL and content. */
function classify(url: string, content: string) {
	const lowerUrl = url.toLowerCase();
	const snippet = content.slice(0, 4000).toLowerCase();

	const isBootstrap =
		lowerUrl.includes('bootstrap') ||
		snippet.includes('bootstrap') ||
		snippet.includes('.container-fluid') ||
		snippet.includes('.btn-primary');

	const isUIKit =
		lowerUrl.includes('uikit') ||
		snippet.includes('uikit') ||
		snippet.includes('.uk-');

	const isFontAwesome =
		lowerUrl.includes('font-awesome') ||
		lowerUrl.includes('fontawesome') ||
		snippet.includes('font awesome') ||
		snippet.includes('.fa-');

	const isLoadCSS = /loadcss\?k=/i.test(url);

	let loadCSSKey: string | undefined;
	if (isLoadCSS) {
		const match = url.match(/loadcss\?k=([^&]+)/i);
		if (match) loadCSSKey = match[1];
	}

	return { isBootstrap, isUIKit, isFontAwesome, isLoadCSS, loadCSSKey };
}

/** Extract <link rel="stylesheet"> hrefs from raw HTML. */
function extractLinkHrefs(html: string): string[] {
	const results: string[] = [];
	// Match <link ...> tags with rel="stylesheet"
	const linkRegex = /<link\b[^>]*>/gi;
	let m: RegExpExecArray | null;
	while ((m = linkRegex.exec(html)) !== null) {
		const tag = m[0];
		if (!/rel\s*=\s*["']?stylesheet["']?/i.test(tag)) continue;
		const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
		if (hrefMatch) results.push(hrefMatch[1]);
	}
	return results;
}

/** Extract inline <style> blocks from raw HTML. */
function extractInlineStyles(html: string): string[] {
	const results: string[] = [];
	const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
	let m: RegExpExecArray | null;
	while ((m = styleRegex.exec(html)) !== null) {
		const content = m[1].trim();
		if (content.length > 0) results.push(content);
	}
	return results;
}

/** Fetch with a timeout via AbortController. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
			}
		});
		return res;
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function scrapeSiteCSS(
	siteUrl: string,
	options: ScrapeOptions = {}
): Promise<ScrapeResult> {
	const timeout = options.timeout ?? DEFAULT_TIMEOUT;
	const cacheRoot = options.cacheDir ?? join(process.cwd(), 'data', 'css-cache');
	const slug = siteSlug(siteUrl);
	const cacheDir = join(cacheRoot, slug);

	const result: ScrapeResult = {
		siteUrl,
		scrapedAt: new Date().toISOString(),
		stylesheets: [],
		totalSize: 0,
		errors: []
	};

	// 1. Fetch the page HTML
	let html: string;
	try {
		const res = await fetchWithTimeout(siteUrl, timeout);
		if (!res.ok) {
			result.errors.push(`Page fetch failed: HTTP ${res.status} for ${siteUrl}`);
			return result;
		}
		html = await res.text();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		result.errors.push(`Page fetch error: ${msg}`);
		return result;
	}

	// Ensure cache directory exists
	await mkdir(cacheDir, { recursive: true });

	// 2. Extract stylesheet links and inline styles
	const linkHrefs = extractLinkHrefs(html);
	const inlineStyles = extractInlineStyles(html);

	let index = 0;

	// 3. Fetch each external stylesheet
	for (const href of linkHrefs) {
		const fullUrl = resolveUrl(href, siteUrl);
		try {
			const res = await fetchWithTimeout(fullUrl, timeout);
			if (!res.ok) {
				result.errors.push(`CSS fetch failed: HTTP ${res.status} for ${fullUrl}`);
				continue;
			}
			const content = await res.text();
			const { isBootstrap, isUIKit, isFontAwesome, isLoadCSS, loadCSSKey } = classify(
				fullUrl,
				content
			);
			const sheet: ScrapedStylesheet = {
				url: fullUrl,
				content,
				sourceType: 'external',
				isBootstrap,
				isUIKit,
				isFontAwesome,
				isLoadCSS,
				...(loadCSSKey ? { loadCSSKey } : {}),
				fileSize: Buffer.byteLength(content, 'utf-8')
			};
			result.stylesheets.push(sheet);

			// Cache to filesystem
			const filename = cssFileName(fullUrl, index);
			await writeFile(join(cacheDir, filename), content, 'utf-8');
			index++;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			result.errors.push(`CSS fetch error for ${fullUrl}: ${msg}`);
		}
	}

	// 4. Inline styles
	for (const css of inlineStyles) {
		const { isBootstrap, isUIKit, isFontAwesome } = classify('', css);
		const sheet: ScrapedStylesheet = {
			url: `inline#${index}`,
			content: css,
			sourceType: 'inline',
			isBootstrap,
			isUIKit,
			isFontAwesome,
			isLoadCSS: false,
			fileSize: Buffer.byteLength(css, 'utf-8')
		};
		result.stylesheets.push(sheet);

		const filename = cssFileName('inline', index);
		await writeFile(join(cacheDir, filename), css, 'utf-8');
		index++;
	}

	// 5. Totals
	result.totalSize = result.stylesheets.reduce((sum, s) => sum + s.fileSize, 0);

	return result;
}
