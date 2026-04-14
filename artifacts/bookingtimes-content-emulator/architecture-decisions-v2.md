---
title: "Architecture Decisions: Bookingtimes Content Emulator V2.1 Rebuild"
version: "1.0.0"
status: complete
arch-id: ARCH-bookingtimes-content-emulator-002
references:
  - PRB-bookingtimes-content-emulator-002
  - design-v2.1.md
  - architecture-decisions.md (V1 — partially superseded)
created: 2026-04-02
author: Architect
domain: content-management
project: bookingtimes-content-emulator
decision-count: 24
supersedes-partially: ARCH-bookingtimes-content-emulator-001
---

# Architecture Decisions: Bookingtimes Content Emulator V2.1 Rebuild

## 1. Architecture Overview

The V2.1 system is a **local-first, pipeline-driven content intelligence platform** that audits, benchmarks, plans, and generates SEO/GEO-optimized HTML content for 5 Australian driving school websites on the BookingTimes SaaS platform.

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        LOCAL MACHINE (Node.js)                            │
│                                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │  SvelteKit   │    │  better-     │    │  Filesystem                  │  │
│  │  (Svelte 5   │◄──►│  sqlite3     │    │  - CSS cache                │  │
│  │   + runes)   │    │  (sync)      │    │  - Scraped HTML             │  │
│  │              │    │              │    │  - Export artifacts          │  │
│  │  adapter-    │    │  25+ tables  │    │  - Brand examples           │  │
│  │  node        │    │  (see ADR-   │    │  - Scribe checkpoints       │  │
│  │              │    │   011)       │    │                              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────────────────┘  │
│         │                   │                                              │
│         │    ┌──────────────┴──────────────┐                              │
│         └───►│  Claude CLI subprocess      │                              │
│              │  `claude -p` via stdin      │                              │
│              │  Max subscription           │                              │
│              │  Stateless, single-turn     │                              │
│              └─────────────────────────────┘                              │
└────────────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│  5 BookingTimes  │          │  Google Search       │
│  driving school  │          │  Console API         │
│  websites        │          │  (optional)          │
│  (scrape source  │          │                      │
│   + paste target)│          │                      │
└─────────────────┘          └─────────────────────┘
```

### Key Architectural Principles

1. **Pipeline-first.** Content never starts from scratch. Every page passes through Audit -> Benchmark -> Gap Analysis -> Blueprint -> Generate. No stage is skippable.
2. **Section-based generation.** One Claude call per section, not per page. Prevents content drift and enables per-section review.
3. **Infer-first.** Brand voice is extracted from existing content, not manually entered.
4. **Link graph before content.** The internal linking structure is planned before any content generation begins.
5. **Learning compounds.** Every approved section enriches the brand profile for subsequent generations.
6. **Platform-aware.** All output is constrained by BookingTimes' code-view paste, Bootstrap 5.0.2, fixed sidebars on long-tail pages, and body-only HTML.

---

## 2. Architecture Decision Records

### ADR-011: Relational Data Model with 25+ Tables in better-sqlite3

**Context:** The V2.1 pipeline introduces multi-dimensional auditing, gap analysis, link graphs, anchor text rotation, section-level blueprints, brand learning, and freshness tracking. The V1 data model had 7 core entities designed for template-based batch generation. The V2.1 pipeline requires tracking state across 5 stages per site, per-section generation state, and a feedback loop that compounds across sessions.

**Decision:** Implement a relational schema of 25+ tables in a single better-sqlite3 database file. Tables fall into five functional groups:

| Group | Tables | Purpose |
|-------|--------|---------|
| **Core** | `sites`, `pages`, `page_versions`, `ai_sessions`, `ai_turns` | Site registry, content storage, version history, AI interaction log |
| **Brand Intelligence** | `brand_profiles`, `brand_rules`, `brand_examples`, `brand_profile_history` | Inferred and refined brand voice per site |
| **Audit & Benchmark** | `site_structure_map`, `content_audit`, `schema_audit`, `css_audit`, `benchmark_standards`, `page_taxonomy` | What exists, what should exist |
| **Planning** | `gap_analysis`, `work_backlog`, `page_blueprints`, `section_specs`, `silo_definitions`, `internal_link_graph`, `anchor_text_bank`, `css_patterns`, `css_decisions` | What to build, in what order, with what structure |
| **Operations** | `gsc_metrics`, `scribe_checkpoints`, `content_freshness` | External data, session persistence, staleness tracking |

**Rationale:**

- The domain is deeply relational: sites have pages, pages have sections, sections have specs, specs reference link graphs and anchor banks. Flat or document-based storage would require constant manual joins.
- better-sqlite3 is synchronous, which simplifies SvelteKit server route handlers. No async/await overhead for database calls.
- 25+ tables may seem large, but each table has a clear, single responsibility. The alternative (fewer tables with JSON blobs) would push complexity into application code and make queries like "find all sections for site X in stage pending" impossible without JSON parsing.
- Foreign keys with `site_id` on nearly every table enable cross-site queries for the future platform vision without schema changes.

**Consequences:**

- Migration management is critical. Use a versioned migration system (numbered SQL files applied in order) rather than ORM auto-migration.
- Indexes must be planned upfront for performance-critical queries: `(site_id, status)` on `work_backlog`, `(site_id, class_name)` on `css_audit`, `(site_id, target_url, anchor_text)` on `anchor_text_bank`.
- The database file will grow over time (brand examples, page versions, AI turns). At projected scale (5 sites, ~60 pages each, ~8 sections per page, ~5 versions per page) this is under 500MB. Periodic archival of old AI turns and page versions to filesystem JSON backup is a low-priority enhancement.

**Key Table Structures:**

```sql
-- Core site registry
CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  bootstrap_version TEXT DEFAULT '5.0.2',
  pipeline_stage TEXT DEFAULT 'not_started' CHECK (pipeline_stage IN (
    'not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'maintaining'
  )),
  last_scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Section-level generation tracking
CREATE TABLE section_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blueprint_id INTEGER NOT NULL REFERENCES page_blueprints(id),
  section_type TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  heading_text TEXT,
  target_word_count_min INTEGER,
  target_word_count_max INTEGER,
  content_requirements TEXT,       -- JSON
  links_required TEXT,             -- JSON: [{url, anchor_text, anchor_variant}]
  css_classes TEXT,                -- JSON
  design_pattern TEXT,
  direct_answer_block_required INTEGER DEFAULT 0,
  faq_questions TEXT,              -- JSON
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'generated', 'approved', 'rejected'
  )),
  generated_html TEXT,
  generation_attempt_count INTEGER DEFAULT 0,
  last_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Content freshness tracking
