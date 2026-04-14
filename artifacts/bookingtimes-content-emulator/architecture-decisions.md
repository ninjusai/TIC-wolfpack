---
title: "Bookingtimes.com Content Creation Emulator — Architecture Decisions"
version: "1.0.0"
status: draft
arch-id: ARCH-bookingtimes-content-emulator-001
references:
  - PRB-bookingtimes-content-emulator-001
  - EVL-bookingtimes-content-emulator-001
created: 2026-04-02
author: Architect
domain: content-management
project: bookingtimes-content-emulator
decision-count: 10
---

# Architecture Decisions: Bookingtimes.com Content Creation Emulator

## 1. Stack Selection

### Decision: SvelteKit frontend + Cloudflare Workers backend + D1 database

**Options Considered:**

| Option | Frontend | Backend | Database |
|--------|----------|---------|----------|
| A | React (Next.js on Pages) | Cloudflare Workers | D1 (SQLite) |
| B | SvelteKit (full-stack on Pages) | SvelteKit API routes on Workers | D1 (SQLite) |
| C | Vue (Nuxt on Pages) | Cloudflare Workers | D1 (SQLite) |
| D | Vanilla HTML + HTMX | Cloudflare Workers | KV (key-value) |

**Decision Made:** Option B — SvelteKit full-stack deployed to Cloudflare Pages with Workers API routes and D1 for persistence.

**Rationale:**
- SvelteKit has first-class Cloudflare adapter support (`@sveltejs/adapter-cloudflare`), producing a single deployment artifact that runs Pages + Workers together.
- Smaller bundle size than React/Vue equivalents — important for an internal tool that should feel fast.
- SvelteKit's server routes map naturally to Workers, avoiding a separate API deployment.
- D1 provides SQLite semantics (relational queries, joins, transactions) which fit the data model well — templates have sections, pages have versions, sites have catalogues. KV is too flat for these relationships.
- The team already deploys to Cloudflare (PeakProtocol precedent), reducing operational learning curve.

**Trade-offs:**
- Smaller ecosystem than React for UI component libraries, but the UI is straightforward (editor, preview pane, settings) and does not need a component library.
- Fewer developers know Svelte vs React — acceptable since this is a small internal tool, not a team project.

**Risks:**
- D1 is still in open beta. Mitigation: the data is reproducible (can re-scrape, re-generate), so catastrophic data loss is recoverable. Export critical data (templates, version history) to R2 as JSON backups on a schedule.

---

## 2. CSS Scraping Strategy

### Decision: Bootstrap 5 CDN baseline + targeted scraping of custom overrides only

**Options Considered:**

| Option | Approach | Complexity |
|--------|----------|------------|
| A | Full CSS scrape — download and parse every stylesheet from every page | High |
| B | Bootstrap 5 CDN baseline + scrape only custom/override stylesheets | Medium |
| C | Use browser DevTools protocol (Puppeteer/Playwright) to extract computed styles | Very High |
| D | Manual catalogue — human curates the class list | Low but unscalable |

**Decision Made:** Option B — Load the Bootstrap 5 CDN stylesheet as the known baseline. Then scrape each site's custom stylesheets (those not from CDNs) to capture overrides and additions. Merge into a per-site catalogue.

**Rationale:**
- Scout confirmed all 5 sites use Bootstrap 5 (migrated from BS3, 30,000+ pages). This means the vast majority of available classes are already documented in the Bootstrap 5 spec.
- Scraping only custom overrides dramatically reduces scraping complexity and produces a cleaner catalogue.
- The Bootstrap 5 class list is stable and well-documented — we can use the official source as ground truth rather than parsing minified CDN CSS.
- Custom scraping focuses on what matters: site-specific theme overrides, custom components, and Font Awesome 6 Pro icon classes.

**Implementation Approach:**
1. Bundle the full Bootstrap 5 class catalogue as a static asset (parsed from the official BS5 source CSS).
2. For each site, fetch the HTML of 3-5 representative pages and extract all `<link rel="stylesheet">` and `<style>` tags.
3. Filter out known CDN URLs (Bootstrap CDN, Font Awesome CDN).
4. Parse remaining stylesheets using a CSS parser (e.g., `css-tree` or `postcss`) to extract class selectors and their properties.
5. Merge: BS5 baseline + Font Awesome 6 icon classes + per-site custom classes = complete catalogue.
6. Store per-site catalogues in D1 with a `scraped_at` timestamp for freshness tracking.

