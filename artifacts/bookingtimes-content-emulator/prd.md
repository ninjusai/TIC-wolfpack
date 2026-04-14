---
title: "Bookingtimes.com Content Creation Emulator — Product Requirements Document"
version: "1.0.0"
status: draft
last-updated: "2026-04-02"
author: quill
project: bookingtimes-content-emulator
references:
  - PRB-bookingtimes-content-emulator-001
  - EVL-bookingtimes-content-emulator-001
  - ARCH-bookingtimes-content-emulator-001
  - INT-bookingtimes-content-emulator-001
---

# Product Requirements Document: Bookingtimes.com Content Creation Emulator

## 1. Problem Statement

Managing content across 5 driving school websites on the bookingtimes.com booking platform in Queensland, Australia is painful and manual. The platform is a booking system, not a CMS -- its WYSIWYG editor is basic, there is no visibility into available CSS classes or styles, and there is no way to preview styled content before deploying to the live site.

Previous attempts at template-based batch content creation produced insufficient quality. Creating and maintaining consistent, high-quality content at scale across all 5 sites requires repetitive manual work with no feedback loop on how content will actually render.

### Core Pain Points

1. **No style visibility.** The platform does not expose which CSS classes or styles are available, forcing blind trial-and-error when styling content.
2. **No preview capability.** Content cannot be previewed in context before it goes live; errors are only discovered after deployment to production.
3. **Manual repetition at scale.** The same or similar content must be manually created and maintained across 5 separate sites with no tooling for reuse or batch operations.
4. **Quality gap in batch generation.** Prior template-based approaches failed to produce content of acceptable quality, indicating that simple find-and-replace templating is insufficient.
5. **No version control.** Changes cannot be tracked or rolled back, making iterative content improvement risky.

---

## 2. Goals

| # | Goal | Type | Measurable Target | Timeframe |
|---|------|------|-------------------|-----------|
| G-1 | Eliminate blind CSS styling by providing a complete, verified catalogue of available classes per site | Efficiency | >= 95% class coverage per site (EVAL-BCE-001) | At first scrape |
| G-2 | Provide a preview that faithfully renders content as it will appear on the live site | Quality | SSIM >= 0.85 between preview and live rendering (EVAL-BCE-009) | Before first content deployment |
| G-3 | Enable AI-assisted content generation that produces export-ready HTML conforming to site styles | Quality | Zero unknown classes in AI output (EVAL-BCE-023); all rubric dimensions >= 4/5 (EVAL-BCE-021) | Per generation cycle |
| G-4 | Support batch generation of localized suburb pages at scale without quality degradation | Scale | 50 suburbs generated, 100% passing validation, < 5 min/page avg (EVAL-BCE-016) | Per batch run |
| G-5 | Provide version history with non-destructive rollback for all content | Safety | Versions persist across restarts (EVAL-BCE-028); rollback creates new version (EVAL-BCE-026) | Continuous |

---

## 3. Requirements

### 3.1 CSS Scraping and Style Discovery

#### REQ-001: CSS Class Catalogue Generation [P0]

**Description:** The system scrapes live bookingtimes.com driving school sites and generates a comprehensive catalogue of available CSS classes. The scraping strategy uses the Bootstrap 5 CDN as a known baseline and targets only custom/override stylesheets for additional classes. Font Awesome 6 Pro icon classes are included. Each site gets its own catalogue stored in D1 with a `scraped_at` timestamp.

**Acceptance Criteria:**
- The scraped catalogue contains >= 95% of classes used in content areas of the live site
- No content-area classes are missing from the catalogue

**eval-trace:** EVAL-BCE-001

---

#### REQ-002: CSS Property Extraction [P0]

**Description:** For each catalogued class, the system extracts and stores the associated CSS properties (font-family, font-size, color, margin, padding, line-height, etc.). Properties are extracted from Bootstrap 5 baseline, Font Awesome 6 CDN, and per-site custom stylesheets. Stylesheets are parsed using a CSS parser (css-tree or postcss).

**Acceptance Criteria:**
- 100% of reference class properties match ground truth values
- Property values account for CSS shorthand equivalences

**eval-trace:** EVAL-BCE-002

---

#### REQ-003: Cross-Site Class Overlap Detection [P1]

