/**
 * CSS Tier Decision Engine — WRK-BCE2-030
 *
 * For each section_spec, determines which CSS tier to use (ADR-016):
 *   Tier 1: Bootstrap 5.0.2 base classes — always safe
 *   Tier 2: Site-specific custom CSS (from LoadCSS) — use where appropriate
 *   Tier 3: New custom CSS — needs operator approval
 *
 * Updates section_specs with recommended classes & design patterns.
 * Creates css_decisions records for Tier 3 needs.
 */

import db from '$lib/db';
import bootstrapCatalogue from '$lib/data/bootstrap-5.0.2-classes.json';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CssTierDecision {
	sectionSpecId: number;
	sectionType: string;
	recommendedClasses: string[];
	designPattern: string;
	tier3Classes?: string[];
}

export interface CssTierResult {
	siteId: number;
	totalSections: number;
	tier1Only: number;
	tier1Plus2: number;
	tier3Needed: number;
	decisions: CssTierDecision[];
}

interface SectionSpecRow {
	id: number;
	blueprint_id: number;
	section_type: string;
	section_order: number;
	css_classes: string | null;
	design_pattern: string | null;
}

interface BlueprintRow {
	id: number;
	backlog_id: number;
	site_id: number;
}

interface BacklogRow {
	id: number;
	page_type: string;
}

interface CssAuditRow {
	class_name: string;
	tier: number;
	notes: string | null;
}

interface CssDecisionRow {
	id: number;
	site_id: number;
	decision_type: string;
	class_name: string | null;
	replacement_class: string | null;
	rationale: string | null;
	created_at: string;
}

// ── Bootstrap class index ──────────────────────────────────────────────────

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

const BS_CLASSES = loadBootstrapClasses();

// ── Section design patterns ────────────────────────────────────────────────

interface PatternDef {
	classes: string[];
	pattern: string;
	/** Classes that are not BS5 or site Tier 2, i.e. Tier 3 candidates */
	tier3Candidates: string[];
}

/**
 * Returns default design-pattern config for a given section type.
 * The `isLocationPage` flag toggles sidebar-aware grid (DEC-032).
 */
function getPatternForType(sectionType: string, isLocationPage: boolean): PatternDef {
	// When location page, content lives in col-lg-9 next to a col-lg-3 sidebar
	const contentCol = isLocationPage ? 'col-lg-9' : 'col-lg-12';

	switch (sectionType) {
		case 'hero':
			return {
				classes: ['container', 'row', 'col-12', 'col-lg-8', 'bg-primary', 'bg-dark', 'text-white', 'display-4', 'lead', 'mb-4', 'btn', 'btn-primary', 'btn-lg'],
				pattern: isLocationPage ? 'hero-split' : 'hero-centered',
				tier3Candidates: ['hero-overlay', 'hero-gradient']
			};

		case 'service_detail':
		case 'local_intro':
			return {
				classes: ['container', 'row', contentCol, 'col-md-6', 'col-lg-4', 'card', 'card-body', 'card-title', 'card-text', 'list-group', 'list-group-item'],
				pattern: isLocationPage ? 'content-with-sidebar' : 'full-width-content',
				tier3Candidates: []
			};

		case 'benefits':
		case 'why_choose_us':
		case 'why_local':
			return {
				classes: ['container', 'row', contentCol, 'col-md-4', 'col-lg-3', 'text-center', 'mb-4', 'p-3'],
				pattern: 'icon-grid',
				tier3Candidates: ['fa-solid', 'fa-light', 'icon-circle']
			};

		case 'faq':
			return {
				classes: ['container', 'row', contentCol, 'accordion', 'accordion-item', 'accordion-header', 'accordion-body', 'accordion-button', 'accordion-collapse'],
				pattern: 'accordion-faq',
				tier3Candidates: []
			};

		case 'cta':
			return {
				classes: ['container', 'text-center', 'bg-primary', 'text-white', 'py-5', 'btn', 'btn-light', 'btn-lg'],
				pattern: 'cta-banner',
				tier3Candidates: []
			};

		case 'nearby_areas':
			return {
				classes: ['container', 'row', contentCol, 'badge', 'bg-secondary', 'list-inline', 'list-inline-item', 'me-2', 'mb-2'],
				pattern: 'link-cloud',
				tier3Candidates: []
			};

		case 'testimonials':
			return {
				classes: ['container', 'row', contentCol, 'col-md-6', 'col-lg-4', 'card', 'card-body', 'blockquote', 'mb-0', 'text-muted', 'small'],
				pattern: 'testimonial-cards',
				tier3Candidates: ['testimonial-stars', 'rating-badge']
			};

		case 'services_overview':
		case 'services_available':
			return {
				classes: ['container', 'row', contentCol, 'col-md-6', 'col-lg-4', 'card', 'card-body', 'card-title', 'card-text', 'btn', 'btn-outline-primary', 'stretched-link'],
				pattern: 'feature-cards',
				tier3Candidates: []
			};

		case 'process':
			return {
				classes: ['container', 'row', contentCol, 'col-md-4', 'text-center', 'rounded-circle', 'bg-primary', 'text-white', 'mb-3'],
				pattern: 'numbered-steps',
				tier3Candidates: ['step-connector', 'step-number']
			};

		case 'statistics':
			return {
				classes: ['container', 'row', contentCol, 'col-md-3', 'col-6', 'text-center', 'display-6', 'fw-bold', 'text-primary'],
				pattern: 'stat-counters',
				tier3Candidates: []
			};

		default:
			return {
				classes: ['container', 'row', contentCol, 'col-12', 'mb-4'],
				pattern: 'generic-content',
				tier3Candidates: []
			};
	}
}

