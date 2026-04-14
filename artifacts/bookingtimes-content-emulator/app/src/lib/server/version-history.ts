/**
 * Version History — non-destructive page versioning and rollback
 *
 * Every content save creates a new version. Rollback creates N+1 with the
 * content from version M, so no history is ever deleted.
 */

import db from '$lib/db/index';
import { computeHtmlEditDistance } from '$lib/server/edit-distance';

export interface PageVersion {
  id: number;
  pageId: number;
  versionNumber: number;
  htmlContent: string;
  changeReason: string;
  createdAt: string;
  editDistance: number | null;
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmtInsertVersion = db.prepare(`
  INSERT INTO page_versions (page_id, version_number, html_content, change_reason, edit_distance)
  VALUES (?, ?, ?, ?, ?)
`);

const stmtMaxVersion = db.prepare(`
  SELECT COALESCE(MAX(version_number), 0) AS max_v
  FROM page_versions
  WHERE page_id = ?
`);

const stmtGetVersions = db.prepare(`
  SELECT id, page_id, version_number, html_content, change_reason, created_at, edit_distance
  FROM page_versions
  WHERE page_id = ?
  ORDER BY version_number DESC
`);

const stmtGetVersion = db.prepare(`
  SELECT id, page_id, version_number, html_content, change_reason, created_at, edit_distance
  FROM page_versions
  WHERE page_id = ? AND version_number = ?
`);

const stmtGetLatestHtml = db.prepare(`
  SELECT html_content FROM page_versions
  WHERE page_id = ?
  ORDER BY version_number DESC
  LIMIT 1
`);

const stmtUpdatePageHtml = db.prepare(`
  UPDATE pages SET current_html = ?, status = ?, updated_at = datetime('now')
  WHERE id = ?
`);

const stmtFindPage = db.prepare(`
  SELECT id FROM pages WHERE site_id = ? AND url = ?
`);

const stmtInsertPage = db.prepare(`
  INSERT INTO pages (site_id, url, title, page_type, status)
  VALUES (?, ?, ?, ?, 'draft')
`);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new version for a page. Automatically determines the next
 * sequential version number and updates pages.current_html.
 */
export function createVersion(
  pageId: number,
  htmlContent: string,
  changeReason: string
): PageVersion {
  const row = stmtMaxVersion.get(pageId) as { max_v: number } | undefined;
  const nextVersion = (row?.max_v ?? 0) + 1;

  const status = changeReason === 'manual_edit' ? 'draft' : 'generated';

  // Compute true Levenshtein edit distance against the previous version's HTML
  let editDist: number | null = null;
  const prevRow = stmtGetLatestHtml.get(pageId) as { html_content: string } | undefined;
  if (prevRow) {
    editDist = computeHtmlEditDistance(prevRow.html_content, htmlContent);
  }

  const txn = db.transaction(() => {
    stmtInsertVersion.run(pageId, nextVersion, htmlContent, changeReason, editDist);
    stmtUpdatePageHtml.run(htmlContent, status, pageId);
  });
  txn();

  const created = stmtGetVersion.get(pageId, nextVersion) as Record<string, unknown>;
  return mapRow(created);
}

/**
 * Return every version for a page, newest first.
 */
export function getVersionHistory(pageId: number): PageVersion[] {
  const rows = stmtGetVersions.all(pageId) as Array<Record<string, unknown>>;
  return rows.map(mapRow);
}

/**
 * Non-destructive rollback: creates version N+1 whose content is copied
 * from the target version. No rows are deleted.
 */
export function rollbackToVersion(
  pageId: number,
  targetVersionNumber: number
): PageVersion {
  const target = stmtGetVersion.get(pageId, targetVersionNumber) as
    | Record<string, unknown>
    | undefined;

  if (!target) {
    throw new Error(
      `Version ${targetVersionNumber} not found for page ${pageId}`
    );
  }

  const reason = `rollback_from_v${targetVersionNumber}`;
  return createVersion(pageId, target.html_content as string, reason);
}

/**
 * Ensure a page record exists for the given site + URL. Returns the page id.
 */
export function getOrCreatePage(
  siteId: number,
  url: string,
  title?: string,
  pageType?: string
): number {
  const existing = stmtFindPage.get(siteId, url) as { id: number } | undefined;
  if (existing) return existing.id;

  const info = stmtInsertPage.run(siteId, url, title ?? null, pageType ?? null);
  return Number(info.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): PageVersion {
  return {
    id: row.id as number,
    pageId: row.page_id as number,
    versionNumber: row.version_number as number,
    htmlContent: row.html_content as string,
    changeReason: row.change_reason as string,
    createdAt: row.created_at as string,
    editDistance: (row.edit_distance as number) ?? null,
  };
}
