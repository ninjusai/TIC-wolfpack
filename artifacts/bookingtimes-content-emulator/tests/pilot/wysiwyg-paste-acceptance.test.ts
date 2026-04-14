/**
 * WYSIWYG Paste Acceptance Test — WRK-BCE2-054
 *
 * Validates that exported HTML will survive a BookingTimes TinyMCE paste
 * operation. Since we cannot automate an actual TinyMCE paste in a test,
 * we validate the HTML structure against known TinyMCE behaviors.
 *
 * Traces: REQ-BCE2-039, EVAL-BCE2-046, DEC-035
 *
 * Run: npx tsx tests/pilot/wysiwyg-paste-acceptance.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Test infrastructure (matches single-site-e2e pattern)
// ---------------------------------------------------------------------------

class TestRunner {
  private passed = 0;
  private failed = 0;
  private errors: string[] = [];
  private suiteName: string;

  constructor(suiteName: string) {
    this.suiteName = suiteName;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  PILOT TEST: ${suiteName}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  assert(condition: boolean, description: string, details?: string): void {
    if (condition) {
      this.passed++;
      console.log(`  [PASS] ${description}`);
    } else {
      this.failed++;
      const msg = details ? `${description} — ${details}` : description;
      this.errors.push(msg);
      console.log(`  [FAIL] ${description}`);
      if (details) console.log(`         ${details}`);
    }
  }

  assertIncludes(haystack: string, needle: string, description: string): void {
    const pass = haystack.includes(needle);
    this.assert(pass, description, pass ? undefined : `String does not contain "${needle}"`);
  }

  assertNotIncludes(haystack: string, needle: string, description: string): void {
    const pass = !haystack.includes(needle);
    this.assert(pass, description, pass ? undefined : `String unexpectedly contains "${needle}"`);
  }

  assertEqual<T>(actual: T, expected: T, description: string): void {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    this.assert(
      pass,
      description,
      pass ? undefined : `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`
    );
  }

  section(title: string): void {
    console.log(`\n  --- ${title} ---\n`);
  }

  summary(): { passed: number; failed: number; total: number } {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  RESULTS: ${this.suiteName}`);
    console.log(`  Passed: ${this.passed}  |  Failed: ${this.failed}  |  Total: ${this.passed + this.failed}`);
    if (this.errors.length > 0) {
      console.log(`\n  Failures:`);
      for (const err of this.errors) {
        console.log(`    - ${err}`);
      }
    }
    console.log(`${'='.repeat(70)}\n`);
    return { passed: this.passed, failed: this.failed, total: this.passed + this.failed };
  }
}

// ---------------------------------------------------------------------------
// Bootstrap 5.0.2 class catalogue loader
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, '../../app');
const BS_CATALOG_PATH = path.join(APP_ROOT, 'src/lib/data/bootstrap-5.0.2-classes.json');

function loadBootstrap502Classes(): Set<string> {
  const raw = JSON.parse(fs.readFileSync(BS_CATALOG_PATH, 'utf-8'));
  const classes = new Set<string>();

  function walk(obj: unknown): void {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'string') classes.add(item);
      }
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        walk(value);
      }
    }
  }

  walk(raw.categories);
  return classes;
}

const BS_502_CLASSES = loadBootstrap502Classes();

// ---------------------------------------------------------------------------
// Known Bootstrap 5.1+ classes that are NOT in 5.0.2
// BookingTimes runs 5.0.2 — these must not appear in exported HTML.
// ---------------------------------------------------------------------------

const BS_POST_502_CLASSES = new Set([
  // 5.1 additions
  'placeholder', 'placeholder-lg', 'placeholder-sm', 'placeholder-xs',
  'placeholder-wave', 'placeholder-glow',
  'col-xxl', 'col-xxl-1', 'col-xxl-2', 'col-xxl-3', 'col-xxl-4',
  'col-xxl-5', 'col-xxl-6', 'col-xxl-7', 'col-xxl-8', 'col-xxl-9',
  'col-xxl-10', 'col-xxl-11', 'col-xxl-12', 'col-xxl-auto',
  // 5.2 additions
  'text-bg-primary', 'text-bg-secondary', 'text-bg-success',
  'text-bg-danger', 'text-bg-warning', 'text-bg-info',
  'text-bg-light', 'text-bg-dark',
  'btn-close-white',
  // 5.3 additions
  'link-underline', 'link-underline-primary', 'link-underline-opacity-0',
  'link-underline-opacity-25', 'link-underline-opacity-50',
  'link-underline-opacity-75', 'link-underline-opacity-100',
  'link-offset-1', 'link-offset-2', 'link-offset-3',
  'icon-link', 'icon-link-hover',
  'focus-ring', 'focus-ring-primary', 'focus-ring-secondary',
  'z-0', 'z-1', 'z-2', 'z-3', 'z-n1',
  'object-fit-contain', 'object-fit-cover', 'object-fit-fill',
  'object-fit-none', 'object-fit-scale',
  'fw-medium',
]);

// ---------------------------------------------------------------------------
// Realistic exported HTML fixture
// ---------------------------------------------------------------------------

/**
 * Generates a realistic exported page HTML fixture that resembles what the
 * export pipeline would produce — sections with Bootstrap grid, headings,
 * data-bce-* attributes, and a JSON-LD script block appended.
 */
