/**
 * CSS Parser Module (WRK-009)
 *
 * Extracts class selectors and their CSS properties from raw stylesheet text.
 * Designed to run in Cloudflare Workers — no heavy dependencies, regex-based parsing.
 *
 * Feeds into WRK-012 (catalogue assembly) which populates catalogue_classes in D1.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParsedClass {
	class_name: string;
	properties: Record<string, string>;
	media_queries: string[]; // which media queries contain this class
	selector_count: number; // how many times this class appears in selectors
}

export interface ParseResult {
	classes: ParsedClass[];
	parse_errors: string[];
	total_rules_processed: number;
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Strip CSS comments */
function stripComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Extract class names from a selector string. Returns unique class names found. */
function extractClassNamesFromSelector(selector: string): string[] {
	// Match class selectors: a dot followed by a valid CSS identifier
	// CSS ident: [-]?[a-zA-Z_\u00a0-\uffff][-a-zA-Z0-9_\u00a0-\uffff]*
	// Also handle escaped characters (\xx)
	const classRegex = /\.(-?[a-zA-Z_][-a-zA-Z0-9_]*(?:\\.[a-zA-Z0-9_]+)*)/g;
	const classes: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = classRegex.exec(selector)) !== null) {
		// Unescape any escaped characters
		const className = match[1].replace(/\\(.)/g, '$1');
		if (!classes.includes(className)) {
			classes.push(className);
		}
	}

	return classes;
}

/** Parse property declarations from a block body string (content between { }) */
function parseProperties(body: string): Record<string, string> {
	const props: Record<string, string> = {};
	// Split on semicolons, but be careful about values with semicolons in strings
	const declarations = body.split(';');

	for (const decl of declarations) {
		const trimmed = decl.trim();
		if (!trimmed) continue;

		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) continue;

		const property = trimmed.slice(0, colonIdx).trim().toLowerCase();
		const value = trimmed.slice(colonIdx + 1).trim();

		// Skip if property name looks invalid
		if (!property || /[{}]/.test(property)) continue;

		props[property] = value;
	}

	return props;
}

/**
 * Find matching closing brace for an opening brace at the given position.
 * Returns the index of the closing brace, or -1 if not found.
 */
function findClosingBrace(css: string, openPos: number): number {
	let depth = 1;
	for (let i = openPos + 1; i < css.length; i++) {
		if (css[i] === '{') depth++;
		else if (css[i] === '}') {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

// ── At-rule blocks to skip entirely ────────────────────────────────────────

const SKIP_AT_RULES = /^@(import|keyframes|font-face|charset|namespace|supports|layer|counter-style|property)/i;

// ── Core parser ────────────────────────────────────────────────────────────

/**
 * Parse a block of CSS rules (either top-level or inside a media query).
 * Populates the classMap with extracted data.
 */
function parseRuleBlock(
	css: string,
	mediaQuery: string | null,
	classMap: Map<string, ParsedClass>,
	errors: string[],
	stats: { rulesProcessed: number }
): void {
	// Regex to match: selector(s) { declarations }
	// We walk the string manually to handle nested braces properly
	let pos = 0;

	while (pos < css.length) {
		// Skip whitespace
		while (pos < css.length && /\s/.test(css[pos])) pos++;
		if (pos >= css.length) break;

		// Find next opening brace
		const braceIdx = css.indexOf('{', pos);
		if (braceIdx === -1) break;

		const prelude = css.slice(pos, braceIdx).trim();

		// Find matching closing brace
		const closeIdx = findClosingBrace(css, braceIdx);
		if (closeIdx === -1) {
			errors.push(`Unmatched brace near: "${prelude.slice(0, 60)}..."`);
			break;
		}

		const body = css.slice(braceIdx + 1, closeIdx).trim();
		pos = closeIdx + 1;

		// Skip empty preludes
		if (!prelude) continue;

		// Handle at-rules we want to skip
		if (SKIP_AT_RULES.test(prelude)) {
			continue;
		}

		// Handle @media queries — recurse into the body
		const mediaMatch = prelude.match(/^@media\s+(.+)$/i);
		if (mediaMatch) {
			const mq = mediaMatch[1].trim();
			parseRuleBlock(body, mq, classMap, errors, stats);
			continue;
		}

		// Skip other at-rules we don't handle (e.g. @page, @document)
		if (prelude.startsWith('@')) {
			continue;
		}

		// This is a normal rule — extract classes from the selector
		stats.rulesProcessed++;

		// A rule can have comma-separated selectors
		const selectors = prelude.split(',');
		const properties = parseProperties(body);

		for (const sel of selectors) {
			const classNames = extractClassNamesFromSelector(sel.trim());

			for (const className of classNames) {
				let entry = classMap.get(className);
				if (!entry) {
					entry = {
						class_name: className,
						properties: {},
						media_queries: [],
						selector_count: 0
					};
					classMap.set(className, entry);
				}

				// Merge properties (later declarations overwrite earlier ones)
				Object.assign(entry.properties, properties);

				// Track media query
				if (mediaQuery && !entry.media_queries.includes(mediaQuery)) {
					entry.media_queries.push(mediaQuery);
				}

				entry.selector_count++;
			}
		}
	}
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse CSS text and extract all class selectors with their properties.
 *
 * Handles:
 * - Simple class selectors (.card)
 * - Compound selectors (.card .card-body)
 * - Multi-class selectors (.card.shadow-sm)
 * - Pseudo-classes (.btn:hover)
 * - Media queries (@media blocks)
 * - Malformed CSS (logs warnings, never throws)
 */
export function parseCSS(cssText: string): ParseResult {
	const classMap = new Map<string, ParsedClass>();
	const errors: string[] = [];
	const stats = { rulesProcessed: 0 };

	try {
		// Strip comments first
		const cleaned = stripComments(cssText);

		parseRuleBlock(cleaned, null, classMap, errors, stats);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[css-parser] Unexpected error during parsing: ${message}`);
		errors.push(`Unexpected parse error: ${message}`);
	}

	// Log warnings for any errors encountered
	for (const e of errors) {
		console.warn(`[css-parser] ${e}`);
	}

	return {
		classes: Array.from(classMap.values()),
		parse_errors: errors,
		total_rules_processed: stats.rulesProcessed
	};
}

/**
 * Extract unique class names from HTML class attributes.
 *
 * Parses `class="..."` and `class='...'` attributes, splits on whitespace,
 * and returns a deduplicated list of class names.
 *
 * Used by the scraper to determine which classes are actually referenced
 * in page HTML (for the `verified` flag in catalogue_classes).
 */
export function extractClassesFromHTML(html: string): string[] {
	const classSet = new Set<string>();

	// Match class="..." or class='...'
	const attrRegex = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
	let match: RegExpExecArray | null;

	while ((match = attrRegex.exec(html)) !== null) {
		const value = match[1] ?? match[2] ?? '';
		const names = value.split(/\s+/).filter(Boolean);
		for (const name of names) {
			classSet.add(name);
		}
	}

	return Array.from(classSet);
}
