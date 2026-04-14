/**
 * CSS Change Detector — WRK-BCE2-056
 *
 * Detects changes between CSS re-scrapes for a site:
 *   1. Compares new CSS catalogue against the previous snapshot
 *   2. Generates a diff report (added, removed, changed classes)
 *   3. Flags generated content that references removed/deprecated classes
 *   4. Updates the catalogue so new classes are available for future generation
 *
 * Traces: REQ-BCE2-038, EVAL-BCE2-058
 * Depends on: WRK-BCE2-010 (CSS 3-tier classification)
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CssClassEntry {
	className: string;
	tier: number;
	sourceFile: string | null;
	properties: Record<string, string>;
	notes: string | null;
}

export interface ChangedClassDetail {
	className: string;
	tier: number;
	changedProperties: {
		added: Record<string, string>;
		removed: Record<string, string>;
		modified: Record<string, { old: string; new: string }>;
	};
}

export interface CssChangeReport {
	siteId: number;
	detectedAt: string;
	addedClasses: CssClassEntry[];
	removedClasses: CssClassEntry[];
	changedClasses: ChangedClassDetail[];
	summary: {
		totalAdded: number;
		totalRemoved: number;
		totalChanged: number;
		totalUnchanged: number;
	};
}

export interface FlaggedContentItem {
	type: 'section_spec' | 'page' | 'page_version';
	id: number;
	label: string;
	deprecatedClasses: string[];
}

export interface DeprecatedContentReport {
	siteId: number;
	removedClasses: string[];
	flaggedItems: FlaggedContentItem[];
	totalFlagged: number;
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface CssAuditRow {
	id: number;
	site_id: number;
	class_name: string;
	tier: number;
	source_file: string | null;
	properties: string | null;
	usage_count: number;
	notes: string | null;
}

interface SnapshotRow {
	id: number;
	site_id: number;
	snapshot: string;
	class_count: number;
	created_at: string;
}

interface SectionSpecRow {
	id: number;
	blueprint_id: number;
	section_type: string;
	generated_html: string | null;
	css_classes: string | null;
}

interface PageRow {
	id: number;
	site_id: number;
	url: string;
	current_html: string | null;
}

interface PageVersionRow {
	id: number;
	page_id: number;
	version_number: number;
	html_content: string;
}

interface ChangeReportRow {
	id: number;
	site_id: number;
	added_classes: string;
	removed_classes: string;
	changed_classes: string;
	total_added: number;
	total_removed: number;
	total_changed: number;
	flagged_content_count: number;
	created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseProperties(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function rowToEntry(row: CssAuditRow): CssClassEntry {
	return {
		className: row.class_name,
		tier: row.tier,
		sourceFile: row.source_file,
		properties: parseProperties(row.properties),
		notes: row.notes
	};
}

/** Diff two property maps and return structured changes. */
function diffProperties(
	oldProps: Record<string, string>,
	newProps: Record<string, string>
): ChangedClassDetail['changedProperties'] | null {
	const added: Record<string, string> = {};
	const removed: Record<string, string> = {};
	const modified: Record<string, { old: string; new: string }> = {};

	// Properties in new but not old
	for (const [key, val] of Object.entries(newProps)) {
		if (!(key in oldProps)) {
			added[key] = val;
		} else if (oldProps[key] !== val) {
			modified[key] = { old: oldProps[key], new: val };
		}
	}

	// Properties in old but not new
	for (const key of Object.keys(oldProps)) {
		if (!(key in newProps)) {
			removed[key] = oldProps[key];
		}
	}

	const hasChanges =
		Object.keys(added).length > 0 ||
		Object.keys(removed).length > 0 ||
		Object.keys(modified).length > 0;

	return hasChanges ? { added, removed, modified } : null;
}

