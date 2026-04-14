/**
 * CSS Classifier Module — WRK-BCE2-010
 *
 * Classifies scraped CSS classes into three tiers:
 *   Tier 1: Bootstrap 5.0.2 base classes
 *   Tier 2: Site-specific custom CSS
 *   Tier 3: Platform / third-party (Font Awesome 6 Pro, UIKit, etc.)
 *
 * Stores per-class records in the css_audit table.
 */

import { scrapeSiteCSS, type ScrapedStylesheet } from './css-scraper';
import db from '$lib/db';
import bootstrapCatalogue from '$lib/data/bootstrap-5.0.2-classes.json';
import fa6Catalogue from '$lib/data/fa6-pro-classes.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifiedCSS {
	className: string;
	tier: 1 | 2 | 3;
	sourceFile: string;
	properties: Record<string, string>;
	notes?: string;
}

export interface ClassificationResult {
	siteId: number;
	totalClasses: number;
	tier1Count: number;
	tier2Count: number;
	tier3Count: number;
	classes: ClassifiedCSS[];
	errors: string[];
}

// ---------------------------------------------------------------------------
// Catalogue loaders (run once at module load)
// ---------------------------------------------------------------------------

/** Recursively extract string arrays from a nested object structure. */
function collectStrings(value: unknown, target: Set<string>): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === 'string') {
				target.add(item);
			}
		}
	} else if (value !== null && typeof value === 'object') {
		for (const nested of Object.values(value as Record<string, unknown>)) {
			collectStrings(nested, target);
		}
	}
}

/** Flatten the BS 5.0.2 catalogue into a Set of class names. */
function loadBootstrapClasses(): Set<string> {
	const set = new Set<string>();
	const cats = (bootstrapCatalogue as { categories: Record<string, unknown> }).categories;
	for (const value of Object.values(cats)) {
		collectStrings(value, set);
	}
	return set;
}

/** Build a Set of all explicitly listed FA6 Pro utility/style classes,
 *  plus a regex for matching icon names (fa-*). */
function loadFA6Classes(): { knownClasses: Set<string>; iconPattern: RegExp } {
	const set = new Set<string>();
	const cat = fa6Catalogue as Record<string, unknown>;
	for (const key of ['styles', 'sizing', 'utility', 'duotone_specific', 'sharp_family']) {
		const arr = cat[key];
		if (Array.isArray(arr)) {
			for (const cls of arr) set.add(cls);
		}
	}
	// Any class matching fa-<word> is treated as FA when the stylesheet is FA-sourced
	const iconPattern = /^fa-[a-z0-9][a-z0-9-]*$/;
	return { knownClasses: set, iconPattern };
}

const BS_CLASSES = loadBootstrapClasses();
const FA6 = loadFA6Classes();

// ---------------------------------------------------------------------------
// CSS parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract class selectors and their property blocks from raw CSS text.
 * Returns a map of className -> Record<string, string> (last-wins for dupes).
 */
function extractClassRules(css: string): Map<string, Record<string, string>> {
	const result = new Map<string, Record<string, string>>();

	// Strip comments
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

	// Match selectors { properties }. We avoid @-rules by skipping @media etc.
	// This regex finds top-level rule blocks (not nested @-rules contents, but
	// we also run it on the inner content of @media blocks).
	const ruleRegex = /([^{}@]+)\{([^{}]*)\}/g;

	// Also handle @media etc. by extracting their inner blocks
	const withMedia = expandAtRules(stripped);

	let m: RegExpExecArray | null;
	while ((m = ruleRegex.exec(withMedia)) !== null) {
		const selectorPart = m[1].trim();
		const propsPart = m[2].trim();

		// Parse properties
		const props = parseProperties(propsPart);

		// Extract class names from the selector
		const classNames = extractClassNames(selectorPart);
		for (const cls of classNames) {
			const existing = result.get(cls);
			if (existing) {
				// Merge properties (last-wins)
				Object.assign(existing, props);
			} else {
				result.set(cls, { ...props });
			}
		}
	}

	return result;
}

/**
 * Flatten @media / @supports blocks so their inner rules are also parsed.
 * We strip the outer @-rule wrapper and keep the contents.
 */
function expandAtRules(css: string): string {
	// Match @media ... { inner } — handles one level of nesting
	const atRuleRegex = /@[a-z-]+[^{]*\{([\s\S]*?\})\s*\}/gi;
	let expanded = css;
	let match: RegExpExecArray | null;
	const extras: string[] = [];

	while ((match = atRuleRegex.exec(css)) !== null) {
		extras.push(match[1]);
	}

	// Append extracted inner blocks so the main regex picks them up
	if (extras.length > 0) {
		expanded += '\n' + extras.join('\n');
	}

	return expanded;
}

/** Parse a CSS declaration block into key-value pairs. */
function parseProperties(block: string): Record<string, string> {
	const props: Record<string, string> = {};
	const declarations = block.split(';');
	for (const decl of declarations) {
		const colonIdx = decl.indexOf(':');
		if (colonIdx === -1) continue;
		const prop = decl.slice(0, colonIdx).trim();
		const val = decl.slice(colonIdx + 1).trim();
		if (prop && val) {
			props[prop] = val;
		}
	}
	return props;
}