CREATE TABLE content_freshness (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  page_url TEXT NOT NULL,
  last_generated_at TEXT,
  last_approved_at TEXT,
  last_deployed_at TEXT,           -- Manually marked by operator
  freshness_status TEXT DEFAULT 'unknown' CHECK (freshness_status IN (
    'fresh', 'aging', 'stale', 'unknown'
  )),
  next_review_due TEXT,
  alert_sent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, page_url)
);
```

Full schema definitions for all tables are specified in the design-v2.1.md sections 8.1-8.3. This ADR ratifies that schema as the implementation target.

---

### ADR-012: 5-Stage Pipeline with Per-Site Independent Progression

**Context:** The pipeline (Audit -> Benchmark -> Gap Analysis -> Blueprint -> Generate) must handle 5 sites. Should sites progress together or independently? Stages 1 and 2 have different scope: Stage 1 is per-site, Stage 2 is domain-wide (shared research).

**Decision:** Each site progresses through the pipeline independently. The `sites.pipeline_stage` column tracks each site's current stage. Stage 2 (Research & Benchmark) produces domain-wide outputs shared across all sites. A site can enter Stage 3 once both its Stage 1 AND Stage 2 (global) are complete.

Pipeline dependency graph:
```
Site A: Stage 1 ──┐
Site B: Stage 1 ──┤──► Stage 3 (per site, requires Stage 1 for THAT site + Stage 2)
Site C: Stage 1 ──┤
                  │
