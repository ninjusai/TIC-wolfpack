# Bookingtimes Content Emulator — Context

Last updated: 2026-04-03 final session (PROJECT COMPLETE — full UI/UX with step persistence, Run-All orchestration, rendered preview)
Updated by: scribe

## Project Summary

A content creation emulator that replicates the Bookingtimes.com platform experience. Allows a single user to generate, preview, and export website content sections styled with the exact CSS framework used by Bookingtimes sites. AI-powered content generation via Claude produces realistic HTML snippets. Top-down content approach: homepage first, then trickle down to subpages. Research-first pipeline: audit existing site, gap analysis, then generate to fill gaps. SEO, GEO, and schema markup are first-class concerns.

## Current State

**Status:** PROJECT COMPLETE. All 56 work items done across 8 phases (0-7). 624 tests/assertions, 0 failures. All 38 UI action triggers wired. Guided workflow UX. Edit distance (DEC-036) resolved. Extensive post-build UI/UX polish: step persistence from DB, Run-All stage orchestration, rendered preview with CSS injection + responsive breakpoints. Dev server at localhost:5173.

**Location:** `artifacts/bookingtimes-content-emulator/` in the project_development repo

**App Location:** `artifacts/bookingtimes-content-emulator/app/`

## What Was Built (Phases 0-6)

### App Architecture
- **36 server modules** in `app/src/lib/server/`
- **33 API route directories** in `app/src/routes/api/`
- **6 UI route groups**: dashboard, backlog, blueprints, brand, preview, site

### Phase 0 — Foundation
- SvelteKit scaffold with adapter-node, better-sqlite3
- SQLite schema (25+ tables), seed sites, stage gates
- Ported CSS scraper, iframe preview, Claude CLI integration from V1
- Bootstrap 5.0.2 catalogue

### Phase 1 — Audit
- Sitemap inventory crawler (`sitemap-crawler.ts`)
- CSS 3-tier classification (`css-classifier.ts`, `css-tier-engine.ts`)
- Content scraping (`content-scraper.ts`)
- Brand voice inference (`brand-inference.ts`)
- Schema detection (`schema-detector.ts`)
- SEO audit (`seo-auditor.ts`), GEO audit (`geo-auditor.ts`)

### Phase 2 — Benchmark
- SEO benchmarks (`seo-benchmarks.ts`), GEO benchmarks (`geo-benchmarks.ts`)
- Schema standards (`schema-benchmarks.ts`)
- Taxonomy and content silo architecture (`taxonomy-silo.ts`)

### Phase 3 — Gap Analysis
- Gap scoring engine (`gap-engine.ts`)
- Missing pages identification (`missing-pages.ts`)
- Prioritized backlog (`backlog-manager.ts`)
- Link graph (`link-graph.ts`), anchor text bank (`anchor-bank.ts`)

### Phase 4 — Design
- Section spec generator (`section-spec-generator.ts`)
- Blueprint generator (`blueprint-generator.ts`)
- 12-layer prompt assembler (`prompt-assembler.ts`)
- Section generation with Claude CLI (`content-generator.ts` + `claude-cli.ts`)

### Phase 5 — Build
- Content generation pipeline
- Human feedback loop and brand refinement (`feedback-engine.ts`)
- Multi-artifact export pipeline (`export-pipeline.ts`)
- 3-tier JavaScript interactivity (`interactivity-engine.ts`)
- JSON-LD structured data generation (`jsonld-generator.ts`, `jsonld-spec-generator.ts`)
- Freshness detection (`freshness-tracker.ts`)
- Version history (`version-history.ts`)

### Phase 6 — UI
- Dashboard and site overview
- Pipeline progress tracking
- Preview iframe with full CSS injection
- Homepage-first workflow
- Export UI with copy-to-clipboard
- Brand rule management

## Phase 7 — Testing & Pilot (COMPLETE)

| Work Item | Description | Agent | Status | Results |
|-----------|-------------|-------|--------|---------|
| WRK-BCE2-050 | Eval harness algorithmic test suite | eval | complete | 118 tests, all passing |
| WRK-BCE2-051 | Eval harness AI-rubric test suite | eval | complete | 71 tests, all passing, claude_judge.py helper |
| WRK-BCE2-052 | Cross-layer integration testing | sentry | complete | 5 suites, 212 assertions, all passing |
| WRK-BCE2-053 | Single-site pilot E2E | sentry | complete | 126 assertions, full 5-stage pipeline walkthrough |
| WRK-BCE2-054 | WYSIWYG paste acceptance test | sentry | complete | 42 tests (7 criteria + 15 negative + 5 edge cases) |
| WRK-BCE2-055 | Edit distance tracking validation | eval | complete | 55 tests, all passing. Gap: prod uses length-diff |
| WRK-BCE2-056 | CSS change detection | forge | complete | New module css-change-detector.ts, API route, migration 003 |

**Total Phase 7: 624 tests/assertions, 0 failures.**

