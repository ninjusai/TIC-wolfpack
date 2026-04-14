/**
 * CSS Validation & Generation Service — WRK-BCE2-037
 *
 * Validates that generated HTML uses only valid CSS classes from the
 * three-tier system, and generates Tier 3 custom CSS when needed.
 *
 *   Tier 1: Bootstrap 5.0.2 base classes (catalogue)
 *   Tier 2: Site-specific custom CSS (css_audit, this site only)
 *   Tier 3: System-generated custom CSS (css_decisions, type='custom')
 *
 * Guards:
 *   - BS 5.1+ classes are explicitly rejected
 *   - FA6 Pro icon classes must match the documented pattern
 *   - Tier 2 classes scoped to the requesting site (zero cross-site contamination)
 */

import db from '$lib/db';
import bootstrapCatalogue from '$lib/data/bootstrap-5.0.2-classes.json';
import fa6Catalogue from '$lib/data/fa6-pro-classes.json';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CssValidationResult {
	siteId: number;
	sectionSpecId: number;
	allClassesValid: boolean;
	tier1Classes: string[];
	tier2Classes: string[];
	tier3Classes: string[];
	unknownClasses: string[];
	generatedCss?: string;
}

interface CssAuditRow {
	class_name: string;
	tier: number;
}

interface CssDecisionRow {
	class_name: string;
	decision_type: string;
}

interface SiteRow {
	id: number;
	name: string;
}

// ── Bootstrap 5.0.2 catalogue ───────────────────────────────────────────────

function collectStrings(value: unknown, target: Set<string>): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			if (typeof item === 'string') target.add(item);
		}
	} else if (value !== null && typeof value === 'object') {
		for (const nested of Object.values(value as Record<string, unknown>)) {
			collectStrings(nested, target);
		}
	}
}

function loadBootstrapClasses(): Set<string> {
	const set = new Set<string>();
	const cats = (bootstrapCatalogue as { categories: Record<string, unknown> }).categories;
	for (const value of Object.values(cats)) {
		collectStrings(value, set);
	}
	return set;
}

const BS_502_CLASSES = loadBootstrapClasses();

// ── Bootstrap 5.1+ exclusion list ───────────────────────────────────────────
// Classes added AFTER 5.0.2 that must be rejected. This is a curated set of
// the most commonly encountered 5.1/5.2/5.3 additions.

const BS_POST_502: Set<string> = new Set([
	// 5.1 additions
	'placeholder', 'placeholder-glow', 'placeholder-wave',
	'placeholder-lg', 'placeholder-sm', 'placeholder-xs',
	'col-xxl', 'col-xxl-1', 'col-xxl-2', 'col-xxl-3', 'col-xxl-4',
	'col-xxl-5', 'col-xxl-6', 'col-xxl-7', 'col-xxl-8', 'col-xxl-9',
	'col-xxl-10', 'col-xxl-11', 'col-xxl-12', 'col-xxl-auto',
	'stack', 'hstack', 'vstack',
	// 5.2 additions
	'text-bg-primary', 'text-bg-secondary', 'text-bg-success',
	'text-bg-danger', 'text-bg-warning', 'text-bg-info',
	'text-bg-light', 'text-bg-dark',
	'btn-close-white',
	// 5.3 additions
	'link-primary', 'link-secondary', 'link-success', 'link-danger',
	'link-warning', 'link-info', 'link-light', 'link-dark',
	'link-body-emphasis', 'link-offset-1', 'link-offset-2', 'link-offset-3',
	'link-underline', 'link-underline-primary', 'link-underline-secondary',
	'link-underline-success', 'link-underline-danger', 'link-underline-warning',
	'link-underline-info', 'link-underline-light', 'link-underline-dark',
	'link-underline-opacity-0', 'link-underline-opacity-10',
	'link-underline-opacity-25', 'link-underline-opacity-50',
	'link-underline-opacity-75', 'link-underline-opacity-100',
	'focus-ring', 'focus-ring-primary', 'focus-ring-secondary',
	'focus-ring-success', 'focus-ring-danger', 'focus-ring-warning',
	'focus-ring-info', 'focus-ring-light', 'focus-ring-dark',
	'icon-link', 'icon-link-hover',
	'object-fit-contain', 'object-fit-cover', 'object-fit-fill',
	'object-fit-scale', 'object-fit-none',
	'z-0', 'z-1', 'z-2', 'z-3', 'z-n1',
	'fw-medium',
	'text-body-emphasis', 'text-body-secondary', 'text-body-tertiary',
	'bg-body-secondary', 'bg-body-tertiary',
	'border-primary-subtle', 'border-secondary-subtle',
	'border-success-subtle', 'border-danger-subtle',
	'border-warning-subtle', 'border-info-subtle',
	'border-light-subtle', 'border-dark-subtle',
]);