**Description:** The system computes and reports the intersection and difference of class catalogues across all 5 sites, identifying shared classes vs. site-specific classes. Classes seen in actual page HTML are marked "verified"; baseline-only classes are marked "available but unverified."

**Acceptance Criteria:**
- Overlap report correctly identifies all known shared classes in the intersection
- All known site-specific classes appear only in their respective site catalogues

**eval-trace:** EVAL-BCE-003

---

#### REQ-004: CSS Change Detection [P2]

**Description:** When a re-scrape is triggered, the system compares the new catalogue against the previous baseline and generates a diff report identifying added, removed, and renamed classes. Supports optional scheduled re-scrape via Cloudflare Cron Triggers.

**Acceptance Criteria:**
- Diff report correctly identifies all class additions, removals, and renames
- No changes missed or misreported

**eval-trace:** EVAL-BCE-004

---

### 3.2 Export HTML Validation

#### REQ-005: Zero Unknown Classes in Export [P0]

**Description:** Before any content is exported, the system validates every CSS class name in the HTML against the target site's verified CSS catalogue. Export produces a clean HTML fragment (no DOCTYPE, html, head, or body tags) using only class-based styling. No inline styles, no `<script>` tags, no `<style>` tags.

**Acceptance Criteria:**
- Zero unknown or unverified classes in the exported HTML
- Export is blocked or flagged if unknown classes are detected

**eval-trace:** EVAL-BCE-005

---

#### REQ-006: Export HTML Structure Validity [P0]

**Description:** Exported HTML is validated for well-formedness (proper nesting, closed tags, valid attributes). The validation pipeline checks for disallowed elements (`<script>`, `<style>`, `<iframe>`, `<form>`) and bare element selectors. Copy-to-clipboard and version recording occur upon successful validation.

**Acceptance Criteria:**
- Zero HTML validation errors in exported content
- Zero disallowed elements or tags present
- All elements use class or ID selectors (no bare element styling)

**eval-trace:** EVAL-BCE-006

---

#### REQ-007: Multi-Site Export Class Isolation [P1]

**Description:** When content is exported for a specific site, all class names are validated against that site's catalogue only. No classes from other site catalogues leak into the export. Per-site CSS catalogues are stored separately in D1.

**Acceptance Criteria:**
- 100% of exported classes belong to the target site's catalogue
- Zero cross-site class contamination

**eval-trace:** EVAL-BCE-007

---

#### REQ-008: WYSIWYG Paste Acceptance Validation [P0]

**Description:** The export format is validated against the bookingtimes.com WYSIWYG editor's paste behavior. This is the highest-risk assumption in the project (Assumption A-2). If the editor strips class attributes on paste, the system pivots to inline-style export (fallback plan documented in architecture decisions).

**Acceptance Criteria:**
- >= 95% of HTML structure and class attributes preserved after paste into the WYSIWYG editor
- Content renders with expected styling after paste

**eval-trace:** EVAL-BCE-008

---

### 3.3 Emulator Preview

#### REQ-009: Layout Fidelity Preview [P0]

**Description:** The system renders a preview of generated content inside a sandboxed `<iframe>` that loads the Bootstrap 5 CSS, Font Awesome 6 CSS, and the target site's custom stylesheets. The iframe document replicates the site's content-area wrapper structure for accurate rendering. Responsive preview supports breakpoints at 767px, 991px, and 1200px.

**Acceptance Criteria:**
- SSIM score >= 0.85 between preview screenshot and live site screenshot at 1280x800 viewport
- All major element bounding boxes align within 10px tolerance

**eval-trace:** EVAL-BCE-009

---

#### REQ-010: Typography Fidelity [P1]

**Description:** The preview accurately reproduces the live site's typography: font-family, font-size, font-weight, line-height, and color for all heading levels and body text.

**Acceptance Criteria:**
- Font-family matches for all elements
- Font-size within 1px of live site values
- Font-weight matches exactly
- Line-height within 2px
- Color values match exactly (hex comparison)

**eval-trace:** EVAL-BCE-010

---

#### REQ-011: Spacing and Margins Fidelity [P1]

**Description:** The preview accurately reproduces the live site's spacing: margin and padding values for all content elements.

**Acceptance Criteria:**
- Margin values within 5px of live site values
- Padding values within 5px of live site values

