/**
 * CSS Change Detection (WRK-042)
 *
 * Compares two CSS catalogues for the same site and produces a structured
 * change report: added, removed, and modified classes with property diffs.
 */

import type { D1CompatDatabase } from '$lib/server/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CSSChangeReport {
	site_id: string;
	old_catalogue_id: string;
	new_catalogue_id: string;
	added_classes: string[];
	removed_classes: string[];
	modified_classes: { class_name: string; changes: string }[];
	summary: string;
}

interface CatalogueClass {
	class_name: string;
	properties: string | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Load all classes for a catalogue into a Map keyed by class_name.
 */
async function loadCatalogueClasses(
	db: D1CompatDatabase,
	catalogueId: string
): Promise<Map<string, Record<string, string>>> {
	const { results } = await db
		.prepare(
			'SELECT class_name, properties FROM catalogue_classes WHERE catalogue_id = ?'
		)
		.bind(catalogueId)
		.all<CatalogueClass>();

	const map = new Map<string, Record<string, string>>();
	for (const row of results ?? []) {
		let props: Record<string, string> = {};
		if (row.properties) {
			try {
				props = JSON.parse(row.properties);
			} catch {
				// Malformed properties — treat as empty
			}
		}
		map.set(row.class_name, props);
	}
	return map;
}

/**
 * Compare two property objects and return a human-readable diff string.
 * Returns null if they are identical.
 */
function diffProperties(
	oldProps: Record<string, string>,
	newProps: Record<string, string>
): string | null {
	const changes: string[] = [];

	const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

	for (const key of allKeys) {
		const oldVal = oldProps[key];
		const newVal = newProps[key];

		if (oldVal === undefined) {
			changes.push(`+${key}: ${newVal}`);
		} else if (newVal === undefined) {
			changes.push(`-${key}: ${oldVal}`);
		} else if (oldVal !== newVal) {
			changes.push(`~${key}: ${oldVal} → ${newVal}`);
		}
	}

	return changes.length > 0 ? changes.join('; ') : null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compare two catalogues for the same site and produce a change report.
 *
 * Reports:
 * - added_classes: present in new but not in old
 * - removed_classes: present in old but not in new
 * - modified_classes: present in both but with different properties
 */
export async function detectCSSChanges(
	db: D1CompatDatabase,
	siteId: string,
	oldCatalogueId: string,
	newCatalogueId: string
): Promise<CSSChangeReport> {
	// Validate both catalogues belong to the specified site
	const [oldCat, newCat] = await Promise.all([
		db
			.prepare('SELECT id, site_id FROM css_catalogues WHERE id = ?')
			.bind(oldCatalogueId)
			.first<{ id: string; site_id: string }>(),
		db
			.prepare('SELECT id, site_id FROM css_catalogues WHERE id = ?')
			.bind(newCatalogueId)
			.first<{ id: string; site_id: string }>()
	]);

	if (!oldCat) throw new Error(`Old catalogue not found: ${oldCatalogueId}`);
	if (!newCat) throw new Error(`New catalogue not found: ${newCatalogueId}`);
	if (oldCat.site_id !== siteId) throw new Error(`Old catalogue does not belong to site ${siteId}`);
	if (newCat.site_id !== siteId) throw new Error(`New catalogue does not belong to site ${siteId}`);

	// Load classes for both catalogues
	const [oldClasses, newClasses] = await Promise.all([
		loadCatalogueClasses(db, oldCatalogueId),
		loadCatalogueClasses(db, newCatalogueId)
	]);

	const added: string[] = [];
	const removed: string[] = [];
	const modified: { class_name: string; changes: string }[] = [];

	// Find added and modified
	for (const [className, newProps] of newClasses) {
		const oldProps = oldClasses.get(className);
		if (!oldProps) {
			added.push(className);
		} else {
			const diff = diffProperties(oldProps, newProps);
			if (diff) {
				modified.push({ class_name: className, changes: diff });
			}
		}
	}

	// Find removed
	for (const className of oldClasses.keys()) {
		if (!newClasses.has(className)) {
			removed.push(className);
		}
	}

	// Sort for deterministic output
	added.sort();
	removed.sort();
	modified.sort((a, b) => a.class_name.localeCompare(b.class_name));

	// Generate human-readable summary
	const parts: string[] = [];
	if (added.length) parts.push(`${added.length} class(es) added`);
	if (removed.length) parts.push(`${removed.length} class(es) removed`);
	if (modified.length) parts.push(`${modified.length} class(es) modified`);
	const summary = parts.length > 0
		? `CSS changes detected: ${parts.join(', ')}.`
		: 'No CSS changes detected between the two catalogues.';

	return {
		site_id: siteId,
		old_catalogue_id: oldCatalogueId,
		new_catalogue_id: newCatalogueId,
		added_classes: added,
		removed_classes: removed,
		modified_classes: modified,
		summary
	};
}

/**
 * Get the latest completed catalogue ID for a site.
 */
export async function getLatestCatalogueId(
	db: D1CompatDatabase,
	siteId: string
): Promise<string | null> {
	const row = await db
		.prepare(
			`SELECT id FROM css_catalogues
			 WHERE site_id = ? AND status = 'complete'
			 ORDER BY scraped_at DESC LIMIT 1`
		)
		.bind(siteId)
		.first<{ id: string }>();

	return row?.id ?? null;
}