// ── Font Awesome 6 Pro validation ───────────────────────────────────────────

function loadFA6Classes(): { knownClasses: Set<string>; iconPattern: RegExp } {
	const set = new Set<string>();
	const cat = fa6Catalogue as Record<string, unknown>;
	for (const key of ['styles', 'sizing', 'utility', 'duotone_specific', 'sharp_family']) {
		const arr = cat[key];
		if (Array.isArray(arr)) {
			for (const cls of arr) set.add(cls);
		}
	}
	// FA6 Pro icon names: fa-<word> (lowercase alphanumeric + hyphens)
	const iconPattern = /^fa-[a-z0-9][a-z0-9-]*$/;
	return { knownClasses: set, iconPattern };
}

const FA6 = loadFA6Classes();

/** Returns true if the class is a valid FA6 Pro class. */
function isValidFA6Class(className: string): boolean {
	if (FA6.knownClasses.has(className)) return true;
	if (FA6.iconPattern.test(className)) return true;
	return false;
}

// ── HTML class extraction ───────────────────────────────────────────────────

/** Extract all CSS class names from an HTML string. */
function extractClassesFromHtml(html: string): string[] {
	const classes = new Set<string>();
	// Match class="..." or class='...' attributes
	const classAttrRegex = /\bclass\s*=\s*["']([^"']*)["']/gi;
	let match: RegExpExecArray | null;
	while ((match = classAttrRegex.exec(html)) !== null) {
		const value = match[1].trim();
		if (!value) continue;
		for (const cls of value.split(/\s+/)) {
			const trimmed = cls.trim();
			if (trimmed) classes.add(trimmed);
		}
	}
	return Array.from(classes);
}

// ── Tier 3 CSS generation patterns ─────────────────────────────────────────

/**
 * Maps common Tier 3 class name patterns to CSS property blocks.
 * Used when generating minimal CSS for system-defined classes.
 */
const TIER3_PATTERN_MAP: Record<string, Record<string, string>> = {
	// Overlay patterns
	'hero-overlay': {
		position: 'relative',
		background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%)',
	},
	'hero-gradient': {
		background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
	},
	// Step/process indicators
	'step-connector': {
		position: 'relative',
		'padding-left': '2rem',
	},
	'step-number': {
		display: 'inline-flex',
		'align-items': 'center',
		'justify-content': 'center',
		width: '2.5rem',
		height: '2.5rem',
		'border-radius': '50%',
		'font-weight': '700',
	},
	// Icon containers
	'icon-circle': {
		display: 'inline-flex',
		'align-items': 'center',
		'justify-content': 'center',
		width: '3rem',
		height: '3rem',
		'border-radius': '50%',
	},
	// Testimonial elements
	'testimonial-stars': {
		color: '#ffc107',
		'font-size': '1rem',
		'letter-spacing': '0.1em',
	},
	'rating-badge': {
		display: 'inline-block',
		padding: '0.25rem 0.75rem',
		'border-radius': '1rem',
		'font-size': '0.875rem',
		'font-weight': '600',
	},
	// Section spacing patterns
	'section-spacer': {
		'padding-top': '3rem',
		'padding-bottom': '3rem',
	},
	'section-spacer-lg': {
		'padding-top': '5rem',
		'padding-bottom': '5rem',
	},
	// Content utilities
	'content-narrow': {
		'max-width': '720px',
		'margin-left': 'auto',
		'margin-right': 'auto',
	},
	'content-wide': {
		'max-width': '960px',
		'margin-left': 'auto',
		'margin-right': 'auto',
	},
};

/**
 * Generate CSS for a single Tier 3 class. Checks the pattern map first,
 * then falls back to an empty rule with a TODO comment.
 */
function generateCssForClass(className: string): string {
	// Try direct match
	if (TIER3_PATTERN_MAP[className]) {
		return formatCssRule(className, TIER3_PATTERN_MAP[className]);
	}

	// Try suffix match: e.g. "bce-hero-overlay" matches "hero-overlay"
	for (const [pattern, props] of Object.entries(TIER3_PATTERN_MAP)) {
		if (className.endsWith(pattern) || className.endsWith(`-${pattern}`)) {
			return formatCssRule(className, props);
		}
	}

	// Fallback: empty rule with TODO marker
	return `.${escapeCssClassName(className)} {\n  /* TODO: Define properties for Tier 3 class */\n}`;
}