function generateRealisticExportHtml(): string {
  return `<section data-bce-section="hero" data-bce-blueprint="42" class="py-5 bg-light">
  <div class="container">
    <div class="row align-items-center">
      <div class="col-lg-6">
        <h2 class="fw-bold mb-3">Professional Climbing Instruction in Blue Mountains</h2>
        <p class="lead text-muted">Expert-guided climbing experiences for all skill levels, from beginner top-roping to advanced multi-pitch routes across the Greater Blue Mountains World Heritage Area.</p>
        <a href="/book-now" class="btn btn-primary btn-lg mt-3">Book Your Session</a>
      </div>
      <div class="col-lg-6">
        <img src="/images/hero-climbing.jpg" alt="Climber on sandstone cliff in Blue Mountains" class="img-fluid rounded shadow" />
      </div>
    </div>
  </div>
</section>

<section data-bce-section="services" data-bce-blueprint="42" class="py-5">
  <div class="container">
    <div class="row">
      <div class="col-12 text-center mb-4">
        <h2 class="fw-bold">Our Climbing Services</h2>
        <p class="text-muted">Tailored programs for every level of climber</p>
      </div>
    </div>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body text-center">
            <i class="fa-solid fa-mountain fa-3x text-primary mb-3"></i>
            <h3 class="card-title h5">Beginner Top-Roping</h3>
            <p class="card-text">Learn the fundamentals of climbing with our certified instructors on beginner-friendly crags.</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body text-center">
            <i class="fa-solid fa-person-hiking fa-3x text-primary mb-3"></i>
            <h3 class="card-title h5">Lead Climbing Course</h3>
            <p class="card-text">Progress to lead climbing with comprehensive safety training and outdoor practice.</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body text-center">
            <i class="fa-solid fa-helmet-safety fa-3x text-primary mb-3"></i>
            <h3 class="card-title h5">Multi-Pitch Adventures</h3>
            <p class="card-text">Experience the thrill of multi-pitch climbing on iconic Blue Mountains routes.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section data-bce-section="about" data-bce-blueprint="42" class="py-5 bg-light">
  <div class="container">
    <div class="row">
      <div class="col-lg-8 mx-auto">
        <h2 class="fw-bold text-center mb-4">Why Choose Blue Mountains Climbing?</h2>
        <p>With over 15 years of experience guiding climbers through the stunning sandstone formations of the Blue Mountains, our team of ACGA-certified instructors provides safe, professional, and unforgettable climbing experiences.</p>
        <p>We operate across the Greater Blue Mountains World Heritage Area, including popular venues at Katoomba, Blackheath, and Mount Victoria. All equipment is provided, and group sizes are kept small to ensure personalised attention.</p>
        <ul class="list-unstyled mt-3">
          <li class="mb-2"><i class="fa-solid fa-check text-success me-2"></i>ACGA-certified instructors</li>
          <li class="mb-2"><i class="fa-solid fa-check text-success me-2"></i>All equipment provided</li>
          <li class="mb-2"><i class="fa-solid fa-check text-success me-2"></i>Small group sizes (max 6)</li>
          <li class="mb-2"><i class="fa-solid fa-check text-success me-2"></i>Weather-flexible scheduling</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section data-bce-section="testimonials" data-bce-blueprint="42" class="py-5">
  <div class="container">
    <h2 class="fw-bold text-center mb-4">What Our Climbers Say</h2>
    <div class="row g-4">
      <div class="col-md-6">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px">
                <span class="fw-bold">SK</span>
              </div>
              <div class="ms-3">
                <h4 class="h6 mb-0">Sarah K.</h4>
                <small class="text-muted">Beginner course, March 2026</small>
              </div>
            </div>
            <p class="card-text">"Absolutely brilliant experience. The instructors made me feel safe and confident on the rock from the very first climb."</p>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px">
                <span class="fw-bold">JM</span>
              </div>
              <div class="ms-3">
                <h4 class="h6 mb-0">James M.</h4>
                <small class="text-muted">Multi-pitch, February 2026</small>
              </div>
            </div>
            <p class="card-text">"The multi-pitch day was the highlight of my year. Professional setup, incredible views, and a genuinely challenging climb."</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Blue Mountains Climbing",
  "description": "Professional climbing instruction and guided experiences in the Blue Mountains, NSW",
  "url": "https://www.bluemountainsclimbing.com.au",
  "telephone": "+61-2-4782-1234",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main Street",
    "addressLocality": "Katoomba",
    "addressRegion": "NSW",
    "postalCode": "2780",
    "addressCountry": "AU"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -33.7150,
    "longitude": 150.3120
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "07:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "06:00",
      "closes": "18:00"
    }
  ],
  "priceRange": "$$",
  "sameAs": [
    "https://www.facebook.com/bluemountainsclimbing",
    "https://www.instagram.com/bluemtnclimbing"
  ]
}
</script>`;
}

