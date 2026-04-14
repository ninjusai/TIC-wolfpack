/**
 * Template Section Validation (WRK-027)
 *
 * Validates template sections against the CSS catalogue.
 * Pure module — no D1 access, receives all data as parameters.
 */

import type { TemplateSection } from '$lib/types/template';
import { extractClassesFromHTML } from '$lib/server/css-parser';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplateValidationResult {
	valid: boolean;
	issues: TemplateValidationIssue[];
}

export interface TemplateValidationIssue {
	section_name: string;
	issue: string;
	severity: 'error' | 'warning';
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Validate template sections against a site's CSS catalogue.
 *
 * Checks:
 * 1. Each section's required_classes exist in the CSS catalogue
 * 2. Orphan classes in html_skeleton (classes used but not in catalogue) → warning
 * 3. sort_order is unique and sequential (starting from 0 or 1)
 */
export function validateTemplateSections(
	sections: TemplateSection[],
	availableClasses: Set<string>
): TemplateValidationResult {
	const issues: TemplateValidationIssue[] = [];

	// ── 1. Check required_classes exist in catalogue ──────────────────────

	for (const section of sections) {
		for (const cls of section.required_classes) {
			if (!availableClasses.has(cls)) {
				issues.push({
					section_name: section.name,
					issue: `Required class "${cls}" not found in CSS catalogue`,
					severity: 'error'
				});
			}
		}
	}

	// ── 2. Check html_skeleton uses valid classes ─────────────────────────

	for (const section of sections) {
		if (!section.html_skeleton) continue;

		const skeletonClasses = extractClassesFromHTML(section.html_skeleton);
		const requiredSet = new Set(section.required_classes);

		for (const cls of skeletonClasses) {
			if (!availableClasses.has(cls) && !requiredSet.has(cls)) {
				issues.push({
					section_name: section.name,
					issue: `Class "${cls}" in html_skeleton is not in the CSS catalogue`,
					severity: 'warning'
				});
			}
		}
	}

	// ── 3. Check sort_order uniqueness and sequentiality ──────────────────

	if (sections.length > 0) {
		const sortOrders = sections.map((s) => s.sort_order);
		const uniqueOrders = new Set(sortOrders);

		// Check uniqueness
		if (uniqueOrders.size !== sortOrders.length) {
			const duplicates = sortOrders.filter(
				(order, idx) => sortOrders.indexOf(order) !== idx
			);
			const uniqueDuplicates = [...new Set(duplicates)];
			for (const dup of uniqueDuplicates) {
				const affectedSections = sections
					.filter((s) => s.sort_order === dup)
					.map((s) => s.name);
				issues.push({
					section_name: affectedSections.join(', '),
					issue: `Duplicate sort_order ${dup} shared by sections: ${affectedSections.join(', ')}`,
					severity: 'error'
				});
			}
		}

		// Check sequentiality (should be 0..n-1 or 1..n)
		const sorted = [...sortOrders].sort((a, b) => a - b);
		const minOrder = sorted[0];
		const expectedSequence = sorted.map((_, i) => minOrder + i);

		for (let i = 0; i < sorted.length; i++) {
			if (sorted[i] !== expectedSequence[i]) {
				issues.push({
					section_name: '(template)',
					issue: `sort_order values are not sequential — expected ${expectedSequence.join(', ')} but got ${sorted.join(', ')}`,
					severity: 'warning'
				});
				break; // One warning is enough
			}
		}
	}

	return {
		valid: issues.every((i) => i.severity !== 'error'),
		issues
	};
}