/** Check if an HTML string references any of the given class names. */
function htmlUsesClasses(html: string, classNames: string[]): string[] {
	const found: string[] = [];
	for (const cls of classNames) {
		// Match class name in class="..." attributes or standalone in the HTML
		// Use word-boundary-style matching to avoid partial matches
		const pattern = new RegExp(`\\b${escapeRegex(cls)}\\b`);
		if (pattern.test(html)) {
			found.push(cls);
		}
	}
	return found;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
	getCssAudit: db.prepare<[number]>(
		`SELECT * FROM css_audit WHERE site_id = ? ORDER BY class_name`
	),

	getLatestSnapshot: db.prepare<[number]>(
		`SELECT * FROM css_catalogue_snapshots
		 WHERE site_id = ?
		 ORDER BY created_at DESC
		 LIMIT 1`
	),

	insertSnapshot: db.prepare<[number, string, number]>(
		`INSERT INTO css_catalogue_snapshots (site_id, snapshot, class_count)
		 VALUES (?, ?, ?)`
	),

	insertChangeReport: db.prepare(
		`INSERT INTO css_change_reports
		   (site_id, added_classes, removed_classes, changed_classes,
		    total_added, total_removed, total_changed, flagged_content_count)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	),

	getLatestChangeReport: db.prepare<[number]>(
		`SELECT * FROM css_change_reports
		 WHERE site_id = ?
		 ORDER BY created_at DESC
		 LIMIT 1`
	),

	getChangeReports: db.prepare<[number]>(
		`SELECT * FROM css_change_reports
		 WHERE site_id = ?
		 ORDER BY created_at DESC`
	),

	getSectionSpecsBySite: db.prepare<[number]>(
		`SELECT ss.id, ss.blueprint_id, ss.section_type, ss.generated_html, ss.css_classes
		 FROM section_specs ss
		 JOIN page_blueprints pb ON ss.blueprint_id = pb.id
		 WHERE pb.site_id = ?`
	),

	getPagesBySite: db.prepare<[number]>(
		`SELECT id, site_id, url, current_html FROM pages WHERE site_id = ?`
	),

	getPageVersionsByPage: db.prepare<[number]>(
		`SELECT id, page_id, version_number, html_content FROM page_versions WHERE page_id = ?`
	)
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Take a snapshot of the current css_audit catalogue for a site.
 * Should be called BEFORE a re-scrape overwrites the catalogue.
 */
export function snapshotCurrentCatalogue(siteId: number): void {
	const rows = stmts.getCssAudit.all(siteId) as CssAuditRow[];
	if (rows.length === 0) return;

	const snapshot = rows.map(rowToEntry);
	stmts.insertSnapshot.run(siteId, JSON.stringify(snapshot), snapshot.length);
}

/**
 * Detect CSS changes between the latest snapshot and the current css_audit
 * catalogue (which should contain the NEW scrape data).
 *
 * Flow:
 *   1. Load previous snapshot
 *   2. Load current css_audit rows (the new catalogue)
 *   3. Diff: added, removed, changed
 *   4. Persist the change report
 *   5. Return the report
 */
export function detectCssChanges(siteId: number): CssChangeReport {
	const now = new Date().toISOString();

	// Load previous snapshot
	const snapshotRow = stmts.getLatestSnapshot.get(siteId) as SnapshotRow | undefined;
	const previousEntries: CssClassEntry[] = snapshotRow
		? JSON.parse(snapshotRow.snapshot)
		: [];

	// Build map of previous classes
	const prevMap = new Map<string, CssClassEntry>();
	for (const entry of previousEntries) {
		prevMap.set(entry.className, entry);
	}

	// Load current (new) catalogue from css_audit
	const currentRows = stmts.getCssAudit.all(siteId) as CssAuditRow[];
	const currentMap = new Map<string, CssClassEntry>();
	for (const row of currentRows) {
		currentMap.set(row.class_name, rowToEntry(row));
	}

	// Diff
	const addedClasses: CssClassEntry[] = [];
	const removedClasses: CssClassEntry[] = [];
	const changedClasses: ChangedClassDetail[] = [];
	let totalUnchanged = 0;

	// Find added and changed classes
	for (const [className, current] of currentMap) {
		const prev = prevMap.get(className);
		if (!prev) {
			addedClasses.push(current);
		} else {
			const propDiff = diffProperties(prev.properties, current.properties);
			if (propDiff) {
				changedClasses.push({
					className,
					tier: current.tier,
					changedProperties: propDiff
				});
			} else {
				totalUnchanged++;
			}
		}
	}

	// Find removed classes
	for (const [className, prev] of prevMap) {
		if (!currentMap.has(className)) {
			removedClasses.push(prev);
		}
	}

	const report: CssChangeReport = {
		siteId,
		detectedAt: now,
		addedClasses,
		removedClasses,
		changedClasses,
		summary: {
			totalAdded: addedClasses.length,
			totalRemoved: removedClasses.length,
			totalChanged: changedClasses.length,
			totalUnchanged
		}
	};

	// Flag deprecated content
	const removedNames = removedClasses.map((c) => c.className);
	let flaggedCount = 0;
	if (removedNames.length > 0) {
		const deprecatedReport = flagDeprecatedContent(siteId, removedNames);
		flaggedCount = deprecatedReport.totalFlagged;
	}

	// Persist change report
	stmts.insertChangeReport.run(
		siteId,
		JSON.stringify(addedClasses.map((c) => c.className)),
		JSON.stringify(removedClasses.map((c) => c.className)),
		JSON.stringify(changedClasses),
		addedClasses.length,
		removedClasses.length,
		changedClasses.length,
		flaggedCount
	);

	return report;
}

/**
 * Flag all generated content (section_specs, pages, page_versions) that
 * references classes no longer in the catalogue.
 */
export function flagDeprecatedContent(
	siteId: number,
	removedClasses: string[]
): DeprecatedContentReport {
	const flaggedItems: FlaggedContentItem[] = [];

	if (removedClasses.length === 0) {
		return { siteId, removedClasses, flaggedItems, totalFlagged: 0 };
	}

	// 1. Check section_specs with generated HTML
	const sections = stmts.getSectionSpecsBySite.all(siteId) as SectionSpecRow[];
	for (const section of sections) {
		const htmlToCheck = section.generated_html ?? '';
		const cssClassesStr = section.css_classes ?? '';

		// Check both generated HTML and the css_classes field
		const combinedText = htmlToCheck + ' ' + cssClassesStr;
		if (!combinedText.trim()) continue;

		const found = htmlUsesClasses(combinedText, removedClasses);
		if (found.length > 0) {
			flaggedItems.push({
				type: 'section_spec',
				id: section.id,
				label: `section_spec #${section.id} (${section.section_type})`,
				deprecatedClasses: found
			});
		}
	}

	// 2. Check pages with current_html
	const pages = stmts.getPagesBySite.all(siteId) as PageRow[];
	for (const page of pages) {
		if (!page.current_html) continue;

		const found = htmlUsesClasses(page.current_html, removedClasses);
		if (found.length > 0) {
			flaggedItems.push({
				type: 'page',
				id: page.id,
				label: `page #${page.id} (${page.url})`,
				deprecatedClasses: found
			});
		}

		// 3. Check page_versions for this page
		const versions = stmts.getPageVersionsByPage.all(page.id) as PageVersionRow[];
		for (const version of versions) {
			if (!version.html_content) continue;

			const found = htmlUsesClasses(version.html_content, removedClasses);
			if (found.length > 0) {
				flaggedItems.push({
					type: 'page_version',
					id: version.id,
					label: `page_version #${version.id} (page ${page.id}, v${version.version_number})`,
					deprecatedClasses: found
				});
			}
		}
	}

	return {
		siteId,
		removedClasses,
		flaggedItems,
		totalFlagged: flaggedItems.length
	};
}

