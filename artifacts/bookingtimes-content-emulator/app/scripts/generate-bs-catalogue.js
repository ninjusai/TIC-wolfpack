/**
 * generate-bs-catalogue.js
 *
 * Parses the Bootstrap 5.0.2 CSS to extract all class selectors,
 * categorizes them, and outputs a structured JSON catalogue.
 *
 * Usage: node scripts/generate-bs-catalogue.js
 * Output: src/lib/data/bootstrap-5.0.2-classes.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Read Bootstrap 5.0.2 CSS
const cssPath = resolve(ROOT, 'node_modules/bootstrap/dist/css/bootstrap.css');
const css = readFileSync(cssPath, 'utf-8');

// Extract all class selectors from CSS
function extractClasses(css) {
  const classes = new Set();
  // Remove comments to avoid picking up classes from URLs/comments
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Only look at selectors (before {), not inside declarations
  const ruleRegex = /([^{}]+)\{/g;
  let ruleMatch;
  while ((ruleMatch = ruleRegex.exec(noComments)) !== null) {
    const selectorBlock = ruleMatch[1];
    // Extract class selectors from selector block
    const clsRegex = /\.([a-zA-Z][\w-]*)/g;
    let match;
    while ((match = clsRegex.exec(selectorBlock)) !== null) {
      const cls = match[1];
      // Skip CSS artifacts from URLs and non-class tokens
      if (['com', 'css', 'org', 'w3', 'map', 'min'].includes(cls)) continue;
      if (cls.startsWith('_') || cls.startsWith('--')) continue;
      classes.add(cls);
    }
  }
  return [...classes].sort();
}

const allClasses = extractClasses(css);

// --- Categorization ---

// Classes that were added in 5.1+ and must NOT appear
const excluded_from_5_1_plus = [
  // text-bg-* utilities (5.2+)
  "text-bg-primary", "text-bg-secondary", "text-bg-success",
  "text-bg-danger", "text-bg-warning", "text-bg-info",
  "text-bg-light", "text-bg-dark",
  // z-index utilities (5.3+)
  "z-0", "z-1", "z-2", "z-3",
  // fw-semibold (5.1+)
  "fw-semibold",
  // link-opacity (5.3+)
  "link-opacity-10", "link-opacity-25", "link-opacity-50",
  "link-opacity-75", "link-opacity-100",
  "link-opacity-10-hover", "link-opacity-25-hover",
  "link-opacity-50-hover", "link-opacity-75-hover",
  "link-opacity-100-hover",
  // focus-ring (5.3+)
  "focus-ring", "focus-ring-primary", "focus-ring-secondary",
  "focus-ring-success", "focus-ring-danger", "focus-ring-warning",
  "focus-ring-info", "focus-ring-light", "focus-ring-dark",
  // icon-link (5.3+)
  "icon-link", "icon-link-hover",
  // object-fit (5.3+)
  "object-fit-contain", "object-fit-cover", "object-fit-fill",
  "object-fit-scale", "object-fit-none",
  "object-fit-sm-contain", "object-fit-sm-cover", "object-fit-sm-fill",
  "object-fit-md-contain", "object-fit-md-cover", "object-fit-md-fill",
  "object-fit-lg-contain", "object-fit-lg-cover", "object-fit-lg-fill",
  "object-fit-xl-contain", "object-fit-xl-cover", "object-fit-xl-fill",
  "object-fit-xxl-contain", "object-fit-xxl-cover", "object-fit-xxl-fill",
  // border-opacity (5.2+)
  "border-opacity-10", "border-opacity-25", "border-opacity-50",
  "border-opacity-75", "border-opacity-100",
  // link-underline (5.3+)
  "link-underline", "link-underline-primary", "link-underline-secondary",
  "link-underline-success", "link-underline-danger",
  "link-underline-warning", "link-underline-info",
  "link-underline-light", "link-underline-dark",
  "link-underline-opacity-0", "link-underline-opacity-10",
  "link-underline-opacity-25", "link-underline-opacity-50",
  "link-underline-opacity-75", "link-underline-opacity-100",
];

const excludedSet = new Set(excluded_from_5_1_plus);

// Filter out any excluded classes that somehow got in
const classes = allClasses.filter(c => !excludedSet.has(c));

// Categorization helpers
function startsWith(prefixes) {
  return (c) => prefixes.some(p => c.startsWith(p));
}
function exact(names) {
  const s = new Set(names);
  return (c) => s.has(c);
}
function matches(regex) {
  return (c) => regex.test(c);
}

// Build categories
const categorized = new Set();

function pick(arr, predicate) {
  const result = [];
  for (const c of arr) {
    if (!categorized.has(c) && predicate(c)) {
      result.push(c);
      categorized.add(c);
    }
  }
  return result.sort();
}

// Layout
const layout = pick(classes, c =>
  /^container(-fluid|-sm|-md|-lg|-xl|-xxl)?$/.test(c)
);

// Grid
const grid = pick(classes, c =>
  /^(row|col|col-|g-|gx-|gy-|row-cols-)/.test(c) ||
  /^(offset-)/.test(c) ||
  /^order-/.test(c)
);

// --- Utilities ---
const spacingUtil = pick(classes, c => /^[mp][txbsey]?-/.test(c));
const displayUtil = pick(classes, c => /^d-/.test(c));
const flexUtil = pick(classes, c =>
  /^(flex-|align-items-|align-self-|align-content-|justify-content-)/.test(c) ||
  c === 'flex-fill'
);
const textUtil = pick(classes, c =>
  /^(text-start|text-end|text-center|text-wrap|text-nowrap|text-break|text-truncate|text-lowercase|text-uppercase|text-capitalize|text-decoration-|text-reset|text-muted|font-monospace|lh-|fs-|text-sm-|text-md-|text-lg-|text-xl-|text-xxl-)/.test(c)
);
const colorUtil = pick(classes, c =>
  /^text-(primary|secondary|success|danger|warning|info|light|dark|body|white|black-50|white-50)$/.test(c)
);
const bgUtil = pick(classes, c =>
  /^bg-(primary|secondary|success|danger|warning|info|light|dark|body|white|transparent|gradient)$/.test(c)
);
const borderUtil = pick(classes, c =>
  /^(border|rounded)/.test(c)
);
const sizingUtil = pick(classes, c =>
  /^(w-|h-|mw-|mh-|min-vw-|min-vh-|vw-|vh-)/.test(c)
);
const positionUtil = pick(classes, c =>
  /^(position-|top-|bottom-|start-|end-|translate-middle)/.test(c) ||
  /^(fixed-top|fixed-bottom|sticky-top|sticky-sm-top|sticky-md-top|sticky-lg-top|sticky-xl-top|sticky-xxl-top)$/.test(c)
);
const visibilityUtil = pick(classes, c =>
  /^(visible|invisible)$/.test(c)
);
const overflowUtil = pick(classes, c =>
  /^overflow-/.test(c)
);
const shadowUtil = pick(classes, c =>
  /^shadow/.test(c)
);
const opacityUtil = pick(classes, c =>
  /^opacity-/.test(c)
);
const floatUtil = pick(classes, c =>
  /^float-/.test(c)
);
const interactionUtil = pick(classes, c =>
  /^(pe-none|pe-auto|user-select-)/.test(c)
);
const gapUtil = pick(classes, c =>
  /^gap-/.test(c)
);
const alignUtil = pick(classes, c =>
  /^align-(baseline|top|middle|bottom|text-top|text-bottom)$/.test(c)
);

// --- Components ---
const alerts = pick(classes, c => /^alert/.test(c));
const badges = pick(classes, c => /^badge$/.test(c));
const buttons = pick(classes, c => /^btn/.test(c));
const cards = pick(classes, c => /^card/.test(c));
const carousel = pick(classes, c => /^carousel/.test(c));
const collapse = pick(classes, c => /^(collapse|collapsing|show)$/.test(c));
const dropdowns = pick(classes, c => /^(dropdown|dropup|dropstart|dropend)/.test(c));
const forms = pick(classes, c =>
  /^(form-|input-group|was-validated|valid-|invalid-|is-valid|is-invalid)/.test(c)
);
const modals = pick(classes, c => /^modal/.test(c));
const navbar = pick(classes, c => /^navbar/.test(c));
const nav = pick(classes, c => /^nav/.test(c) && !/^navbar/.test(c));
const pagination = pick(classes, c => /^(pagination|page-)/.test(c));
const tables = pick(classes, c => /^table/.test(c));
const toast = pick(classes, c => /^toast/.test(c));
const accordion = pick(classes, c => /^accordion/.test(c));
const listGroup = pick(classes, c => /^list-group/.test(c));
const progress = pick(classes, c => /^progress/.test(c));
const spinners = pick(classes, c => /^spinner/.test(c));
const offcanvas = pick(classes, c => /^offcanvas/.test(c));
const breadcrumb = pick(classes, c => /^breadcrumb/.test(c));
const closeBtn = pick(classes, c => /^btn-close/.test(c));
const placeholder = pick(classes, c => /^placeholder/.test(c));
const popover = pick(classes, c => /^(popover|bs-popover)/.test(c));
const tooltip = pick(classes, c => /^(tooltip|bs-tooltip)/.test(c));
const tabs = pick(classes, c => /^(tab-|nav-tabs)/.test(c));
const figures = pick(classes, c => /^figure/.test(c));
const imgClasses = pick(classes, c => /^img-/.test(c));

// Link classes
const linkClasses = pick(classes, c =>
  /^link-(primary|secondary|success|danger|warning|info|light|dark)$/.test(c)
);

// Caption & misc table-related
const tableRelated = pick(classes, c =>
  /^(caption-top)$/.test(c)
);

// Validation-related (form)
const validationClasses = pick(classes, c =>
  /^(has-validation|valid-feedback|valid-tooltip|invalid-feedback|invalid-tooltip|needs-validation)$/.test(c)
);

// Transition / visibility states
const stateClasses = pick(classes, c =>
  /^(hide|showing|pointer-event)$/.test(c)
);

// Helpers
const helpers = pick(classes, c =>
  /^(clearfix|ratio|ratio-|visually-hidden|visually-hidden-focusable|stretched-link|text-truncate|vr|hstack|vstack)/.test(c)
);

// Typography
const typography = pick(classes, c =>
  /^(h[1-6]|display-[1-6]|lead|small|mark|blockquote|blockquote-footer|list-unstyled|list-inline|list-inline-item|initialism|fw-|fst-|text-decoration-)/.test(c)
);

// Catch remaining utility-like classes
const miscUtil = pick(classes, c =>
  /^(fade|show|active|disabled|collapse|collapsing|visually-hidden|pe-none|pe-auto|stretched-link|img-fluid|img-thumbnail)$/.test(c)
);

// Anything uncategorized
const uncategorized = classes.filter(c => !categorized.has(c)).sort();

// Build output
const catalogue = {
  version: "5.0.2",
  generated: "2026-04-03",
  categories: {
    layout,
    grid,
    utilities: {
      spacing: spacingUtil,
      display: displayUtil,
      flex: flexUtil,
      text: textUtil,
      colors: colorUtil,
      background: bgUtil,
      borders: borderUtil,
      sizing: sizingUtil,
      position: positionUtil,
      visibility: visibilityUtil,
      overflow: overflowUtil,
      shadows: shadowUtil,
      opacity: opacityUtil,
      float: floatUtil,
      interactions: interactionUtil,
      gap: gapUtil,
      "vertical-align": alignUtil
    },
    components: {
      alerts,
      badges,
      buttons,
      breadcrumb,
      cards,
      carousel,
      collapse,
      dropdowns,
      figures,
      forms,
      images: imgClasses,
      "list-group": listGroup,
      modals,
      navbar,
      nav,
      offcanvas,
      pagination,
      placeholder,
      popover,
      progress,
      spinners,
      tables,
      tabs,
      toast,
      tooltip,
      accordion,
      links: linkClasses
    },
    helpers,
    typography,
    other: uncategorized
  },
  total_classes: classes.length,
  excluded_from_5_1_plus
};

// Write output
const outPath = resolve(ROOT, 'src/lib/data/bootstrap-5.0.2-classes.json');
writeFileSync(outPath, JSON.stringify(catalogue, null, 2));

console.log(`Bootstrap 5.0.2 Class Catalogue generated.`);
console.log(`Total classes extracted: ${classes.length}`);
console.log(`Output: ${outPath}`);
console.log(`\nCategory breakdown:`);
console.log(`  layout: ${layout.length}`);
console.log(`  grid: ${grid.length}`);
console.log(`  utilities.spacing: ${spacingUtil.length}`);
console.log(`  utilities.display: ${displayUtil.length}`);
console.log(`  utilities.flex: ${flexUtil.length}`);
console.log(`  utilities.text: ${textUtil.length}`);
console.log(`  utilities.colors: ${colorUtil.length}`);
console.log(`  utilities.background: ${bgUtil.length}`);
console.log(`  utilities.borders: ${borderUtil.length}`);
console.log(`  utilities.sizing: ${sizingUtil.length}`);
console.log(`  utilities.position: ${positionUtil.length}`);
console.log(`  utilities.visibility: ${visibilityUtil.length}`);
console.log(`  utilities.overflow: ${overflowUtil.length}`);
console.log(`  utilities.shadows: ${shadowUtil.length}`);
console.log(`  utilities.opacity: ${opacityUtil.length}`);
console.log(`  utilities.float: ${floatUtil.length}`);
console.log(`  utilities.interactions: ${interactionUtil.length}`);
console.log(`  components (total): ${alerts.length + badges.length + buttons.length + breadcrumb.length + cards.length + carousel.length + collapse.length + dropdowns.length + figures.length + forms.length + imgClasses.length + listGroup.length + modals.length + navbar.length + nav.length + offcanvas.length + pagination.length + placeholder.length + popover.length + progress.length + spinners.length + tables.length + tabs.length + toast.length + tooltip.length + accordion.length}`);
console.log(`  helpers: ${helpers.length}`);
console.log(`  typography: ${typography.length}`);
console.log(`  uncategorized: ${uncategorized.length}`);

// Validation checks
console.log(`\n--- Validation ---`);
if (classes.length >= 1000 && classes.length <= 2000) {
  console.log(`✓ Total classes (${classes.length}) is in expected range [1000-2000]`);
} else {
  console.log(`⚠ Total classes (${classes.length}) outside expected range [1000-2000]`);
}

// Check no 5.1+ classes leaked in
const leaked = excluded_from_5_1_plus.filter(c => classes.includes(c));
if (leaked.length === 0) {
  console.log(`✓ No 5.1+ classes found in catalogue`);
} else {
  console.log(`✗ 5.1+ classes found in catalogue: ${leaked.join(', ')}`);
}

if (uncategorized.length > 0) {
  console.log(`\nUncategorized classes (${uncategorized.length}):`);
  console.log(uncategorized.slice(0, 30).join(', ') + (uncategorized.length > 30 ? '...' : ''));
}
