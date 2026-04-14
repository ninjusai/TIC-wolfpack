/**
 * Interactivity Engine — WRK-BCE2-038
 *
 * Three-tier JavaScript interactivity system for generated content:
 *   Tier 1: CSS-only (details/summary, :target tabs, scroll-snap) — guaranteed
 *   Tier 2: Head JS injection via BookingTimes "Analytics & Tracking" field
 *   Tier 3: Inline JS (IIFE-scoped) — needs manual paste-survival test
 *
 * All Tier 2/3 elements include a Tier 1 CSS-only fallback.
 * Generated JS uses IIFE scope, jQuery + Bootstrap 5.0.2 only.
 * All interactive elements are keyboard-navigable with ARIA attributes.
 */

import db from '$lib/db';

// ── Types ───────────────────────────────────────────────────────────────────

export interface InteractiveElement {
  tier: 1 | 2 | 3;
  type: string;
  htmlSnippet: string;
  headJs?: string;
  cssClasses: string[];
  fallbackHtml: string;
  ariaAttributes: Record<string, string>;
}

interface InteractiveTypeInfo {
  type: string;
  tier: number;
  description: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface TabItem {
  id: string;
  label: string;
  content: string;
}

interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
}

interface DistanceCalcContent {
  suburbs: Array<{ name: string; distanceKm: number }>;
  businessName: string;
  unit?: string;
}

// ── Interactive Type Registry ───────────────────────────────────────────────

const INTERACTIVE_TYPES: InteractiveTypeInfo[] = [
  {
    type: 'faq-accordion',
    tier: 2,
    description: 'FAQ accordion with Tier 1 details/summary fallback and Tier 2 Bootstrap accordion enhancement',
  },
  {
    type: 'service-tabs',
    tier: 2,
    description: 'Service tabs with Tier 1 :target-based fallback and Tier 2 jQuery tab switching',
  },
  {
    type: 'distance-calculator',
    tier: 2,
    description: 'Distance/suburb calculator using jQuery (Tier 2 only, no Tier 1 fallback beyond static table)',
  },
  {
    type: 'testimonial-carousel',
    tier: 2,
    description: 'Testimonial carousel with Tier 1 CSS scroll-snap fallback and Tier 2 Bootstrap carousel',
  },
];

// ── Generators ──────────────────────────────────────────────────────────────

function generateFaqAccordion(items: FaqItem[]): InteractiveElement {
  const accordionId = `bce-faq-${Date.now()}`;

  // Tier 1: CSS-only using <details>/<summary>
  const fallbackHtml = `<div class="bce-interactive-faq" data-bce-accordion>
${items
  .map(
    (item, i) => `  <details class="bce-interactive-faq-item"${i === 0 ? ' open' : ''}>
    <summary class="bce-interactive-faq-question">${escapeHtml(item.question)}</summary>
    <div class="bce-interactive-faq-answer">
      <p>${escapeHtml(item.answer)}</p>
    </div>
  </details>`
  )
  .join('\n')}
</div>`;

  // Tier 2: Bootstrap 5.0.2 accordion
  const htmlSnippet = `<div class="accordion bce-interactive-faq" id="${accordionId}" data-bce-accordion>
${items
  .map(
    (item, i) => `  <div class="accordion-item">
    <h3 class="accordion-header" id="${accordionId}-h${i}">
      <button class="accordion-button${i > 0 ? ' collapsed' : ''}" type="button"
        data-bs-toggle="collapse" data-bs-target="#${accordionId}-c${i}"
        aria-expanded="${i === 0 ? 'true' : 'false'}" aria-controls="${accordionId}-c${i}">
        ${escapeHtml(item.question)}
      </button>
    </h3>
    <div id="${accordionId}-c${i}" class="accordion-collapse collapse${i === 0 ? ' show' : ''}"
      aria-labelledby="${accordionId}-h${i}" data-bs-parent="#${accordionId}">
      <div class="accordion-body">
        <p>${escapeHtml(item.answer)}</p>
      </div>
    </div>
  </div>`
  )
  .join('\n')}
</div>`;

  return {
    tier: 2,
    type: 'faq-accordion',
    htmlSnippet,
    headJs: generateAccordionHeadJs(),
    cssClasses: ['accordion', 'accordion-item', 'accordion-header', 'accordion-button', 'accordion-collapse', 'accordion-body', 'bce-interactive-faq', 'bce-interactive-faq-item', 'bce-interactive-faq-question', 'bce-interactive-faq-answer'],
    fallbackHtml,
    ariaAttributes: {
      'aria-expanded': 'Indicates if accordion item is open',
      'aria-controls': 'Links button to its collapsible panel',
      'aria-labelledby': 'Links panel back to its header',
    },
  };
}