**Trade-offs:**
- Misses any Bootstrap classes that the site has overridden with different property values. Mitigation: the custom stylesheet scrape catches overrides since they re-declare the same selectors.
- Does not capture dynamically-generated styles (e.g., JavaScript-injected). Acceptable: content pages on bookingtimes.com use server-rendered HTML, not dynamic JS styling.

**Risks:**
- If a site uses a custom build of Bootstrap (subset of classes), the baseline catalogue includes classes that do not actually work. Mitigation: add a "verified" flag — classes seen in actual page HTML are marked verified; baseline-only classes are marked "available but unverified." Export validation (SC-1) checks against verified classes by default.
- CORS may block stylesheet fetching from Workers. Mitigation: use a server-side fetch from the Worker (not browser-side), which is not subject to CORS.

---

## 3. Emulator/Preview Approach

### Decision: Sandboxed iframe with injected site stylesheets

**Options Considered:**

| Option | Approach | Fidelity | Isolation |
|--------|----------|----------|-----------|
| A | Shadow DOM with cloned stylesheets | Medium-High | High |
| B | Sandboxed iframe with injected stylesheets | High | Complete |
| C | Inline style conversion (no external CSS) | Low | N/A |
| D | Live proxy — embed the real site page and overlay content | Very High | Low |

**Decision Made:** Option B — Render the preview inside a sandboxed `<iframe>` that loads the Bootstrap 5 CSS, Font Awesome 6 CSS, and the site's custom stylesheets. The generated HTML is injected into the iframe body.

**Rationale:**
- An iframe provides complete CSS isolation — the app's own styles cannot leak into the preview and vice versa. This is critical because the bookingtimes.com rule about bare element selectors (never use `p`, `h2`, `table` without class/ID) means the site CSS may style bare elements for the backend. An iframe prevents that from affecting the editor UI.
- The iframe approach achieves the highest preview fidelity short of loading the actual site, because it renders with the real CSS in a real browser rendering context.
- Shadow DOM (Option A) has known issues with Bootstrap's global styles (BS5 relies on `:root` variables, `body` styles, and media queries that do not penetrate shadow boundaries correctly).
- The live proxy approach (Option D) introduces latency, CORS complexity, and risks breaking when the site changes. It also exposes the SaaS backend unnecessarily.

**Implementation Approach:**
1. Create an iframe with `sandbox="allow-same-origin"` (needed for stylesheet application but no script execution).
2. Build the iframe document: `<!DOCTYPE html><html data-bs-theme="light"><head>[stylesheets]</head><body>[generated content]</body></html>`.
3. Stylesheets loaded in order: Bootstrap 5 CDN, Font Awesome 6 CDN, then the site's custom CSS (fetched and cached in R2).
4. Apply the site's `[data-bs-theme]` attribute to match light/dark theme settings.
5. Responsive preview: allow the user to resize the iframe to test breakpoints (767px, 991px, 1200px) matching the platform's known breakpoints.
6. Live update: re-inject HTML into the iframe on each content change (debounced).

**Trade-offs:**
- Cannot capture styles that depend on the bookingtimes.com page structure outside the content area (e.g., styles conditional on a parent `.main-content` wrapper). Mitigation: wrap the preview content in a simulated parent structure matching the site's content area wrapper classes (discoverable via scraping).
- Fonts may not load if the site uses fonts served from its own domain. Mitigation: identify font URLs during scraping and proxy them through R2/Workers if needed.

**Risks:**
- Preview fidelity eval (SC-2, SSIM >= 0.85) may be hard to meet if the site's content area inherits significant styles from ancestor elements not replicated in the iframe. Mitigation: during scraping, capture the DOM structure of the content area wrapper (typically 2-3 ancestor divs) and replicate that wrapper in the iframe.
- Cross-origin stylesheet loading may be blocked. Mitigation: fetch stylesheets server-side (Worker), cache in R2, and serve from same origin.