**eval-trace:** EVAL-BCE-011

---

#### REQ-012: Preview Refresh on Re-Scrape [P2]

**Description:** When the CSS catalogue is updated via a re-scrape, the preview automatically reflects the new styles without manual intervention. The iframe reloads updated stylesheets (cached in R2 and served from same origin).

**Acceptance Criteria:**
- Preview reflects all CSS changes after re-scrape
- No stale styles displayed after catalogue update

**eval-trace:** EVAL-BCE-012

---

### 3.4 Batch Suburb Page Generation

#### REQ-013: Zero Placeholder Tokens in Output [P0]

**Description:** Batch-generated pages must contain no residual placeholder tokens, template variables, or markers. The system scans all output for patterns including `{{...}}`, `{...}`, `[PLACEHOLDER]`, `[TBD]`, `INSERT_`, `TODO`, and `XXX` before marking a page as complete.

**Acceptance Criteria:**
- Zero placeholder tokens across all generated pages
- All pages contain only resolved, human-readable content

**eval-trace:** EVAL-BCE-013

---

#### REQ-014: Suburb-Specific Data Accuracy [P0]

**Description:** Each batch-generated page contains accurate, suburb-specific local data (name, region, distance, landmarks). No cross-contamination between suburbs is permitted. Suburb data is sourced from a static QLD dataset (bundled JSON) supplemented by optional user-provided data per suburb.

**Acceptance Criteria:**
- Each page contains the correct suburb name, distance, and landmark references matching ground truth
- 100% data accuracy across all pages
- Zero cross-contamination between suburbs

**eval-trace:** EVAL-BCE-014

---

#### REQ-015: Batch Output Structure Conformance [P0]

**Description:** Every batch-generated page conforms to the template's section structure: all required sections are present, sections appear in the specified order, and each section passes its structural validation rules. The batch pipeline validates output at step 5 of processing before storing results.

**Acceptance Criteria:**
- 100% of pages contain all required sections in the correct order
- Each section passes its structural validation rules

**eval-trace:** EVAL-BCE-015

---

#### REQ-016: Batch Scale to 50 Suburbs [P1]

**Description:** The batch pipeline processes 50 suburbs sequentially via a D1-backed job queue. Each suburb is a job record with status tracking (pending, processing, complete, failed, needs_review). The system supports retry with adjusted prompts (up to 3 attempts per job) and provides a review gate before export.

**Acceptance Criteria:**
- All 50 pages pass placeholder, data accuracy, and structural checks
- No two pages are identical (each is unique to its suburb)
- Average generation time < 5 minutes per page

**eval-trace:** EVAL-BCE-016

---

### 3.5 Template System

#### REQ-017: Section Definition and Rendering [P0]

**Description:** Templates are JSON documents stored in D1. Each template defines an ordered array of sections. Each section specifies: HTML structure skeleton, required CSS classes, content constraints (word count, tone), and an optional pool of content variants. The AI prompt builder extracts section rules to feed to Claude.

**Acceptance Criteria:**
- Each section renders with the correct HTML structure as defined in the template
- CSS classes applied match the section's style rules

**eval-trace:** EVAL-BCE-017

---

#### REQ-018: Content Randomization and Variation [P1]

**Description:** When template sections define variant pools, the batch generator selects variants using a deterministic shuffle (seeded by suburb name hash) to ensure reproducible builds and even distribution. All generated content must be drawn from approved variants only.

**Acceptance Criteria:**
- At least 3 of 4 defined variants appear across 20 generated pages
- No variant is used more than 40% of the time (distribution not pathologically skewed)
- All generated content is from the approved variant set (no hallucinated variants)

**eval-trace:** EVAL-BCE-018

---

#### REQ-019: Per-Section Style Rules Enforcement [P0]

**Description:** Each template section defines required CSS classes. Generated content is validated to ensure each section contains its required classes and no cross-section class contamination occurs.

**Acceptance Criteria:**
- All section class rules satisfied in generated output
- Zero cross-section class contamination

**eval-trace:** EVAL-BCE-019

---

#### REQ-020: Template Reuse Across Sites [P2]