function generateServiceTabs(tabs: TabItem[]): InteractiveElement {
  const tabsId = `bce-tabs-${Date.now()}`;

  // Tier 1: CSS-only using :target
  const fallbackHtml = `<div class="bce-interactive-tabs" data-bce-tabs>
  <nav class="bce-interactive-tabs-nav" role="tablist" aria-label="Service tabs">
${tabs.map((tab) => `    <a href="#${tab.id}" class="bce-interactive-tabs-link" role="tab">${escapeHtml(tab.label)}</a>`).join('\n')}
  </nav>
${tabs
  .map(
    (tab, i) => `  <div id="${tab.id}" class="bce-interactive-tabs-panel${i === 0 ? ' bce-interactive-tabs-panel--default' : ''}" role="tabpanel">
    ${tab.content}
  </div>`
  )
  .join('\n')}
</div>
<style>
  .bce-interactive-tabs-panel { display: none; }
  .bce-interactive-tabs-panel--default { display: block; }
  .bce-interactive-tabs-panel:target { display: block; }
  .bce-interactive-tabs-panel:target ~ .bce-interactive-tabs-panel--default { display: none; }
</style>`;

  // Tier 2: jQuery-enhanced tabs
  const htmlSnippet = `<div class="bce-interactive-tabs" id="${tabsId}" data-bce-tabs>
  <ul class="nav nav-tabs" role="tablist">
${tabs
  .map(
    (tab, i) => `    <li class="nav-item" role="presentation">
      <button class="nav-link${i === 0 ? ' active' : ''}" id="${tab.id}-tab" data-bs-toggle="tab"
        data-bs-target="#${tab.id}-pane" type="button" role="tab"
        aria-controls="${tab.id}-pane" aria-selected="${i === 0 ? 'true' : 'false'}">
        ${escapeHtml(tab.label)}
      </button>
    </li>`
  )
  .join('\n')}
  </ul>
  <div class="tab-content">
${tabs
  .map(
    (tab, i) => `    <div class="tab-pane fade${i === 0 ? ' show active' : ''}" id="${tab.id}-pane"
      role="tabpanel" aria-labelledby="${tab.id}-tab" tabindex="0">
      ${tab.content}
    </div>`
  )
  .join('\n')}
  </div>
</div>`;

  return {
    tier: 2,
    type: 'service-tabs',
    htmlSnippet,
    headJs: generateTabsHeadJs(),
    cssClasses: ['nav', 'nav-tabs', 'nav-item', 'nav-link', 'tab-content', 'tab-pane', 'bce-interactive-tabs', 'bce-interactive-tabs-nav', 'bce-interactive-tabs-link', 'bce-interactive-tabs-panel'],
    fallbackHtml,
    ariaAttributes: {
      'role': 'tablist / tab / tabpanel',
      'aria-selected': 'Indicates currently active tab',
      'aria-controls': 'Links tab to its panel',
      'aria-labelledby': 'Links panel back to its tab',
    },
  };
}