### Test File Locations
- `tests/eval/test_algorithmic.py` — 118 algorithmic eval tests (CSS fidelity, HTML validity, prompt assembly, etc.)
- `tests/eval/test_ai_rubric.py` — 71 AI-rubric eval tests with `claude_judge.py` helper (mock + live modes)
- `tests/eval/claude_judge.py` — AI judge helper for rubric-based evaluation
- `tests/eval/conftest.py` — Shared pytest fixtures
- `tests/integration/01-stage-gate-transitions.test.ts` — Stage gate transition validation
- `tests/integration/02-feedback-creates-rules.test.ts` — Feedback loop creates brand rules
- `tests/integration/03-export-validation.test.ts` — Export pipeline validation
- `tests/integration/04-preview-css-site-isolation.test.ts` — Preview CSS isolation per site
- `tests/integration/05-multi-site-isolation.test.ts` — Multi-site data isolation
- `tests/integration/run-all.ts` — Integration test runner
- `tests/pilot/single-site-e2e.test.ts` — Full 5-stage pipeline E2E walkthrough
- `tests/pilot/wysiwyg-paste-acceptance.test.ts` — WYSIWYG paste acceptance (7 criteria + negatives + edge cases)
- `tests/pilot/edit-distance-tracking.test.ts` — Edit distance tracking validation

### Edit Distance Gap — RESOLVED (DEC-036)
~~Production code used `Math.abs(a.length - b.length)` instead of true Levenshtein distance.~~
**Fixed by Forge.** Deliverables:
- `app/src/lib/server/edit-distance.ts` — proper Levenshtein implementation
- Migration 004 — `edit_distance` column added to `content_versions` table
- Aggregation endpoint for edit distance metrics
- `version-history.ts` updated to use new implementation
- Svelte export page fixed to display real edit distance

### UI Action Gap — RESOLVED (All 38 Triggers Wired)

3 parallel Pixel agents wired all 38 missing UI action triggers:
- **Dashboard:** "Add New Site & Scrape CSS" form + per-site quick actions
- **Site Detail:** 8 audit/scrape action buttons in 3 groups
- **Pipeline:** Stage-specific action buttons + completion gates + can-advance integration
- **Blueprint list:** 4-step Stage 4 design workflow
- **Blueprint detail:** Per-section Generate/Validate/Approve/Reject/Refine + page-level build actions
- **Export:** Generate Export, Rollback, CSS Change Detection

### Sentry API Route Audit (33/35 Confirmed)
- CRITICAL fix: Missing `/api/site/[siteId]/pages` route (export page version history) — added by Forge
- MINOR fix: Dashboard scrape button relabeled to "Scrape CSS" — fixed by Forge

### Forge Edit Distance Fix (DEC-036)
Levenshtein module delivered: `edit-distance.ts`, migration 004, aggregation endpoint, `version-history.ts` updated.

### Guided Workflow UX Redesign (Pixel)
- Numbered step checklists on all pages
- Step completion tracking with checkmarks and "next step" highlights
- Pipeline page: stage cards expand/collapse, current highlighted, future locked
- Blueprint detail: per-section status-based action buttons
- Dashboard: "Continue Workflow" buttons per site

### Step Persistence — RESOLVED
Step completion state now reads from the database on page load via `/api/site/[siteId]/step-status`. All 4 pages (site detail, pipeline, blueprint, export) load completion state from DB. No longer resets on reload.

### Post-Build UI/UX Additions (Final Session)

1. **Step persistence from DB:** New `/api/site/[siteId]/step-status` endpoint. All 4 pages read DB on load — progress persists across navigation.
2. **Interactivity endpoint fix:** POST `/api/interactivity` now accepts `{blueprintId}` for blueprint-mode generation (was missing request body handling).
3. **Export page navigation:** "View Export" buttons added to blueprint detail page, blueprint list page, and dashboard for quick access.
4. **Generated HTML preview:** API updated to include `generated_html` in blueprint detail response. Preview/Source tabs added to blueprint detail page.
5. **"Run All" stage orchestration:** 4 new endpoints (`run-all-1` through `run-all-4`), one per stage. Single click runs all tasks for a stage sequentially.
6. **Rendered preview:** Export page defaults to iframe preview with all CSS tiers injected, responsive breakpoint switcher (Mobile 375px / Tablet 768px / Desktop 1200px).

## V2.1 Pipeline Artifacts (Complete)

| Stage | Artifact | Agent | Key Metrics |
|-------|----------|-------|-------------|
| 1. Intake | `intake-brief-v2.json` | Interviewer | 14 scope-in, 5 scope-out, 7 success criteria |
| 2. Problem Definition | `problem-v2.md` | Framer | PRB-002, 10 sections, 10 open questions |
| 3. Architecture | `architecture-decisions-v2.md` | Architect | 24 ADRs (ADR-011 to ADR-034), all V1 decisions superseded |
| 4. Eval Spec | `eval-spec-v2.md` | Eval | 52 eval cases, 11 categories, 27 P0 |
| 5. PRD | `prd-v2.md` | Quill | 42 requirements, full traceability matrix |
| 6. Diagrams | `diagrams/v2/` (7 files) | System context, containers, pipeline, ERD, sequence, silo, export |
| 7. Build Plan | `build-plan-v2.md` | Planner | 56 work items, 8 phases, 8 agents assigned |