/** Extract individual class names from a CSS selector string.
 *  e.g. ".card .card-body:hover, .btn-primary" → ["card", "card-body", "btn-primary"] */
function extractClassNames(selector: string): string[] {
	const classes: string[] = [];
	// Match .className patterns — class names are [a-zA-Z0-9_-]+
	const classRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
	let m: RegExpExecArray | null;
	while ((m = classRegex.exec(selector)) !== null) {
		const cls = m[1];
		// Deduplicate within this selector
		if (!classes.includes(cls)) {
			classes.push(cls);
		}
	}
	return classes;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classifyClass(
	className: string,
	sourceSheet: ScrapedStylesheet
): 1 | 2 | 3 {
	// Tier 1: Bootstrap 5.0.2
	if (BS_CLASSES.has(className)) {
		return 1;
	}

	// Tier 3: Font Awesome
	if (sourceSheet.isFontAwesome) {
		// All classes from an FA stylesheet are Tier 3
		return 3;
	}
	// Even if from a non-FA sheet, if the class matches FA patterns
	if (FA6.knownClasses.has(className) || FA6.iconPattern.test(className)) {
		return 3;
	}

	// Tier 3: UIKit (ignored per DEC-029 but still classified)
	if (sourceSheet.isUIKit || className.startsWith('uk-')) {
		return 3;
	}

	// Tier 2: everything else is site-custom
	return 2;
}

function tierNote(tier: 1 | 2 | 3, sourceSheet: ScrapedStylesheet): string | undefined {
	if (tier === 1) return 'Bootstrap 5.0.2';
	if (tier === 3) {
		if (sourceSheet.isFontAwesome) return 'Font Awesome 6 Pro';
		if (sourceSheet.isUIKit) return 'UIKit (ignored per DEC-029)';
		if (sourceSheet.isUIKit === false && tier === 3) return 'Third-party';
	}
	if (tier === 2 && sourceSheet.isLoadCSS) {
		return `LoadCSS key=${sourceSheet.loadCSSKey ?? 'unknown'}`;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function classifySiteCSS(siteId: number): Promise<ClassificationResult> {
	const errors: string[] = [];

	// 1. Look up site URL from database
	const site = db.prepare('SELECT url FROM sites WHERE id = ?').get(siteId) as
		| { url: string }
		| undefined;

	if (!site) {
		return {
			siteId,
			totalClasses: 0,
			tier1Count: 0,
			tier2Count: 0,
			tier3Count: 0,
			classes: [],
			errors: [`Site with id ${siteId} not found`]
		};
	}

	// 2. Scrape all stylesheets
	const scrapeResult = await scrapeSiteCSS(site.url);
	if (scrapeResult.errors.length > 0) {
		errors.push(...scrapeResult.errors);
	}

	// 3. Parse & classify
	const classMap = new Map<string, ClassifiedCSS>();

	for (const sheet of scrapeResult.stylesheets) {
		const rules = extractClassRules(sheet.content);
		const sourceFile = sheet.url;

		for (const [className, properties] of rules) {
			const tier = classifyClass(className, sheet);

			// If we've already seen this class, keep the first occurrence but
			// merge properties and prefer the lower tier number (more specific classification)
			const existing = classMap.get(className);
			if (existing) {
				// Merge properties
				Object.assign(existing.properties, properties);
				// Keep the lower tier (Bootstrap > custom > third-party)
				if (tier < existing.tier) {
					existing.tier = tier;
					existing.sourceFile = sourceFile;
					existing.notes = tierNote(tier, sheet);
				}
			} else {
				classMap.set(className, {
					className,
					tier,
					sourceFile,
					properties,
					notes: tierNote(tier, sheet)
				});
			}
		}
	}

	const classes = Array.from(classMap.values());

	// 4. Store in database
	const insertStmt = db.prepare(`
		INSERT OR REPLACE INTO css_audit
			(site_id, class_name, tier, source_file, properties, usage_count, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`);

	const updateSiteStmt = db.prepare(`
		UPDATE sites SET last_scraped_at = datetime('now') WHERE id = ?
	`);

	const insertAll = db.transaction(() => {
		for (const cls of classes) {
			insertStmt.run(
				siteId,
				cls.className,
				cls.tier,
				cls.sourceFile,
				JSON.stringify(cls.properties),
				0, // usage_count — will be populated by DOM analysis later
				cls.notes ?? null
			);
		}
		updateSiteStmt.run(siteId);
	});

	try {
		insertAll();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		errors.push(`Database insert error: ${msg}`);
	}

	// 5. Build result
	let tier1Count = 0;
	let tier2Count = 0;
	let tier3Count = 0;
	for (const cls of classes) {
		if (cls.tier === 1) tier1Count++;
		else if (cls.tier === 2) tier2Count++;
		else tier3Count++;
	}

	return {
		siteId,
		totalClasses: classes.length,
		tier1Count,
		tier2Count,
		tier3Count,
		classes,
		errors
	};
}
