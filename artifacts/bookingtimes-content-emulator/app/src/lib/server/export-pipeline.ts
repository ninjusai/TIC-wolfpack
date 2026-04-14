/**
 * Multi-Artifact Export Pipeline — WRK-BCE2-040
 *
 * Assembles three export artifacts per page for BookingTimes:
 *   1. Page HTML — all sections assembled in order + JSON-LD appended
 *   2. Schema JSON-LD — separately available for reference
 *   3. Head JS — script for <head> injection (only if Tier 2 interactivity exists)
 *
 * Runs a validation checklist before allowing export.
 * Integrates with version history and freshness tracking on successful assembly.
 */

import db from '$lib/db';
import { validateSectionHtml } from '$lib/server/html-validator';
import { generateJsonLd } from '$lib/server/jsonld-generator';
import { getHeadJsForPage } from '$lib/server/interactivity-engine';
import { getOrCreatePage, createVersion } from '$lib/server/version-history';
import { updateFreshness } from '$lib/server/freshness-tracker';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExportArtifact {
  pageHtml: string;        // All sections assembled + JSON-LD
  jsonLd: string;          // JSON-LD separately
  headJs: string | null;   // Head JS if Tier 2 interactivity exists
}

export interface ExportValidation {
  passed: boolean;
  critical: string[];      // Block export
  warnings: string[];      // Allow export with caution
}

export interface ExportResult {
  blueprintId: number;
  artifacts: ExportArtifact;
  validation: ExportValidation;
  exportBlocked: boolean;  // true if any critical failures
}

// ── Internal row types ──────────────────────────────────────────────────────

interface BlueprintRow {
  id: number;
  backlog_id: number;
  site_id: number;
  working_title: string | null;
  canonical_url: string | null;
  target_url: string | null;
  page_type: string;
}

interface SectionSpecRow {
  id: number;
  blueprint_id: number;
  section_type: string;
  section_order: number;
  heading_text: string | null;
  target_word_count_min: number | null;
  target_word_count_max: number | null;
  status: string;
  generated_html: string | null;
}

interface TaxonomyRow {
  page_type: string;
  required_sections: string | null;
  optional_sections: string | null;
}

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
  getBlueprint: db.prepare<[number]>(`
    SELECT pb.id, pb.backlog_id, pb.site_id,
           pb.working_title, pb.canonical_url,
           wb.target_url, wb.page_type
    FROM page_blueprints pb
    JOIN work_backlog wb ON pb.backlog_id = wb.id
    WHERE pb.id = ?
  `),

  getSections: db.prepare<[number]>(`
    SELECT id, blueprint_id, section_type, section_order, heading_text,
           target_word_count_min, target_word_count_max, status, generated_html
    FROM section_specs
    WHERE blueprint_id = ?
    ORDER BY section_order ASC
  `),

  getTaxonomy: db.prepare<[string]>(`
    SELECT page_type, required_sections, optional_sections
    FROM page_taxonomy
    WHERE page_type = ?
  `),
};

// ── Placeholder / well-formedness checks ────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/,
  /\[TBD\]/i,
  /\bTODO\b/,
  /\bINSERT_\w+/,
  /\bPLACEHOLDER\b/i,
  /\bLorem ipsum\b/i,
];

/**
 * Basic unclosed-tag check. Returns error messages for malformed HTML.
 */
function checkWellFormedness(html: string): string[] {
  const errors: string[] = [];
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g;
  const stack: Array<{ tag: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();

    if (voidElements.has(tagName)) continue;
    if (fullMatch.endsWith('/>')) continue;
    if (fullMatch.startsWith('<!--')) continue;
    // Allow <script> tags — JSON-LD is appended as a script element
    if (tagName === 'script') continue;

    if (fullMatch.startsWith('</')) {
      if (stack.length === 0) {
        errors.push(`Unexpected closing tag </${tagName}>`);
      } else if (stack[stack.length - 1].tag !== tagName) {
        const idx = stack.findLastIndex((s) => s.tag === tagName);
        if (idx === -1) {
          errors.push(`Unexpected closing tag </${tagName}>`);
        } else {
          for (let i = stack.length - 1; i > idx; i--) {
            errors.push(`Unclosed tag <${stack[i].tag}>`);
          }
          stack.splice(idx);
        }
      } else {
        stack.pop();
      }
    } else {
      stack.push({ tag: tagName });
    }
  }

  for (const item of stack) {
    errors.push(`Unclosed tag <${item.tag}>`);
  }

  return errors;
}