// ── Prepared statements ────────────────────────────────────────────────────

const stmts = {
	getBlueprintsBySite: db.prepare<[number]>(
		`SELECT pb.id, pb.backlog_id, pb.site_id
		 FROM page_blueprints pb
		 WHERE pb.site_id = ?`
	),

	getBacklog: db.prepare<[number]>(
		`SELECT id, page_type FROM work_backlog WHERE id = ?`
	),

	getSectionsByBlueprint: db.prepare<[number]>(
		`SELECT id, blueprint_id, section_type, section_order, css_classes, design_pattern
		 FROM section_specs
		 WHERE blueprint_id = ?
		 ORDER BY section_order`
	),

	getTier2Classes: db.prepare<[number]>(
		`SELECT class_name, tier, notes
		 FROM css_audit
		 WHERE site_id = ? AND tier = 2`
	),

	updateSectionSpec: db.prepare<[string, string, number]>(
		`UPDATE section_specs SET css_classes = ?, design_pattern = ? WHERE id = ?`
	),

	insertCssDecision: db.prepare<[number, string, string | null, string | null, string | null]>(
		`INSERT INTO css_decisions (site_id, decision_type, class_name, replacement_class, rationale)
		 VALUES (?, ?, ?, ?, ?)`
	),

	getCssDecisions: db.prepare<[number]>(
		`SELECT * FROM css_decisions WHERE site_id = ? ORDER BY id`
	),

	clearCssDecisions: db.prepare<[number]>(
		`DELETE FROM css_decisions WHERE site_id = ?`
	)
};

// ── Location page types (long-tail, DEC-032) ──────────────────────────────

const LOCATION_PAGE_TYPES = new Set([
	'service_area',
	'location',
	'city_page',
	'suburb_page',
	'service_location',
	'local_landing'
]);

// ── Main API ───────────────────────────────────────────────────────────────

/**
 * Assign CSS tiers to every section_spec for a given site.
 *
 * 1. Loads the BS 5.0.2 catalogue (Tier 1)
 * 2. Loads css_audit rows for the site (Tier 2)
 * 3. Iterates all section_specs across all blueprints
 * 4. Assigns recommended classes + design pattern
 * 5. Identifies Tier 3 needs and records css_decisions
 * 6. Updates section_specs rows
 */