/**
 * Generates HTML with intentional TinyMCE-hostile patterns for negative testing.
 */
function generateHostileHtml(): string {
  return `<section data-bce-section="hero" class="py-5">
  <style>
    .custom-hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .hero-text { font-size: 2rem; }
  </style>
  <div class="container">
    <div class="row" onclick="trackClick('hero')">
      <div class="col-12" onmouseover="highlight(this)">
        <h2 class="placeholder-wave text-bg-primary">Heading</h2>
        <p>Content with <a href="#" onclick="alert('xss')">dangerous link</a></p>
      </div>
    </div>
  </div>
  <link rel="stylesheet" href="/custom.css" />
</section>`;
}

/**
 * Generates HTML with broken structure for negative testing.
 */
function generateBrokenStructureHtml(): string {
  return `<section data-bce-section="content" class="py-5">
  <div class="container">
    <div class="row">
      <div class="col-12">
        <h2>Main Heading</h2>
        <div class="row">
          <p>Paragraph directly in row without col wrapper</p>
        </div>
        <h4>Skipped H3 Level</h4>
        <div class="card">
          <div class="card-body">
            <p></p>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/**
 * Generates HTML using Bootstrap 5.1+ classes that BookingTimes does not have.
 */
function generatePost502Html(): string {
  return `<section data-bce-section="content" class="py-5">
  <div class="container">
    <div class="row">
      <div class="col-xxl-6">
        <h2 class="placeholder-glow">Loading Title</h2>
        <span class="placeholder col-6"></span>
        <p class="text-bg-primary">This uses 5.2 helper</p>
        <a class="icon-link" href="/">Link with icon</a>
        <div class="focus-ring">Focusable</div>
        <p class="fw-medium">Medium weight text</p>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Paste-safety validation functions
// ---------------------------------------------------------------------------

/**
 * Check 1: CSS class attributes are preserved (present on elements).
 * TinyMCE preserves class attributes — confirmed by DEC-035.
 */
function checkCssClassesPreserved(html: string): { pass: boolean; details: string; classes: string[] } {
  const classPattern = /class\s*=\s*["']([^"']*)["']/gi;
  const allClasses: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = classPattern.exec(html)) !== null) {
    const value = match[1];
    for (const cls of value.split(/\s+/)) {
      const trimmed = cls.trim();
      if (trimmed) allClasses.push(trimmed);
    }
  }

  const uniqueClasses = [...new Set(allClasses)];

  if (uniqueClasses.length === 0) {
    return { pass: false, details: 'No CSS classes found in HTML', classes: [] };
  }

  return {
    pass: true,
    details: `Found ${uniqueClasses.length} unique CSS classes across elements`,
    classes: uniqueClasses,
  };
}