/**
 * Count visible words in HTML (strip tags, entities, whitespace).
 */
function countWords(html: string): number {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 0;
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// ── Core export functions ───────────────────────────────────────────────────

/**
 * Run the export validation checklist for a blueprint.
 * Returns critical errors (block export) and warnings (allow with caution).
 */
export function getExportValidation(blueprintId: number): ExportValidation {
  const critical: string[] = [];
  const warnings: string[] = [];

  const bp = stmts.getBlueprint.get(blueprintId) as BlueprintRow | undefined;
  if (!bp) {
    critical.push(`Blueprint ${blueprintId} not found`);
    return { passed: false, critical, warnings };
  }

  const sections = stmts.getSections.all(blueprintId) as SectionSpecRow[];

  if (sections.length === 0) {
    critical.push('No section specs found for this blueprint');
    return { passed: false, critical, warnings };
  }

  // ── 1. Required sections check (per taxonomy) ───────────────────────
  const taxonomy = stmts.getTaxonomy.get(bp.page_type) as TaxonomyRow | undefined;

  if (taxonomy?.required_sections) {
    let requiredTypes: string[];
    try {
      requiredTypes = JSON.parse(taxonomy.required_sections);
    } catch {
      requiredTypes = taxonomy.required_sections.split(',').map((s) => s.trim());
    }

    const presentTypes = new Set(sections.map((s) => s.section_type));
    for (const req of requiredTypes) {
      if (!presentTypes.has(req)) {
        critical.push(`Required section type "${req}" is missing per taxonomy`);
      }
    }
  }

  if (taxonomy?.optional_sections) {
    let optionalTypes: string[];
    try {
      optionalTypes = JSON.parse(taxonomy.optional_sections);
    } catch {
      optionalTypes = taxonomy.optional_sections.split(',').map((s) => s.trim());
    }

    const presentTypes = new Set(sections.map((s) => s.section_type));
    for (const opt of optionalTypes) {
      if (!presentTypes.has(opt)) {
        warnings.push(`Optional section type "${opt}" is not present`);
      }
    }
  }

  // ── 2. Per-section checks ───────────────────────────────────────────
  for (const section of sections) {
    const label = `[Section ${section.id} — ${section.section_type}]`;

    // All required sections must have generated HTML
    if (!section.generated_html) {
      critical.push(`${label} No generated HTML`);
      continue;
    }

    if (section.status !== 'generated' && section.status !== 'approved') {
      critical.push(`${label} Status is "${section.status}" — must be "generated" or "approved"`);
      continue;
    }

    // CSS class validation via html-validator
    const htmlValidation = validateSectionHtml(
      section.generated_html,
      bp.site_id,
      section.id
    );
    for (const err of htmlValidation.errors) {
      critical.push(`${label} ${err}`);
    }
    for (const warn of htmlValidation.warnings) {
      warnings.push(`${label} ${warn}`);
    }

    // Placeholder tokens
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = section.generated_html.match(pattern);
      if (match) {
        critical.push(`${label} Placeholder content detected: ${match[0]}`);
        break;
      }
    }

    // Word count in range
    const wc = countWords(section.generated_html);
    if (section.target_word_count_min !== null && wc < section.target_word_count_min) {
      critical.push(
        `${label} Word count ${wc} below minimum ${section.target_word_count_min}`
      );
    }
    if (section.target_word_count_max !== null && wc > section.target_word_count_max) {
      // Slightly over = warning (within 20%), way over = still just a warning per spec
      warnings.push(
        `${label} Word count ${wc} exceeds maximum ${section.target_word_count_max}`
      );
    }
  }

  // ── 3. JSON-LD validation ───────────────────────────────────────────
  const jsonLdResult = generateJsonLd(blueprintId);
  if (!jsonLdResult.valid) {
    for (const err of jsonLdResult.validationErrors) {
      critical.push(`JSON-LD: ${err}`);
    }
  }

  // Extra check: no unresolved template variables in the JSON-LD
  if (jsonLdResult.jsonLd) {
    const templateVars = jsonLdResult.jsonLd.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      const unique = [...new Set(templateVars)];
      critical.push(`JSON-LD: Unresolved template variables: ${unique.join(', ')}`);
    }

    // Verify it's valid JSON
    try {
      JSON.parse(jsonLdResult.jsonLd);
    } catch (e) {
      critical.push(`JSON-LD: Invalid JSON — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 4. Assembled HTML well-formedness ───────────────────────────────
  const assembledSectionsHtml = sections
    .filter((s) => s.generated_html && (s.status === 'generated' || s.status === 'approved'))
    .map((s) => s.generated_html!)
    .join('\n\n');

  if (assembledSectionsHtml) {
    const formErrors = checkWellFormedness(assembledSectionsHtml);
    for (const err of formErrors) {
      critical.push(`Page HTML structure: ${err}`);
    }
  }

  // ── 5. Unknown internal links (warning only) ────────────────────────
  // Already covered by validateSectionHtml per section

  return {
    passed: critical.length === 0,
    critical,
    warnings,
  };
}

/**
 * Assemble all export artifacts for a blueprint.
 *
 * 1. Load blueprint + sections ordered by section_order
 * 2. Concatenate generated_html from sections with status generated/approved
 * 3. Generate JSON-LD and append as <script type="application/ld+json">
 * 4. Get Head JS if Tier 2 interactivity exists
 * 5. Run validation checklist
 */
export function assembleExport(blueprintId: number): ExportResult {
  const bp = stmts.getBlueprint.get(blueprintId) as BlueprintRow | undefined;
  if (!bp) {
    return {
      blueprintId,
      artifacts: { pageHtml: '', jsonLd: '', headJs: null },
      validation: {
        passed: false,
        critical: [`Blueprint ${blueprintId} not found`],
        warnings: [],
      },
      exportBlocked: true,
    };
  }

  const sections = stmts.getSections.all(blueprintId) as SectionSpecRow[];

  // ── Step 1: Filter to includable sections ─────────────────────────
  const includable = sections.filter(
    (s) => s.generated_html && (s.status === 'generated' || s.status === 'approved')
  );

  // ── Step 2: Assemble Page HTML from sections ──────────────────────
  const sectionsHtml = includable.map((s) => s.generated_html!).join('\n\n');

  // ── Step 3: Generate JSON-LD ──────────────────────────────────────
  const jsonLdResult = generateJsonLd(blueprintId);
  const jsonLdString = jsonLdResult.jsonLd || '';

  // ── Step 4: Append JSON-LD to page HTML ───────────────────────────
  let pageHtml = sectionsHtml;
  if (jsonLdString) {
    const jsonLdScript = `\n\n<script type="application/ld+json">\n${jsonLdString}\n</script>`;
    pageHtml += jsonLdScript;
  }

  // ── Step 5: Get Head JS ───────────────────────────────────────────
  const headJs = getHeadJsForPage(blueprintId);

  // ── Step 6: Run validation ────────────────────────────────────────
  const validation = getExportValidation(blueprintId);

  return {
    blueprintId,
    artifacts: {
      pageHtml,
      jsonLd: jsonLdString,
      headJs,
    },
    validation,
    exportBlocked: !validation.passed,
  };
}

/**
 * Assemble export and, if validation passes, create a page version
 * and update freshness tracking.
 *
 * Returns the full ExportResult (version is created as a side effect).
 */
export function assembleAndVersion(blueprintId: number): ExportResult {
  const result = assembleExport(blueprintId);

  if (result.exportBlocked) {
    return result;
  }

  // Load blueprint for version creation context
  const bp = stmts.getBlueprint.get(blueprintId) as BlueprintRow | undefined;
  if (!bp) return result;

  const pageUrl = bp.canonical_url || bp.target_url || '/';
  const pageTitle = bp.working_title || undefined;
  const pageType = bp.page_type || undefined;

  // Create or find the page record
  const pageId = getOrCreatePage(bp.site_id, pageUrl, pageTitle, pageType);

  // Create a new version with the assembled HTML
  createVersion(pageId, result.artifacts.pageHtml, 'assembly');

  // Update freshness
  updateFreshness(bp.site_id, pageUrl, 'generated');

  return result;
}
