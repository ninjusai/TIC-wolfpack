/**
 * Page Content Scraper Endpoint
 *
 * POST /api/scrape-page
 * Fetches the full HTML of a given URL, extracts the main content area,
 * and returns it for import into the editor.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch a URL with timeout, return null on failure */
async function safeFetch(url: string, timeoutMs = 15000): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'BookingtimesEmulator/1.0 (Page Scraper)',
				Accept: 'text/html,*/*'
			}
		});
		clearTimeout(timer);
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

/** Extract the <title> tag content */
function extractTitle(html: string): string {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return match?.[1]?.trim() ?? 'Untitled';
}

/** Extract meta description */
function extractMetaDescription(html: string): string {
	const match = html.match(/<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i)
		|| html.match(/<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i);
	return match?.[1]?.trim() ?? '';
}

/** Count CSS classes in HTML */
function countClasses(html: string): number {
	const classes = new Set<string>();
	const classRegex = /class\s*=\s*["']([^"']+)["']/gi;
	let match: RegExpExecArray | null;
	while ((match = classRegex.exec(html)) !== null) {
		for (const cls of match[1].split(/\s+/)) {
			if (cls.trim()) classes.add(cls.trim());
		}
	}
	return classes.size;
}

/** Strip unwanted tags from HTML content */
function stripTags(html: string, tags: string[]): string {
	let result = html;
	for (const tag of tags) {
		// Remove opening and closing tags and everything between them
		const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
		result = result.replace(regex, '');
		// Also remove self-closing versions
		const selfClosing = new RegExp(`<${tag}\\b[^>]*/?>`, 'gi');
		result = result.replace(selfClosing, '');
	}
	return result;
}

/**
 * Extract the main content area from full HTML.
 * Uses a hierarchy of selectors to find the content wrapper.
 */
function extractContent(html: string, contentWrapper?: { selector?: string; tag?: string } | null): string {
	// Strip unwanted elements first
	let cleaned = stripTags(html, ['script', 'style', 'nav', 'header', 'footer', 'noscript', 'iframe']);

	// Remove HTML comments
	cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

	// Try to extract body content first
	const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
	const bodyContent = bodyMatch?.[1] ?? cleaned;

	// Strategy 1: Use content_wrapper selector from CSS catalogue if available
	if (contentWrapper?.selector) {
		const selectorContent = extractBySelector(bodyContent, contentWrapper.selector);
		if (selectorContent && selectorContent.trim().length > 100) {
			return selectorContent.trim();
		}
	}

	// Strategy 2: Look for <main> tag
	const mainMatch = bodyContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
	if (mainMatch?.[1]?.trim() && mainMatch[1].trim().length > 100) {
		return mainMatch[1].trim();
	}

	// Strategy 3: Look for <article> tag
	const articleMatch = bodyContent.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
	if (articleMatch?.[1]?.trim() && articleMatch[1].trim().length > 100) {
		return articleMatch[1].trim();
	}

	// Strategy 4: Look for common content wrapper classes
	const wrapperPatterns = [
		/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*$/i,
		/<div[^>]*class="[^"]*main[^"]*"[^>]*>([\s\S]*?)<\/div>\s*$/i,
		/<div[^>]*class="[^"]*page[^"]*"[^>]*>([\s\S]*?)<\/div>\s*$/i,
		/<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>\s*$/i,
		/<div[^>]*id="main"[^>]*>([\s\S]*?)<\/div>\s*$/i,
	];

	for (const pattern of wrapperPatterns) {
		const match = bodyContent.match(pattern);
		if (match?.[1]?.trim() && match[1].trim().length > 100) {
			return match[1].trim();
		}
	}

	// Strategy 5: Look for Bootstrap container
	const containerMatch = bodyContent.match(/<div[^>]*class="[^"]*container[^"]*"[^>]*>([\s\S]*)/i);
	if (containerMatch?.[1]?.trim() && containerMatch[1].trim().length > 100) {
		// Find the matching closing div — take a generous chunk
		const content = containerMatch[1];
		// Find reasonable end point (before last few closing divs)
		return content.trim();
	}

	// Fallback: return the full body content (minus already-stripped nav/header/footer)
	return bodyContent.trim();
}

/** Try to extract content using a CSS-like selector (simple class/tag matching) */
function extractBySelector(html: string, selector: string): string | null {
	// Handle simple selectors like ".container", "main", "#content"
	if (selector.startsWith('.')) {
		const className = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`<[a-z][a-z0-9]*[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*)`, 'i');
		const match = html.match(regex);
		return match?.[1] ?? null;
	}
	if (selector.startsWith('#')) {
		const id = selector.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`<[a-z][a-z0-9]*[^>]*id="${id}"[^>]*>([\\s\\S]*)`, 'i');
		const match = html.match(regex);
		return match?.[1] ?? null;
	}
	// Tag selector
	const tag = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
	const match = html.match(regex);
	return match?.[1] ?? null;
}

// ── POST Handler ────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: { site_id?: string; page_url?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { site_id, page_url } = body;
	if (!site_id || !page_url) {
		throw error(400, 'Missing required fields: site_id, page_url');
	}

	// Validate URL
	let targetUrl: URL;
	try {
		targetUrl = new URL(page_url);
	} catch {
		throw error(400, 'Invalid page_url — must be a valid URL');
	}

	// Verify the site exists
	const site = await db
		.prepare('SELECT id, name, url FROM sites WHERE id = ?')
		.bind(site_id)
		.first<{ id: string; name: string; url: string }>();

	if (!site) {
		throw error(404, `Site not found: ${site_id}`);
	}

	// Check for content_wrapper from CSS catalogue
	let contentWrapper: { selector?: string; tag?: string } | null = null;
	try {
		const catalogue = await db
			.prepare(
				`SELECT content_wrapper FROM css_catalogues
				 WHERE site_id = ? AND status = 'complete'
				 ORDER BY scraped_at DESC LIMIT 1`
			)
			.bind(site_id)
			.first<{ content_wrapper: string | null }>();

		if (catalogue?.content_wrapper) {
			try {
				contentWrapper = JSON.parse(catalogue.content_wrapper);
			} catch {
				// Ignore malformed JSON
			}
		}
	} catch {
		// Non-critical — continue without wrapper info
	}

	// Fetch the page
	const fullHtml = await safeFetch(targetUrl.href);
	if (!fullHtml) {
		throw error(502, `Could not fetch page: ${targetUrl.href}`);
	}

	// Extract content
	const title = extractTitle(fullHtml);
	const contentHtml = extractContent(fullHtml, contentWrapper);
	const description = extractMetaDescription(fullHtml);
	const classesFound = countClasses(contentHtml);

	return json({
		site_id,
		url: targetUrl.href,
		title,
		content_html: contentHtml,
		full_html: fullHtml,
		meta: {
			description,
			classes_found: classesFound
		}
	});
};