function generateDistanceCalculator(content: DistanceCalcContent): InteractiveElement {
  const calcId = `bce-calc-${Date.now()}`;
  const unit = content.unit || 'km';

  // Tier 1 fallback: static table of distances
  const fallbackHtml = `<div class="bce-interactive-calculator" data-bce-calculator>
  <h4>Distance from ${escapeHtml(content.businessName)}</h4>
  <table class="table bce-interactive-calculator-table">
    <thead>
      <tr><th>Suburb</th><th>Distance (${escapeHtml(unit)})</th></tr>
    </thead>
    <tbody>
${content.suburbs.map((s) => `      <tr><td>${escapeHtml(s.name)}</td><td>${s.distanceKm}</td></tr>`).join('\n')}
    </tbody>
  </table>
</div>`;

  // Tier 2: jQuery-based interactive calculator
  const suburbDataJson = JSON.stringify(content.suburbs.map((s) => ({ n: s.name, d: s.distanceKm })));

  const htmlSnippet = `<div class="bce-interactive-calculator" id="${calcId}" data-bce-calculator>
  <h4>Distance from ${escapeHtml(content.businessName)}</h4>
  <div class="input-group mb-3">
    <input type="text" class="form-control bce-interactive-calculator-input"
      placeholder="Type your suburb..." aria-label="Suburb name"
      data-bce-calculator-input list="${calcId}-suburbs" autocomplete="off">
    <datalist id="${calcId}-suburbs">
${content.suburbs.map((s) => `      <option value="${escapeHtml(s.name)}">`).join('\n')}
    </datalist>
  </div>
  <div class="bce-interactive-calculator-result" data-bce-calculator-result aria-live="polite" aria-atomic="true"></div>
  <noscript>
    <table class="table bce-interactive-calculator-table">
      <thead><tr><th>Suburb</th><th>Distance (${escapeHtml(unit)})</th></tr></thead>
      <tbody>
${content.suburbs.map((s) => `        <tr><td>${escapeHtml(s.name)}</td><td>${s.distanceKm}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </noscript>
  <script type="application/json" data-bce-calculator-data>${suburbDataJson}</script>
</div>`;

  const headJs = generateCalculatorHeadJs(unit);

  return {
    tier: 2,
    type: 'distance-calculator',
    htmlSnippet,
    headJs,
    cssClasses: ['input-group', 'form-control', 'table', 'bce-interactive-calculator', 'bce-interactive-calculator-input', 'bce-interactive-calculator-result', 'bce-interactive-calculator-table'],
    fallbackHtml,
    ariaAttributes: {
      'aria-label': 'Suburb name input',
      'aria-live': 'polite — announces result changes to screen readers',
      'aria-atomic': 'true — reads the full result region on change',
    },
  };
}

function generateTestimonialCarousel(testimonials: TestimonialItem[]): InteractiveElement {
  const carouselId = `bce-carousel-${Date.now()}`;

  // Tier 1: CSS scroll-snap
  const fallbackHtml = `<div class="bce-interactive-carousel" data-bce-carousel
  style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:1rem;padding:1rem 0;">
${testimonials
  .map(
    (t) => `  <figure class="bce-interactive-carousel-slide" style="min-width:80%;scroll-snap-align:start;flex-shrink:0;">
    <blockquote><p>${escapeHtml(t.quote)}</p></blockquote>
    <figcaption>— ${escapeHtml(t.author)}${t.role ? `, ${escapeHtml(t.role)}` : ''}</figcaption>
  </figure>`
  )
  .join('\n')}
</div>`;

  // Tier 2: Bootstrap 5.0.2 carousel
  const htmlSnippet = `<div id="${carouselId}" class="carousel slide bce-interactive-carousel" data-bs-ride="carousel" data-bce-carousel>
  <div class="carousel-indicators">
${testimonials.map((_, i) => `    <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${i}"${i === 0 ? ' class="active" aria-current="true"' : ''} aria-label="Testimonial ${i + 1}"></button>`).join('\n')}
  </div>
  <div class="carousel-inner">
${testimonials
  .map(
    (t, i) => `    <div class="carousel-item${i === 0 ? ' active' : ''}">
      <figure class="text-center p-4">
        <blockquote class="blockquote"><p>${escapeHtml(t.quote)}</p></blockquote>
        <figcaption class="blockquote-footer">${escapeHtml(t.author)}${t.role ? `, <cite>${escapeHtml(t.role)}</cite>` : ''}</figcaption>
      </figure>
    </div>`
  )
  .join('\n')}
  </div>
  <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Previous</span>
  </button>
  <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
    <span class="carousel-control-next-icon" aria-hidden="true"></span>
    <span class="visually-hidden">Next</span>
  </button>
</div>`;

  return {
    tier: 2,
    type: 'testimonial-carousel',
    htmlSnippet,
    headJs: generateCarouselHeadJs(),
    cssClasses: ['carousel', 'carousel-inner', 'carousel-item', 'carousel-indicators', 'carousel-control-prev', 'carousel-control-next', 'bce-interactive-carousel', 'bce-interactive-carousel-slide'],
    fallbackHtml,
    ariaAttributes: {
      'aria-label': 'Testimonial slide indicator',
      'aria-current': 'true — marks active indicator',
      'aria-hidden': 'true — hides decorative icon from screen readers',
    },
  };
}

// ── Head JS Generators ──────────────────────────────────────────────────────

function generateAccordionHeadJs(): string {
  return `;(function($) {
  'use strict';
  $(document).ready(function() {
    // BCE Accordion Enhancement
    $('[data-bce-accordion]').each(function() {
      var $acc = $(this);
      // Hide <details> fallback if BS accordion is present
      $acc.find('details.bce-interactive-faq-item').hide();
      // Ensure BS accordion components are initialized
      $acc.find('.accordion-collapse').each(function() {
        if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
          new bootstrap.Collapse(this, { toggle: false });
        }
      });
    });
  });
})(jQuery);`;
}

function generateTabsHeadJs(): string {
  return `;(function($) {
  'use strict';
  $(document).ready(function() {
    // BCE Tab Enhancement
    $('[data-bce-tabs]').each(function() {
      var $tabs = $(this);
      // Hide :target fallback styles
      $tabs.find('style').remove();
      $tabs.find('.bce-interactive-tabs-nav').hide();
      $tabs.find('.bce-interactive-tabs-panel').hide();
      // Initialize BS tabs
      $tabs.find('[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        $(e.target).attr('aria-selected', 'true');
        $(e.relatedTarget).attr('aria-selected', 'false');
      });
    });
  });
})(jQuery);`;
}

function generateCalculatorHeadJs(unit: string): string {
  return `;(function($) {
  'use strict';
  $(document).ready(function() {
    // BCE Distance Calculator
    $('[data-bce-calculator]').each(function() {
      var $calc = $(this);
      var data = JSON.parse($calc.find('[data-bce-calculator-data]').text());
      var $input = $calc.find('[data-bce-calculator-input]');
      var $result = $calc.find('[data-bce-calculator-result]');

      $input.on('input', function() {
        var val = $(this).val().toLowerCase();
        if (!val) { $result.html(''); return; }
        var matches = data.filter(function(s) {
          return s.n.toLowerCase().indexOf(val) !== -1;
        });
        if (matches.length === 1) {
          $result.html('<p class="text-success fw-bold">' + matches[0].n + ' is ' + matches[0].d + ' ${unit} away.</p>');
        } else if (matches.length > 1 && matches.length <= 5) {
          var html = '<ul class="list-unstyled">';
          matches.forEach(function(m) { html += '<li>' + m.n + ': ' + m.d + ' ${unit}</li>'; });
          html += '</ul>';
          $result.html(html);
        } else if (matches.length > 5) {
          $result.html('<p class="text-muted">Keep typing to narrow results...</p>');
        } else {
          $result.html('<p class="text-muted">No matching suburb found.</p>');
        }
      });
    });
  });
})(jQuery);`;
}

function generateCarouselHeadJs(): string {
  return `;(function($) {
  'use strict';
  $(document).ready(function() {
    // BCE Carousel Enhancement
    $('[data-bce-carousel]').each(function() {
      var $carousel = $(this);
      // Hide scroll-snap fallback if BS carousel is present
      if ($carousel.hasClass('carousel')) {
        $carousel.find('.bce-interactive-carousel-slide').css('min-width', '');
        if (typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
          new bootstrap.Carousel(this, { interval: 5000, wrap: true });
        }
      }
    });
  });
})(jQuery);`;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an interactive element of the given type with the given content.
 */
export function generateInteractiveElement(type: string, content: unknown): InteractiveElement {
  switch (type) {
    case 'faq-accordion': {
      const items = content as FaqItem[];
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('faq-accordion requires a non-empty array of { question, answer } items');
      }
      return generateFaqAccordion(items);
    }

    case 'service-tabs': {
      const tabs = content as TabItem[];
      if (!Array.isArray(tabs) || tabs.length === 0) {
        throw new Error('service-tabs requires a non-empty array of { id, label, content } items');
      }
      return generateServiceTabs(tabs);
    }

    case 'distance-calculator': {
      const calc = content as DistanceCalcContent;
      if (!calc || !Array.isArray(calc.suburbs) || !calc.businessName) {
        throw new Error('distance-calculator requires { suburbs: [{ name, distanceKm }], businessName }');
      }
      return generateDistanceCalculator(calc);
    }

    case 'testimonial-carousel': {
      const items = content as TestimonialItem[];
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('testimonial-carousel requires a non-empty array of { quote, author } items');
      }
      return generateTestimonialCarousel(items);
    }

    default:
      throw new Error(`Unknown interactive element type: ${type}. Use getAllInteractiveTypes() for available types.`);
  }
}

/**
 * Get the combined head JS for all interactive elements used in a blueprint.
 * Queries section_specs for the given blueprint to find which interactive types
 * are in use, then returns a single combined JS string for the <head> injection.
 *
 * Returns null if the blueprint has no interactive elements or doesn't exist.
 */
export function getHeadJsForPage(blueprintId: number): string | null {
  // Query section_specs for generated HTML that contains data-bce-* attributes
  const rows = db
    .prepare(
      `SELECT generated_html FROM section_specs
       WHERE blueprint_id = ? AND generated_html IS NOT NULL`
    )
    .all(blueprintId) as Array<{ generated_html: string }>;

  if (rows.length === 0) return null;

  const allHtml = rows.map((r) => r.generated_html).join('\n');

  // Detect which interactive types are used
  const jsFragments: string[] = [];
  const preamble = `// BCE Head JS - Generated for blueprint #${blueprintId}\n`;

  if (allHtml.includes('data-bce-accordion')) {
    jsFragments.push(generateAccordionHeadJs());
  }
  if (allHtml.includes('data-bce-tabs')) {
    jsFragments.push(generateTabsHeadJs());
  }
  if (allHtml.includes('data-bce-calculator')) {
    // Default to km when aggregating — individual elements embed their own unit
    jsFragments.push(generateCalculatorHeadJs('km'));
  }
  if (allHtml.includes('data-bce-carousel')) {
    jsFragments.push(generateCarouselHeadJs());
  }

  if (jsFragments.length === 0) return null;

  return preamble + jsFragments.join('\n\n');
}