**Description:** Templates can be configured as reusable across multiple sites (via `site_ids` array). When applied to different sites, shared sections use shared classes correctly while site-specific sections use the correct site-specific classes from the target site's catalogue.

**Acceptance Criteria:**
- Shared classes used correctly on both sites
- Site-specific classes correctly isolated per site
- No cross-site class misapplication

**eval-trace:** EVAL-BCE-020

---

### 3.6 AI Content Generation

#### REQ-021: Initial Content Generation Quality [P0]

**Description:** The system uses a server-side Claude proxy (Cloudflare Worker) to generate content. The Worker constructs prompts using template rules, CSS catalogue context, platform constraints, and conversation history. Generated content is evaluated on 5 quality dimensions: relevance, tone, length, structure, and accuracy.

**Acceptance Criteria:**
- Generated content scores >= 4/5 on all 5 rubric dimensions (relevance, tone, length, structure, accuracy)
- Content is usable without major rewrites

**eval-trace:** EVAL-BCE-021

---

#### REQ-022: Iterative Refinement Loop [P0]

**Description:** Users can provide feedback on generated content and request revisions. The system replays full conversation history (stored as turns in D1) to Claude on each revision request. Revisions address feedback without regressing quality or breaking template compliance.

**Acceptance Criteria:**
- All feedback items are addressed in the revision
- No quality regression from the original content
- Revised output still conforms to template rules

**eval-trace:** EVAL-BCE-022

---

#### REQ-023: AI Output HTML Conformance [P0]

**Description:** AI-generated HTML is validated before returning to the frontend. All class names are checked against the CSS catalogue. Unknown classes are flagged with warnings (not silently stripped). Output must be well-formed HTML with no inline styles (unless template-allowed), no disallowed tags, and conformance to the template section structure.

**Acceptance Criteria:**
- Zero CSS class violations in AI-generated HTML
- Zero structural errors
- No disallowed elements (script, style, iframe)

**eval-trace:** EVAL-BCE-023

---

#### REQ-024: AI Content Uniqueness Across Suburbs [P1]

**Description:** AI-generated content for different suburbs must be substantively unique. The system avoids producing near-duplicate content by providing suburb-specific data and variant instructions to Claude. Each page must contain suburb-specific details not found in other pages.

**Acceptance Criteria:**
- Maximum pairwise text similarity < 0.80 (cosine similarity on TF-IDF vectors) across suburb pages
- Each page contains at least 3 suburb-specific details unique to that page

**eval-trace:** EVAL-BCE-024

---

### 3.7 Version History

#### REQ-025: Version Save on Edit [P0]

**Description:** Every content edit (manual, AI-generated, or batch) creates a new version record in the `page_versions` D1 table. Previous versions remain accessible. Each version stores the full HTML snapshot, a sequential version number, timestamp, source type, and change summary.

**Acceptance Criteria:**
- New version created upon every save
- Previous versions remain accessible and unmodified
- Diff between versions accurately reflects only the changes made

**eval-trace:** EVAL-BCE-025

---

#### REQ-026: Non-Destructive Rollback [P0]

**Description:** Rolling back to a previous version creates a new version record (version N+1 with content from version M) rather than destructively overwriting. Full version history is preserved including the rollback action itself. The `source` field records "rollback" and `parent_version` links to the source version.

**Acceptance Criteria:**
- Content after rollback matches the target version exactly
- A new version entry is created for the rollback action
- Full version history is preserved (no versions deleted)

**eval-trace:** EVAL-BCE-026

---

#### REQ-027: Version History Metadata [P1]

**Description:** Each version record includes: version number (sequential), timestamp (ISO 8601), source/author (manual, ai_generate, ai_refine, batch, rollback), and change summary.

**Acceptance Criteria:**
- All metadata fields present for every version
- Timestamps chronologically ordered
- Version numbers sequential without gaps

**eval-trace:** EVAL-BCE-027

---

#### REQ-028: Version History Persistence [P0]

**Description:** Version history is stored in Cloudflare D1 and persists across application restarts, deployments, and browser sessions. Critical data (templates, version history) is backed up to R2 as JSON on a schedule.

**Acceptance Criteria:**
- Version count and content identical before and after application restart
- No data loss or corruption across restarts

**eval-trace:** EVAL-BCE-028

---

### 3.8 Edge Cases and Resilience