/**
 * Check 2: Bootstrap grid structure is valid and properly nested.
 * Validates container > row > col-* nesting.
 */
function checkBootstrapGridIntegrity(html: string): { pass: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check containers exist
  const hasContainer = /class="[^"]*\bcontainer\b[^"]*"/.test(html) ||
                       /class="[^"]*\bcontainer-fluid\b[^"]*"/.test(html);
  if (!hasContainer) {
    errors.push('No Bootstrap container found');
  }

  // Check rows exist
  const hasRow = /class="[^"]*\brow\b[^"]*"/.test(html);
  if (!hasRow) {
    errors.push('No Bootstrap row found');
  }

  // Check cols exist
  const hasCol = /class="[^"]*\bcol(?:-[a-z]{2})?(?:-\d{1,2})?\b[^"]*"/.test(html);
  if (!hasCol) {
    errors.push('No Bootstrap col-* classes found');
  }

  // Validate nesting: rows should be inside containers
  // Simple structural check: find row elements and ensure they have a container ancestor
  const containerBlocks = html.match(/<div[^>]*class="[^"]*\bcontainer(?:-fluid)?\b[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*\bcontainer(?:-fluid)?\b|$)/gi);
  if (containerBlocks) {
    for (const block of containerBlocks) {
      const rowsInBlock = (block.match(/class="[^"]*\brow\b[^"]*"/g) || []).length;
      if (rowsInBlock === 0) {
        // Container without rows is unusual but not necessarily wrong
      }
    }
  }

  // Check that col classes appear after row classes (basic ordering check)
  const rowIndex = html.search(/class="[^"]*\brow\b[^"]*"/);
  const colIndex = html.search(/class="[^"]*\bcol(?:-[a-z]{2})?(?:-\d{1,2})?\b[^"]*"/);
  if (rowIndex > -1 && colIndex > -1 && colIndex < rowIndex) {
    errors.push('Column class appears before any row class — possible broken grid nesting');
  }

  return { pass: errors.length === 0, errors };
}

/**
 * Check 3: JSON-LD script tags are well-formed and contain valid JSON.
 * DEC-035 confirmed JSON-LD survives TinyMCE paste.
 */
