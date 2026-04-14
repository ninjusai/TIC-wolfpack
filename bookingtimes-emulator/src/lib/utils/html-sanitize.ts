/**
 * Client-side HTML sanitizer for {@html} rendering.
 *
 * Strips dangerous elements and attributes to prevent XSS when
 * rendering AI-generated HTML inline (outside a sandboxed iframe).
 */

/** Tags that are always stripped (with their content) */
const STRIP_TAGS = /<!--[\s\S]*?-->|<\s*(script|iframe|object|embed|applet|form|base|link|meta)[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|applet|form|base|link|meta)[^>]*\/?\s*>/gi;

/** Inline <style> blocks — strip tag and content */
const STRIP_STYLE = /<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi;

/** Event handler attributes (onclick, onerror, onload, etc.) */
const STRIP_ON_ATTRS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** javascript: / data: / vbscript: in href/src/action attributes */
const STRIP_DANGEROUS_URLS = /\s+(href|src|action)\s*=\s*(?:"(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*')/gi;

/**
 * Sanitize HTML for safe inline rendering via {@html}.
 *
 * This is NOT a full CSP-grade sanitizer — it covers the primary XSS
 * vectors relevant to AI-generated HTML output (scripts, iframes,
 * event handlers, dangerous URLs). The sandboxed PreviewFrame remains
 * the primary safe rendering path.
 */
export function sanitizeHtml(html: string): string {
	if (!html) return '';

	let clean = html;

	// 1. Strip dangerous tags (with content)
	clean = clean.replace(STRIP_TAGS, '');

	// 2. Strip <style> blocks
	clean = clean.replace(STRIP_STYLE, '');

	// 3. Strip on* event handler attributes
	clean = clean.replace(STRIP_ON_ATTRS, '');

	// 4. Strip javascript:/data:/vbscript: URLs
	clean = clean.replace(STRIP_DANGEROUS_URLS, '');

	return clean;
}