#### REQ-029: Empty Suburb Data Handling [P1]

**Description:** When a suburb in the batch list has missing or null data fields (landmarks, distance, population), the system handles this gracefully. The AI generates content without the missing data point rather than inserting placeholders. The system does not crash or produce corrupt output.

**Acceptance Criteria:**
- Graceful handling: either skip with warning or generate valid fallback content
- No crash, corrupt output, empty strings in content, or placeholder tokens

**eval-trace:** EVAL-BCE-029

---

#### REQ-030: Malformed CSS Handling [P2]

**Description:** The CSS scraper handles malformed CSS input (unclosed braces, invalid property values, @import loops) without crashing. Valid classes are extracted while malformed rules are logged as warnings.

**Acceptance Criteria:**
- Scraper completes without crash on malformed input
- Valid classes extracted correctly
- Malformed rules logged as warnings
- No invalid entries in the catalogue

**eval-trace:** EVAL-BCE-030

---

#### REQ-031: Network Failure During Scrape [P2]

**Description:** If network connectivity is lost during a CSS scrape, the scraper reports the failure clearly with details of what was and was not scraped. Partial results are not silently committed as a complete catalogue.

**Acceptance Criteria:**
- Clear error reporting on network failure
- Partial results not treated as a complete catalogue
- No crash or silent corruption

**eval-trace:** EVAL-BCE-031

---

#### REQ-032: Very Long Content Page Handling [P2]

**Description:** The system handles pages with 15+ sections and substantial content (200+ words per section) without truncation, rendering failure, or performance degradation.

**Acceptance Criteria:**
- HTML export is complete and not truncated
- Preview renders all sections without layout breakage
- Preview loads in < 5 seconds

**eval-trace:** EVAL-BCE-032

---

## 4. Traceability Matrix

| Requirement | Priority | Eval Case(s) | Pass Threshold | Scorer Type |
|-------------|----------|--------------|----------------|-------------|
| REQ-001 | P0 | EVAL-BCE-001 | >= 95% class coverage | Algorithmic |
| REQ-002 | P0 | EVAL-BCE-002 | 100% property match | Algorithmic |
| REQ-003 | P1 | EVAL-BCE-003 | All shared/specific classes correctly classified | Algorithmic |
| REQ-004 | P2 | EVAL-BCE-004 | All 6 changes identified | Algorithmic |
| REQ-005 | P0 | EVAL-BCE-005 | 0 unknown classes | Algorithmic |
| REQ-006 | P0 | EVAL-BCE-006 | 0 validation errors, 0 disallowed elements | Algorithmic |
| REQ-007 | P1 | EVAL-BCE-007 | 100% classes in target site catalogue | Algorithmic |
| REQ-008 | P0 | EVAL-BCE-008 | >= 95% HTML preservation after paste | AI Rubric |
| REQ-009 | P0 | EVAL-BCE-009 | SSIM >= 0.85, bounding box delta <= 10px | Algorithmic + AI Rubric |
| REQ-010 | P1 | EVAL-BCE-010 | All typography within stated tolerances | Algorithmic |
| REQ-011 | P1 | EVAL-BCE-011 | All spacing within 5px tolerance | Algorithmic |
| REQ-012 | P2 | EVAL-BCE-012 | Preview reflects all CSS changes after re-scrape | AI Rubric |
| REQ-013 | P0 | EVAL-BCE-013 | 0 placeholder tokens | Algorithmic |
| REQ-014 | P0 | EVAL-BCE-014 | 100% data accuracy, 0 cross-contamination | Algorithmic |
| REQ-015 | P0 | EVAL-BCE-015 | 100% structural conformance | Algorithmic |
| REQ-016 | P1 | EVAL-BCE-016 | 100% pass, no duplicates, < 5 min/page avg | Algorithmic |
| REQ-017 | P0 | EVAL-BCE-017 | All sections render correctly with correct classes | Algorithmic |
| REQ-018 | P1 | EVAL-BCE-018 | >= 3/4 variants used, <= 40% skew, no unapproved | Algorithmic |
| REQ-019 | P0 | EVAL-BCE-019 | All rules satisfied, 0 cross-section contamination | Algorithmic |
| REQ-020 | P2 | EVAL-BCE-020 | Correct class selection per site | Algorithmic |
| REQ-021 | P0 | EVAL-BCE-021 | All 5 rubric dimensions >= 4/5 | AI Rubric |
| REQ-022 | P0 | EVAL-BCE-022 | All feedback addressed, no regression, template compliant | AI Rubric |
| REQ-023 | P0 | EVAL-BCE-023 | 0 class violations, 0 structural errors, 0 disallowed elements | Algorithmic + AI Rubric |
| REQ-024 | P1 | EVAL-BCE-024 | Max similarity < 0.80, >= 3 unique details/page | Algorithmic + AI Rubric |
| REQ-025 | P0 | EVAL-BCE-025 | New version created, old accessible, diff accurate | Algorithmic |
| REQ-026 | P0 | EVAL-BCE-026 | Content matches, new version created, history preserved | Algorithmic |
| REQ-027 | P1 | EVAL-BCE-027 | All metadata present, ordered, sequential | Algorithmic |
| REQ-028 | P0 | EVAL-BCE-028 | Data identical before/after restart | Algorithmic |
| REQ-029 | P1 | EVAL-BCE-029 | Graceful handling, no crash | Algorithmic |
| REQ-030 | P2 | EVAL-BCE-030 | No crash, valid classes extracted, malformed logged | Algorithmic |
| REQ-031 | P2 | EVAL-BCE-031 | Clear error, no silent partial commit, no crash | Algorithmic |
| REQ-032 | P2 | EVAL-BCE-032 | Complete export, full preview, < 5s load | Algorithmic |

