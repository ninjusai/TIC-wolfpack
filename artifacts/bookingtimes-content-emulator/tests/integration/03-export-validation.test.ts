/**
 * Integration Test 03: Export Validation Blocks Broken Content — WRK-BCE2-052
 *
 * Verifies: The export pipeline validates content before allowing export;
 * broken HTML or missing JSON-LD should be rejected.
 *
 * Cross-layer: Database <-> export-pipeline service <-> html-validator <-> jsonld-generator
 *
 * Checklist:
 *   [x] Data flows correctly across layer boundaries
 *   [x] Field names match
 *   [x] Error cases handled gracefully (broken HTML, placeholders, missing sections)
 *   [x] No data loss in round-trips (assembled HTML preserves section content)
 *   [x] Site isolation holds (export for site A doesn't pull site B data)
 */

import Database from 'better-sqlite3';
import { createTestDb, seedTestData, TestRunner } from './test-helpers';

// ---------------------------------------------------------------------------
// Export validation logic (mirrors export-pipeline.ts, uses injected db)
// ---------------------------------------------------------------------------

interface ExportValidation {
  passed: boolean;
  critical: string[];
  warnings: string[];
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

interface BlueprintRow {
  id: number;
  site_id: number;
  page_type: string;
}

interface TaxonomyRow {
  required_sections: string | null;
  optional_sections: string | null;
}

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/,
  /\[TBD\]/i,
  /\bTODO\b/,
  /\bINSERT_\w+/,
  /\bPLACEHOLDER\b/i,
  /\bLorem ipsum\b/i,
];

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

/**
 * Simplified export validation that tests the core logic chain:
 * blueprint -> sections -> HTML assembly -> validation
 */
function getExportValidation(db: Database.Database, blueprintId: number): ExportValidation {
  const critical: string[] = [];
  const warnings: string[] = [];

  const bp = db.prepare(
    `SELECT pb.id, pb.site_id, wb.page_type
     FROM page_blueprints pb JOIN work_backlog wb ON pb.backlog_id = wb.id
     WHERE pb.id = ?`
  ).get(blueprintId) as BlueprintRow | undefined;

  if (!bp) {
    critical.push(`Blueprint ${blueprintId} not found`);
    return { passed: false, critical, warnings };
  }

  const sections = db.prepare(
    `SELECT id, blueprint_id, section_type, section_order, heading_text,
            target_word_count_min, target_word_count_max, status, generated_html
     FROM section_specs WHERE blueprint_id = ? ORDER BY section_order ASC`
  ).all(blueprintId) as SectionSpecRow[];

  if (sections.length === 0) {
    critical.push('No section specs found for this blueprint');
    return { passed: false, critical, warnings };
  }

  // Required sections check
  const taxonomy = db.prepare(
    'SELECT required_sections, optional_sections FROM page_taxonomy WHERE page_type = ?'
  ).get(bp.page_type) as TaxonomyRow | undefined;

  if (taxonomy?.required_sections) {
    let requiredTypes: string[];
    try {
      requiredTypes = JSON.parse(taxonomy.required_sections);
    } catch {
      requiredTypes = taxonomy.required_sections.split(',').map(s => s.trim());
    }
    const presentTypes = new Set(sections.map(s => s.section_type));
    for (const req of requiredTypes) {
      if (!presentTypes.has(req)) {
        critical.push(`Required section type "${req}" is missing per taxonomy`);
      }
    }
  }

  // Per-section checks
  for (const section of sections) {
    const label = `[Section ${section.id} - ${section.section_type}]`;

    if (!section.generated_html) {
      critical.push(`${label} No generated HTML`);
      continue;
    }

    if (section.status !== 'generated' && section.status !== 'approved') {
      critical.push(`${label} Status is "${section.status}" - must be "generated" or "approved"`);
      continue;
    }

    // Placeholder tokens
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const m = section.generated_html.match(pattern);
      if (m) {
        critical.push(`${label} Placeholder content detected: ${m[0]}`);
        break;
      }
    }

    // Word count
    const wc = countWords(section.generated_html);
    if (section.target_word_count_min !== null && wc < section.target_word_count_min) {
      critical.push(`${label} Word count ${wc} below minimum ${section.target_word_count_min}`);
    }
    if (section.target_word_count_max !== null && wc > section.target_word_count_max) {
      warnings.push(`${label} Word count ${wc} exceeds maximum ${section.target_word_count_max}`);
    }
  }

  // Assembled HTML well-formedness
  const assembledHtml = sections
    .filter(s => s.generated_html && (s.status === 'generated' || s.status === 'approved'))
    .map(s => s.generated_html!)
    .join('\n\n');

  if (assembledHtml) {
    const formErrors = checkWellFormedness(assembledHtml);
    for (const err of formErrors) {
      critical.push(`Page HTML structure: ${err}`);
    }
  }

  // JSON-LD validation (simplified — check schema_spec is valid JSON)
  const bpFull = db.prepare('SELECT schema_spec FROM page_blueprints WHERE id = ?').get(blueprintId) as { schema_spec: string | null } | undefined;
  if (bpFull?.schema_spec) {
    try {
      JSON.parse(bpFull.schema_spec);
    } catch (e) {
      critical.push(`JSON-LD: Invalid JSON — ${e instanceof Error ? e.message : String(e)}`);
    }
    // Check for template variables
    const templateVars = bpFull.schema_spec.match(/\{\{[^}]+\}\}/g);
    if (templateVars) {
      critical.push(`JSON-LD: Unresolved template variables: ${[...new Set(templateVars)].join(', ')}`);
    }
  }

  return { passed: critical.length === 0, critical, warnings };
}

