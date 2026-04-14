/**
 * Backlog Manager (WRK-BCE2-024)
 *
 * Extended backlog management utilities including GSC enrichment.
 * Works alongside missing-pages.ts which handles initial backlog creation.
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// GSC Enrichment (stub — WRK-BCE2-024)
// ---------------------------------------------------------------------------

/**
 * Enrich backlog items with Google Search Console traffic potential data.
 *
 * When GSC metrics are available in the `gsc_metrics` table, this function
 * applies a traffic_potential weight (0.2) to adjust backlog item priorities.
 * Pages with higher organic impressions/clicks get a priority boost.
 *
 * Currently a stub — checks for GSC data presence and logs status.
 * Full implementation will come once the GSC data pipeline is connected.
 */
export function enrichBacklogWithGSC(siteId: number): void {
  const TRAFFIC_POTENTIAL_WEIGHT = 0.2;

  // Check if gsc_metrics table exists
  const tableCheck = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gsc_metrics'")
    .get() as { name: string } | undefined;

  if (!tableCheck) {
    console.log(
      `[backlog-manager] gsc_metrics table does not exist. GSC enrichment skipped for site ${siteId}.`
    );
    return;
  }

  // Check if there is any GSC data for this site
  const dataCheck = db
    .prepare('SELECT COUNT(*) as count FROM gsc_metrics WHERE site_id = ?')
    .get(siteId) as { count: number };

  if (dataCheck.count === 0) {
    console.log(
      `[backlog-manager] No GSC data found for site ${siteId}. ` +
        `Connect Google Search Console to enable traffic-weighted prioritisation. ` +
        `(traffic_potential weight: ${TRAFFIC_POTENTIAL_WEIGHT})`
    );
    return;
  }

  // TODO: Full implementation — when GSC data is available:
  // 1. Join gsc_metrics with work_backlog on URL or page_type
  // 2. Compute traffic_potential = normalised(impressions * ctr_opportunity)
  // 3. Adjust priority: new_priority = priority * (1 - TRAFFIC_POTENTIAL_WEIGHT) + traffic_rank * TRAFFIC_POTENTIAL_WEIGHT
  // 4. Update work_backlog priorities in a transaction
  console.log(
    `[backlog-manager] GSC data found for site ${siteId} (${dataCheck.count} rows). ` +
      `Full enrichment not yet implemented.`
  );
}