---

## 5. Success Metrics

| # | Metric | Target | Source |
|---|--------|--------|--------|
| SM-1 | CSS class coverage per site | >= 95% of content-area classes catalogued | SC-1 / EVAL-BCE-001 |
| SM-2 | Export class validation | 0 unknown classes in any export | SC-1 / EVAL-BCE-005 |
| SM-3 | Preview visual fidelity | SSIM >= 0.85 vs live site | SC-2 / EVAL-BCE-009 |
| SM-4 | Batch page validation pass rate | 100% of generated pages pass all automated checks | SC-3 / EVAL-BCE-013, 014, 015 |
| SM-5 | Batch generation throughput | < 5 minutes average per suburb page | EVAL-BCE-016 |
| SM-6 | AI content quality | >= 4/5 on all rubric dimensions (first generation) | EVAL-BCE-021 |
| SM-7 | Content uniqueness | < 0.80 pairwise similarity across suburb pages | EVAL-BCE-024 |
| SM-8 | Version history reliability | Zero data loss across application restarts | EVAL-BCE-028 |

---

## 6. Dependencies

| # | Dependency | Type | Impact | Affected Requirements |
|---|-----------|------|--------|----------------------|
| D-1 | Live bookingtimes.com site access | External | Required for CSS scraping and preview fidelity validation | REQ-001, 002, 003, 009, 010, 011 |
| D-2 | Cloudflare platform (Pages, Workers, D1, R2, KV) | Infrastructure | Hosting and data storage for the entire application | All |
| D-3 | Claude API via OAuth | External | AI content generation and iterative refinement | REQ-021, 022, 023, 024 |
| D-4 | Bootstrap 5 CDN | External | Baseline CSS catalogue and preview stylesheet | REQ-001, 009 |
| D-5 | Font Awesome 6 Pro CDN | External | Icon class catalogue and preview stylesheet | REQ-001, 009 |
| D-6 | Queensland suburb dataset | Data | Structured local data for batch suburb page generation | REQ-013, 014, 015, 016, 029 |
| D-7 | bookingtimes.com WYSIWYG editor access | External | Validation of paste acceptance behavior (Assumption A-2) | REQ-008 |
| D-8 | SvelteKit + @sveltejs/adapter-cloudflare | Framework | Frontend framework with Cloudflare deployment adapter | All frontend requirements |

---

## 7. Open Questions