Stage 2 (global) ─┘
```

Stages 3, 4, and 5 are strictly per-site and sequential within each site.

**Rationale:**

- Sites have different content maturity levels. A site with 80 pages needs more audit work than a site with 5 pages. Forcing them to advance together wastes time.
- Stage 2 is domain research (what does a great driving school website look like?). This is identical across all 5 sites and should be done once.
- Independent progression enables starting with a pilot site (answering OQ-9) while other sites remain at Stage 1.

**Consequences:**

- The UI must show per-site pipeline status.
- Stage 2 tables (`benchmark_standards`, `page_taxonomy`) have no `site_id` foreign key -- they are global.
- Stage 3+ tables all have `site_id` -- they are per-site.
- A Scribe checkpoint fires at every stage transition per site.

---

### ADR-013: Section-Based Generation with 12-Layer Context Assembly

**Context:** V1 used whole-page generation (one Claude call per page). This caused content drift: later sections lost coherence with earlier ones as the model's attention wandered. V2.1 needs per-section generation with rules cascading from global to section-level.

**Decision:** Each section of a page is generated by a separate `claude -p` CLI call. Context is assembled in 12 layers per call:

| Layer | Content | Approx Tokens |
|-------|---------|---------------|
| 1 | Platform constraints (body-only HTML, no bare selectors, sidebar awareness) | 200 |
| 2 | Brand profile (voice, tone, terminology) | 300-500 |
| 3 | Brand rules (filtered to relevant scope) | 200-800 |
| 4 | Section specification (from blueprint) | 200-400 |
| 5 | Page-level context (SEO requirements, target keywords) | 300-500 |
| 6 | Internal linking targets for this section | 100-300 |
| 7 | GEO requirements for this section | 100-200 |
| 8 | CSS class palette (tiered, filtered to relevant classes) | 200-400 |
| 9 | Previously generated sections from this page (for continuity) | 500-3000 |
| 10 | Approved examples from previous pages (few-shot) | 500-2000 |
| 11 | Suburb/location data (if applicable) | 100-300 |
| 12 | Output format instructions | 100-200 |
| **Total** | | **~3,000-8,500** |

**Rationale:**

- Section-level calls keep each generation focused on a single concern (hero, FAQ, services overview, etc.).
- Per-section review and regeneration are possible without affecting other sections.
- Layer 9 (previously generated sections) maintains coherence across sections within a page.
- Layer 10 (approved examples) is how the learning loop materializes in generation -- approved hero sections from previous pages become few-shot examples for new hero sections.
- Token budget per call is 3,000-8,500 tokens of context plus output. Well within Claude's limits and much smaller than a whole-page call would require.

**Consequences:**

- A page with 8 sections requires 8 Claude CLI calls plus 1 coherence pass = 9 total calls per page.
- Sequential processing within a page (each section needs the previous sections as context). No intra-page parallelism.
- The prompt assembly module is the most complex component in the system. It must query multiple tables (brand_profiles, brand_rules, section_specs, css_audit, internal_link_graph, anchor_text_bank, brand_examples) and assemble them into a coherent prompt.
- Rate limiting on `claude -p` is a risk. Build in configurable delay between calls (default: 2 seconds). Monitor and adjust.

---

### ADR-014: Claude CLI Subprocess Integration (Retained from DEC-014)

**Context:** DEC-014 established `claude -p` CLI subprocess as the AI integration method after all OAuth/API approaches failed due to rate limits. V2.1 retains this approach.

**Decision:** Retain `claude -p` CLI subprocess for all AI calls. Single-turn, stateless. The application is the memory; Claude is the muscle.

Implementation specifics:
- `child_process.spawn("claude", ["-p", ...])` with prompt piped via stdin (Windows cmd line length limit prevents passing as argument).
- Strip `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY` from subprocess env.
- Parse stdout as the response. Handle stderr for errors.
- Timeout: 120 seconds per call (configurable). Sections should generate in 10-30 seconds.
- Retry: up to 3 attempts per section with exponential backoff (2s, 4s, 8s).

**Rationale:** Unchanged from DEC-014. The CLI subprocess leverages Max subscription credentials without rate limit issues. Single-turn calls with rich context assembly match the section-based generation model perfectly.

**Consequences:**

- No streaming. Each section generation blocks until complete. Acceptable for a single-user tool.
- No conversation memory in Claude. All context must be assembled per call. This is by design -- the database is the memory, not Claude's conversation state.
- CLI must be installed and authenticated on the operator's machine. This is a prerequisite, not a runtime concern.

---

### ADR-015: Brand Voice Inference Pipeline

**Context:** V2 proposed manual brand profile entry. The human rejected this as friction-heavy. V2.1 requires automated inference from existing content.

**Decision:** Brand voice is inferred through a three-phase process:

**Phase 1: Extraction (Stage 1)**
- Scrape 5-10 representative pages per site (homepage + service pages + 2-3 location pages).
- For each page, extract: sentence structure patterns, vocabulary frequency, tone markers, recurring phrases, CTA patterns, formality level, use of second person, technical vs. accessible language.
- Use a Claude CLI call with the extracted text to produce a structured brand profile: `voice_description`, `tone_keywords`, `terminology_patterns`, `sentence_style`, `recurring_phrases`, `anti_patterns`.
- Store in `brand_profiles` with `inference_confidence` (0.0-1.0) based on `source_page_count`.

**Phase 2: Confirmation (Stage 1 Gate)**
- Present the inferred profile to the operator in a review UI.
- Operator confirms, adjusts, or overrides fields.
- Set `user_confirmed = 1` on the profile.

**Phase 3: Enrichment (Stage 5, ongoing)**
- Every approved section reinforces voice patterns (positive signal).
- Every refinement or rejection adds corrective rules to `brand_rules`.
- Brand profile history tracks evolution via `brand_profile_history` snapshots.
- After 15-20 approved pages, the profile should be mature enough for batch generation with minimal edits.

**Rationale:**

- Existing content IS the brand voice. The best way to learn it is to analyze it.
- A thin site (few pages) will produce a low-confidence profile. The system handles this gracefully: `inference_confidence < 0.5` triggers a warning prompting more operator input.
- The enrichment phase means the profile gets better even if initial inference is imperfect.

**Consequences:**

- Stage 1 requires scraping actual page content (not just CSS/structure). The scraper must extract rendered text content.
- Brand profiles are per-site. Voice NEVER transfers between sites. Design patterns (layout, CSS) can transfer; voice cannot.
- The inference Claude call needs enough source content to be meaningful. Minimum 3 pages with 500+ words each.

---

### ADR-016: Three-Tier CSS Strategy with Bootstrap 5.0.2

**Context:** Live sites run Bootstrap 5.0.2 (confirmed by inspection). V1 assumed 5.3.3 (DEC-008, now superseded by DEC-028). The system must generate HTML using only CSS classes that actually work on the platform.

**Decision:** CSS is organized in three tiers:

| Tier | Source | Policy | How Identified |
|------|--------|--------|----------------|
| **1: Bootstrap Base** | CDN (Bootstrap 5.0.2) | Use freely. Never modify. | Match against known BS 5.0.2 class catalogue |
| **2: Site Custom CSS** | Site's own stylesheets (per-site `LoadCSS?k=` files) | Use where appropriate. Extend where needed. | Everything remaining after filtering out Bootstrap, platform CSS, FA6, and third-party libraries |
| **3: New Custom CSS** | Created by the system | Create when needed. Must be approved. | Generated by the system, reviewed by operator, added to site's custom CSS file |

**Bootstrap 5.0.2 vs 5.3.3 Gap Analysis (addressing OQ-4):**

Key features NOT available in 5.0.2 that exist in 5.1-5.3:

| Feature | Added In | Impact on V2.1 |
|---------|----------|-----------------|
| CSS custom properties (CSS variables) for all components | 5.1.0 | **Medium.** Cannot use `--bs-*` variables for theming. Must use class-based approaches. |
| `.text-bg-{color}` utilities | 5.2.0 | **Low.** Use separate `.text-*` + `.bg-*` classes instead. |
| Dark mode via `data-bs-theme` | 5.3.0 | **Low.** Sites use light theme. Not a concern. |
| `.z-*` z-index utilities | 5.3.0 | **Low.** Use inline styles or Tier 3 CSS for z-index if needed. |
| New link utilities, focus ring utilities | 5.3.0 | **Low.** Use existing link and focus classes. |
| Revised color system | 5.3.0 | **Medium.** Must use 5.0.2 color classes. The color palette is more limited. |

**Mitigation strategy:** Build a validated BS 5.0.2 class catalogue by parsing the actual 5.0.2 source CSS. The prompt assembler (Layer 8 in ADR-013) only offers classes from this validated catalogue. Any class from 5.1+ that Claude might "know" about is filtered out before it reaches the prompt.

**Rationale:**

- Pinning to 5.0.2 eliminates the risk of generating HTML with classes that don't exist on the live site.
- BookingTimes updates are rare and global. The platform is unlikely to upgrade Bootstrap mid-project. If it does, re-scrape and rebuild the catalogue.
- Tier 3 CSS (new custom styles) provides an escape hatch for any visual capability that BS 5.0.2 lacks.

**Consequences:**

- Must obtain or build a complete Bootstrap 5.0.2 class catalogue. The BS5 source CSS for 5.0.2 is available from CDN/GitHub.
- CSS custom properties cannot be relied upon for theming. Per-site color must come from Tier 2 custom CSS.
- The design doc references `data-bs-theme` (5.3 feature). This is NOT available. Remove from implementation. Sites are light-only.
- Font Awesome 6 Pro is separately catalogued from FA6's CSS. Self-hosted via platform, loaded per customer.

---

### ADR-017: JavaScript Interactivity Tiers

**Context:** DEC-034 established interactive JS as a priority. Scout's research confirmed multiple JS pathways exist on BookingTimes. The key uncertainty is whether `<script>` tags survive TinyMCE paste in the code view editor.

**Decision:** Implement a three-tier interactivity model:

**Tier 1: CSS-Only (Guaranteed)**
- Animations, transitions, hover effects via CSS
- `<details>`/`<summary>` for native HTML accordions
- Checkbox hack for toggle visibility
- `:target` selector for anchor-based tab switching
- CSS scroll-snap for carousel-like scrolling
- No JavaScript required. Always works.

**Tier 2: Head Injection + Content HTML Hooks (High Confidence)**
- JavaScript added via BookingTimes Setup > Analytics & Tracking > `<head>` tag
- Content HTML uses CSS classes and `data-*` attributes as hooks
- JS in `<head>` queries DOM for `.bce-interactive-*` classes and `data-bce-*` attributes
- Separation of concerns: JS lives in `<head>`, HTML structure in content editor
- One-time setup per site (add the JS to `<head>` once, then all content pages can use it)
- jQuery is available globally (platform-bundled)

**Tier 3: Inline JavaScript (Unconfirmed -- Needs Manual Test)**
- `<script>` tags directly in pasted content
- Inline event handlers (`onclick`, `onmouseover`)
- May be stripped by TinyMCE's DOMPurify sanitization
- Until confirmed via manual testing (see Scout's test protocol), do NOT rely on this tier

**Implementation approach:**
1. Build all interactive elements using Tier 1 first. This is the baseline.
2. Generate a `<head>` JavaScript bundle per site for Tier 2. This bundle:
   - Uses `document.addEventListener('DOMContentLoaded', ...)` 
   - Queries for `[data-bce-*]` attributes in the page content
   - Applies interactive behaviors (accordion expand, tab switch, calculator logic, etc.)
   - Uses jQuery `$()` since it's guaranteed available
3. If manual testing confirms Tier 3 works, generate inline `<script>` blocks as a convenience alternative.

**Rationale:**

- Tiered approach de-risks the JS uncertainty. Tier 1 works regardless. Tier 2 has high confidence based on Scout's research (GA, FB pixel already work via head injection). Tier 3 is a bonus.
- The `data-bce-*` prefix prevents collision with existing platform attributes.
- One-time `<head>` setup per site is acceptable for the operator's workflow.

**Consequences:**

- Interactive elements in generated HTML must use `data-bce-*` attributes for Tier 2 hook points.
- The system must generate both the page HTML (for code view paste) AND a companion `<head>` JS snippet (for Analytics & Tracking paste).
- Preview iframe must load the Tier 2 JS to accurately preview interactive behavior.

---

### ADR-018: Internal Link Graph as First-Class Data Structure

**Context:** Scout's siloing research established that the link graph must be built BEFORE content generation. Links are not an afterthought -- they are a generation constraint.

**Decision:** The internal link graph is a directed graph stored in `internal_link_graph` with companion `anchor_text_bank` for rotation. The graph is constructed in Stage 3 (Gap Analysis) and consumed in Stage 5 (Generation).

**Graph structure:**
- **Nodes:** All pages (existing + planned), stored in `site_structure_map` and `work_backlog`.
- **Edges:** Directed links with type, anchor text, variant classification, and target section.
- **Anchor banks:** Per target URL, a pool of anchor text variants with usage counts.

**Link generation rules (codified, not ad hoc):**

| Rule | Source Pages | Target Pages | Pattern |
|------|-------------|--------------|---------|
| Service -> Location | Each service page | All locations offering that service | "Available In" section with location links |
| Location -> Service | Each location page | All services offered in that location | "Services in [Suburb]" section |
| Location -> Adjacent | Each location page | 3-5 geographically nearest suburbs | "Nearby Areas" section |
| Contextual | Any page body | First mention of service or suburb | In-text link on first mention only |
| Breadcrumb | Every page | Parent page chain | BreadcrumbList at page top |
| Orphan prevention | Post-generation | Any page with < 2 incoming links | Add links from parent/hub pages |

**Anchor text distribution targets:**

| Variant Type | Target % | Example |
|-------------|----------|---------|
| Exact match | 10-20% | "manual driving lessons" |
| Partial match | 30-40% | "our manual lesson packages" |
| Branded | 10-15% | "[Brand] manual lessons" |
| Natural/contextual | 30-40% | "learn to drive a manual car" |
| Generic | < 5% | "learn more" |

Hard constraint: no exact anchor text used more than 3 times site-wide per target.

**Rationale:**

- The link graph prevents orphan pages, ensures proper equity distribution, and enforces anchor text rotation -- all of which are critical for SEO.
- Building the graph before content generation means every section's prompt already knows which links it must include.
- Anchor text rotation at the database level prevents the over-optimization penalty that Google enforces on repetitive exact-match anchors.

**Consequences:**

- Adding a new page triggers a regeneration cascade: update "Available In" sections on service pages, update "Nearby Areas" on adjacent location pages, update hub pages.
- The system must track `usage_count` per anchor text and select least-used variants during prompt assembly.
- Link graph validation is a required step in Stage 5 assembly: every planned edge must exist in the generated HTML.

---

### ADR-019: Content Freshness via Operator-Marked Deployment Timestamps

**Context:** DEC-033 established ~2-month freshness cycles. But the deployment mechanism is manual paste. The system has no way to know when content was actually deployed to the live site.

**Decision:** Freshness tracking uses three timestamps per page:

| Timestamp | Source | How Set |
|-----------|--------|---------|
| `last_generated_at` | System | Auto-set when section generation completes |
| `last_approved_at` | System | Auto-set when operator approves the page |
| `last_deployed_at` | Operator | **Manually marked** by operator after pasting to BookingTimes |

The freshness status is computed from `last_deployed_at`:
- **Fresh:** deployed < 6 weeks ago
- **Aging:** deployed 6-10 weeks ago (warning)
- **Stale:** deployed > 10 weeks ago (alert)
- **Unknown:** never deployed or no timestamp

Alerts are surfaced in the dashboard UI. No email/push notifications (single-user local tool -- the operator sees alerts when they open the tool).

**Rationale:**

- Without an API to BookingTimes, manual marking is the only honest approach. Auto-marking on approval would be inaccurate (the operator may not paste immediately).
- A "Mark as Deployed" button after copy-to-clipboard is low-friction and integrates naturally into the paste workflow.
- 6/10 week thresholds align with the ~2-month update cadence and GEO research (content < 13 weeks old is cited 50% more by AI engines).

**Consequences:**

- The UI must include a "Mark as Deployed" action, ideally surfaced immediately after copy-to-clipboard.
- A dashboard view shows freshness status across all pages for all sites.
- If the operator forgets to mark deployment, the page shows as "unknown" or "stale." This is a user behavior dependency, not a system deficiency.

---

### ADR-020: Learning Loop Persistence Model

**Context:** OQ-2 asks how the learning loop persists across sessions. Claude CLI calls are stateless -- no conversation memory. The system must reconstruct all learning from the database.

**Decision:** All learning persists in the database. There is no ephemeral session state that matters for learning. The learning loop has three persistence mechanisms:

**1. Brand Rules (`brand_rules` table)**
- Source: `inferred` (Stage 1), `research` (Stage 2), `feedback` (Stage 5), `manual`
- Scoped: `global`, `brand`, `page_type`, `section_type`, `page`
- Each rule has `confidence` (0.0-1.0) and `confirmed` (boolean)
- Rules are included in generation prompts (Layer 3 in ADR-013) filtered by relevance to the current section

**2. Brand Examples (`brand_examples` table)**
- Approved sections stored with `section_type`, `page_type`, `quality_rating`
- Used as few-shot examples in generation prompts (Layer 10 in ADR-013)
- Negative examples (rejected sections) stored with `is_negative = 1` and used as anti-patterns

**3. Brand Profile Evolution (`brand_profiles` + `brand_profile_history`)**
- Profile fields updated after significant feedback events
- Full snapshots stored in history table for tracking evolution
- `inference_confidence` increases as more pages are approved

**Cross-session reconstruction:** When a new session begins, the prompt assembler queries:
1. `brand_profiles` for the current voice profile
2. `brand_rules` WHERE `active = 1` AND (scope matches current section)
3. `brand_examples` WHERE `section_type` matches AND `quality_rating >= 4` (positive) or `is_negative = 1` (anti-pattern)
4. `page_versions` for previously approved pages of this type
5. `section_specs` for what was already generated in an incomplete page

No Claude conversation state is needed. Everything the system has learned is in the database.

**Rationale:**

- Database persistence is session-independent. The operator can close the tool, reopen it weeks later, and all learning is intact.
- The `brand_rules` table with scoped confidence provides a structured way to capture corrections at the right granularity (a terminology fix applies to all future content; a section-specific layout preference applies only to that section type).
- Few-shot examples are the most powerful learning mechanism. Showing Claude 2-3 approved hero sections is worth more than 20 rules.

**Consequences:**

- The prompt assembler must be efficient at querying relevant rules and examples. Index on `(site_id, scope, section_type, active)`.
- Token budget management is critical. If a site accumulates 100 rules and 50 examples, the prompt assembler must select the most relevant subset, not include all of them.
- Rule management UI needed: the operator should be able to view, edit, deactivate, and prioritize rules.

---

### ADR-021: Export/Paste Workflow

**Context:** All generated content must be pasted into BookingTimes' WYSIWYG code view editor. The system must produce paste-ready HTML.

**Decision:** The export pipeline produces three artifacts per page:

| Artifact | Content | Paste Target |
|----------|---------|-------------|
| **Page HTML** | Complete body-level HTML fragment. All sections assembled. All internal links in place. | BookingTimes code view editor (main content area) |
| **Schema JSON-LD** | `<script type="application/ld+json">` blocks with `@graph`/`@id` pattern | Appended to page HTML (pasted into same code view) OR separate paste if editor strips `<script>` tags |
| **Head JS** (if Tier 2 interactive elements) | `<script>` block for `<head>` injection | BookingTimes Setup > Analytics & Tracking |

**Export validation checklist (automated, run before copy-to-clipboard):**
1. All CSS classes validated against the site's Tier 1 + Tier 2 + Tier 3 catalogue
2. HTML well-formedness (proper nesting, closed tags)
3. No bare element selectors in any inline styles
4. All internal links resolve to known pages in the link graph
5. Anchor text distribution within acceptable range
6. JSON-LD validates against schema.org (basic structural validation)
7. Required sections all present
8. Word count within blueprint range
9. No placeholder tokens remaining

**Copy-to-clipboard behavior:**
- "Copy HTML" button copies the page HTML + JSON-LD blocks to clipboard
- "Copy Head JS" button (separate) copies the head injection script
- After copy, surface "Mark as Deployed" button

**Rationale:**

- Separating page HTML from head JS matches the two different paste targets on BookingTimes (content editor vs. Analytics & Tracking).
- JSON-LD is appended to the page HTML body because BookingTimes has no `<head>` access for content pages. Google supports body-placed JSON-LD.
- Automated validation prevents paste of broken content. This replaces the V1 approach of manual class checking.

**Consequences:**

- OQ-5 (does the WYSIWYG strip `<script type="application/ld+json">`?) is a critical unknown. If the editor strips ALL script tags, the schema JSON-LD must be delivered via the `<head>` injection pathway instead. This changes the export from 2 artifacts to a single combined HTML+schema head block.
- The "Mark as Deployed" UX is tied to this workflow. It should be prominent and require minimal effort.

---

### ADR-022: SEO/GEO/Schema Integration Points

**Context:** SEO, GEO, and Schema are first-class concerns at every pipeline stage, not post-processing add-ons.

**Decision:** Each concern integrates at specific pipeline stages:

**SEO integration:**

| Stage | Integration |
|-------|------------|
| 1 (Audit) | Assess title tags, metas, headers, canonicals, E-E-A-T, internal links, content uniqueness |
| 2 (Benchmark) | Define title tag formulas, header hierarchy templates, content uniqueness thresholds (40-50%) |
| 3 (Gap) | Score SEO gaps per page. Identify pages with high impressions but low CTR (from GSC) |
| 4 (Blueprint) | Set per-section SEO requirements. Title/meta drafts. Keyword targets per section |
| 5 (Generate) | Validate generated sections. Check headers, keyword placement, link presence |

**GEO integration:**

| Stage | Integration |
|-------|------------|
| 1 (Audit) | Assess citation-worthiness, direct answer blocks, FAQ presence, stats density, freshness |
| 2 (Benchmark) | Define GEO patterns: TLDR-first, direct answer block format, stat frequency (every 150-200 words) |
| 3 (Gap) | Score GEO readiness gaps. Identify pages lacking citation-worthy content |
| 4 (Blueprint) | Specify which sections need direct answer blocks, statistics, FAQ questions |
| 5 (Generate) | Validate: TLDR-first in first 200 words, stats density, FAQ schema present, freshness date |

**Schema integration:**

| Stage | Integration |
|-------|------------|
| 1 (Audit) | Inventory existing schema. Validate JSON-LD. Check for broken/missing properties |
| 2 (Benchmark) | Define per-page-type schema requirements. `@graph`/`@id` pattern. `AutomotiveBusiness` type |
| 3 (Gap) | Score schema completeness. Identify missing types and properties |
| 4 (Blueprint) | Full JSON-LD specification per page. `sameAs` disambiguation. `BreadcrumbList` matching visible breadcrumbs |
| 5 (Generate) | Validate generated JSON-LD against spec. Check content/schema consistency |

**Schema type mapping (from Scout's research):**

| Page Type | Primary Schema | Additional |
|-----------|---------------|------------|
| Homepage | `AutomotiveBusiness` (full) | `WebSite` with `SearchAction`, `BreadcrumbList` |
| Service | `Service` with `Offer` | `FAQPage`, `BreadcrumbList` |
| Location | `AutomotiveBusiness` (with `areaServed`) | `FAQPage`, `BreadcrumbList` |
| About | `AboutPage` | `BreadcrumbList` |
| FAQ | `FAQPage` | `BreadcrumbList` |
| Resource | `Article` or `HowTo` | `BreadcrumbList` |

**Rationale:**

- Embedding SEO/GEO/Schema into every stage ensures these concerns shape content from the start, not as a retrofit.
- The agent model (seo, geo, schema specialists) maps naturally to per-stage validation. Each specialist validates their domain at each stage.
- `AutomotiveBusiness` is the correct schema.org type (DrivingSchool does not exist).

**Consequences:**

- Generation prompts must include SEO/GEO/Schema requirements per section (Layers 5, 6, 7 in ADR-013).
- JSON-LD generation is part of Stage 5 assembly, not a separate step.
- Schema validation requires checking that JSON-LD values match visible page content (e.g., schema `name` matches H1).

---

### ADR-023: Content Siloing Architecture

**Context:** Scout's research recommends the Hybrid Two-Page Model for multi-location service businesses. The link graph enforces silo structure.

**Decision:** Implement the Hybrid Two-Page Model with three silos per site:

```
Homepage
├── SERVICES SILO
│   ├── Manual Driving Lessons (hub)
│   ├── Automatic Driving Lessons
│   ├── Driving Test Preparation
│   ├── Learner Licence Preparation
│   ├── Defensive Driving
│   └── Keys2Drive Free Lesson (if applicable)
│
├── LOCATIONS SILO
│   ├── Areas We Serve (hub)
│   ├── Springfield
│   ├── Ipswich
│   ├── Toowoomba
│   └── ... (50+ suburbs)
│
└── TRUST SILO
    ├── About Us
    ├── Contact
    ├── FAQ
    └── Resources/Blog
