/**
 * WRK-013: Cross-Site Overlap Report
 *
 * GET /api/catalogues/overlap
 *
 * Computes the intersection and difference of class catalogues across all sites.
 * Uses the latest catalogue per site.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface CatalogueRow {
	id: string;
	site_id: string;
}

interface ClassRow {
	class_name: string;
	catalogue_id: string;
}

interface PerSiteReport {
	unique_classes: string[];
	unique_count: number;
	total: number;
}

export const GET: RequestHandler = async ({ locals }) => {
	const db = locals.db;

	// ── 1. Load latest catalogue per site ─────────────────────────────────
	// Get the most recent complete catalogue for each site
	const { results: latestCatalogues } = await db
		.prepare(
			`SELECT c.id, c.site_id
			 FROM css_catalogues c
			 INNER JOIN (
			   SELECT site_id, MAX(scraped_at) AS max_scraped
			   FROM css_catalogues
			   WHERE status = 'complete'
			   GROUP BY site_id
			 ) latest ON c.site_id = latest.site_id AND c.scraped_at = latest.max_scraped
			 WHERE c.status = 'complete'`
		)
		.all<CatalogueRow>();

	const catalogues = latestCatalogues ?? [];

	if (catalogues.length === 0) {
		return json({
			sites: [],
			shared_classes: [],
			shared_count: 0,
			per_site: {},
			message: 'No complete catalogues found'
		});
	}

	// ── 2. Load classes for each catalogue ────────────────────────────────
	// Map: site_id -> Set<class_name>
	const siteClasses = new Map<string, Set<string>>();

	for (const cat of catalogues) {
		const { results: classRows } = await db
			.prepare('SELECT class_name FROM catalogue_classes WHERE catalogue_id = ?')
			.bind(cat.id)
			.all<ClassRow>();

		const classSet = new Set<string>();
		for (const row of classRows ?? []) {
			classSet.add(row.class_name);
		}
		siteClasses.set(cat.site_id, classSet);
	}

	const siteIds = Array.from(siteClasses.keys());

	// ── 3. Compute shared classes (intersection of ALL sites) ─────────────
	let sharedClasses: string[] = [];

	if (siteIds.length > 0) {
		// Start with the first site's classes, intersect with each subsequent site
		const firstSet = siteClasses.get(siteIds[0])!;
		const intersection = new Set<string>(firstSet);

		for (let i = 1; i < siteIds.length; i++) {
			const otherSet = siteClasses.get(siteIds[i])!;
			for (const cls of intersection) {
				if (!otherSet.has(cls)) {
					intersection.delete(cls);
				}
			}
		}

		sharedClasses = Array.from(intersection).sort();
	}

	const sharedSet = new Set(sharedClasses);

	// ── 4. Compute per-site unique classes ────────────────────────────────
	const perSite: Record<string, PerSiteReport> = {};

	for (const siteId of siteIds) {
		const myClasses = siteClasses.get(siteId)!;

		// A class is "unique" to this site if no other site has it
		const uniqueClasses: string[] = [];
		for (const cls of myClasses) {
			let foundElsewhere = false;
			for (const otherId of siteIds) {
				if (otherId === siteId) continue;
				if (siteClasses.get(otherId)!.has(cls)) {
					foundElsewhere = true;
					break;
				}
			}
			if (!foundElsewhere) {
				uniqueClasses.push(cls);
			}
		}

		uniqueClasses.sort();

		perSite[siteId] = {
			unique_classes: uniqueClasses,
			unique_count: uniqueClasses.length,
			total: myClasses.size
		};
	}

	// ── 5. Compute overlap percentages ────────────────────────────────────
	const overlapPercentages: Record<string, number> = {};
	for (const siteId of siteIds) {
		const total = siteClasses.get(siteId)!.size;
		overlapPercentages[siteId] = total > 0
			? Math.round((sharedClasses.length / total) * 10000) / 100
			: 0;
	}

	return json({
		sites: siteIds,
		shared_classes: sharedClasses,
		shared_count: sharedClasses.length,
		per_site: perSite,
		overlap_percentages: overlapPercentages
	});
};
