import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';

interface PageRow {
  id: number;
  site_id: number;
  url: string;
  title: string | null;
  page_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface VersionCountRow {
  version_count: number;
  latest_edit_distance: number | null;
}

/**
 * GET /api/site/[siteId]/pages
 *
 * Returns all pages belonging to a site with version counts and edit-distance
 * data. The export page's loadVersions() iterates over `data.pages`, using
 * each `p.id` to fetch `/api/versions/{pageId}`.
 */
export const GET: RequestHandler = ({ params }) => {
  const siteId = parseInt(params.siteId, 10);

  if (isNaN(siteId) || siteId <= 0) {
    return json({ error: 'Invalid siteId parameter' }, { status: 400 });
  }

  try {
    const rows = db
      .prepare('SELECT * FROM pages WHERE site_id = ? ORDER BY id')
      .all(siteId) as PageRow[];

    const pages = rows.map((row) => {
      // Grab version count and latest edit distance for each page
      const vInfo = db
        .prepare(
          `SELECT
             COUNT(*) AS version_count,
             (SELECT edit_distance
              FROM page_versions
              WHERE page_id = ?
              ORDER BY version_number DESC
              LIMIT 1) AS latest_edit_distance
           FROM page_versions
           WHERE page_id = ?`
        )
        .get(row.id, row.id) as VersionCountRow;

      return {
        id: row.id,
        siteId: row.site_id,
        url: row.url,
        title: row.title,
        pageType: row.page_type,
        status: row.status,
        versionCount: vInfo.version_count,
        latestEditDistance: vInfo.latest_edit_distance,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return json({ pages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(
      { error: `Failed to fetch pages for site ${siteId}: ${message}` },
      { status: 500 }
    );
  }
};