---

## 4. AI Integration

### Decision: Server-side Claude proxy with structured conversation sessions stored in D1

**Options Considered:**

| Option | Approach |
|--------|----------|
| A | Direct browser-to-Claude API calls via OAuth token | 
| B | Server-side proxy (Worker) that manages Claude sessions, with frontend sending content requests |
| C | Pre-built AI chat component (e.g., Vercel AI SDK) |

**Decision Made:** Option B — A Cloudflare Worker endpoint proxies all Claude API calls. The frontend sends structured content requests (not raw prompts). The Worker constructs prompts using template rules, CSS catalogue context, and conversation history, then streams responses back to the frontend.

**Rationale:**
- Server-side prompt construction ensures the AI always receives the correct context (CSS catalogue, template rules, section constraints) without trusting the client to assemble it correctly.
- OAuth token management stays server-side, avoiding token exposure in browser code.
- Conversation history stored in D1 enables the iterative refinement loop (EVAL-BCE-022): the system can replay the full conversation context to Claude on each turn.
- Structured requests (e.g., `{action: "generate", section: "hero", suburb: "Springfield", site_id: 3}`) let the Worker build optimized prompts rather than relying on the user to write good prompts.

**Implementation Approach:**
1. **Conversation sessions:** Each content creation session gets a D1 record. Each turn (user request + AI response) is stored as a conversation turn record linked to the session.
2. **Prompt construction:** The Worker assembles the system prompt from:
   - Template definition (section structure, required classes, content rules)
   - CSS class catalogue (verified classes for the target site)
   - Platform constraints (body-level HTML only, no bare element selectors, no `<script>`/`<style>` tags)
   - Conversation history (previous turns in this session)
   - User's current request or feedback
3. **Streaming:** Use Claude's streaming API via the Worker, forwarding SSE events to the frontend for real-time display.
4. **Output validation:** Before returning the AI response to the frontend, validate the generated HTML against the CSS catalogue. Flag any unknown classes with warnings (do not silently strip them — let the user see and decide).
5. **Batch mode:** For batch generation, the Worker queues suburb requests and processes them sequentially (or with controlled concurrency) against Claude, storing results in D1 as they complete.

**Trade-offs:**
- Server-side proxy adds latency (extra hop). Minimal impact: Workers are fast and co-located with Claude API endpoints.
- Storing full conversation history in D1 grows storage over time. Mitigation: conversation history is text, so small. Implement a retention policy (archive sessions older than 90 days to R2).

**Risks:**
- Claude API rate limits during batch generation of 50+ suburb pages. Mitigation: implement exponential backoff and configurable concurrency (start with 1 concurrent request). The eval allows < 5 min/page average (EVAL-BCE-016), giving plenty of headroom.
- Prompt size limits when CSS catalogue + conversation history + template rules exceed Claude's context window. Mitigation: send only the relevant subset of the CSS catalogue (classes used in the target template section, not the full catalogue). Summarize older conversation turns.

---

## 5. Template System Design

### Decision: JSON-defined templates with section array, per-section rules, and variant pools

**Options Considered:**

| Option | Format | Flexibility |
|--------|--------|-------------|
| A | Markdown templates with frontmatter metadata | Low-Medium |
| B | JSON schema defining sections, rules, and variant pools | High |
| C | Visual template builder (drag-and-drop) | Very High (to build) |
| D | Handlebars/Mustache templates with helper functions | Medium |

**Decision Made:** Option B — Templates are JSON documents stored in D1. Each template defines an ordered array of sections. Each section specifies: HTML structure skeleton, required CSS classes, content constraints (word count, tone), and an optional pool of content variants for randomization.

**Rationale:**
- JSON is machine-readable, making it straightforward for the AI prompt builder to extract section rules and feed them to Claude.
- The section-array structure maps directly to the eval requirements: EVAL-BCE-015 checks section presence and ordering, EVAL-BCE-019 checks per-section class rules, EVAL-BCE-018 checks variant randomization.
- Handlebars (Option D) was rejected because the previous template system used simple find-and-replace and produced "insufficient quality." The problem is not template syntax — it is that AI-generated content with structural constraints produces better results than token replacement.
- A visual builder (Option C) is over-engineered for 5 sites and a single primary user.