/**
 * Generate interactive elements for all eligible sections of a blueprint.
 *
 * Scans the blueprint's section_specs for sections with generated_html that
 * contain interactive-compatible content (FAQ questions, service tabs, etc.)
 * but don't already have BCE interactive markup. For each eligible section,
 * generates the appropriate interactive element and appends it to the
 * section's generated_html.
 *
 * Returns a summary of what was generated.
 */
export function generateInteractivityForBlueprint(blueprintId: number): {
  blueprintId: number;
  processed: number;
  generated: Array<{ sectionId: number; sectionType: string; interactiveType: string }>;
  skipped: Array<{ sectionId: number; reason: string }>;
  headJs: string | null;
} {
  const sections = db
    .prepare(
      `SELECT id, section_type, section_order, heading_text, faq_questions,
              design_pattern, generated_html, status
       FROM section_specs
       WHERE blueprint_id = ? AND generated_html IS NOT NULL
       ORDER BY section_order`
    )
    .all(blueprintId) as Array<{
    id: number;
    section_type: string;
    section_order: number;
    heading_text: string | null;
    faq_questions: string | null;
    design_pattern: string | null;
    generated_html: string;
    status: string;
  }>;

  if (sections.length === 0) {
    return {
      blueprintId,
      processed: 0,
      generated: [],
      skipped: [{ sectionId: 0, reason: 'No sections with generated HTML found for this blueprint' }],
      headJs: null,
    };
  }

  const generated: Array<{ sectionId: number; sectionType: string; interactiveType: string }> = [];
  const skipped: Array<{ sectionId: number; reason: string }> = [];

  const updateStmt = db.prepare(
    `UPDATE section_specs SET generated_html = ? WHERE id = ?`
  );

  for (const section of sections) {
    // Skip sections that already have BCE interactive markup
    if (section.generated_html.includes('data-bce-')) {
      skipped.push({ sectionId: section.id, reason: 'Already has interactive elements' });
      continue;
    }

    // Determine which interactive type fits this section
    let element: InteractiveElement | null = null;
    let interactiveType = '';

    // FAQ sections with faq_questions get an accordion
    if (section.section_type === 'faq' && section.faq_questions) {
      try {
        const questions = JSON.parse(section.faq_questions) as FaqItem[];
        if (Array.isArray(questions) && questions.length > 0) {
          element = generateFaqAccordion(questions);
          interactiveType = 'faq-accordion';
        }
      } catch {
        skipped.push({ sectionId: section.id, reason: 'Failed to parse faq_questions JSON' });
        continue;
      }
    }

    // Service sections with a tabs design pattern get tabs
    if (!element && section.design_pattern === 'tabs') {
      // Extract tab-like content from the section heading/type
      // This is a heuristic: if the section has a tabs design pattern,
      // we look for structured content in the generated HTML
      skipped.push({ sectionId: section.id, reason: 'Tabs require structured tab content (not auto-extractable)' });
      continue;
    }

    // Testimonial sections get a carousel
    if (!element && section.section_type === 'testimonials') {
      // Testimonials need structured data; skip if we can't extract it
      skipped.push({ sectionId: section.id, reason: 'Testimonials require structured data (not auto-extractable)' });
      continue;
    }

    if (!element) {
      skipped.push({ sectionId: section.id, reason: `No interactive type matches section_type '${section.section_type}'` });
      continue;
    }

    // Append the interactive element HTML after the existing generated HTML
    const updatedHtml =
      section.generated_html +
      '\n\n<!-- BCE Interactive Element: ' + interactiveType + ' -->\n' +
      element.htmlSnippet;

    updateStmt.run(updatedHtml, section.id);
    generated.push({
      sectionId: section.id,
      sectionType: section.section_type,
      interactiveType,
    });
  }

  // Re-generate the combined head JS after updates
  const headJs = getHeadJsForPage(blueprintId);

  return {
    blueprintId,
    processed: sections.length,
    generated,
    skipped,
    headJs,
  };
}

/**
 * Return all available interactive element types with their tier and description.
 */
export function getAllInteractiveTypes(): InteractiveTypeInfo[] {
  return [...INTERACTIVE_TYPES];
}
