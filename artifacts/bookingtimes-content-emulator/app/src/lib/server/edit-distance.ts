/**
 * Edit Distance Utilities — WRK-BCE2-055
 *
 * Provides true Levenshtein edit distance computation to replace the naive
 * length-difference approximation previously used in the export/approval flow.
 *
 * Design choice: operates on **text content** (HTML tags stripped) rather than
 * raw HTML. Rationale from architecture-decisions-v2.md: "compute normalized
 * Levenshtein distance on the text content (stripping HTML tags for comparison)."
 * This ensures that purely structural HTML changes (class renames, wrapper div
 * reshuffles) don't inflate the distance, keeping the metric focused on actual
 * content quality improvements.
 *
 * Performance: uses a two-row rolling array (O(min(n,m)) space) instead of the
 * full O(n*m) matrix. For 5000+ char strings this completes well under 100ms.
 */

// ---------------------------------------------------------------------------
// HTML tag stripping
// ---------------------------------------------------------------------------

const TAG_RE = /<[^>]*>/g;
const WHITESPACE_RE = /\s+/g;

/**
 * Strip HTML tags and collapse whitespace. This is the preprocessing step
 * applied before distance computation so the metric reflects textual changes
 * rather than markup changes.
 */
export function stripHtmlTags(html: string): string {
  return html.replace(TAG_RE, ' ').replace(WHITESPACE_RE, ' ').trim();
}

// ---------------------------------------------------------------------------
// Levenshtein distance (two-row optimisation)
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 *
 * Uses a two-row rolling array for O(min(n,m)) memory. The shorter string is
 * always placed on the "column" axis to minimise the row length.
 *
 * @returns The minimum number of single-character insertions, deletions, or
 *          substitutions required to transform `a` into `b`.
 */
export function computeEditDistance(a: string, b: string): number {
  // Ensure `a` is the longer string so the inner loop is shorter.
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const m = b.length;

  // Trivial cases
  if (m === 0) return a.length;

  let prev = new Uint32Array(m + 1);
  let curr = new Uint32Array(m + 1);

  // Initialise first row
  for (let j = 0; j <= m; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);

    for (let j = 1; j <= m; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }

    // Swap rows
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Compute the normalised edit distance between two strings, returned as a
 * value in [0, 1].
 *
 * Formula: `distance / max(len(a), len(b))`.  Returns 0 when both strings are
 * empty (identical).
 */
export function computeNormalizedEditDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return computeEditDistance(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// HTML-aware convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Compute edit distance on the **text content** of two HTML strings.
 * Tags are stripped and whitespace normalised before comparison.
 */
export function computeHtmlEditDistance(htmlA: string, htmlB: string): number {
  return computeEditDistance(stripHtmlTags(htmlA), stripHtmlTags(htmlB));
}

/**
 * Compute normalised edit distance on the text content of two HTML strings.
 */
export function computeNormalizedHtmlEditDistance(
  htmlA: string,
  htmlB: string
): number {
  return computeNormalizedEditDistance(stripHtmlTags(htmlA), stripHtmlTags(htmlB));
}