**Template Structure:**
```json
{
  "template_id": "suburb-landing-v1",
  "name": "Suburb Landing Page",
  "site_ids": [1, 2, 3, 4, 5],
  "sections": [
    {
      "id": "hero",
      "order": 1,
      "required": true,
      "structure": "<div class=\"hero-banner\"><h2 class=\"hero-title\">{content}</h2><p class=\"hero-subtitle\">{content}</p></div>",
      "required_classes": ["hero-banner", "hero-title", "hero-subtitle"],
      "content_rules": {
        "hero-title": {"max_words": 10, "must_include": ["suburb_name"]},
        "hero-subtitle": {"max_words": 25, "tone": "welcoming"}
      },
      "variants": null
    },
    {
      "id": "intro",
      "order": 2,
      "required": true,
      "structure": "<div class=\"content-section\"><p class=\"lead\">{content}</p></div>",
      "required_classes": ["content-section", "lead"],
      "content_rules": {
        "lead": {"word_range": [50, 150], "must_include": ["suburb_name"], "tone": "professional, approachable"}
      },
      "variants": [
        {"id": "v1", "brief": "Focus on convenience and local access"},
        {"id": "v2", "brief": "Focus on safety record and experienced instructors"},
        {"id": "v3", "brief": "Focus on first-time learner friendliness"},
        {"id": "v4", "brief": "Focus on flexible scheduling and pass rates"}
      ]
    }
  ]
}
```

