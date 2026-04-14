/**
 * WRK-025: Template CRUD — single-resource endpoints
 *
 * GET    /api/templates/:templateId  — Get template with all sections
 * PUT    /api/templates/:templateId  — Update template (replaces sections)
 * DELETE /api/templates/:templateId  — Delete template (CASCADE handles sections)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TemplateRow, TemplateSectionRow } from '$lib/types/template';
import { parseTemplateRow, parseSectionRow } from '$lib/types/template';

// ─── GET /api/templates/:templateId ──────────────────────────────────────────

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;

	const { templateId } = params;
	if (!templateId) throw error(400, 'Missing template ID');

	try {
		const templateRow = await db
			.prepare(
				`SELECT id, name, description, site_ids, created_at, updated_at
				 FROM templates WHERE id = ?`
			)
			.bind(templateId)
			.first<TemplateRow>();

		if (!templateRow) throw error(404, `Template not found: ${templateId}`);

		const { results: sectionRows } = await db
			.prepare(
				`SELECT id, template_id, name, sort_order, required,
				        html_skeleton, required_classes, content_rules, variant_pool
				 FROM template_sections
				 WHERE template_id = ?
				 ORDER BY sort_order ASC`
			)
			.bind(templateId)
			.all<TemplateSectionRow>();

		const template = {
			...parseTemplateRow(templateRow),
			sections: (sectionRows ?? []).map(parseSectionRow)
		};

		return json({ template });
	} catch (err) {
		// Re-throw SvelteKit errors (404, etc.)
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to get template: ${message}`);
	}
};

// ─── PUT /api/templates/:templateId ──────────────────────────────────────────

interface UpdateTemplateBody {
	name?: string;
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

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const db = locals.db;

	const { templateId } = params;
	if (!templateId) throw error(400, 'Missing template ID');

	let body: UpdateTemplateBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	try {
		// Verify template exists
		const existing = await db
			.prepare('SELECT id FROM templates WHERE id = ?')
			.bind(templateId)
			.first<{ id: string }>();

		if (!existing) throw error(404, `Template not found: ${templateId}`);

		const now = new Date().toISOString();
		const statements = [];

		// Update template fields
		statements.push(
			db
				.prepare(
					`UPDATE templates
					 SET name = COALESCE(?, name),
					     description = COALESCE(?, description),
					     site_ids = COALESCE(?, site_ids),
					     updated_at = ?
					 WHERE id = ?`
				)
				.bind(
					body.name ?? null,
					body.description !== undefined ? body.description : null,
					body.site_ids ? JSON.stringify(body.site_ids) : null,
					now,
					templateId
				)
		);

		// Replace sections if provided
		if (body.sections !== undefined) {
			// Delete old sections
			statements.push(
				db
					.prepare('DELETE FROM template_sections WHERE template_id = ?')
					.bind(templateId)
			);

			// Insert new sections
			for (const section of body.sections) {
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
			}
		}

		await db.batch(statements);

		// Fetch the updated template to return
		const updatedRow = await db
			.prepare(
				`SELECT id, name, description, site_ids, created_at, updated_at
				 FROM templates WHERE id = ?`
			)
			.bind(templateId)
			.first<TemplateRow>();

		const { results: sectionRows } = await db
			.prepare(
				`SELECT id, template_id, name, sort_order, required,
				        html_skeleton, required_classes, content_rules, variant_pool
				 FROM template_sections
				 WHERE template_id = ?
				 ORDER BY sort_order ASC`
			)
			.bind(templateId)
			.all<TemplateSectionRow>();

		const template = {
			...parseTemplateRow(updatedRow!),
			sections: (sectionRows ?? []).map(parseSectionRow)
		};

		return json({ template });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to update template: ${message}`);
	}
};

// ─── DELETE /api/templates/:templateId ───────────────────────────────────────

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;

	const { templateId } = params;
	if (!templateId) throw error(400, 'Missing template ID');

	try {
		// Verify template exists before deleting
		const existing = await db
			.prepare('SELECT id FROM templates WHERE id = ?')
			.bind(templateId)
			.first<{ id: string }>();

		if (!existing) throw error(404, `Template not found: ${templateId}`);

		// CASCADE on template_sections handles child rows
		await db
			.prepare('DELETE FROM templates WHERE id = ?')
			.bind(templateId)
			.run();

		return json({ deleted: true, id: templateId });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw error(500, `Failed to delete template: ${message}`);
	}
};