```

**Silo rules:**
- Service pages at root level (maximum authority): `/manual-driving-lessons/`
- Location pages flat under `/areas/`: `/areas/springfield/`
- No service x location matrix pages. Location pages cover ALL services for their area.
- Max 3 levels deep. No regional nesting (`/areas/qld/seq/...` is forbidden).
- Cross-silo links allowed but follow hub-and-spoke pattern (service hubs link to location pages and vice versa).

**URL rules:**
- Work within platform-enforced patterns detected from sitemap.
- All lowercase, hyphen-separated.
- Suburb slugs match common usage.
- The sitemap is the source of truth for what URL structures are possible.

**Rationale:**

- The Two-Page Model consolidates authority. One external link to a service page benefits all linked location pages.
- Flat location structure under `/areas/` prevents crawl budget waste from deep nesting.
- Cross-silo hub-and-spoke linking creates bidirectional equity flow without violating silo integrity.

**Consequences:**

- `silo_definitions` table tracks silo membership and cross-silo linking policies per site.
- Content generation order must respect silo structure: hubs before children, services before locations.
- URL patterns may differ across the 5 sites depending on platform configuration. Each site's sitemap dictates what is possible.

---

### ADR-024: Iframe Preview with Bootstrap 5.0.2

**Context:** V1 decided on sandboxed iframe preview (ADR-003/DEC-003). V2.1 retains this but must use BS 5.0.2, not 5.3.3.

**Decision:** Preview uses a sandboxed `<iframe>` with `srcdoc`:

1. Load Bootstrap 5.0.2 CSS (CDN or cached local copy)
2. Load Font Awesome 6 Pro CSS (cached from site)
3. Load site's custom CSS (Tier 2, cached from scrape)
4. Load Tier 3 CSS (system-generated, if any)
5. If Tier 2 interactive JS exists, load it in the iframe for accurate preview
6. Inject generated HTML into iframe body
7. Wrap content in simulated parent structure matching site's content area (for CSS inheritance)
8. For long-tail pages, include simulated sidebar element to test layout alongside fixed sidebar

**Responsive preview breakpoints:** 576px, 768px, 992px, 1200px (Bootstrap 5.0.2 breakpoints, which are unchanged from 5.3).

**Rationale:**

- Complete CSS isolation from the SvelteKit app shell.
- Real browser rendering with the actual CSS that the live site uses.
- Sidebar simulation on long-tail page previews catches layout conflicts before deployment.

**Consequences:**

- Must cache all CSS files locally (filesystem) for offline preview capability.
- The preview may not be pixel-perfect if the site's content area has parent elements with styles not replicated in the iframe wrapper. Mitigation: scrape the content area's parent DOM structure during Stage 1.

---

### ADR-025: Version History (Retained from V1, Adapted)

**Context:** V1 ADR-008 (DEC-006) established append-only versioning. V2.1 retains this but adds section-level tracking.

**Decision:** Retain append-only full-HTML-snapshot versioning in `page_versions`. Add section-level tracking via `section_specs.generated_html` and `section_specs.status`.

Version sources expanded for V2.1:

| Source | Description |
|--------|-------------|
| `ai_generate` | Initial generation from Claude |
| `ai_refine` | Regeneration after feedback |
| `manual_edit` | Operator direct edit |
| `rollback` | Non-destructive rollback (creates new version with old content) |
| `assembly` | Page assembled from approved sections |
| `link_cascade` | Link sections regenerated due to new page addition |

**Rationale:** Full snapshots remain appropriate. Content pages are small (5-50KB HTML). The `link_cascade` source type is new -- it tracks when a page's link sections were automatically regenerated because a new page was added to the link graph.

**Consequences:** Same as V1. Storage is negligible at projected scale.

---

### ADR-026: Scribe Checkpoints for Session Persistence

**Context:** DEC-027 established Scribe checkpoints at every stage. V2.1 formalizes this in the data model.

**Decision:** Every stage transition fires a Scribe checkpoint stored in `scribe_checkpoints`. Checkpoints contain:

- `deliverables`: JSON list of what was produced
- `decisions`: JSON list of decisions made with rationale
- `state_for_next_session`: JSON resumption context (what to do next if the session ends here)
- `issues`: JSON list of blockers or concerns

**When checkpoints fire:**
1. After each Stage gate approval (5 per site lifecycle)
2. After each page approval in Stage 5
3. On session end (regardless of position in pipeline)
4. After batch generation completion

**Rationale:** The operator works ad hoc (~2-month cycles). A session may end at any point. The checkpoint ensures the next session can resume exactly where it left off. The `state_for_next_session` field is specifically designed for this: it contains the concrete next action ("Continue Stage 4 blueprinting for site X, page Y was the last approved blueprint").

**Consequences:**

- Checkpoint writes are synchronous and must not fail silently. If a checkpoint write fails, surface an error.
- The session startup flow reads the latest checkpoint per site to determine resumption state.

---

### ADR-027: GSC Integration as Optional Enhancement

**Context:** GSC access is confirmed for all 5 sites (DEC-024). Traffic data improves backlog prioritization.

**Decision:** GSC integration is an optional module that enriches Stage 3 (Gap Analysis) and ongoing performance tracking. It is NOT required for the pipeline to function.

**Integration approach:**
- Pull GSC data via the Search Console API (requires Google OAuth for the API, not for BookingTimes).
- Store in `gsc_metrics` table with `site_id` foreign key.
- Feed into the Stage 3 prioritization formula:
  ```
  priority = hierarchy_weight * 0.4
           + gap_severity * 0.3
           + traffic_potential * 0.2
           + silo_completion * 0.1
  ```
- Without GSC data, `traffic_potential` defaults to 0 and prioritization falls back to hierarchy + gap severity.

**Rationale:** GSC data is valuable but not essential. The pipeline must work without it (for new sites with no GSC data, or if the API is temporarily unavailable). Designing it as an optional enrichment keeps the core pipeline simple.

**Consequences:**

- Google OAuth for GSC API is a separate credential from BookingTimes/Claude. Must be set up independently.
- GSC data should be refreshed periodically (daily or weekly) and cached locally.

---

### ADR-028: "Minimal Edits" Definition (Addressing OQ-3)

**Context:** SC-1 (highest priority success criterion) requires "minimal edits." OQ-3 asks what this means concretely.

**Decision:** Define minimal edits using a three-level classification:

| Level | Edit Distance | Description | Target Phase |
|-------|---------------|-------------|--------------|
| **Copy edits only** | < 5% of content changed | Grammar, punctuation, minor word choice. No structural changes. | Mature pipeline (page 16+) |
| **Minor revisions** | 5-15% of content changed | Sentence rewrites, paragraph reordering, adding/removing a sentence. No section-level changes. | Developing pipeline (pages 5-15) |
| **Significant revisions** | > 15% of content changed | Section rewrites, structural changes, tone corrections. | Early pipeline (pages 1-4) |

**Measurement:** After operator approval, compute edit distance between the generated HTML and the final approved HTML using normalized Levenshtein distance on the text content (stripping HTML tags for comparison).

**Success threshold:** By page 16+, 80% of generated pages should require only copy edits (< 5% edit distance). This is tracked in `page_versions` by comparing the `ai_generate` version against the final `manual_edit` or `assembly` version.

**Rationale:** Concrete thresholds enable objective measurement. The progressive enrichment model (design doc section 5.6) predicts decreasing edit effort over time. These thresholds formalize that prediction.

**Consequences:**

- Edit distance computation must be implemented as part of the approval workflow.
- A dashboard view should track edit distance trends per site over time.
- If edit distance is not decreasing, it indicates the learning loop is not working -- investigate rule quality, example selection, or voice inference accuracy.

---

### ADR-029: V1 Codebase Reuse Assessment

**Context:** A V1 codebase exists with CSS scraping, iframe preview, and template-based generation. What can be reused?

**Decision:** The V1 codebase provides three reusable components and the rest is rebuilt:

| V1 Component | V2.1 Disposition | Rationale |
|-------------|------------------|-----------|
| **CSS scraper** | **Reuse with modification.** Add Tier 1/2/3 classification. Add BS 5.0.2 catalogue. Remove BS 5.3.3 references. | Core scraping logic is sound. Classification is new. |
| **Iframe preview** | **Reuse with modification.** Pin to BS 5.0.2. Add sidebar simulation. Add Tier 2 JS loading. | Preview approach is correct. Details change. |
| **Claude CLI integration** (`claude-cli.ts`) | **Reuse as-is.** The spawn/stdin/stdout pattern is unchanged. | DEC-014 approach works for V2.1's section-based calls. |
| Template system (JSON templates) | **Rebuild.** Replace with dynamic blueprints + section specs. | V1 used fixed templates. V2.1 uses dynamic per-page blueprints (ADR-013). |
| Batch pipeline (queue-based) | **Rebuild.** Replace with 5-stage pipeline with per-section generation. | Fundamentally different architecture. |
| Data model (7 entities) | **Rebuild.** Replace with 25+ table schema (ADR-011). | V1 schema does not support audit, gap analysis, link graphs, or learning. |
| Export pipeline | **Rebuild.** Add validation, schema JSON-LD, head JS export. | V1 export was simple copy. V2.1 needs validation + multi-artifact export. |
| OAuth/auth code | **Delete.** DEC-030 eliminates auth. | Single user, no auth needed. |

**Rationale:** Reuse where the core approach is sound. Rebuild where the V2.1 architecture is fundamentally different. The CSS scraper and Claude CLI module are stable, proven code. Everything else reflects V1's simpler batch-generation model, which V2.1 supersedes.

**Consequences:**

- The project is primarily a rebuild, not a refactor.
- V1 code should be preserved in a branch or archive for reference but not actively maintained.
- The three reusable modules should be extracted, tested, and adapted as the first implementation step.

---

### ADR-030: Prompt Assembly Module Architecture

**Context:** The 12-layer prompt assembly (ADR-013) is the most complex component. It must query multiple tables, filter by relevance, manage token budgets, and produce a coherent prompt.

**Decision:** The prompt assembly module is a dedicated server-side module (`prompt-assembler.ts`) with the following architecture:

```
prompt-assembler.ts
├── assembleSectionPrompt(sectionSpec, blueprint, site)
│   ├── Layer 1: loadPlatformConstraints()           -- static
│   ├── Layer 2: loadBrandProfile(siteId)             -- brand_profiles
│   ├── Layer 3: loadRelevantRules(siteId, scope)     -- brand_rules (filtered)
│   ├── Layer 4: loadSectionSpec(specId)               -- section_specs
│   ├── Layer 5: loadPageContext(blueprintId)           -- page_blueprints
│   ├── Layer 6: loadLinkTargets(specId)               -- internal_link_graph
│   ├── Layer 7: loadGeoRequirements(specId)           -- section_specs GEO fields
│   ├── Layer 8: loadCSSPalette(siteId, sectionType)  -- css_audit (filtered)
│   ├── Layer 9: loadPreviousSections(blueprintId)     -- section_specs (approved)
│   ├── Layer 10: loadExamples(siteId, sectionType)    -- brand_examples (top-rated)
│   ├── Layer 11: loadLocationData(blueprintId)         -- suburb data
│   ├── Layer 12: loadOutputFormat()                    -- static
│   └── tokenBudget.trim(layers, maxTokens=8000)       -- trim least-critical layers if over budget
└── assembleCoherencePrompt(blueprint, allSections)
    └── Full-page coherence check prompt