function formatCssRule(className: string, props: Record<string, string>): string {
	const lines = Object.entries(props).map(([prop, val]) => `  ${prop}: ${val};`);
	return `.${escapeCssClassName(className)} {\n${lines.join('\n')}\n}`;
}

/** Escape special characters in CSS class names (colons, dots, slashes). */
function escapeCssClassName(name: string): string {
	return name.replace(/([.:\/])/g, '\\$1');
}

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
	getSite: db.prepare<[number]>(
		`SELECT id, name FROM sites WHERE id = ?`
	),

	getTier2Classes: db.prepare<[number]>(
		`SELECT class_name, tier FROM css_audit
		 WHERE site_id = ? AND tier = 2`
	),

	getTier3Decisions: db.prepare<[number]>(
		`SELECT class_name, decision_type FROM css_decisions
		 WHERE site_id = ? AND decision_type = 'custom' AND class_name IS NOT NULL`
	),
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate all CSS classes in an HTML string against the three-tier system.
 * Returns classification of every class and generates Tier 3 CSS if needed.
 */
export function validateAndGenerateCss(
	html: string,
	siteId: number,
	sectionSpecId: number = 0
): CssValidationResult {
	const classes = extractClassesFromHtml(html);

	// Load site-specific data
	const tier2Rows = stmts.getTier2Classes.all(siteId) as CssAuditRow[];
	const tier2Set = new Set(tier2Rows.map((r) => r.class_name));

	const tier3Rows = stmts.getTier3Decisions.all(siteId) as CssDecisionRow[];
	const tier3Set = new Set(tier3Rows.map((r) => r.class_name));

	const tier1Classes: string[] = [];
	const tier2Classes: string[] = [];
	const tier3Classes: string[] = [];
	const unknownClasses: string[] = [];

	for (const cls of classes) {
		// Check BS 5.1+ exclusion first — these are explicitly invalid
		if (BS_POST_502.has(cls)) {
			unknownClasses.push(cls);
			continue;
		}

		// Tier 1: Bootstrap 5.0.2
		if (BS_502_CLASSES.has(cls)) {
			tier1Classes.push(cls);
			continue;
		}

		// FA6 Pro: valid icon/utility classes count as Tier 1 (framework)
		if (isValidFA6Class(cls)) {
			tier1Classes.push(cls);
			continue;
		}

		// Tier 2: Site-specific custom CSS (this site only)
		if (tier2Set.has(cls)) {
			tier2Classes.push(cls);
			continue;
		}

		// Tier 3: Approved custom classes from css_decisions
		if (tier3Set.has(cls)) {
			tier3Classes.push(cls);
			continue;
		}

		// Unknown — not in any tier
		unknownClasses.push(cls);
	}

	// Generate Tier 3 CSS if there are any Tier 3 classes
	let generatedCss: string | undefined;
	if (tier3Classes.length > 0) {
		generatedCss = generateTier3Css(tier3Classes, siteId);
	}

	return {
		siteId,
		sectionSpecId,
		allClassesValid: unknownClasses.length === 0,
		tier1Classes,
		tier2Classes,
		tier3Classes,
		unknownClasses,
		generatedCss,
	};
}

/**
 * Generate minimal CSS rules for a set of Tier 3 classes.
 * Returns a complete CSS string with a header comment.
 */
export function generateTier3Css(classes: string[], siteId: number): string {
	const site = stmts.getSite.get(siteId) as SiteRow | undefined;
	const siteName = site?.name ?? `Site ${siteId}`;

	const header = `/* Tier 3: System-generated CSS for ${siteName} */\n/* Generated: ${new Date().toISOString().split('T')[0]} */\n`;

	const rules = classes.map((cls) => generateCssForClass(cls));

	return header + '\n' + rules.join('\n\n') + '\n';
}

/**
 * Return the full CSS palette for a site: all classes grouped by tier.
 */
export function getSiteCssPalette(siteId: number): {
	tier1: string[];
	tier2: string[];
	tier3: string[];
} {
	const tier2Rows = stmts.getTier2Classes.all(siteId) as CssAuditRow[];
	const tier3Rows = stmts.getTier3Decisions.all(siteId) as CssDecisionRow[];

	return {
		tier1: Array.from(BS_502_CLASSES).sort(),
		tier2: tier2Rows.map((r) => r.class_name).sort(),
		tier3: tier3Rows.map((r) => r.class_name).filter(Boolean).sort(),
	};
}
