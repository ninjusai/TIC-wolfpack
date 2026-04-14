/**
 * WRK-025: Template CRUD — collection endpoints
 *
 * GET  /api/templates          — List all templates (optional ?site_id filter)
 * POST /api/templates          — Create a new template with sections
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TemplateRow, TemplateSectionRow } from '$lib/types/template';
import { parseTemplateRow, parseSectionRow } from '$lib/types/template';

// ─── GET /api/templates ──────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.db;

	const siteId = url.searchParams.get('site_id');

	try {
		let templates: TemplateRow[];

		if (siteId) {
			// site_ids is a JSON array stored as TEXT — use json_each to filter
			const { results } = await db
				.prepare(
					`SELECT DISTINCT t.id, t.name, t.description, t.site_ids,
					        t.created_at, t.updated_at
					 FROM templates t, json_each(t.site_ids) j
					 WHERE j.value = ?
					 ORDER BY t.updated_at DESC`
				)
				.bind(siteId)
				.all<TemplateRow>();
			templates = results ?? [];
		} else {
			const { results } = await db
				.prepare(
					`SELECT id, name, description, site_ids, created_at, updated_at
					 FROM templates
					 ORDER BY updated_at DESC`
				)
				.all<TemplateRow>();
			templates = results ?? [];
		}

		// Fetch section counts — chunk to stay within D1's 100-parameter limit
		const ids = templates.map((t) => t.id);
		const sectionCounts: Record<string, number> = {};
		const CHUNK_SIZE = 90; // stay safely under D1's 100-param limit

		for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
			const chunk = ids.slice(i, i + CHUNK_SIZE);
			const placeholders = chunk.map(() => '?').join(', ');
			const { results } = await db
				.prepare(
					`SELECT template_id, COUNT(*) as count
					 FROM template_sections
					 WHERE template_id IN (${placeholders})
					 GROUP BY template_id`
				)
				.bind(...chunk)
				.all<{ template_id: string; count: number }>();

			for (const row of results ?? []) {
				sectionCounts[row.template_id] = row.count;
			}
		}

		const parsed = templates.map((row) => ({
			...parseTemplateRow(row),
			section_count: sectionCounts[row.id] ?? 0
		}));

		return json({ templates: parsed });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to list templates: ${message}`);
	}
};

// ─── POST /api/templates ─────────────────────────────────────────────────────

interface CreateTemplateBody {
	name: string;
	description?: string | null;
	site_ids?: string[];
	sections?: Array<{
		name: string;
		sort_order: number;
		required?: boolean;
		html_skeleton?: string | null;
		required_classes?: string[];
		content_rules?: Record<string, unknown> | null;
		variant_pool?: Array<{ id: string; brief: string }>;
	}>;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const db = locals.db;

	let body: CreateTemplateBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!body.name || typeof body.name !== 'string') {
		throw error(400, 'Template name is required');
	}

	const templateId = crypto.randomUUID();
	const now = new Date().toISOString();
	const siteIds = JSON.stringify(body.site_ids ?? []);
	const sections = body.sections ?? [];

	try {
		// Build batch: insert template + all sections
		const statements = [
			db
				.prepare(
					`INSERT INTO templates (id, name, description, site_ids, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?)`
				)
				.bind(templateId, body.name, body.description ?? null, siteIds, now, now)
		];

		const createdSections: Array<{
			id: string;
			template_id: string;
			name: string;
			sort_order: number;
			required: boolean;
			html_skeleton: string | null;
			required_classes: string[];
			content_rules: Record<string, unknown> | null;
			variant_pool: Array<{ id: string; brief: string }>;
		}> = [];

		for (const section of sections) {
			const sectionId = crypto.randomUUID();
			const required = section.required !== false ? 1 : 0;

			statements.push(
				db
					.prepare(
						`INSERT INTO template_sections
						 (id, template_id, name, sort_order, required, html_skeleton, required_classes, content_rules, variant_pool)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						sectionId,
						templateId,
						section.name,
						section.sort_order,
						required,
						section.html_skeleton ?? null,
						JSON.stringify(section.required_classes ?? []),
						section.content_rules ? JSON.stringify(section.content_rules) : null,
						JSON.stringify(section.variant_pool ?? [])
					)
			);

			createdSections.push({
				id: sectionId,
				template_id: templateId,
				name: section.name,
				sort_order: section.sort_order,
				required: required === 1,
				html_skeleton: section.html_skeleton ?? null,
				required_classes: section.required_classes ?? [],
				content_rules: section.content_rules ?? null,
				variant_pool: section.variant_pool ?? []
			});
		}

		await db.batch(statements);

		return json(
			{
				template: {
					id: templateId,
					name: body.name,
					description: body.description ?? null,
					site_ids: body.site_ids ?? [],
					created_at: now,
					updated_at: now,
					sections: createdSections
				}
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to create template: ${message}`);
	}
};