/**
 * Get the latest change report for a site.
 */
export function getLatestChangeReport(siteId: number): ChangeReportRow | null {
	const row = stmts.getLatestChangeReport.get(siteId) as ChangeReportRow | undefined;
	return row ?? null;
}

/**
 * Get all change reports for a site (newest first).
 */
export function getAllChangeReports(siteId: number): ChangeReportRow[] {
	return stmts.getChangeReports.all(siteId) as ChangeReportRow[];
}

/**
 * Orchestrate a full re-scrape comparison cycle:
 *   1. Snapshot the current catalogue
 *   2. Run classification (which scrapes + overwrites css_audit)
 *   3. Detect changes against the snapshot
 *   4. Return both the classification result and the change report
 *
 * This is the main integration point called from the scrape/classify flow.
 */
export async function runRescrapeWithChangeDetection(
	siteId: number,
	classifySiteCSS: (siteId: number) => Promise<{ totalClasses: number; errors: string[] }>
): Promise<{
	changeReport: CssChangeReport;
	classificationResult: { totalClasses: number; errors: string[] };
}> {
	// Step 1: Snapshot current state before re-scrape
	snapshotCurrentCatalogue(siteId);

	// Step 2: Run classification (scrape + classify + overwrite css_audit)
	const classificationResult = await classifySiteCSS(siteId);

	// Step 3: Detect changes
	const changeReport = detectCssChanges(siteId);

	return { changeReport, classificationResult };
}
