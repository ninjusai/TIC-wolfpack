/**
 * Version History System (WRK-039 + WRK-040)
 *
 * Append-only page versioning with non-destructive rollback.
 * Every mutation creates a NEW version — existing versions are never updated or deleted.
 */

import type { D1CompatDatabase } from '$lib/server/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PageVersion {
	id: string;
	page_id: string;
	version_number: number;
	html_content: string;
	source: 'manual' | 'ai' | 'batch' | 'rollback';
	parent_version: string | null;
	change_summary: string | null;
	created_at: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new page version.
 *
 * Finds the current max version_number for the page, increments by 1,
 * and inserts a new append-only record.
 */
export async function createVersion(
	db: D1CompatDatabase,
	pageId: string,
	html: string,
	source: string,
	changeSummary?: string
): Promise<PageVersion> {
	// Get current max version number for this page
	const latest = await db
		.prepare(
			'SELECT MAX(version_number) AS max_version FROM page_versions WHERE page_id = ?'
		)
		.bind(pageId)
		.first<{ max_version: number | null }>();

	const nextVersion = (latest?.max_version ?? 0) + 1;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO page_versions (id, page_id, version_number, html_content, source, parent_version, change_summary, created_at)
			 VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
		)
		.bind(id, pageId, nextVersion, html, source, changeSummary ?? null, now)
		.run();

	return {
		id,
		page_id: pageId,
		version_number: nextVersion,
		html_content: html,
		source: source as PageVersion['source'],
		parent_version: null,
		change_summary: changeSummary ?? null,
		created_at: now
	};
}

/**
 * Get full version history for a page, ordered by version_number DESC (newest first).
 */
export async function getVersionHistory(
	db: D1CompatDatabase,
	pageId: string
): Promise<PageVersion[]> {
	const { results } = await db
		.prepare(
			`SELECT id, page_id, version_number, html_content, source, parent_version, change_summary, created_at
			 FROM page_versions
			 WHERE page_id = ?
			 ORDER BY version_number DESC`
		)
		.bind(pageId)
		.all<PageVersion>();

	return results ?? [];
}

/**
 * Get a single version by its ID.
 */
export async function getVersion(
	db: D1CompatDatabase,
	versionId: string
): Promise<PageVersion | null> {
	return await db
		.prepare(
			`SELECT id, page_id, version_number, html_content, source, parent_version, change_summary, created_at
			 FROM page_versions
			 WHERE id = ?`
		)
		.bind(versionId)
		.first<PageVersion>() ?? null;
}

/**
 * Get the latest (highest version_number) version for a page.
 */
export async function getLatestVersion(
	db: D1CompatDatabase,
	pageId: string
): Promise<PageVersion | null> {
	return await db
		.prepare(
			`SELECT id, page_id, version_number, html_content, source, parent_version, change_summary, created_at
			 FROM page_versions
			 WHERE page_id = ?
			 ORDER BY version_number DESC
			 LIMIT 1`
		)
		.bind(pageId)
		.first<PageVersion>() ?? null;
}

/**
 * Non-destructive rollback (WRK-040).
 *
 * Rolling back to version M creates a NEW version N+1 that copies
 * html_content from M. Sets source='rollback', parent_version=targetVersionId,
 * and a descriptive change_summary. Full history is preserved.
 */
export async function rollbackToVersion(
	db: D1CompatDatabase,
	pageId: string,
	targetVersionId: string
): Promise<PageVersion> {
	// Fetch the target version to copy content from
	const target = await getVersion(db, targetVersionId);
	if (!target) {
		throw new Error(`Version not found: ${targetVersionId}`);
	}

	if (target.page_id !== pageId) {
		throw new Error(`Version ${targetVersionId} does not belong to page ${pageId}`);
	}

	// Get current max version number
	const latest = await db
		.prepare(
			'SELECT MAX(version_number) AS max_version FROM page_versions WHERE page_id = ?'
		)
		.bind(pageId)
		.first<{ max_version: number | null }>();

	const nextVersion = (latest?.max_version ?? 0) + 1;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const changeSummary = `Rollback to version ${target.version_number}`;

	await db
		.prepare(
			`INSERT INTO page_versions (id, page_id, version_number, html_content, source, parent_version, change_summary, created_at)
			 VALUES (?, ?, ?, ?, 'rollback', ?, ?, ?)`
		)
		.bind(id, pageId, nextVersion, target.html_content, targetVersionId, changeSummary, now)
		.run();

	return {
		id,
		page_id: pageId,
		version_number: nextVersion,
		html_content: target.html_content,
		source: 'rollback',
		parent_version: targetVersionId,
		change_summary: changeSummary,
		created_at: now
	};
}