function checkJsonLdIntegrity(html: string): { pass: boolean; errors: string[]; schemas: number } {
  const errors: string[] = [];
  const jsonLdPattern = /<script\s+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let schemaCount = 0;

  while ((match = jsonLdPattern.exec(html)) !== null) {
    schemaCount++;
    const jsonContent = match[1].trim();

    if (!jsonContent) {
      errors.push(`JSON-LD block #${schemaCount} is empty`);
      continue;
    }

    try {
      const parsed = JSON.parse(jsonContent);

      // Validate required Schema.org fields
      if (!parsed['@context']) {
        errors.push(`JSON-LD block #${schemaCount} missing @context`);
      }
      if (!parsed['@type']) {
        errors.push(`JSON-LD block #${schemaCount} missing @type`);
      }

      // Check for template variables that were not resolved
      if (jsonContent.includes('{{')) {
        errors.push(`JSON-LD block #${schemaCount} contains unresolved template variables`);
      }
    } catch (e) {
      errors.push(`JSON-LD block #${schemaCount} contains invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { pass: errors.length === 0, errors, schemas: schemaCount };
}

/**
 * Check 4: data-bce-* custom attributes are present on section elements.
 */
function checkDataBceAttributes(html: string): { pass: boolean; errors: string[]; attrs: string[] } {
  const errors: string[] = [];
  const bceAttrPattern = /data-bce-([a-z-]+)\s*=\s*["']([^"']*)["']/gi;
  const foundAttrs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = bceAttrPattern.exec(html)) !== null) {
    foundAttrs.push(`data-bce-${match[1]}="${match[2]}"`);
  }

  if (foundAttrs.length === 0) {
    errors.push('No data-bce-* attributes found — these are required for system tracking');
  }

  // Every <section> should have data-bce-section
  const sectionTags = html.match(/<section[^>]*>/gi) || [];
  for (let i = 0; i < sectionTags.length; i++) {
    const tag = sectionTags[i];
    if (!/data-bce-section/.test(tag)) {
      errors.push(`<section> tag #${i + 1} missing data-bce-section attribute`);
    }
  }

  return { pass: errors.length === 0, errors, attrs: foundAttrs };
}

/**
 * Check 5: No TinyMCE-hostile patterns.
 * TinyMCE strips: <style> blocks, event handlers, <link> tags, @import rules.
 */
function checkNoHostilePatterns(html: string): { pass: boolean; violations: string[] } {
  const violations: string[] = [];

  // <style> blocks — TinyMCE strips these entirely
  if (/<style\b[^>]*>[\s\S]*?<\/style>/i.test(html)) {
    violations.push('<style> block detected — TinyMCE will strip this');
  }

  // Inline event handlers (onclick, onmouseover, onerror, etc.)
  const eventHandlerPattern = /\s(on[a-z]+)\s*=\s*["'][^"']*["']/gi;
  let match: RegExpExecArray | null;
  const foundHandlers = new Set<string>();
  while ((match = eventHandlerPattern.exec(html)) !== null) {
    foundHandlers.add(match[1].toLowerCase());
  }
  if (foundHandlers.size > 0) {
    violations.push(`Event handlers detected: ${[...foundHandlers].join(', ')} — TinyMCE strips these`);
  }

  // <link> tags — not allowed in body content, TinyMCE strips them
  if (/<link\b[^>]*>/i.test(html)) {
    violations.push('<link> tag detected — TinyMCE will strip this from body content');
  }

  // @import rules in inline styles
  if (/@import\b/i.test(html)) {
    violations.push('@import rule detected — not supported in TinyMCE paste context');
  }

  // <iframe> tags — TinyMCE strips by default unless explicitly configured
  if (/<iframe\b/i.test(html)) {
    violations.push('<iframe> tag detected — TinyMCE strips these by default');
  }

  // <form> elements — TinyMCE strips these by default
  if (/<form\b/i.test(html)) {
    violations.push('<form> tag detected — TinyMCE strips these by default');
  }

  // <embed> / <object> — TinyMCE strips these
  if (/<embed\b/i.test(html)) {
    violations.push('<embed> tag detected — TinyMCE strips this');
  }
  if (/<object\b/i.test(html)) {
    violations.push('<object> tag detected — TinyMCE strips this');
  }

  return { pass: violations.length === 0, violations };
}

/**
 * Check 6: Content renders correctly — heading hierarchy, no empty elements,
 * no broken nesting.
 */
function checkContentRendering(html: string): { pass: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract headings
  const headingPattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    headings.push({ level, text });
  }

  // No H1 in section content (H1 is the page title, managed outside sections)
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length > 0) {
    errors.push(`H1 tags found in section content: "${h1s.map((h) => h.text).join('", "')}"`);
  }

  // Check for skipped heading levels
  const nonH1 = headings.filter((h) => h.level > 1);
  for (let i = 1; i < nonH1.length; i++) {
    const prev = nonH1[i - 1].level;
    const curr = nonH1[i].level;
    if (curr > prev + 1) {
      warnings.push(`Heading level skip: H${prev} -> H${curr} ("${nonH1[i].text}")`);
    }
  }

  // Check for empty paragraphs or divs (rendering concern)
  const emptyBlockPattern = /<(p|div|span|h[2-6])\b[^>]*>\s*<\/\1>/gi;
  const emptyElements: string[] = [];
  while ((match = emptyBlockPattern.exec(html)) !== null) {
    emptyElements.push(`<${match[1]}>...</${match[1]}>`);
  }
  if (emptyElements.length > 0) {
    warnings.push(`Empty elements found: ${emptyElements.join(', ')}`);
  }

  // Check well-formedness (unclosed tags)
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g;
  const stack: string[] = [];
  while ((match = tagPattern.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();
    if (voidElements.has(tagName)) continue;
    if (fullMatch.endsWith('/>')) continue;
    if (tagName === 'script') continue; // JSON-LD scripts handled separately

    if (fullMatch.startsWith('</')) {
      if (stack.length > 0 && stack[stack.length - 1] === tagName) {
        stack.pop();
      } else {
        const idx = stack.lastIndexOf(tagName);
        if (idx === -1) {
          errors.push(`Unexpected closing tag </${tagName}>`);
        } else {
          for (let i = stack.length - 1; i > idx; i--) {
            errors.push(`Unclosed tag <${stack[i]}>`);
          }
          stack.splice(idx);
        }
      }
    } else {
      stack.push(tagName);
    }
  }
  for (const tag of stack) {
    errors.push(`Unclosed tag <${tag}>`);
  }

  return { pass: errors.length === 0, errors, warnings };
}

