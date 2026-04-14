/**
 * Template types — shared between API routes and UI components.
 * JSON fields (site_ids, required_classes, content_rules, variant_pool)
 * are stored as TEXT in D1 and parsed/stringified on read/write.
 */

export interface Template {
	id: string;
	name: string;
	description: string | null;
	site_ids: string[];
	created_at: string;
	updated_at: string;
	sections: TemplateSection[];
}

export interface TemplateSection {
	id: string;
	template_id: string;
	name: string;
	sort_order: number;
	required: boolean;
	html_skeleton: string | null;
	required_classes: string[];
	content_rules: ContentRules | null;
	variant_pool: Variant[];
}

export interface ContentRules {
	min_words?: number;
	max_words?: number;
	tone?: string;
	[key: string]: unknown;
}

export interface Variant {
	id: string;
	brief: string;
}

/** Row shape returned by D1 for the templates table. */
export interface TemplateRow {
	id: string;
	name: string;
	description: string | null;
	site_ids: string | null;
	created_at: string;
	updated_at: string;
}

/** Row shape returned by D1 for the template_sections table. */
export interface TemplateSectionRow {
	id: string;
	template_id: string;
	name: string;
	sort_order: number;
	required: number; // SQLite stores booleans as 0/1
	html_skeleton: string | null;
	required_classes: string | null;
	content_rules: string | null;
	variant_pool: string | null;
}

/** Parse a D1 template row into a Template (without sections). */
export function parseTemplateRow(row: TemplateRow): Omit<Template, 'sections'> {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		site_ids: row.site_ids ? JSON.parse(row.site_ids) : [],
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

/** Parse a D1 section row into a TemplateSection. */
export function parseSectionRow(row: TemplateSectionRow): TemplateSection {
	return {
		id: row.id,
		template_id: row.template_id,
		name: row.name,
		sort_order: row.sort_order,
		required: row.required === 1,
		html_skeleton: row.html_skeleton,
		required_classes: row.required_classes ? JSON.parse(row.required_classes) : [],
		content_rules: row.content_rules ? JSON.parse(row.content_rules) : null,
		variant_pool: row.variant_pool ? JSON.parse(row.variant_pool) : []
	};
}
