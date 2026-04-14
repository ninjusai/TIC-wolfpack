/**
 * AI Session Management — CRUD for ai_sessions and ai_turns tables.
 *
 * Used by the /api/ai/generate endpoint to maintain conversation context
 * across multiple Claude interactions.
 */

import type { D1CompatDatabase } from '$lib/server/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AISession {
	id: string;
	page_id: string | null;
	site_id: string;
	status: 'active' | 'complete' | 'abandoned';
	created_at: string;
	updated_at: string;
}

export interface AITurn {
	id: string;
	session_id: string;
	turn_number: number;
	role: 'user' | 'assistant';
	content: string;
	validation_report: object | null;
	created_at: string;
}

/** Raw D1 row shape — validation_report comes back as TEXT from SQLite */
interface AITurnRow {
	id: string;
	session_id: string;
	turn_number: number;
	role: 'user' | 'assistant';
	content: string;
	validation_report: string | null;
	created_at: string;
}

// ── Session Operations ─────────────────────────────────────────────────────

/**
 * Create a new AI session tied to a site (and optionally a page).
 * Returns the new session ID.
 */
export async function createSession(
	db: D1CompatDatabase,
	siteId: string,
	pageId?: string
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO ai_sessions (id, site_id, page_id, status, created_at, updated_at)
			 VALUES (?, ?, ?, 'active', ?, ?)`
		)
		.bind(id, siteId, pageId ?? null, now, now)
		.run();

	return id;
}

/**
 * Retrieve a single session by ID.
 */
export async function getSession(
	db: D1CompatDatabase,
	sessionId: string
): Promise<AISession> {
	const row = await db
		.prepare('SELECT * FROM ai_sessions WHERE id = ?')
		.bind(sessionId)
		.first<AISession>();

	if (!row) {
		throw new Error(`Session not found: ${sessionId}`);
	}

	return row;
}

/**
 * Return all turns for a session, ordered by turn_number ascending.
 */
export async function getSessionHistory(
	db: D1CompatDatabase,
	sessionId: string
): Promise<AITurn[]> {
	const result = await db
		.prepare(
			'SELECT * FROM ai_turns WHERE session_id = ? ORDER BY turn_number ASC'
		)
		.bind(sessionId)
		.all<AITurnRow>();

	return (result.results ?? []).map((row) => ({
		...row,
		validation_report: row.validation_report
			? JSON.parse(row.validation_report)
			: null
	}));
}

/**
 * Append a turn (user or assistant) to a session.
 * Automatically calculates the next turn_number.
 * Returns the new turn ID.
 */
export async function addTurn(
	db: D1CompatDatabase,
	sessionId: string,
	role: 'user' | 'assistant',
	content: string,
	validationReport?: object
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	// Get next turn number
	const last = await db
		.prepare(
			'SELECT MAX(turn_number) as max_turn FROM ai_turns WHERE session_id = ?'
		)
		.bind(sessionId)
		.first<{ max_turn: number | null }>();

	const turnNumber = (last?.max_turn ?? 0) + 1;

	await db.batch([
		db
			.prepare(
				`INSERT INTO ai_turns (id, session_id, turn_number, role, content, validation_report, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				sessionId,
				turnNumber,
				role,
				content,
				validationReport ? JSON.stringify(validationReport) : null,
				now
			),
		db
			.prepare('UPDATE ai_sessions SET updated_at = ? WHERE id = ?')
			.bind(now, sessionId)
	]);

	return id;
}

/**
 * Delete the last turn (by highest turn_number) in a session.
 * Used for 'regenerate' action — discard the last assistant turn before re-generating.
 * Returns the deleted turn or null if no turns exist.
 */
export async function deleteLastTurn(
	db: D1CompatDatabase,
	sessionId: string,
	role?: 'user' | 'assistant'
): Promise<AITurn | null> {
	const roleFilter = role ? ' AND role = ?' : '';
	const query = `SELECT * FROM ai_turns WHERE session_id = ?${roleFilter} ORDER BY turn_number DESC LIMIT 1`;

	const stmt = db.prepare(query);
	const bound = role ? stmt.bind(sessionId, role) : stmt.bind(sessionId);
	const row = await bound.first<AITurnRow>();

	if (!row) return null;

	await db
		.prepare('DELETE FROM ai_turns WHERE id = ?')
		.bind(row.id)
		.run();

	return {
		...row,
		validation_report: row.validation_report
			? JSON.parse(row.validation_report)
			: null
	};
}

/**
 * Mark a session as complete.
 */
export async function completeSession(
	db: D1CompatDatabase,
	sessionId: string
): Promise<void> {
	const now = new Date().toISOString();

	await db
		.prepare(
			"UPDATE ai_sessions SET status = 'complete', updated_at = ? WHERE id = ?"
		)
		.bind(now, sessionId)
		.run();
}

/**
 * List sessions, optionally filtered by site_id.
 * Ordered by most recently updated first.
 */
export async function listSessions(
	db: D1CompatDatabase,
	siteId?: string
): Promise<AISession[]> {
	if (siteId) {
		const result = await db
			.prepare(
				'SELECT * FROM ai_sessions WHERE site_id = ? ORDER BY updated_at DESC'
			)
			.bind(siteId)
			.all<AISession>();

		return result.results ?? [];
	}

	const result = await db
		.prepare('SELECT * FROM ai_sessions ORDER BY updated_at DESC')
		.all<AISession>();

	return result.results ?? [];
}
