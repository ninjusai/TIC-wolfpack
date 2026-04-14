/**
 * Variant Pool & Deterministic Selection (WRK-028)
 *
 * Deterministically selects a variant from a pool using a seed string
 * (e.g., suburb name). Same seed always produces the same variant.
 *
 * Pure module — no D1 access, no heavy deps, runs on Cloudflare Workers.
 */

import type { Variant } from '$lib/types/template';

// ── Hash function ─────────────────────────────────────────────────────────

/**
 * Simple FNV-1a 32-bit hash. Fast, good distribution, deterministic.
 * No crypto needed — this is for variant selection, not security.
 */
function fnv1a(str: string): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193); // FNV prime
	}
	return hash >>> 0; // Ensure unsigned 32-bit
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Deterministically select a variant from the pool using a seed string.
 *
 * Same seed always selects the same variant. Uses FNV-1a hash for
 * fast, well-distributed selection.
 *
 * @throws Error if variants array is empty
 */
export function selectVariant(variants: Variant[], seed: string): Variant {
	if (variants.length === 0) {
		throw new Error('Cannot select from an empty variant pool');
	}

	if (variants.length === 1) {
		return variants[0];
	}

	const hash = fnv1a(seed.toLowerCase().trim());
	const index = hash % variants.length;

	return variants[index];
}

/**
 * Check the distribution of variant selections across a set of seeds.
 *
 * Returns the count and percentage for each variant. Useful for verifying
 * that no single variant dominates when used across many suburbs.
 *
 * @param variants - The variant pool
 * @param seeds - List of seed strings (e.g., suburb names)
 * @returns Distribution stats per variant, sorted by count descending
 */
export function checkDistribution(
	variants: Variant[],
	seeds: string[]
): { variant_id: string; count: number; percentage: number }[] {
	if (variants.length === 0 || seeds.length === 0) {
		return variants.map((v) => ({
			variant_id: v.id,
			count: 0,
			percentage: 0
		}));
	}

	const counts = new Map<string, number>();
	for (const v of variants) {
		counts.set(v.id, 0);
	}

	for (const seed of seeds) {
		const selected = selectVariant(variants, seed);
		counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
	}

	const total = seeds.length;

	return variants
		.map((v) => {
			const count = counts.get(v.id) ?? 0;
			return {
				variant_id: v.id,
				count,
				percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0
			};
		})
		.sort((a, b) => b.count - a.count);
}