```

**Token budget management:**
- Target: 8,000 tokens total prompt (leaving room for output).
- If assembled layers exceed budget, trim in priority order (lowest priority trimmed first):
  1. Layer 10 (examples) -- reduce from 3 examples to 1
  2. Layer 3 (rules) -- reduce to highest-confidence rules only
  3. Layer 9 (previous sections) -- summarize instead of full HTML
  4. Layer 8 (CSS palette) -- reduce to section-relevant classes only
- Layers 1, 4, 5, 12 are never trimmed (essential context).

**Rationale:**

- Centralized prompt assembly prevents prompt drift across different parts of the system.
- Token budget management prevents oversized prompts that would degrade output quality.
- The priority-based trimming ensures the most critical context is always preserved.

**Consequences:**

- This module is a critical path component. All generation quality depends on it.
- Must be thoroughly tested with varying amounts of rules, examples, and previous sections.
- Token counting must be approximate but conservative (use word count * 1.3 as approximation).

---

### ADR-031: Per-Site Pilot Strategy (Addressing OQ-9)

**Context:** Starting with all 5 sites simultaneously is risky. A pilot builds the learning loop faster.

**Decision:** Start with one pilot site, selected by the operator. Recommended selection criteria:

1. **Most existing content** (provides the richest signal for brand voice inference)
2. **Highest GSC traffic** (improvements have the most impact)
3. **Most representative** (patterns learned transfer best to other sites)

The pilot site goes through all 5 stages. Learnings from the pilot inform adjustments before onboarding the remaining 4 sites. Domain-wide outputs from Stage 2 are shared across all sites.

After the pilot site reaches Stage 5 and has 3-5 approved pages, the next site enters Stage 1. Sites can be staggered or parallelized depending on operator capacity.

**Rationale:** One site first reduces risk, accelerates learning, and identifies pipeline issues before they multiply across 5 sites. The operator's time is the bottleneck (review and approval gates), so staggering sites also manages workload.

**Consequences:**

- The UI must support multiple sites at different pipeline stages (ADR-012).
- Stage 2 outputs are available to all sites immediately, even before they enter Stage 1.

---

### ADR-032: Sidebar-Aware Layout Strategy

**Context:** DEC-032 established that sidebars only constrain long-tail pages. Other pages have full viewport. CSS can adjust sidebar positioning but cannot remove it.

**Decision:** Implement sidebar-aware layout as a generation constraint:

| Page Type | Sidebar Present? | Layout Strategy |
|-----------|-----------------|-----------------|
| Homepage | No | Full viewport. Use BS5 `container-fluid` or `container` with full-width sections |
| Service pages | No | Full viewport. Content-rich layouts with cards, CTAs, imagery zones |
| Location pages (long-tail) | Yes | Main content + sidebar. Use BS5 grid (`col-md-8` / `col-md-4` or similar). Push sidebar below hero via CSS order utilities if desired |
| About, Contact, FAQ | Varies (check per site) | Document per site during Stage 1 audit |

**Sidebar handling for location pages:**
1. During Stage 1, Pixel agent measures sidebar dimensions and documents CSS that controls its position.
2. Stage 4 blueprints for location pages include sidebar-aware section widths.
3. Generation prompts specify available content width (e.g., "content area is col-md-8, approximately 730px at desktop").
4. Preview iframe includes a simulated sidebar element for layout testing.

**Rationale:** Ignoring the sidebar and then discovering layout conflicts at paste time wastes effort. Making sidebar awareness a first-class constraint in blueprints and prompts prevents this.

**Consequences:**

- Stage 1 Pixel audit must document sidebar behavior per site.
- Blueprint `page_level_css_rules` includes sidebar context for location pages.
- Preview iframe needs two modes: with sidebar (location pages) and without (other pages).

---

### ADR-033: Dynamic Section Count Determination

**Context:** DEC-026 established dynamic section counts. Fixed counts cause programmatic sameness across 5 sites.

**Decision:** Section count and composition are determined during Stage 4 blueprinting using a rule-based approach:

**Base section count by page type:**

| Page Type | Minimum Sections | Maximum Sections | Mandatory Section Types |
|-----------|-----------------|-----------------|------------------------|
| Homepage | 6 | 12 | Hero, Services Overview, Areas Overview, Testimonials, CTA |
| Service page | 5 | 10 | Hero, What You'll Learn, How It Works, FAQ, CTA |
| Location page | 4 | 8 | Hero, Services in [Suburb], Local Content, Nearby Areas, CTA |
| About page | 3 | 7 | Hero, Our Story, Team, CTA |
| Resource page | 3 | 6 | Hero, Body Content, CTA |

**Variation drivers:**
- Brand personality (premium brands: fewer, more impactful sections; community brands: more varied sections)
- Content requirements (suburb with TMR office needs an extra section; suburb near school zones needs driving conditions section)
- Keyword targets (competitive keywords need more content depth = more sections)
- Cross-site uniqueness (if site A's Springfield page has 6 sections, site B's should have a different count or composition)

**Implementation:** The blueprinting module in Stage 4 selects from a pool of optional sections based on the variation drivers. The rationale for the chosen count is stored in `page_blueprints.section_count_rationale`.

**Rationale:** Dynamic sections prevent the templated feel that plagued V1. Each page feels intentionally composed rather than mechanically generated. Storing the rationale ensures the choice is explainable and reviewable.

**Consequences:**

- The `page_taxonomy` table defines required and optional sections per page type.
- The blueprinting module must implement the variation logic.
- More sections = more Claude calls = longer generation time. Acceptable given the "quality over speed" priority.

---

### ADR-034: Edit Distance Tracking and Quality Dashboard

**Context:** SC-1 requires tracking whether edits decrease over time. ADR-028 defines the thresholds. The system needs a mechanism to compute and display this data.

**Decision:** Implement edit distance tracking as part of the approval workflow:

1. When the operator approves a page (with or without edits), compute normalized edit distance between the latest `ai_generate` version and the approved version.
2. Store the edit distance as a field on the `page_versions` record.
3. Aggregate edit distances per site over time in a dashboard view.
4. Display trend lines: average edit distance per site over pages 1-5, 5-10, 10-20, 20+.
5. Flag sites where edit distance is not decreasing (learning loop may be broken).

**Edit distance computation:**
- Strip HTML tags from both versions to compare text content only.
- Compute normalized Levenshtein distance: `distance / max(len(a), len(b))`.
- Store as a percentage (0.0 = identical, 1.0 = completely different).

**Rationale:** This is the primary feedback mechanism for the learning loop. If edits are not decreasing, the system is not learning. Making this visible enables the operator to investigate and the system to improve.

**Consequences:**

- Levenshtein distance computation on text content (not HTML) avoids noise from HTML formatting changes.
- The dashboard is a key UI surface. It answers "is the system getting better?"

---

## 3. Superseded V1 Decisions

The following decisions from `architecture-decisions.md` (V1, ARCH-001) are superseded:

| V1 Decision | V2.1 Replacement | Why Superseded |
|-------------|------------------|----------------|
| **ADR-001 (V1): SvelteKit + Cloudflare Workers + D1** | DEC-011 + ADR-011: SvelteKit + adapter-node + better-sqlite3 + filesystem | Local deployment. No Cloudflare. |
| **ADR-002 (V1): Bootstrap CDN baseline + custom scraping** | ADR-016: Three-tier CSS with BS 5.0.2 validated catalogue | Tier classification is new. BS 5.0.2 not 5.3.3. Custom CSS extensible. |
| **ADR-003 (V1): Sandboxed iframe preview** | ADR-024: Iframe preview with BS 5.0.2 + sidebar simulation | Retained with modifications. |
| **ADR-004 (V1): Server-side Claude proxy with OAuth** | ADR-014: Claude CLI subprocess | OAuth/API approach failed. CLI subprocess works. |
| **ADR-005 (V1): JSON-defined templates with variant pools** | ADR-013 + ADR-033: Dynamic blueprints + section specs | Fixed templates replaced by dynamic per-page blueprints. |
| **ADR-006 (V1): Body-level HTML export with class validation** | ADR-021: Multi-artifact export (HTML + JSON-LD + Head JS) | Expanded to include schema and interactive JS exports. |
| **ADR-007 (V1): Queue-based batch pipeline** | ADR-012: 5-stage pipeline with per-site progression | Fundamentally different pipeline architecture. |
| **ADR-008 (V1): Append-only version history** | ADR-025: Append-only versions + section tracking | Retained and extended. |
| **ADR-009 (V1): 7-entity relational model** | ADR-011: 25+ table relational model | V1 schema insufficient for V2.1 pipeline. |
| **ADR-010 (V1): Cloudflare deployment architecture** | DEC-011: Local Node.js deployment | Cloudflare removed entirely. |

**Decisions from DECISIONS.md that remain active and unchanged:**
- DEC-001: SvelteKit (Svelte 5 with runes)
- DEC-006: Append-only versioning
- DEC-010: {@html} XSS sanitization
- DEC-014: Claude CLI subprocess
- DEC-016: Infer-first brand voice
- DEC-017: Section-based generation
- DEC-018: Multi-agent site audit
- DEC-019: Two-page content model
- DEC-020: SEO/GEO/Schema specialist agents
- DEC-023: Custom CSS identification and extension
- DEC-026: Dynamic section count
- DEC-028-034: All V2.1 session decisions remain active

---

## 4. Open Architecture Questions

| # | Question | Impact | Recommendation |
|---|----------|--------|----------------|
| **OAQ-1** | Does the BookingTimes WYSIWYG strip `<script type="application/ld+json">` tags? (OQ-5) | **Critical.** Determines whether schema JSON-LD goes in page content or must use `<head>` injection. | Test immediately during Phase A (Foundation Validation). If stripped, schema delivery moves to `<head>` injection via Analytics & Tracking, which changes the export workflow (ADR-021). |
| **OAQ-2** | Does inline `<script>` survive TinyMCE paste? (OQ-1, partially answered) | **High.** Determines Tier 3 JS viability. | Manual test per Scout's protocol. If it fails, Tier 2 is the ceiling for interactivity. System works either way (ADR-017). |
| **OAQ-3** | What is the actual page inventory per site? (OQ-6) | **Medium.** Affects effort estimation and batch generation scale. | Stage 1 sitemap crawl will answer this. Architecture handles any scale from 5 to 500 pages per site. |
| **OAQ-4** | Can the operator modify custom CSS files directly? (OQ-10) | **High.** Affects Tier 3 CSS deployment. If CSS changes require a support ticket to BookingTimes, Tier 3 CSS has a bottleneck. | Ask the operator. If restricted, Tier 3 CSS fallback is inline styles in generated HTML (less maintainable but functional). |
| **OAQ-5** | Does `<style>` tag survive TinyMCE paste? | **Medium.** If `<style>` tags survive, Tier 3 CSS could be delivered per-page in the content rather than requiring custom CSS file edits. | Test alongside OAQ-1 and OAQ-2 during Foundation Validation. |
| **OAQ-6** | Claude CLI rate limits under sustained section generation (50+ sections per session) | **Medium.** 8 sections/page x 60 pages = 480 Claude calls per site. With retries, potentially 600+. | Monitor during pilot. If rate-limited, implement queuing with configurable delay (default 2s between calls). Progressive batch generation (Stage 5.6) naturally throttles by requiring approval gates. |

---

## 5. Decision Dependency Map

```
ADR-011 (Data Model)
├── ADR-012 (Pipeline stages) -- sites.pipeline_stage
├── ADR-015 (Brand voice) -- brand_profiles, brand_rules, brand_examples
├── ADR-018 (Link graph) -- internal_link_graph, anchor_text_bank
├── ADR-019 (Freshness) -- content_freshness
├── ADR-020 (Learning loop) -- brand_rules, brand_examples
├── ADR-025 (Versions) -- page_versions
├── ADR-026 (Checkpoints) -- scribe_checkpoints
└── ADR-034 (Edit distance) -- page_versions

ADR-013 (Section generation)
├── ADR-014 (Claude CLI) -- execution mechanism
├── ADR-030 (Prompt assembly) -- context construction
├── ADR-033 (Dynamic sections) -- what to generate
└── ADR-020 (Learning loop) -- feeds examples into prompts

ADR-016 (CSS strategy)
├── ADR-024 (Preview) -- uses same CSS tiers
├── ADR-017 (JS tiers) -- Tier 2 JS hooks into CSS classes
└── ADR-032 (Sidebar) -- layout within CSS constraints

ADR-021 (Export)
├── ADR-022 (SEO/GEO/Schema) -- schema JSON-LD in export
├── ADR-017 (JS tiers) -- head JS as separate export artifact
└── ADR-019 (Freshness) -- "Mark as Deployed" in export flow

ADR-023 (Siloing)
├── ADR-018 (Link graph) -- silo structure enforced in graph
├── ADR-012 (Pipeline) -- generation order follows silo hierarchy
└── ADR-031 (Pilot) -- pilot site tests silo implementation
```