**Supporting Research:**
- `squad/inbox/scout-bookingtimes-js-research.md` — Scout JS capability research
- `squad/inbox/scout-seo-geo-schema-research.md` — SEO/GEO/Schema research
- `squad/inbox/scout-siloing-linking-research.md` — Content siloing/internal linking research

## Foundation Validation Results (2026-04-02 evening)

### CSS Platform Analysis
- **Forge scraped metrodriving.com.au:** 15 stylesheets (~1.14MB total)
- **Forge scraped racsom.com.au:** Confirmed identical platform stack
- **Dual framework:** Bootstrap 5.0.2 AND UIKit both loaded
- **LoadCSS endpoint:** `LoadCSS?k=` with per-customer key (k=874264 vs k=874246)
- **FA6 Pro:** Self-hosted on cdn.bookingtimes.com
- **Decision:** Bootstrap 5.0.2 is the actual version (NOT 5.3.3 as previously assumed). UIKit is to be ignored entirely.

### Platform Characteristics
- **Angular SSR** application
- No public update schedule — Bootstrap 5.0 deployment was a major event ("months of preparation", 30,000+ pages)
- Updates are rare
- WYSIWYG paste: CSS classes survive paste (human confirmed, tested vigorously)

### JavaScript and JSON-LD Capability (CONFIRMED)
- JS IS supported via head code injection (Setup > Analytics & Tracking)
- jQuery bundled platform-wide
- No CSP headers blocking script execution
- **JSON-LD survives TinyMCE paste** — FAQPage schema found on live Acacia Ridge page
- **Executable JS survives TinyMCE paste** — Facebook SDK IIFE found inside Metro homepage content area
- Both findings resolve OQ-1 and OQ-5 from problem-v2.md

## Key Decisions Summary

See `DECISIONS.md` for full rationale. Key decisions:

| ID | Decision | Impact |
|----|----------|--------|
| DEC-028 | Unify all CSS under Bootstrap | No UIKit conversion needed |
| DEC-029 | Ignore UIKit entirely | Simplifies CSS strategy |
| DEC-030 | No auth system | Single user, simple access route |
| DEC-031 | Top-down content approach | Homepage first, trickle down |
| DEC-032 | Sidebar on long-tail pages only | Full viewport for other page types |
| DEC-033 | Content freshness alerts | Ad hoc updates, ~2 month cycles |
| DEC-034 | JS capability is a priority | Explore interactive pages in BookingTimes |
| DEC-035 | JSON-LD + JS survive paste | Both confirmed via live site evidence |
| DEC-036 | Replace length-diff with Levenshtein | RESOLVED — Forge delivered edit-distance.ts, migration 004, aggregation endpoint |

Earlier key decisions still in effect: DEC-014 (claude -p CLI subprocess), DEC-016 (infer-first profiles), DEC-017 (section-based generation), DEC-018 (multi-agent site audit), DEC-019 (two-page content model), DEC-024 (GSC + larger platform vision), DEC-025 (platform constraints), DEC-027 (Scribe checkpoints).

24 architecture decision records (ADR-011 through ADR-034) are documented in `architecture-decisions-v2.md`, superseding all V1 decisions.

## Open Items

1. ~~**Edit distance fix:**~~ **RESOLVED (DEC-036).** Forge delivered proper Levenshtein implementation.
2. ~~**UI action gap (38/50 endpoints):**~~ **RESOLVED.** All 38 triggers wired by Pixel. Sentry confirmed 33/35 working; 2 mismatches fixed by Forge.
3. ~~**Step completion persistence:**~~ **RESOLVED.** New `/api/site/[siteId]/step-status` endpoint reads from DB on page load.
4. **OQ-3:** What "minimal edits" means in practice for paste workflow (threshold not yet defined)
5. **Brand inference may 500** if Claude CLI (`claude -p`) isn't configured — expected behavior, not a bug. Requires Max subscription.
6. **Minor a11y warnings** on blueprint detail page (non-blocking).

## Target Sites (Driving Schools)

1. affordabledrivingschoolbrisbane.com.au
2. racsom.com.au
3. easyasdta.com.au
4. metrodriving.com.au
5. learnersdrivertraining.com.au

## Dev Environment

- Dev server: `cd artifacts/bookingtimes-content-emulator/app && npm run dev` (SvelteKit on Node.js)
- Production build: `cd artifacts/bookingtimes-content-emulator/app && npm run build && node build`
- Server runs on: http://localhost:3000
- Database: better-sqlite3 (local SQLite, auto-created)
- Storage: local filesystem at `data/storage/`
- AI: Claude via `claude -p` CLI subprocess (claude-sonnet-4-20250514, Max subscription)

## Next Steps

**Project is COMPLETE.** All 56/56 work items delivered. 624 tests. Edit distance fixed. All 38 UI triggers wired. Guided workflow UX done. Step persistence from DB. Run-All orchestration. Rendered preview with responsive breakpoints.

No further development required unless the user identifies new requirements. Remaining open items (OQ-3, a11y) are non-blocking.