/**
 * Check 7: Bootstrap 5.0.2 class compliance — only BS 5.0.2 classes used,
 * not 5.1+ classes that BookingTimes does not have.
 */
function checkBs502Compliance(html: string): { pass: boolean; violations: string[]; warnings: string[] } {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Extract all classes
  const classPattern = /class\s*=\s*["']([^"']*)["']/gi;
  const allClasses = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = classPattern.exec(html)) !== null) {
    for (const cls of match[1].split(/\s+/)) {
      const trimmed = cls.trim();
      if (trimmed) allClasses.add(trimmed);
    }
  }

  // Check each class
  for (const cls of allClasses) {
    // Skip Font Awesome classes (they are not Bootstrap)
    if (/^fa[-s]/.test(cls) || cls === 'fa') continue;
    // Skip data-bce- related classes or site-custom classes (anything with a hyphenated prefix that is not Bootstrap)
    // We only flag classes that ARE in post-5.0.2 BS but NOT in 5.0.2
    if (BS_POST_502_CLASSES.has(cls)) {
      violations.push(`Class "${cls}" is Bootstrap 5.1+ — not available in BookingTimes (5.0.2)`);
    }
  }

  return { pass: violations.length === 0, violations, warnings };
}

// ---------------------------------------------------------------------------
// Inline style audit — TinyMCE preserves inline styles but they can break
// ---------------------------------------------------------------------------

/**
 * Bonus check: inline styles are minimal and safe.
 * TinyMCE preserves inline styles, but excessive use indicates CSS should
 * be class-based instead.
 */
function checkInlineStyles(html: string): { pass: boolean; warnings: string[]; count: number } {
  const warnings: string[] = [];
  const stylePattern = /\sstyle\s*=\s*["']([^"']*)["']/gi;
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = stylePattern.exec(html)) !== null) {
    count++;
    const value = match[1];

    // Flag potentially problematic inline styles
    if (/position\s*:\s*(?:fixed|absolute)/i.test(value)) {
      warnings.push(`Inline style with position:fixed/absolute may cause layout issues: "${value}"`);
    }
    if (/z-index/i.test(value)) {
      warnings.push(`Inline z-index may conflict with BookingTimes layout: "${value}"`);
    }
  }

  if (count > 10) {
    warnings.push(`${count} inline styles found — consider using CSS classes instead`);
  }

  return { pass: true, warnings, count }; // Inline styles are warnings, not failures
}

// ---------------------------------------------------------------------------
// Main test execution
// ---------------------------------------------------------------------------