export function assignCssTiers(siteId: number): CssTierResult {
	// Load site's Tier 2 classes
	const tier2Rows = stmts.getTier2Classes.all(siteId) as CssAuditRow[];
	const tier2Classes = new Set(tier2Rows.map((r) => r.class_name));

	// Load blueprints for the site
	const blueprints = stmts.getBlueprintsBySite.all(siteId) as BlueprintRow[];

	// Clear previous css_decisions for this site (re-run is idempotent)
	stmts.clearCssDecisions.run(siteId);

	const decisions: CssTierDecision[] = [];
	let tier1Only = 0;
	let tier1Plus2 = 0;
	let tier3Needed = 0;

	// Track Tier 3 classes we've already inserted decisions for
	const tier3Inserted = new Set<string>();

	const processSite = db.transaction(() => {
		for (const bp of blueprints) {
			// Determine if this is a location page (for sidebar awareness)
			const backlog = stmts.getBacklog.get(bp.backlog_id) as BacklogRow | undefined;
			const pageType = backlog?.page_type ?? '';
			const isLocationPage = LOCATION_PAGE_TYPES.has(pageType);

			// Get all section_specs for this blueprint
			const sections = stmts.getSectionsByBlueprint.all(bp.id) as SectionSpecRow[];

			for (const section of sections) {
				const patternDef = getPatternForType(section.section_type, isLocationPage);

				// Determine which classes are Tier 1 (BS), Tier 2 (site), or Tier 3 (new)
				const recommendedClasses: string[] = [];
				const t3Classes: string[] = [];
				let usesTier2 = false;

				// Add pattern classes — verify each against BS catalogue and site Tier 2
				for (const cls of patternDef.classes) {
					recommendedClasses.push(cls);
					if (!BS_CLASSES.has(cls) && !tier2Classes.has(cls)) {
						// Not in BS5 or site's Tier 2 → Tier 3 candidate
						t3Classes.push(cls);
					} else if (tier2Classes.has(cls) && !BS_CLASSES.has(cls)) {
						usesTier2 = true;
					}
				}

				// Add Tier 3 candidates from the pattern definition
				for (const cls of patternDef.tier3Candidates) {
					t3Classes.push(cls);
					// Don't add to recommendedClasses — these are optional/proposed
				}

				// Classify the section's tier usage
				const hasTier3 = t3Classes.length > 0;
				if (hasTier3) {
					tier3Needed++;
				} else if (usesTier2) {
					tier1Plus2++;
				} else {
					tier1Only++;
				}

				// Build the decision record
				const decision: CssTierDecision = {
					sectionSpecId: section.id,
					sectionType: section.section_type,
					recommendedClasses,
					designPattern: patternDef.pattern,
					tier3Classes: t3Classes.length > 0 ? t3Classes : undefined
				};
				decisions.push(decision);

				// Update section_specs
				stmts.updateSectionSpec.run(
					JSON.stringify(recommendedClasses),
					patternDef.pattern,
					section.id
				);

				// Insert css_decisions for Tier 3 classes (deduplicated)
				for (const cls of t3Classes) {
					if (!tier3Inserted.has(cls)) {
						tier3Inserted.add(cls);
						stmts.insertCssDecision.run(
							siteId,
							'custom',
							cls,
							null,
							`Tier 3 class needed for ${section.section_type} section (${patternDef.pattern} pattern). Requires operator approval.`
						);
					}
				}
			}
		}
	});

	processSite();

	return {
		siteId,
		totalSections: decisions.length,
		tier1Only,
		tier1Plus2,
		tier3Needed,
		decisions
	};
}

/**
 * Return current css_decisions for a site.
 */
export function getCssDecisions(siteId: number): CssDecisionRow[] {
	return stmts.getCssDecisions.all(siteId) as CssDecisionRow[];
}
