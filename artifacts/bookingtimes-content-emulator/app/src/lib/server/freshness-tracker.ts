/**
 * Content Freshness Tracker — WRK-BCE2-042
 *
 * Tracks content freshness per page and surfaces alerts when content becomes stale.
 * Uses the existing `content_freshness` table from 001_initial_schema.sql.
 *
 * Freshness rules (DEC-033):
 *   Fresh:   < 6 weeks since last deployed (or approved if not deployed)
 *   Aging:   6–10 weeks — warning
 *   Stale:   > 10 weeks — alert
 *   Unknown: Never deployed or approved
 */

import db from '$lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FreshnessStatus {
  siteId: number;
  pageUrl: string;
  lastGeneratedAt: string | null;
  lastApprovedAt: string | null;
  lastDeployedAt: string | null;
  freshnessStatus: 'fresh' | 'aging' | 'stale' | 'unknown';
  nextReviewDue: string | null;
  alertSent: boolean;
}

interface FreshnessRow {
  site_id: number;
  page_url: string;
  last_generated_at: string | null;
  last_approved_at: string | null;
  last_deployed_at: string | null;
  freshness_status: string;
  next_review_due: string | null;
  alert_sent: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRESH_WEEKS = 6;
const STALE_WEEKS = 10;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Prepared statements (lazy-initialised)
// ---------------------------------------------------------------------------

const upsertStmt = db.prepare(`
  INSERT INTO content_freshness (site_id, page_url, last_generated_at, last_approved_at, last_deployed_at, freshness_status, next_review_due, alert_sent)
  VALUES (@site_id, @page_url, @last_generated_at, @last_approved_at, @last_deployed_at, @freshness_status, @next_review_due, @alert_sent)
  ON CONFLICT(site_id, page_url) DO UPDATE SET
    last_generated_at  = COALESCE(@last_generated_at,  content_freshness.last_generated_at),
    last_approved_at   = COALESCE(@last_approved_at,   content_freshness.last_approved_at),
    last_deployed_at   = COALESCE(@last_deployed_at,   content_freshness.last_deployed_at),
    freshness_status   = @freshness_status,
    next_review_due    = @next_review_due,
    alert_sent         = @alert_sent
`);

const selectBySiteStmt = db.prepare(`
  SELECT site_id, page_url, last_generated_at, last_approved_at, last_deployed_at,
         freshness_status, next_review_due, alert_sent
  FROM content_freshness
  WHERE site_id = ?
`);

const selectOneStmt = db.prepare(`
  SELECT site_id, page_url, last_generated_at, last_approved_at, last_deployed_at,
         freshness_status, next_review_due, alert_sent
  FROM content_freshness
  WHERE site_id = ? AND page_url = ?
`);

const selectStaleStmt = db.prepare(`
  SELECT site_id, page_url, last_generated_at, last_approved_at, last_deployed_at,
         freshness_status, next_review_due, alert_sent
  FROM content_freshness
  WHERE site_id = ? AND freshness_status IN ('aging', 'stale')
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToStatus(row: FreshnessRow): FreshnessStatus {
  return {
    siteId: row.site_id,
    pageUrl: row.page_url,
    lastGeneratedAt: row.last_generated_at,
    lastApprovedAt: row.last_approved_at,
    lastDeployedAt: row.last_deployed_at,
    freshnessStatus: row.freshness_status as FreshnessStatus['freshnessStatus'],
    nextReviewDue: row.next_review_due,
    alertSent: row.alert_sent === 1,
  };
}

/**
 * Determine the most-recent significant timestamp for freshness calculation.
 * Priority: last_deployed_at > last_approved_at
 */
function getSignificantDate(
  deployed: string | null,
  approved: string | null,
): Date | null {
  const ts = deployed ?? approved;
  return ts ? new Date(ts) : null;
}

function classifyFreshness(
  significantDate: Date | null,
  now: Date,
): 'fresh' | 'aging' | 'stale' | 'unknown' {
  if (!significantDate) return 'unknown';

  const ageMs = now.getTime() - significantDate.getTime();
  const ageWeeks = ageMs / MS_PER_WEEK;

  if (ageWeeks < FRESH_WEEKS) return 'fresh';
  if (ageWeeks < STALE_WEEKS) return 'aging';
  return 'stale';
}

function computeNextReviewDue(significantDate: Date | null): string | null {
  if (!significantDate) return null;
  const reviewDate = new Date(significantDate.getTime() + FRESH_WEEKS * MS_PER_WEEK);
  return reviewDate.toISOString();
}

function isoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a freshness event for a page and recompute its status.
 */
export function updateFreshness(
  siteId: number,
  pageUrl: string,
  event: 'generated' | 'approved' | 'deployed',
): void {
  const now = new Date();
  const timestamp = isoNow();

  // Fetch existing row (may be null for first event)
  const existing = selectOneStmt.get(siteId, pageUrl) as FreshnessRow | undefined;

  const lastGeneratedAt =
    event === 'generated' ? timestamp : (existing?.last_generated_at ?? null);
  const lastApprovedAt =
    event === 'approved' ? timestamp : (existing?.last_approved_at ?? null);
  const lastDeployedAt =
    event === 'deployed' ? timestamp : (existing?.last_deployed_at ?? null);

  const significantDate = getSignificantDate(lastDeployedAt, lastApprovedAt);
  const status = classifyFreshness(significantDate, now);
  const nextReview = computeNextReviewDue(significantDate);
  const alertSent = status === 'stale' || status === 'aging' ? 1 : 0;

  upsertStmt.run({
    site_id: siteId,
    page_url: pageUrl,
    last_generated_at: lastGeneratedAt,
    last_approved_at: lastApprovedAt,
    last_deployed_at: lastDeployedAt,
    freshness_status: status,
    next_review_due: nextReview,
    alert_sent: alertSent,
  });
}

/**
 * Recompute and return freshness status for every tracked page of a site.
 */
export function computeFreshnessStatus(siteId: number): FreshnessStatus[] {
  const now = new Date();
  const rows = selectBySiteStmt.all(siteId) as FreshnessRow[];

  const results: FreshnessStatus[] = [];

  for (const row of rows) {
    const significantDate = getSignificantDate(row.last_deployed_at, row.last_approved_at);
    const status = classifyFreshness(significantDate, now);
    const nextReview = computeNextReviewDue(significantDate);
    const alertSent = status === 'stale' || status === 'aging' ? 1 : 0;

    // Update in-place if status changed
    if (
      row.freshness_status !== status ||
      row.next_review_due !== nextReview ||
      row.alert_sent !== alertSent
    ) {
      upsertStmt.run({
        site_id: row.site_id,
        page_url: row.page_url,
        last_generated_at: row.last_generated_at,
        last_approved_at: row.last_approved_at,
        last_deployed_at: row.last_deployed_at,
        freshness_status: status,
        next_review_due: nextReview,
        alert_sent: alertSent,
      });
    }

    results.push({
      siteId: row.site_id,
      pageUrl: row.page_url,
      lastGeneratedAt: row.last_generated_at,
      lastApprovedAt: row.last_approved_at,
      lastDeployedAt: row.last_deployed_at,
      freshnessStatus: status,
      nextReviewDue: nextReview,
      alertSent: alertSent === 1,
    });
  }

  return results;
}

/**
 * Return only pages that are aging or stale for a site.
 */
export function getStalePages(siteId: number): FreshnessStatus[] {
  // Recompute first so results are current
  computeFreshnessStatus(siteId);

  const rows = selectStaleStmt.all(siteId) as FreshnessRow[];
  return rows.map(rowToStatus);
}

/**
 * Convenience: mark a page as deployed and recompute status.
 */
export function markAsDeployed(siteId: number, pageUrl: string): void {
  updateFreshness(siteId, pageUrl, 'deployed');
}