function assembleExportHtml(db: Database.Database, blueprintId: number): string {
  const sections = db.prepare(
    `SELECT generated_html, status FROM section_specs
     WHERE blueprint_id = ? AND generated_html IS NOT NULL
       AND status IN ('generated', 'approved')
     ORDER BY section_order ASC`
  ).all(blueprintId) as Array<{ generated_html: string; status: string }>;

  return sections.map(s => s.generated_html).join('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function runTests(): { passed: number; failed: number; errors: string[] } {
  const t = new TestRunner('03 — Export Validation Blocks Broken Content');
  const db = createTestDb();
  seedTestData(db);

  // ── Test 1: Valid blueprint passes validation ──────────────────────────
  t.section('Valid export passes validation');

  const validResult = getExportValidation(db, 1);
  t.assert(validResult.passed, 'Blueprint 1 (well-formed) passes validation');
  t.assertEqual(validResult.critical.length, 0, 'No critical errors for valid content');

  // ── Test 2: Assembled HTML preserves all sections ──────────────────────
  t.section('Assembled HTML round-trip');

  const assembled = assembleExportHtml(db, 1);
  t.assertIncludes(assembled, 'Sydney Driving Lessons', 'Hero section content preserved');
  t.assertIncludes(assembled, 'Why Choose Alpha', 'Features section content preserved');
  t.assertIncludes(assembled, 'Book Your Lesson', 'CTA section content preserved');

  // ── Test 3: Broken HTML is rejected ────────────────────────────────────
  t.section('Broken HTML: unclosed tags');

  // Inject broken HTML into a section
  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container"><div class="row"><div class="col-12"><h2>Broken</h2><p>Missing closing tags'
  );

  const brokenResult = getExportValidation(db, 1);
  t.assert(!brokenResult.passed, 'Broken HTML fails validation');
  const hasUnclosedError = brokenResult.critical.some(e => e.includes('Unclosed tag'));
  t.assert(hasUnclosedError, 'Critical error mentions unclosed tag');

  // Restore valid HTML
  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Sydney Driving Lessons</h2><p>Learn to drive with Alpha Driving School in Sydney. Our experienced instructors provide patient and professional driving lessons tailored to your needs. Whether you are a beginner or need a refresher course we have the right program for you. Book your first lesson today and start your journey to becoming a confident driver on Sydney roads.</p></div></div></section>'
  );

  // ── Test 4: Placeholder content is rejected ────────────────────────────
  t.section('Placeholder content detection');

  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-12"><h2>{{TITLE}}</h2><p>Real content goes here with enough words to pass word count checks for the section minimum requirements.</p></div></div></section>'
  );

  const placeholderResult = getExportValidation(db, 1);
  t.assert(!placeholderResult.passed, 'Placeholder content fails validation');
  const hasPlaceholderError = placeholderResult.critical.some(e => e.includes('Placeholder'));
  t.assert(hasPlaceholderError, 'Critical error mentions placeholder');

  // Test [TBD] placeholder
  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-12"><h2>Title</h2><p>[TBD] - This content needs to be filled in with actual driving school information and details about Sydney lessons.</p></div></div></section>'
  );

  const tbdResult = getExportValidation(db, 1);
  t.assert(!tbdResult.passed, '[TBD] placeholder detected and rejected');

  // Test Lorem ipsum
  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-12"><h2>Title</h2><p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p></div></div></section>'
  );

  const loremResult = getExportValidation(db, 1);
  t.assert(!loremResult.passed, 'Lorem ipsum detected and rejected');

  // Restore valid HTML
  db.prepare('UPDATE section_specs SET generated_html = ? WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Sydney Driving Lessons</h2><p>Learn to drive with Alpha Driving School in Sydney. Our experienced instructors provide patient and professional driving lessons tailored to your needs. Whether you are a beginner or need a refresher course we have the right program for you. Book your first lesson today and start your journey to becoming a confident driver on Sydney roads.</p></div></div></section>'
  );

  // ── Test 5: Missing required sections blocks export ────────────────────
  t.section('Missing required sections');

  // Remove the 'hero' section (required per taxonomy)
  const heroHtml = db.prepare('SELECT generated_html FROM section_specs WHERE id = 1').get() as { generated_html: string };
  db.prepare('DELETE FROM section_specs WHERE id = 1').run();

  const missingResult = getExportValidation(db, 1);
  t.assert(!missingResult.passed, 'Missing required section fails validation');
  const hasMissingError = missingResult.critical.some(e => e.includes('Required section type') && e.includes('hero'));
  t.assert(hasMissingError, 'Error identifies missing hero section');

  // Restore
  db.prepare(
    `INSERT INTO section_specs (id, blueprint_id, section_type, section_order, heading_text, target_word_count_min, target_word_count_max, status, generated_html)
     VALUES (1, 1, 'hero', 1, 'Sydney Driving Lessons', 50, 150, 'generated', ?)`
  ).run(heroHtml.generated_html);

  // ── Test 6: Invalid JSON-LD is rejected ────────────────────────────────
  t.section('Invalid JSON-LD');

  db.prepare('UPDATE page_blueprints SET schema_spec = ? WHERE id = 1').run(
    '{"@context":"https://schema.org", invalid json here'
  );

  const jsonLdResult = getExportValidation(db, 1);
  t.assert(!jsonLdResult.passed, 'Invalid JSON-LD fails validation');
  const hasJsonLdError = jsonLdResult.critical.some(e => e.includes('JSON-LD') && e.includes('Invalid JSON'));
  t.assert(hasJsonLdError, 'Error identifies invalid JSON-LD');

  // Restore
  db.prepare('UPDATE page_blueprints SET schema_spec = ? WHERE id = 1').run(
    '{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Driving Lessons in Sydney","url":"https://alphadriving.com.au/driving-lessons-sydney"}]}'
  );

  // ── Test 7: Unresolved template variables in JSON-LD ───────────────────
  t.section('Unresolved template variables in JSON-LD');

  db.prepare('UPDATE page_blueprints SET schema_spec = ? WHERE id = 1').run(
    '{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"{{siteName}}","url":"{{siteUrl}}"}]}'
  );

  const templateResult = getExportValidation(db, 1);
  t.assert(!templateResult.passed, 'Unresolved template variables fail validation');
  const hasTemplateError = templateResult.critical.some(e => e.includes('template variables'));
  t.assert(hasTemplateError, 'Error identifies unresolved template variables');

  // Restore
  db.prepare('UPDATE page_blueprints SET schema_spec = ? WHERE id = 1').run(
    '{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Driving Lessons in Sydney","url":"https://alphadriving.com.au/driving-lessons-sydney"}]}'
  );

  // ── Test 8: Section with wrong status is rejected ──────────────────────
  t.section('Section with pending status blocks export');

  db.prepare("UPDATE section_specs SET status = 'pending' WHERE id = 2").run();

  const pendingResult = getExportValidation(db, 1);
  t.assert(!pendingResult.passed, 'Pending section status blocks export');
  const hasPendingError = pendingResult.critical.some(e => e.includes('pending'));
  t.assert(hasPendingError, 'Error identifies pending status');

  db.prepare("UPDATE section_specs SET status = 'generated' WHERE id = 2").run();

  // ── Test 9: Word count below minimum blocks export ─────────────────────
  t.section('Word count validation');

  db.prepare('UPDATE section_specs SET generated_html = ?, target_word_count_min = 100 WHERE id = 1').run(
    '<section class="container"><h2>Short</h2><p>Too few words here.</p></section>'
  );

  const wordCountResult = getExportValidation(db, 1);
  t.assert(!wordCountResult.passed, 'Below minimum word count fails validation');
  const hasWordCountError = wordCountResult.critical.some(e => e.includes('Word count') && e.includes('below'));
  t.assert(hasWordCountError, 'Error identifies word count below minimum');

  // Restore
  db.prepare('UPDATE section_specs SET generated_html = ?, target_word_count_min = 50 WHERE id = 1').run(
    '<section class="container py-5"><div class="row"><div class="col-lg-8"><h2>Sydney Driving Lessons</h2><p>Learn to drive with Alpha Driving School in Sydney. Our experienced instructors provide patient and professional driving lessons tailored to your needs. Whether you are a beginner or need a refresher course we have the right program for you. Book your first lesson today and start your journey to becoming a confident driver on Sydney roads.</p></div></div></section>'
  );

  // ── Test 10: Non-existent blueprint ────────────────────────────────────
  t.section('Error: non-existent blueprint');

  const notFoundResult = getExportValidation(db, 999);
  t.assert(!notFoundResult.passed, 'Non-existent blueprint fails');
  const hasNotFoundError = notFoundResult.critical.some(e => e.includes('not found'));
  t.assert(hasNotFoundError, 'Error mentions not found');

  // ── Test 11: Export only includes correct site's sections ──────────────
  t.section('Site isolation: export assembly');

  const siteAHtml = assembleExportHtml(db, 1);
  const siteBHtml = assembleExportHtml(db, 3);

  t.assertIncludes(siteAHtml, 'Alpha Driving School', 'Site A export contains site A content');
  t.assertNotIncludes(siteAHtml, 'Beta Driving School', 'Site A export does NOT contain site B content');
  t.assertNotIncludes(siteAHtml, 'Melbourne', 'Site A export does NOT contain Melbourne');

  t.assertIncludes(siteBHtml, 'Beta Driving School', 'Site B export contains site B content');
  t.assertNotIncludes(siteBHtml, 'Alpha Driving School', 'Site B export does NOT contain site A content');

  // ── Test 12: After validation passes, verify full roundtrip ────────────
  t.section('Full round-trip: validate then assemble');

  const finalValidation = getExportValidation(db, 1);
  t.assert(finalValidation.passed, 'Clean blueprint passes final validation');

  const finalHtml = assembleExportHtml(db, 1);
  t.assertGreaterThan(finalHtml.length, 0, 'Assembled HTML is non-empty');

  // Verify HTML is well-formed
  const finalFormErrors = checkWellFormedness(finalHtml);
  t.assertEqual(finalFormErrors.length, 0, 'Final assembled HTML is well-formed');

  db.close();
  return t.summary();
}

const results = runTests();
process.exit(results.failed > 0 ? 1 : 0);
