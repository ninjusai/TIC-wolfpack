/**
 * Multi-Site Export Class Isolation (WRK-032)
 *
 * Ensures exported HTML only uses classes from the target site's catalogue.
 * Detects class leakage from other sites' catalogues.
 *
 * Pure module — no D1 access, receives all data as parameters.
 */

import { extractClassesFromHTML } from '$lib/server/css-parser';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IsolationResult {
	isolated: boolean;
	leaks: ClassLeak[];
}

export interface ClassLeak {
	class_name: string;
	belongs_to: string[]; // site IDs that own this class
	not_in: string; // target site ID where it's missing
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check that all classes in the HTML belong to the target site's catalogue.
 *
 * If a class is found that doesn't belong to the target site but does
 * belong to another loaded site catalogue, it's flagged as a leak.
 * Classes not found in any catalogue are ignored (handled by output-validator).
 *
 * @param html - The HTML content to check
 * @param targetSiteId - The site this content is being exported for
 * @param allCatalogues - Map of site_id → Set of class names for all loaded sites
 */
export function checkClassIsolation(
	html: string,
	targetSiteId: string,
	allCatalogues: Map<string, Set<string>>
): IsolationResult {
	const usedClasses = extractClassesFromHTML(html);
	const targetClasses = allCatalogues.get(targetSiteId) ?? new Set<string>();
	const leaks: ClassLeak[] = [];

	for (const cls of usedClasses) {
		// Skip if it's in the target catalogue — all good
		if (targetClasses.has(cls)) continue;

		// Check if it belongs to any other site
		const belongsTo: string[] = [];
		for (const [siteId, classes] of allCatalogues) {
			if (siteId === targetSiteId) continue;
			if (classes.has(cls)) {
				belongsTo.push(siteId);
			}
		}

		// Only flag as a leak if it belongs to another site
		// (unknown classes are a separate concern handled by output-validator)
		if (belongsTo.length > 0) {
			leaks.push({
				class_name: cls,
				belongs_to: belongsTo,
				not_in: targetSiteId
			});
		}
	}

	return {
		isolated: leaks.length === 0,
		leaks
	};
}
