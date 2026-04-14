import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionRow {
  page_id: number;
  version_number: number;
  edit_distance: number | null;
}

interface PageMetric {
  pageId: number;
  versions: Array<{ version: number; editDistance: number }>;
}

type Trend = 'improving' | 'stable' | 'degrading' | 'insufficient_data';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const stmtVersionsBysite = db.prepare(`
  SELECT pv.page_id, pv.version_number, pv.edit_distance
  FROM page_versions pv
  JOIN pages p ON p.id = pv.page_id
  WHERE p.site_id = ? AND pv.edit_distance IS NOT NULL
  ORDER BY pv.page_id, pv.version_number DESC
`);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * GET /api/metrics/edit-distance/[siteId]
 *
 * Returns aggregated edit-distance metrics for a site:
 *   - averageEditDistance across all versions with data
 *   - trend: comparing average of last 3 data points vs previous 3
 *   - per-page breakdown with version-level detail
 */
export const GET: RequestHandler = async ({ params }) => {
  const siteId = Number(params.siteId);
  if (!Number.isInteger(siteId) || siteId <= 0) {
    throw error(400, 'Invalid siteId — must be a positive integer');
  }

  const rows = stmtVersionsBysite.all(siteId) as VersionRow[];

  // Group by page
  const pageMap = new Map<number, Array<{ version: number; editDistance: number }>>();
  const allDistances: number[] = [];

  for (const row of rows) {
    if (row.edit_distance == null) continue;

    if (!pageMap.has(row.page_id)) {
      pageMap.set(row.page_id, []);
    }
    pageMap.get(row.page_id)!.push({
      version: row.version_number,
      editDistance: row.edit_distance,
    });
    allDistances.push(row.edit_distance);
  }

  const pages: PageMetric[] = [];
  for (const [pageId, versions] of pageMap) {
    pages.push({ pageId, versions });
  }

  // Compute average
  const averageEditDistance =
    allDistances.length > 0
      ? Math.round(allDistances.reduce((s, d) => s + d, 0) / allDistances.length)
      : 0;

  // Compute trend: compare average of last 3 vs previous 3 data points
  // "last" means the most recently created versions (allDistances is ordered
  // newest-first per page, but interleaved across pages). We re-sort globally
  // by version_number descending to get a chronological ordering.
  const trend = computeTrend(rows);

  return json({ siteId, averageEditDistance, trend, pages });
};

// ---------------------------------------------------------------------------
// Trend calculation
// ---------------------------------------------------------------------------

function computeTrend(rows: VersionRow[]): Trend {
  // Extract non-null distances ordered by version number descending (newest first)
  const sorted = rows
    .filter((r) => r.edit_distance != null)
    .sort((a, b) => b.version_number - a.version_number);

  if (sorted.length < 3) return 'insufficient_data';

  const recent = sorted.slice(0, 3);
  const previous = sorted.slice(3, 6);

  if (previous.length < 3) return 'insufficient_data';

  const avgRecent = avg(recent.map((r) => r.edit_distance!));
  const avgPrevious = avg(previous.map((r) => r.edit_distance!));

  if (avgPrevious === 0) {
    // Previous was perfect; any increase is degrading, zero is stable
    return avgRecent === 0 ? 'stable' : 'degrading';
  }

  const changeRatio = (avgRecent - avgPrevious) / avgPrevious;

  if (changeRatio < -0.10) return 'improving';  // >10% reduction
  if (changeRatio > 0.10) return 'degrading';   // >10% increase
  return 'stable';
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
