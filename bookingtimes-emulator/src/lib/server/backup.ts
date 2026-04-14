/**
 * WRK-041: Backup utility — DB → local storage JSON snapshots
 *
 * Exports critical tables to local storage as JSON, supports listing and restoring.
 */

import type { D1CompatDatabase } from '$lib/server/db';
import type { LocalStorage } from './storage';

const BACKUP_PREFIX = 'backups/';
const CHUNK_SIZE = 500; // rows per SELECT batch

/** Tables to include in backups (order matters for restore FK safety). */
const BACKUP_TABLES = [
	'templates',
	'template_sections',
	'pages',
	'page_versions',
	'suburb_data'
] as const;

type TableName = (typeof BACKUP_TABLES)[number];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read all rows from a table using LIMIT/OFFSET chunking. */
async function readTable(db: D1CompatDatabase, table: TableName): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = [];
	let offset = 0;

	while (true) {
		const { results } = await db
			.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`)
			.bind(CHUNK_SIZE, offset)
			.all();

		if (!results || results.length === 0) break;
		rows.push(...(results as Record<string, unknown>[]));
		if (results.length < CHUNK_SIZE) break;
		offset += CHUNK_SIZE;
	}

	return rows;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface BackupPayload {
	version: 1;
	timestamp: string;
	tables: Record<string, Record<string, unknown>[]>;
}

/**
 * Export critical tables as JSON and store in local storage.
 */
export async function createBackup(
	db: D1CompatDatabase,
	storage: LocalStorage
): Promise<{ key: string; tables: string[]; timestamp: string }> {
	const timestamp = new Date().toISOString();
	const key = `${BACKUP_PREFIX}${timestamp}.json`;

	const payload: BackupPayload = {
		version: 1,
		timestamp,
		tables: {}
	};

	const exportedTables: string[] = [];

	for (const table of BACKUP_TABLES) {
		try {
			const rows = await readTable(db, table);
			payload.tables[table] = rows;
			exportedTables.push(table);
		} catch {
			// Table may not exist yet — skip silently
		}
	}

	const body = JSON.stringify(payload);
	await storage.put(key, body);

	return { key, tables: exportedTables, timestamp };
}

/**
 * List all backup files stored under the backups/ prefix in local storage.
 */
export async function listBackups(
	storage: LocalStorage
): Promise<{ key: string; created: string }[]> {
	const list = await storage.list({ prefix: BACKUP_PREFIX });

	return list.objects.map((obj) => ({
		key: obj.key,
		created: obj.uploaded
	}));
}

/**
 * Restore data from a backup JSON stored in local storage.
 * Clears target tables then re-inserts all rows using DB batch.
 */
export async function restoreFromBackup(
	db: D1CompatDatabase,
	storage: LocalStorage,
	backupKey: string
): Promise<{ restored_tables: string[]; row_counts: Record<string, number> }> {
	const obj = await storage.get(backupKey);
	if (!obj) throw new Error(`Backup not found: ${backupKey}`);

	const text = await obj.text();
	const payload: BackupPayload = JSON.parse(text);

	if (payload.version !== 1) {
		throw new Error(`Unsupported backup version: ${payload.version}`);
	}

	const restoredTables: string[] = [];
	const rowCounts: Record<string, number> = {};

	// Delete in reverse order (children first) to respect FK constraints
	const deleteOrder = [...BACKUP_TABLES].reverse();
	const deleteStatements = deleteOrder
		.filter((t) => t in payload.tables)
		.map((t) => db.prepare(`DELETE FROM ${t}`));

	if (deleteStatements.length > 0) {
		await db.batch(deleteStatements);
	}

	// Insert in forward order (parents first)
	for (const table of BACKUP_TABLES) {
		const rows = payload.tables[table];
		if (!rows || rows.length === 0) continue;

		// Build INSERT OR REPLACE statements in chunks to stay within batch limits
		const columns = Object.keys(rows[0]);
		const placeholders = columns.map(() => '?').join(', ');
		const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

		// D1 batch has a limit — chunk inserts into batches of 50
		const BATCH_CHUNK = 50;
		for (let i = 0; i < rows.length; i += BATCH_CHUNK) {
			const chunk = rows.slice(i, i + BATCH_CHUNK);
			const statements = chunk.map((row) =>
				db.prepare(sql).bind(...columns.map((col) => row[col] ?? null))
			);
			await db.batch(statements);
		}

		restoredTables.push(table);
		rowCounts[table] = rows.length;
	}

	return { restored_tables: restoredTables, row_counts: rowCounts };
}