| # | Question | Why It Matters | Status |
|---|----------|---------------|--------|
| OQ-1 | What exactly does the bookingtimes.com WYSIWYG editor accept when HTML is pasted? Does it strip tags, classes, inline styles, or specific elements? | Directly determines what the export format can contain. If the editor strips classes, the approach must pivot to inline styles. This is the single highest-risk assumption (A-2). | Open -- test early via EVAL-BCE-008 |
| OQ-2 | Why did the previous template-based system produce "insufficient quality"? What were the specific failure modes? | Understanding past failures prevents repeating them. Was it content quality, structural issues, styling problems, or lack of localization? | Open |
| OQ-3 | How are the 5 sites structured on bookingtimes.com? Do they share a theme/template, or does each have independent styling? | Affects whether a single style catalogue works across all sites or whether per-site catalogues and templates are needed. EVAL-BCE-003 will reveal this empirically. | Open -- informed by REQ-003 |
| OQ-4 | What local data sources exist for the suburb pages? Is there a defined list of suburbs, and what per-suburb data is available? | The batch generation feature depends on having structured local data. If this data doesn't exist yet, its creation becomes a prerequisite. | Open |
| OQ-5 | How frequently do styles or layouts change on the bookingtimes.com platform? | Determines how aggressively scraped styles need to be refreshed and whether change detection (REQ-004) should be scheduled. | Open |
| OQ-6 | What does "randomization" mean in the context of the template system? Random selection from a set of approved variants? Dynamic content variation per page? | Architecture decision ADR-5 resolves this as deterministic variant selection from approved pools. Confirm with stakeholder. | Resolved (pending confirmation) |
| OQ-7 | What constitutes "local data and datasets" for suburb pages? Are these existing structured datasets, or data that needs to be researched/compiled? | Determines whether a data pipeline is needed upstream of content generation. | Open |
| OQ-8 | What is the acceptable threshold for "closely matches" in SC-2 visual comparison? What level of rendering deviation is tolerable? | Architecture decision ADR-3 targets SSIM >= 0.85. Confirm with stakeholder. | Resolved (pending confirmation) |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **bookingtimes.com** | A SaaS booking platform (ASP.NET Web Forms) used to host the 5 driving school websites. Functions as a booking system, not a CMS. |
| **CSS catalogue** | A structured inventory of all CSS class names and their associated properties available on a specific bookingtimes.com site. Generated by scraping. |
| **Content emulator** | The preview component that renders HTML content with the target site's actual CSS styles, providing a faithful visual preview before deployment. |
| **D1** | Cloudflare's serverless SQLite database service, used as the primary relational data store for this project. |
| **R2** | Cloudflare's S3-compatible object storage service, used for cached CSS files, export backups, and large datasets. |
| **KV** | Cloudflare's key-value storage service, used for high-speed caching of CSS catalogue lookups and preview render results. |
| **WYSIWYG editor** | The "What You See Is What You Get" editor provided by bookingtimes.com for content editing. Supports custom HTML/CSS/JS at body level. |
| **Body-level HTML** | HTML fragments that do not include DOCTYPE, html, head, or body wrapper tags. The only format accepted by the bookingtimes.com content area. |
| **Bare element selector** | A CSS selector that targets an HTML element by tag name only (e.g., `p`, `h2`, `table`) without a class or ID qualifier. Prohibited by bookingtimes.com platform rules. |
| **SSIM** | Structural Similarity Index Measure. An algorithm that quantifies visual similarity between two images. Used to compare preview rendering against live site screenshots. |
| **Batch generation** | The process of programmatically generating content pages for multiple suburbs from a single template and suburb data list. |
| **Variant pool** | A set of approved content alternatives for a template section, from which the system selects during generation to ensure content diversity. |
| **Non-destructive rollback** | A rollback mechanism that creates a new version (N+1) containing the content of a previous version (M), preserving the complete version history rather than overwriting. |
| **SvelteKit** | A full-stack web framework built on Svelte, deployed to Cloudflare Pages via the `@sveltejs/adapter-cloudflare` adapter. |
| **Bootstrap 5 (BS5)** | The CSS framework used by all 5 bookingtimes.com driving school sites. Provides the baseline class catalogue. |
| **Font Awesome 6 Pro** | The icon library available on bookingtimes.com sites. Icon classes are included in the CSS catalogue. |
| **OAuth** | The authentication protocol used to connect to the Claude API from the server-side Worker proxy. |
| **Deterministic shuffle** | A randomization method seeded by a fixed value (suburb name hash) that produces the same result on repeated runs, ensuring reproducible variant distribution. |