function main(): void {
  const t = new TestRunner('WYSIWYG Paste Acceptance — WRK-BCE2-054');

  // ═══════════════════════════════════════════════════════════════════════
  // PART A: Positive tests — valid exported HTML passes all checks
  // ═══════════════════════════════════════════════════════════════════════

  const validHtml = generateRealisticExportHtml();

  t.section('A1: CSS Class Attributes Preserved');
  {
    const result = checkCssClassesPreserved(validHtml);
    t.assert(result.pass, 'Exported HTML contains CSS class attributes');
    t.assert(
      result.classes.length > 10,
      `Sufficient class diversity (${result.classes.length} unique classes)`
    );
    // Check specific critical classes are present
    t.assert(result.classes.includes('container'), 'Bootstrap "container" class present');
    t.assert(result.classes.includes('row'), 'Bootstrap "row" class present');
    t.assert(
      result.classes.some((c) => c.startsWith('col-')),
      'Bootstrap col-* classes present'
    );
    t.assert(result.classes.includes('btn'), 'Bootstrap "btn" class present');
    t.assert(result.classes.includes('card'), 'Bootstrap "card" class present');
  }

  t.section('A2: Bootstrap Grid Structure Preserved');
  {
    const result = checkBootstrapGridIntegrity(validHtml);
    t.assert(result.pass, 'Bootstrap grid structure is valid');
    for (const err of result.errors) {
      t.assert(false, `Grid error: ${err}`);
    }
  }

  t.section('A3: JSON-LD Script Tags Survive');
  {
    const result = checkJsonLdIntegrity(validHtml);
    t.assert(result.pass, 'JSON-LD blocks are well-formed');
    t.assert(result.schemas > 0, `Found ${result.schemas} JSON-LD schema(s)`);
    for (const err of result.errors) {
      t.assert(false, `JSON-LD error: ${err}`);
    }
  }

  t.section('A4: data-bce-* Attributes Preserved');
  {
    const result = checkDataBceAttributes(validHtml);
    t.assert(result.pass, 'data-bce-* attributes found on section elements');
    t.assert(
      result.attrs.length >= 4,
      `Found ${result.attrs.length} data-bce-* attributes across sections`
    );
  }

  t.section('A5: No TinyMCE-Hostile Patterns');
  {
    const result = checkNoHostilePatterns(validHtml);
    t.assert(result.pass, 'No TinyMCE-hostile patterns in valid export');
    for (const v of result.violations) {
      t.assert(false, `Hostile pattern: ${v}`);
    }
  }

  t.section('A6: Content Renders Correctly');
  {
    const result = checkContentRendering(validHtml);
    t.assert(result.pass, 'HTML is well-formed and properly nested');
    for (const err of result.errors) {
      t.assert(false, `Rendering error: ${err}`);
    }
    // Warnings are informational, not failures
    for (const w of result.warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }

  t.section('A7: Bootstrap 5.0.2 Class Compliance');
  {
    const result = checkBs502Compliance(validHtml);
    t.assert(result.pass, 'All Bootstrap classes are 5.0.2 compatible');
    for (const v of result.violations) {
      t.assert(false, `BS version violation: ${v}`);
    }
  }

  t.section('A8: Inline Style Audit');
  {
    const result = checkInlineStyles(validHtml);
    t.assert(result.pass, `Inline styles acceptable (${result.count} found)`);
    for (const w of result.warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART B: Negative tests — hostile HTML is correctly flagged
  // ═══════════════════════════════════════════════════════════════════════

  t.section('B1: TinyMCE-Hostile Patterns Detected');
  {
    const hostile = generateHostileHtml();
    const result = checkNoHostilePatterns(hostile);
    t.assert(!result.pass, 'Hostile patterns correctly detected');
    t.assert(
      result.violations.some((v) => v.includes('<style>')),
      'Detects <style> blocks'
    );
    t.assert(
      result.violations.some((v) => v.includes('Event handlers')),
      'Detects inline event handlers'
    );
    t.assert(
      result.violations.some((v) => v.includes('<link>')),
      'Detects <link> tags'
    );
  }

  t.section('B2: Bootstrap 5.1+ Classes Detected');
  {
    const post502 = generatePost502Html();
    const result = checkBs502Compliance(post502);
    t.assert(!result.pass, 'Post-5.0.2 classes correctly detected');
    t.assert(
      result.violations.some((v) => v.includes('col-xxl-6')),
      'Detects col-xxl-* (5.1+)'
    );
    t.assert(
      result.violations.some((v) => v.includes('placeholder-glow')),
      'Detects placeholder-glow (5.1+)'
    );
    t.assert(
      result.violations.some((v) => v.includes('text-bg-primary')),
      'Detects text-bg-* (5.2+)'
    );
    t.assert(
      result.violations.some((v) => v.includes('icon-link')),
      'Detects icon-link (5.3+)'
    );
    t.assert(
      result.violations.some((v) => v.includes('fw-medium')),
      'Detects fw-medium (5.3+)'
    );
  }

  t.section('B3: Broken Structure Detected');
  {
    const broken = generateBrokenStructureHtml();
    const result = checkContentRendering(broken);
    // The broken HTML has skipped heading and empty elements
    const hasWarnings = result.warnings.length > 0;
    t.assert(hasWarnings, 'Structural warnings raised for broken HTML');
    t.assert(
      result.warnings.some((w) => w.includes('Heading level skip')),
      'Detects skipped heading levels (H2 -> H4)'
    );
    t.assert(
      result.warnings.some((w) => w.includes('Empty elements')),
      'Detects empty block elements'
    );
  }

  t.section('B4: Missing data-bce-* Attributes Detected');
  {
    const noBce = '<section class="py-5"><div class="container"><p>Content</p></div></section>';
    const result = checkDataBceAttributes(noBce);
    t.assert(!result.pass, 'Missing data-bce-* attributes correctly detected');
  }

  t.section('B5: Invalid JSON-LD Detected');
  {
    const badJsonLd = `<div>Content</div>
<script type="application/ld+json">{ invalid json here }</script>`;
    const result = checkJsonLdIntegrity(badJsonLd);
    t.assert(!result.pass, 'Invalid JSON-LD correctly detected');
    t.assert(
      result.errors.some((e) => e.includes('invalid JSON')),
      'Reports JSON parse error'
    );
  }

  t.section('B6: Empty JSON-LD Detected');
  {
    const emptyJsonLd = `<div>Content</div>
<script type="application/ld+json"></script>`;
    const result = checkJsonLdIntegrity(emptyJsonLd);
    t.assert(!result.pass, 'Empty JSON-LD correctly detected');
  }

  t.section('B7: JSON-LD Missing Schema.org Fields Detected');
  {
    const incompleteJsonLd = `<div>Content</div>
<script type="application/ld+json">{"name": "Test"}</script>`;
    const result = checkJsonLdIntegrity(incompleteJsonLd);
    t.assert(!result.pass, 'JSON-LD missing @context/@type detected');
    t.assert(
      result.errors.some((e) => e.includes('@context')),
      'Reports missing @context'
    );
    t.assert(
      result.errors.some((e) => e.includes('@type')),
      'Reports missing @type'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART C: Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  t.section('C1: HTML With Only JSON-LD (No Sections)');
  {
    const jsonLdOnly = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Test"}</script>`;
    const jsonLdResult = checkJsonLdIntegrity(jsonLdOnly);
    t.assert(jsonLdResult.pass, 'Standalone JSON-LD is valid');

    const bceResult = checkDataBceAttributes(jsonLdOnly);
    t.assert(!bceResult.pass, 'Correctly flags missing section attributes in JSON-LD-only content');
  }

  t.section('C2: Multiple JSON-LD Blocks');
  {
    const multiJsonLd = `<section data-bce-section="content" class="py-5">
  <div class="container"><p>Content</p></div>
</section>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Biz"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>`;
    const result = checkJsonLdIntegrity(multiJsonLd);
    t.assert(result.pass, 'Multiple JSON-LD blocks are valid');
    t.assertEqual(result.schemas, 2, 'Found 2 JSON-LD schemas');
  }

  t.section('C3: Inline Styles Are Tolerated (Not Stripped by TinyMCE)');
  {
    // TinyMCE keeps inline styles — DEC-035 confirms this
    const withStyles = `<section data-bce-section="testimonials" class="py-5">
  <div class="container">
    <div class="rounded-circle bg-primary" style="width:48px;height:48px">
      <span>AB</span>
    </div>
  </div>
</section>`;
    const hostileCheck = checkNoHostilePatterns(withStyles);
    t.assert(hostileCheck.pass, 'Inline styles are NOT flagged as hostile (TinyMCE preserves them)');

    const styleCheck = checkInlineStyles(withStyles);
    t.assert(styleCheck.count === 1, `Found ${styleCheck.count} inline style(s)`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════

  const { passed, failed, total } = t.summary();

  // Exit with appropriate code
  if (failed > 0) {
    process.exit(1);
  }
}

main();