**Randomization:** When variants exist for a section, the batch generator selects one per suburb using a deterministic shuffle (seeded by suburb name hash) to ensure reproducible builds and even distribution across variants (satisfying EVAL-BCE-018's <= 40% skew requirement).

**Trade-offs:**
- JSON templates require manual editing or a simple form UI to create/modify. Acceptable for the small user base.
- Section structures use placeholder `{content}` markers that the AI fills — this is not the same as Handlebars variable substitution. The AI generates the actual HTML content within the structural skeleton.

**Risks:**
- Template schema may need to evolve as new section types are needed. Mitigation: use a flexible schema where unknown fields are ignored, and version the template format.

---

## 6. Export Strategy

### Decision: Body-level HTML fragment with class-only styling, validated before export

**Options Considered:**

| Option | Output Format |
|--------|---------------|
| A | Full HTML document (DOCTYPE, head, body) |
| B | Body-level HTML fragment with class-based styling only |
| C | Body-level HTML with inline styles |
| D | Markdown that the WYSIWYG editor converts |

**Decision Made:** Option B — Export produces a clean HTML fragment (no `<!DOCTYPE>`, `<html>`, `<head>`, or `<body>` tags) using only CSS classes for styling. No inline styles, no `<script>` tags, no `<style>` tags. All class names are validated against the target site's CSS catalogue before export.

**Rationale:**
- Scout confirmed that bookingtimes.com supports custom HTML/CSS/JS on pages but only at body level — no DOCTYPE/html/head tags. The export must be a body fragment.
- The CRITICAL platform rule (never use bare element selectors) is enforced at the AI generation level and validated at export time. All elements in the export must use class or ID selectors.
- Class-only styling (no inline styles) is preferred because inline styles are harder to maintain and may be stripped by the WYSIWYG editor. However, Assumption A-2 (paste behavior) is unvalidated — inline styles may need to be a fallback if classes are stripped on paste. This is a risk to test early (EVAL-BCE-008).

**Export Validation Pipeline:**
1. Parse the HTML fragment.
2. Extract all `class` attribute values.
3. Check every class against the target site's verified CSS catalogue.
4. Flag any unknown classes as errors (block export) or warnings (user override).
5. Validate HTML well-formedness (proper nesting, closed tags).
6. Check for disallowed elements (`<script>`, `<style>`, `<iframe>`, `<form>`).
7. Check for bare element selectors in any inline `style` attributes (should be none, but defensive check).
8. Produce a validation report before export.

**Copy-to-Clipboard Format:**
- The export button copies the validated HTML to the clipboard.
- Additionally, store the exported HTML in D1 with a version record and export timestamp.

**Trade-offs:**
- If the WYSIWYG editor strips class attributes on paste, the entire class-based approach fails. Fallback plan: generate inline styles derived from the CSS catalogue. This is higher effort but mechanically straightforward (resolve class to computed properties, emit as `style=""` attributes).
- No `<style>` tags in the export means no CSS custom properties or animations. Acceptable: content pages for driving schools do not need animations.

**Risks:**
- WYSIWYG paste behavior is undocumented (Open Question OQ-1, Assumption A-2). This is the single highest-risk assumption in the project. Mitigation: make EVAL-BCE-008 (paste acceptance test) the very first manual test performed. If classes are stripped, pivot to Option C (inline styles) before building the rest of the system.

---

## 7. Batch Generation Pipeline

### Decision: Queue-based pipeline with per-suburb jobs, AI generation, validation, and review gate

**Options Considered:**

| Option | Approach |
|--------|----------|
| A | Synchronous sequential — generate one page at a time, wait for completion |
| B | Queue-based with Durable Objects — parallel processing with rate limiting |
| C | Queue-based with D1 job table — sequential processing with status tracking |
| D | Offline batch script — generate all pages outside the app, import results |

**Decision Made:** Option C — A D1-backed job queue where each suburb is a job record. A Worker cron trigger or manual "start batch" action processes jobs sequentially. Each job: constructs the prompt with suburb data, calls Claude, validates the output, stores the result, and updates the job status.

**Rationale:**
- Sequential processing is simpler and avoids Claude API rate limit issues. At < 5 min/page (EVAL-BCE-016 target), 50 suburbs completes in < 4 hours — acceptable for an internal tool with no deadline pressure.
- D1 job table provides built-in status tracking (pending, processing, complete, failed, needs_review) and allows the user to monitor progress, retry failures, and review results.
- Durable Objects (Option B) add complexity and cost for parallelism that is not needed given the scale (50 suburbs, not 5,000).

**Pipeline Steps:**
1. **Input:** User selects a template, a target site, and uploads/selects a suburb list (CSV or JSON: suburb name, region, postcode, latitude/longitude).
2. **Data Enrichment:** For each suburb, enrich with local data. Sources:
   - Static dataset bundled with the app (distances, landmarks, region names for QLD suburbs).
   - Optionally, user-provided supplementary data per suburb (custom notes, specific selling points).
3. **Job Creation:** One D1 record per suburb, status = `pending`.
4. **Processing:** Worker picks the next `pending` job, constructs the Claude prompt (template rules + suburb data + CSS catalogue + platform constraints), calls Claude, receives HTML content.
5. **Validation:** Automated checks on the generated HTML:
   - No placeholder tokens (EVAL-BCE-013).
   - Suburb data accuracy — suburb name appears, no cross-contamination (EVAL-BCE-014).
   - Section structure matches template (EVAL-BCE-015).
   - All CSS classes verified (SC-1).
   - HTML well-formedness.
6. **Result Storage:** Validated HTML stored in D1 (or R2 if large). Job status = `complete` or `needs_review` if validation warnings exist.
7. **Review Gate:** User reviews generated pages in the preview pane, can approve, edit, or regenerate individual pages.
8. **Export:** Approved pages can be exported individually or as a batch (zip of HTML files).

**Suburb Data Sourcing:**
- Bundle a static JSON dataset of QLD suburbs with basic data (name, postcode, region, approximate distance to Brisbane CBD, notable landmarks). This can be compiled from publicly available ABS and geographic data.
- The user can supplement or override data per suburb through the UI.
- For batch generation, missing data fields trigger a graceful fallback (EVAL-BCE-029): the AI generates content without the missing data point rather than inserting placeholders.

**Trade-offs:**
- Sequential processing is slow for large batches. Acceptable given the "no deadline" constraint and small scale.
- Static suburb data may be incomplete or outdated. Mitigation: allow user overrides and display data source/date.

**Risks:**
- AI-generated content may fail validation frequently, requiring many retries. Mitigation: strong system prompts with explicit constraints, and retry with adjusted prompts (up to 3 attempts per job before marking as `failed`).

---

## 8. Version History

### Decision: Append-only version records in D1 with full HTML snapshots

**Options Considered:**

| Option | Storage | Rollback |
|--------|---------|----------|
| A | Store diffs only (delta compression) | Reconstruct by replaying diffs |
| B | Store full HTML snapshot per version | Direct retrieval, no reconstruction |
| C | Git-based version control (libgit2 in Worker) | Full git semantics |
| D | Store in R2 as versioned objects | S3-style versioning |

**Decision Made:** Option B — Each version is a full HTML snapshot stored as a D1 record. Rollback retrieves the target version's snapshot directly and creates a new version record (non-destructive rollback per EVAL-BCE-026).

**Rationale:**
- Full snapshots are simple to implement and retrieve. No reconstruction logic needed.
- Content pages are small (typically 5-50 KB of HTML), so storage cost is negligible even with hundreds of versions.
- D1 handles this well — a versions table with `page_id`, `version_number`, `html_content`, `created_at`, `source` (manual/ai/batch/rollback), and `change_summary`.
- Non-destructive rollback (creates version N+1 with content from version M) preserves full history, satisfying EVAL-BCE-026.
- Git-based (Option C) is over-engineered. Delta compression (Option A) adds complexity for minimal storage savings given the small content size.

**Implementation:**
```sql
CREATE TABLE page_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai_generate', 'ai_refine', 'batch', 'rollback')),
  change_summary TEXT,
  parent_version INTEGER,
  UNIQUE(page_id, version_number)
);
```

**Trade-offs:**
- Full snapshots use more storage than diffs. At 50 KB per version and 100 versions per page across 250 pages (50 suburbs x 5 sites), total is ~1.25 GB. Well within D1 limits and trivial cost.
- No semantic diff — the system stores what changed as a text summary but does not compute a structural HTML diff. Acceptable: a text diff can be computed on-demand in the frontend.

**Risks:**
- D1 row size limits. D1 supports up to 1 MB per row, and content pages will be well under this. No risk in practice.

---

## 9. Data Model

### Decision: Relational model in D1 with 7 core entities

**Core Entities and Relationships:**

```
sites ──────────< css_catalogues
  │                    │
  │                    ├── catalogue_classes (class name, properties, verified flag)
  │                    │
  └───< pages ────────< page_versions
          │
          └── page_id references template sections
          
templates ──────< template_sections
                      │
                      └── section_variants

ai_sessions ────< ai_turns
  │
  └── linked to page_id

batch_jobs
  │
  └── linked to template_id, site_id, suburb data
```

**Entity Definitions:**

| Entity | Key Fields | Storage |
|--------|-----------|---------|
| `sites` | id, name, url, theme (light/dark), last_scraped_at | D1 |
| `css_catalogues` | id, site_id, scraped_at, bootstrap_version | D1 |
| `catalogue_classes` | id, catalogue_id, class_name, css_properties (JSON), source (bootstrap/fontawesome/custom), verified | D1 |
| `templates` | id, name, description, site_ids (JSON array), created_at, updated_at | D1 |
| `template_sections` | id, template_id, section_id, order, required, structure_html, required_classes (JSON), content_rules (JSON), variants (JSON) | D1 |
| `pages` | id, site_id, template_id, suburb_name, slug, current_version, status, created_at | D1 |
| `page_versions` | id, page_id, version_number, html_content, source, change_summary, created_at | D1 |
| `ai_sessions` | id, page_id, started_at, turn_count | D1 |
| `ai_turns` | id, session_id, role (user/assistant), content, created_at | D1 |
| `batch_jobs` | id, template_id, site_id, suburb_data (JSON), status, started_at, completed_at, error_message | D1 |
| `suburb_data` | id, name, postcode, region, distance_cbd_km, landmarks (JSON), custom_notes | D1 |

**Rationale:**
- The relational model captures the natural relationships: sites have catalogues, pages have versions, templates have sections, sessions have turns.
- JSON columns (css_properties, content_rules, variants) provide flexibility for nested data without over-normalizing.
- Separate `catalogue_classes` table enables efficient class validation queries (WHERE class_name = ? AND catalogue_id = ?).
- `suburb_data` as its own table enables reuse across batch jobs and templates.

**Trade-offs:**
- D1 has no full-text search. If search is needed later (find pages containing specific text), add a search index or use KV as a secondary index.
- JSON columns trade query flexibility for schema flexibility. Acceptable: these fields are read as whole objects, not queried by nested keys.

**Risks:**
- D1 query performance with large catalogues (thousands of classes across 5 sites). Mitigation: index on `(catalogue_id, class_name)` for O(log n) lookups.

---

## 10. Deployment Architecture

### Decision: Single Cloudflare Pages project with Workers functions, D1 for data, R2 for assets, KV for caching

**Architecture Diagram:**

```
                     User Browser
                          │
                          ▼
              ┌───────────────────────┐
              │   Cloudflare Pages    │
              │   (SvelteKit SSR)     │
              │                       │
              │  ┌─────────────────┐  │
              │  │  Static Assets  │  │
              │  │  (JS, CSS, img) │  │
              │  └─────────────────┘  │
              │                       │
              │  ┌─────────────────┐  │
              │  │  Workers        │  │
              │  │  (API Routes)   │  │
              │  │                 │  │
              │  │  /api/scrape    │  │
              │  │  /api/generate  │  │
              │  │  /api/export    │  │
              │  │  /api/templates │  │
              │  │  /api/batch     │  │
              │  │  /api/ai/*     │  │
              │  └────────┬────────┘  │
              └───────────┼───────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │    D1    │  │    R2    │  │    KV    │
    │ Database │  │  Assets  │  │  Cache   │
    │          │  │          │  │          │
    │ - sites  │  │ - cached │  │ - CSS    │
    │ - pages  │  │   CSS    │  │   catalogue│
    │ - templ. │  │   files  │  │   lookups│
    │ - vers.  │  │ - export │  │ - preview│
    │ - ai_    │  │   backups│  │   render │
    │   sessions│ │ - suburb │  │   cache  │
    │ - batch  │  │   data   │  │          │
    │ - suburb │  │   files  │  │          │
    │ - css_   │  │          │  │          │
    │   catalog│  │          │  │          │
    └──────────┘  └──────────┘  └──────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Claude API          │
              │   (via OAuth)         │
              │   - Content generation│
              │   - Iterative refine  │
              │   - Batch processing  │
              └───────────────────────┘
```

**Service Mapping:**

| Cloudflare Service | Usage |
|--------------------|-------|
| **Pages** | Hosts the SvelteKit frontend (SSR + static assets). Single deployment via `@sveltejs/adapter-cloudflare`. |
| **Workers** | API routes for scraping, generation, export, AI proxy, and batch processing. Part of the same Pages deployment (SvelteKit server routes). |
| **D1** | Primary database for all relational data (see Data Model above). Single database instance. |
| **R2** | Object storage for cached CSS files (scraped stylesheets), export backups, and large suburb datasets. Also serves as a backup target for D1 data exports. |
| **KV** | High-speed cache for frequently accessed data: resolved CSS catalogue lookups (class name to properties), preview render cache (content hash to rendered HTML). TTL-based expiry. |
| **Cron Triggers** | Optional: scheduled re-scrape of site CSS (e.g., weekly) to detect style changes (EVAL-BCE-004). Also usable for batch job processing if the user starts a batch and closes the browser. |

**Deployment Pipeline:**
1. Code pushed to GitHub repository.
2. Cloudflare Pages auto-deploys from the main branch.
3. D1 migrations applied via Wrangler CLI as part of deploy.
4. Preview deployments on pull requests for testing.

**Rationale:**
- Single Pages project avoids the operational overhead of separate Workers deployments.
- D1 + R2 + KV covers the full spectrum of storage needs (relational, blob, cache).
- No authentication needed (internal tool constraint), so no auth middleware required.
- Cloudflare's global edge network provides low-latency access from Queensland, Australia.

**Trade-offs:**
- Tied to Cloudflare ecosystem. Acceptable: the constraint specifies Cloudflare deployment, and the team has Cloudflare operational experience.
- Workers have a 30-second CPU time limit (50ms on free plan, but Pages/Workers bundled has higher limits). Batch processing that calls Claude may exceed this per request. Mitigation: batch processing uses a queue pattern where each job is a separate Worker invocation triggered by cron or the previous job's completion, not a single long-running request.

**Risks:**
- D1 is in beta and may have availability issues. Mitigation: critical data (templates, version history) backed up to R2 on a schedule. The tool is internal and can tolerate brief downtime.
- Worker memory limits (128 MB) could be hit when parsing very large CSS files. Mitigation: stream-parse CSS files rather than loading entire files into memory.

---

## Appendix A: Decision Dependency Map

```
Stack Selection (1)
    ├── CSS Scraping Strategy (2) ─── depends on backend runtime
    ├── Emulator/Preview (3) ─── depends on frontend framework
    ├── AI Integration (4) ─── depends on backend runtime
    ├── Data Model (9) ─── depends on database choice
    └── Deployment (10) ─── depends on all of the above

Template System (5) ─── depends on Data Model (9), AI Integration (4)
Export Strategy (6) ─── depends on CSS Scraping (2), Platform Research
Batch Pipeline (7) ─── depends on Template System (5), AI Integration (4), Data Model (9)
Version History (8) ─── depends on Data Model (9)
```

## Appendix B: Key Platform Constraints Reference

These constraints from Scout's platform research directly inform multiple decisions:

| Constraint | Decisions Affected | How It Manifests |
|------------|-------------------|------------------|
| Bootstrap 5 base framework | CSS Scraping (2), Preview (3), Export (6) | Baseline catalogue, known class set, CDN loading in iframe |
| Font Awesome 6 Pro | CSS Scraping (2), Template System (5) | Icon classes included in catalogue, usable in templates |
| Body-level HTML only | Export (6), AI Integration (4) | No DOCTYPE/html/head in export; AI instructed accordingly |
| No bare element selectors | Export (6), AI Integration (4), Preview (3) | Validation rejects bare selectors; AI system prompt enforces; iframe isolates |
| [data-bs-theme] light/dark | Preview (3), Data Model (9) | Theme attribute on iframe html element; stored per-site |
| Responsive breakpoints: 767/991/1200px | Preview (3) | Iframe resize presets |
| No public API | Export (6), Batch Pipeline (7) | Copy-paste only; no programmatic deployment |
| Paste behavior unknown (A-2) | Export (6) | CRITICAL: test early; inline-style fallback plan ready |
| ASP.NET Web Forms SaaS | CSS Scraping (2), Preview (3) | Server-rendered HTML; no dynamic JS styles to worry about |

## Appendix C: Eval Traceability

| Decision | Key Eval Cases | How Decision Supports Eval |
|----------|---------------|---------------------------|
| CSS Scraping (2) | EVAL-BCE-001, 002, 003, 004 | BS5 baseline + custom scrape ensures catalogue completeness; per-site catalogues enable cross-site overlap detection |
| Export (6) | EVAL-BCE-005, 006, 007, 008 | Pre-export validation pipeline catches unknown classes, structural errors, and cross-site contamination |
| Preview (3) | EVAL-BCE-009, 010, 011, 012 | Iframe with real CSS achieves high visual fidelity; stylesheet refresh updates preview |
| Batch Pipeline (7) | EVAL-BCE-013, 014, 015, 016 | Validation step in pipeline catches placeholders, data errors, structural issues; sequential processing scales to 50 suburbs |
| Template System (5) | EVAL-BCE-017, 018, 019, 020 | JSON sections with rules enable structural validation; deterministic variant shuffle ensures distribution |
| AI Integration (4) | EVAL-BCE-021, 022, 023, 024 | Server-side prompt construction with constraints produces conformant HTML; conversation history enables iterative refinement |
| Version History (8) | EVAL-BCE-025, 026, 027, 028 | Append-only versions with metadata satisfy all version history evals; D1 persistence survives restarts |
| Data Model (9) | All | Relational model supports all query patterns required by eval validation |
