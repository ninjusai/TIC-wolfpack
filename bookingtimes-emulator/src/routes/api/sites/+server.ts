import { json, error } from '@sveltejs/kit';

/**
 * GET /api/sites
 *
 * Returns a list of all sites from D1.
 */
export async function GET({ locals }: { locals: App.Locals }) {
	const db = locals.db;

	try {
		const result = await db
			.prepare('SELECT id, name, url FROM sites ORDER BY name ASC')
			.all();

		return json({ sites: result.results ?? [] });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list sites: ${message}`);
	}
}
