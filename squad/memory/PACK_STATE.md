# Wolf Pack State

Last updated: 2026-04-03 (Workspace v1 LIVE & VERIFIED by human. All routes confirmed working.)
Updated by: scribe

## Active Projects

| Project | Status | Last Activity | Priority | Location |
|---------|--------|---------------|----------|----------|
| bookingtimes-workspace | **Active — v1 LIVE & VERIFIED + Dashboard.** Human confirmed all routes working. Dashboard at root URL (`/`) shows all sites as project cards. 15/15 work items, 49/49 tests. Full toolchain operational. Metro Driving first site, workspace in active use. | 2026-04-03 | P1 | artifacts/bookingtimes-workspace/ |
| bookingtimes-content-emulator | **DORMANT.** Pipeline app complete (56/56, 624 tests) but superseded by flat-file workspace approach. Available for reference/on-demand tool reuse. | 2026-04-03 | P3 | artifacts/bookingtimes-content-emulator/ |
| peakprotocol | **Phase 6 COMPLETE — DEPLOYED.** Calendar supplements, food diary enhancements, AI estimation. 75 work items. Additional bugfixes 2026-04-07 (manual food entry, WeightChart wiring, weekly schedule case mismatch). ANTHROPIC_API_KEY not yet set. | 2026-04-07 | P1 | artifacts/peakprotocol/ |
| mission-control | **V1 + Testing** (Dashboard Progress FIXED) | 2026-04-01 | P1 | artifacts/mission-control/ |
| project_development | active | 2026-04-02 | P0 | (this repo) |
| interview-intake | **COMPLETE (Integrated)** | 2026-04-01 | P0 | artifacts/interview-intake/ |
| scribe-heartbeat | **COMPLETE** | 2026-04-01 | P2 | artifacts/scribe-heartbeat/ |

## Pack Roster (22 Agents)

| Agent | Role | Status | Current Assignment |
|-------|------|--------|-------------------|
| alpha | Orchestrator | active | available |
| peter | Recruitment Lead | active | available |
| scout | Talent Research | active | available |
| sigma | SQLite Specialist | active | available |
| architect | Operating Model Architect | active | available |
| forge | TypeScript/Node.js Developer | active | available |
| quill | Technical Writer | active | available |
| sketch | Diagram Specialist | active | available |
| eval | Eval Engineer | active | available |
| pipeline | CI/CD Specialist | active | available |
| framer | Problem Framer | active | available |
| planner | Build Planner | active | available |
| anvil | Rust/Tauri Specialist | active | available |
| scribe | Pack Librarian | active | available |
| sentry | QA & Integration Testing Specialist | active | available |
| interviewer | Project Intake Interviewer | active | available |
| auditor | Cross-Layer Code Auditor | active | available |
| cloud | Cloudflare Workers / Edge Platform Specialist | active | available |
| pixel | Frontend UI/UX Specialist | active | available |
| seo | SEO Specialist | active | available |
| geo | GEO Specialist | active | available |
| schema | Schema / Structured Data Specialist | active | available |

## Recent Activity (2026-04-03 — Major Build Session)

### Phase 1: Bug Fix + Pivot to Flat-File Visual Workspace

Human realized BCE app's fundamental problem was visibility — couldn't see what was being built. Pivoted to flat-file workspace.

- Forge fixed 404 on `/api/preview-css/[slug]` (slug-to-hostname mismatch)
- Architect designed workspace (DESIGN.md), Forge built scrape.js + export.js
- Scraped metrodriving.com.au, Pixel redesigned content zone
- Fixed curly quotes bug, fixed Melbourne-to-Brisbane geography error

### Phase 2: Pack Brainstorm + Intake Pipeline

- Pack brainstorm (Pixel, Forge, SEO, Architect) produced 32 ideas for workflow improvements
- Human approved all 32 + added GEO requirement (AI citation optimization)
- Full intake pipeline: Interviewer -> Framer -> Architect (evals) -> Planner (build plan)
- Human authorized autonomous execution: "just bang through it, don't ask me"

### Phase 3: Overnight Build Execution — 15/15 COMPLETE, 49/49 TESTS PASSING

15 work items across 4 waves, 6 agents (Forge, SEO, GEO, Schema, Pixel, Eval). All complete.

**6 Eval Gates (all passing):**
| Eval | Tests | Status |
|------|-------|--------|
| SC1 Auto-Reload (chokidar + SSE) | 1/1 | PASS |
| SC2 SEO Analyzer | 19/19 | PASS |
| SC3 GEO Scorer | 7/7 | PASS |
| SC4 Responsive Preview | 8/8 | PASS |
| SC5 Export Validation | 9/9 | PASS |
| SC6 Multi-Site | 5/5 | PASS |

**Tools built:**
- `tools/serve.js` — dev server with SSE live reload + chokidar file watching
- `tools/scrape.js` — URL to flat HTML with localized assets
- `tools/export.js` — content zone extraction with validation
- `tools/seo-analyze.js` — SEO analysis (headings, keywords, meta, links)
- `tools/geo-score.js` — GEO citation scorer (0-100, 9 signals)
- `tools/status.js` — workspace status command
- `tools/session.js` — session context persistence
- `tools/preview.html` — responsive preview (375/768/1440px)
- `tools/sidebar.html` — SEO + GEO analysis sidebar panel
- `tools/diff.html` — before/after diff view via git
- `tools/analyze-api.js` — analysis API endpoint
- `tools/api-routes.js` — extracted API routes
- `tools/dashboard.html` — project dashboard at root URL (`/`), shows all sites as cards with quick links to Preview, Sidebar, Responsive, and Diff views

**Templates:** `templates/localbusiness.jsonld`, `templates/SCHEMA-README.md`, `templates/seo-checklist.md`, `templates/keyword-intent.json`

**Other:** `tokens/design-tokens.json` (brand colors/fonts from Metro Driving CSS), `site.json` (multi-site manifest), 6 eval test scripts in `tests/`, pipeline artifacts (`intake-brief.json`, `problem.md`, `eval-spec.md`, `build-plan.md`)

**Key decisions this session:** DEC-W001 through DEC-W012 recorded in `artifacts/bookingtimes-workspace/DECISIONS.md`

**BCE status:** Dormant. Not deleted. Analysis tools available on-demand.

---

### Previous: Bookingtimes Content Emulator — PROJECT COMPLETE (56/56 work items)

**Massive implementation sprint. All 56 work items across 8 phases built, tested, and delivered.**

**Phases 0-6 — Build (49 work items, all complete):**
- Phase 0: Foundation (SvelteKit, SQLite, CSS scraper, Claude CLI)
- Phase 1: Audit (sitemap crawler, CSS classifier, brand inference, SEO/GEO/schema auditors)
- Phase 2: Benchmark (SEO/GEO/schema benchmarks, taxonomy/silo architecture)
- Phase 3: Gap Analysis (gap engine, missing pages, backlog, link graph, anchor bank)
- Phase 4: Design (section specs, blueprints, 12-layer prompt assembler, content generator)
- Phase 5: Build (generation pipeline, feedback loop, export, JS interactivity, JSON-LD, freshness, versioning)
- Phase 6: UI (dashboard, pipeline tracking, preview iframe, homepage-first workflow, export UI, brand rules)

**App Structure:**
- 36 server modules in `app/src/lib/server/`
- 33 API route directories in `app/src/routes/api/`
- Full UI: dashboard, backlog, blueprints, brand, preview, site routes

**Phase 7 — Testing & Pilot (7 work items, ALL COMPLETE):**

| Work Item | Description | Agent | Status | Results |
|-----------|-------------|-------|--------|---------|
| WRK-BCE2-050 | Eval harness algorithmic test suite | eval | complete | 118 tests, all passing |
| WRK-BCE2-051 | Eval harness AI-rubric test suite | eval | complete | 71 tests, all passing, claude_judge.py (mock + live) |
| WRK-BCE2-052 | Cross-layer integration testing | sentry | complete | 5 suites, 212 assertions, all passing |
| WRK-BCE2-053 | Single-site pilot E2E | sentry | complete | 126 assertions, full 5-stage pipeline, no issues |
| WRK-BCE2-054 | WYSIWYG paste acceptance test | sentry | complete | 42 tests (7 criteria + 15 negative + 5 edge), all passing |
| WRK-BCE2-055 | Edit distance tracking validation | eval | complete | 55 tests, all passing. Gap found: prod uses length-diff not Levenshtein |
| WRK-BCE2-056 | CSS change detection | forge | complete | New module css-change-detector.ts, API route, migration 003 |

**Phase 7 total: 624 tests/assertions, 0 failures.**

**Edit distance gap (DEC-036) RESOLVED:** Forge replaced length-diff with proper Levenshtein. Deliverables: `edit-distance.ts`, migration 004, aggregation endpoint, `version-history.ts` updated, svelte page fixed.

**UI Action Gap — RESOLVED (all 38 triggers wired):**
3 parallel Pixel agents wired all 38 missing UI action triggers:
- **Dashboard:** "Add New Site & Scrape CSS" form + per-site quick actions
- **Site Detail:** 8 audit/scrape action buttons in 3 groups
- **Pipeline:** Stage-specific action buttons + completion gates + can-advance integration
- **Blueprint list:** 4-step Stage 4 design workflow
- **Blueprint detail:** Per-section Generate/Validate/Approve/Reject/Refine + page-level build actions
- **Export:** Generate Export, Rollback, CSS Change Detection

**Sentry API route audit (33/35 confirmed working):**
- CRITICAL fix: Missing `/api/site/[siteId]/pages` route — added by Forge
- MINOR fix: Dashboard scrape button relabeled "Scrape CSS" — fixed by Forge

**Guided Workflow UX (Pixel):**
- Numbered step checklists on all pages
- Step completion tracking with checkmarks and "next step" highlights
- Pipeline: stage cards expand/collapse, current highlighted, future locked
- Blueprint detail: per-section status-based action buttons
- Dashboard: "Continue Workflow" buttons per site

**Post-Build UI/UX Additions (this session):**
1. Step persistence from DB: new `/api/site/[siteId]/step-status` endpoint, all 4 pages read DB on load
2. Interactivity endpoint fix: POST `/api/interactivity` accepts `{blueprintId}` for blueprint-mode generation
3. Export page navigation: "View Export" buttons on blueprint detail, blueprint list, dashboard
4. Generated HTML preview: API includes `generated_html`, Preview/Source tabs in blueprint detail
5. "Run All" stage orchestration: 4 new endpoints (`run-all-1` through `run-all-4`) — one click per stage
6. Rendered preview: Export page defaults to iframe preview with all CSS tiers, responsive breakpoints (Mobile/Tablet/Desktop)

**Known remaining items:**
- Brand inference may fail if Claude CLI isn't configured (expected — requires `claude -p`)
- Minor a11y warnings on blueprint detail page
- OQ-3 still open: What "minimal edits" means in practice for paste workflow (threshold not yet defined)

**Dev server:** Running at localhost:5173

**Test file locations:**
- `tests/eval/test_algorithmic.py` — 118 algorithmic eval tests
- `tests/eval/test_ai_rubric.py` — 71 AI-rubric eval tests
- `tests/eval/claude_judge.py` — AI judge helper (mock + live modes)
- `tests/integration/` — 5 cross-layer integration suites (01-05)
- `tests/pilot/single-site-e2e.test.ts` — 126 assertions, full pipeline walkthrough
- `tests/pilot/wysiwyg-paste-acceptance.test.ts` — 42 paste acceptance tests
- `tests/pilot/edit-distance-tracking.test.ts` — 55 edit distance validation tests

### Previous: Bookingtimes Content Emulator — Build Session (6 Phases)

**Full pipeline + build + Cloudflare→local pivot + OAuth odyssey + CLI AI integration + Design V2 — all in one session.**

**Phase 1: Pipeline Run** — Interviewer → Framer → Eval (32 cases) → Scout (platform research) → Architect (10 decisions) → Quill (32 requirements) → Sketch (5 diagrams) → Planner (42 items, 7 phases)

**Phase 2: Full Build** — 42/42 work items delivered. Agent contributions: Forge (19), Cloud (11), Pixel (8), Sigma (2). Audit: 14 findings (2 CRITICAL, 4 HIGH) — all 6 fixed.

**Phase 3: Cloudflare → Local Pivot** — adapter-cloudflare → adapter-node, D1 → better-sqlite3, R2 → local filesystem, KV → lru-cache. 23 endpoints + 8 lib files migrated. Build verified, server starts on localhost.

**Phase 4: Post-Pivot Fixes** — Bootstrap SRI hash fix, Pages API column mismatch fix, iframe sandbox allow-scripts, Sites management page with scrape controls (Forge), page content scraper + import-to-editor feature.

**Phase 5: OAuth/Auth Journey (10 attempts):**
1-10. Various OAuth approaches failed. **Implemented `claude -p` CLI subprocess approach — WORKING.**

**Phase 6: Design V2** — "Brand Knowledge Amplifier" concept. **Superseded by V2.1.**

**Pipeline:** Interviewer -> Framer -> Eval (32 cases) -> Scout (platform research) -> Architect (10 decisions) -> Quill (32 requirements) -> Sketch (5 diagrams) -> Planner (42 items, 7 phases)

**Build phases:**
1. Foundation (6): SvelteKit scaffold, D1 schema (11 tables), wrangler config, sidebar UI
2. CSS Scraping (7): Scraper, parser, BS5 (387) + FA6 (203) catalogues, assembly, overlap report
3. Preview (4): R2 CSS cache, iframe preview with srcdoc, wrapper discovery, responsive breakpoints
4. AI Generation (6): Claude proxy with SSE, prompt builder, output validator, chat UI, refinement loop
5. Templates & Export (8): Template CRUD, editor UI, section validation, variant selection, export with class isolation
6. Batch Generation (6): 50 QLD suburb seed data, batch pipeline with 3-retry, review dashboard, progress monitor
7. Version History (4): Append-only versioning, non-destructive rollback, CSS change detection, R2 backup

**Agent contributions:** Forge (19 items), Cloud (11), Pixel (8), Sigma (2)

**Audit:** 14 findings (2 CRITICAL, 4 HIGH, 5 MEDIUM, 3 LOW). All CRITICAL and HIGH fixed.

**Cloudflare → Local Pivot:**
| Before (Cloudflare) | After (Local) |
|---|---|
| `@sveltejs/adapter-cloudflare` | `@sveltejs/adapter-node` |
| D1 (async) | better-sqlite3 (sync) with D1-compat wrapper |
| R2 object storage | Local filesystem (`data/storage/`) |
| KV cache | LRU cache (in-memory, 1hr TTL) |
| `platform?.env?.BCE_DB` | `locals.db` via hooks.server.ts |
| wrangler dev | `npm run dev` / `node build` |
| Claude OAuth (kept) | Claude OAuth (kept) |

**Verification:** Build clean with adapter-node, migrations run (3 files, 5 sites seeded), server starts on http://localhost:3000

**Tech:** SvelteKit (Svelte 5 runes), Node.js (adapter-node), better-sqlite3, local filesystem storage, LRU cache, Claude via `claude -p` CLI subprocess (claude-sonnet-4-20250514, Max subscription), Bootstrap 5.3.3, Font Awesome 6.5.1

**What works:** CSS scraping on live sites, AI generation via CLI subprocess, page scraping + import-to-editor, preview iframe with CSS injection, sites management

**Open items:** WYSIWYG paste test (deferred to human), preview fidelity baseline (deferred), templates/export/batch/version-history e2e testing, pre-existing type error in batch-queue.ts:208, original OAuth dance returns 400, Design V2 review pending

---

### PeakProtocol — PROJECT COMPLETE AND DEPLOYED

**Final session accomplishments:**

1. **Mount blocker resolved** (3 root causes): Router non-Route children pattern, SolidJS render append behavior, vite-plugin-pwa devOptions interference
2. **Auth flow crash fixed**: ErrorBoundary, offline detection, friendlyAuthError helper
3. **Calendar Day Summary feature**: New API endpoint (5 parallel D1 queries), Calendar.tsx, DaySummary.tsx, 3-tab Dashboard layout
4. **Auth simplified to passcode**: POST /api/auth/passcode, APP_PASSCODE secret, fixed "owner" user ID, PasscodeLogin.tsx
5. **Deployed to Cloudflare production**:
   - Frontend: https://peakprotocol-web.pages.dev (Cloudflare Pages)
   - API: https://peakprotocol-api.jusbartholomew.workers.dev (Cloudflare Workers)
   - D1 database + KV namespace + R2 bucket created and bound
   - Secrets configured: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, USDA_API_KEY, APP_PASSCODE
   - CORS + getApiBase() + .env.production configured

### Dev Environment Setup

- Frontend: `cd peakprotocol/packages/web && npm run dev` (Vite, localhost:3000+)
- Backend: `cd peakprotocol/packages/api && npm run dev` (Wrangler, localhost:8787)
- Migrations: `cd peakprotocol/packages/api && npm run db:migrate`

---

## Previous Session Activity (2026-04-01)

### Dashboard Pipeline Progress Fix (Task 2026-04-01-033)

- Added `architecture-decisions` stage (6 stages now, matching Rust backend)
- Added `complete` state handling for `currentStage`
- Dashboard now correctly shows pipeline progress for all projects

### Pack Expansion: 2 New Agents Recruited

- **Cloud** (#18) — Cloudflare Workers / Edge Platform Specialist
  - Domains: cloudflare-workers, hono, d1, kv, r2, edge-runtime, web-push, cron-triggers
  - Recruited via Peter + Scout pipeline
- **Pixel** (#19) — Frontend UI/UX Specialist
  - Domains: solidjs, unocss, uplot, pwa, service-worker, indexeddb, accessibility, mobile-first
  - Recruited via Peter + Scout pipeline

### PeakProtocol Phase 5: Polish & Launch — ALL 8 ITEMS COMPLETE (BUILD DONE)

All 8 remaining work items delivered (WRK-040 through WRK-047):

| WRK | Task | Agent | Key Deliverables |
|-----|------|-------|-----------------|
| 040 | Service Worker | Pixel | Workbox, cache strategies, background sync |
| 041 | IndexedDB Offline Queue | Pixel | idb, replay, 3-retry |
| 042 | Offline Connectivity UI | Pixel | Banner, sync status |
| 043 | Bundle Optimization | Pixel | manualChunks, vendor splitting, analyzer |
| 044 | PWA Manifest | Pixel | Icons, shortcuts, standalone |
| 045 | Data Export/Import | Cloud | R2 storage, batch import |
| 046 | Idempotency Middleware | Cloud | KV-cached responses, 5-min TTL |
| 047 | Eval Test Harness | Eval | 24 cases, Vitest, unit + API tests |

**Phase 4 audit:** 1 HIGH found and fixed (createTrainingSession unwrap)

**Key highlights:**
- Pixel delivered 5 PWA/offline items (service worker, IndexedDB queue, offline UI, bundle optimization, PWA manifest)
- Cloud delivered 2 backend items (data export/import with R2, idempotency middleware with KV)
- Eval delivered test harness with 24 test cases using Vitest
- **Overall progress: 47/47 work items complete (100%)**

### PeakProtocol Full Build Summary

- **47/47 work items complete across 5 phases** — all delivered in a single session
- **19 agents in the pack** (2 recruited this session: Cloud, Pixel)
- **5 audit passes** catching 44 findings total before shipping
- **Audit improvement trend:** 22 → 14 → 2 → 1 → 5 findings per phase (all fixed)

**Agent contributions:**
| Agent | Items | Role |
|-------|-------|------|
| Forge | 18 | Backend APIs, services, pure functions |
| Pixel | 14 | UI components, PWA, offline |
| Cloud | 10 | Workers infra, KV, R2, cron, push |
| Sigma | 3 | Schema, migrations, cache |
| Eval | 1 | Test harness |
| Auditor | 4 passes | Cross-layer audits |

### RESOLVED: PeakProtocol Frontend Mount (2026-04-02)

**STATUS: RESOLVED** — App renders and runs locally. Three root causes fixed:
1. Router non-Route children pattern (Forge + Pixel)
2. SolidJS render() append behavior (Pixel)
3. vite-plugin-pwa devOptions (Forge)

Plus auth flow crash fix: ErrorBoundary + offline state for unreachable backend.

### Phase 5 Audit — CLEAN (5 findings, all fixed)

- **Audit 5:** 5 findings caught in Phase 5 code
  - SQL injection vulnerability on data import endpoint
  - Idempotency scoping issue
  - Service worker method filtering
  - (2 additional findings)
- **Fix Pass:** All 5 fixed immediately
- **Status:** CLEAN. All phases now audit-clean.

### Alpha Protocol Violation — Two-Strike Debugging Rule

Alpha spent 4+ rounds debugging the frontend mount issue directly instead of delegating after 2 failed attempts. This violates the Two-Strike Debugging Rule. **Learning:** After 2 failed debug attempts, ALWAYS spawn a specialist (Forge or Pixel) to take over.

### PeakProtocol Phase 4: Training & Reports — ALL 9 ITEMS COMPLETE

All 9 work items delivered (WRK-031 through WRK-039) across 3 specialist agents:

| WRK | Task | Agent | Key Deliverables |
|-----|------|-------|-----------------|
| 031 | Training Session API | Forge | Training session CRUD and tracking endpoints |
| 032+033 | Training UI (simple + detailed) | Pixel | Training page with simple and detailed entry modes |
| 034 | Training Weekly Summary | Pixel | Weekly training summary view |
| 035 | Journal Entry API | Forge | Journal entry CRUD with search |
| 036 | Journal UI with Search | Pixel | Journal page with full-text search |
| 037 | Correlation Analysis Service | Forge | Pure analysis service with Pearson correlation |
| 038 | Reports UI | Pixel | Reports page with correlation gauges |
| 039 | Weekly Report Cron Update | Cloud | Enhanced weekly cron with real data |

**Key highlights:**
- Pixel delivered 5 UI components (training page with 3 modes, journal with search, reports with correlation gauges)
- Forge built pure Pearson correlation analysis service
- Cloud enhanced weekly cron to use real data

### PeakProtocol Phase 3: Nutrition — ALL 10 ITEMS COMPLETE

All 10 work items delivered (WRK-021 through WRK-030) across 3 specialist agents working two parallel tracks (food + metrics):

| WRK | Task | Agent | Key Deliverables |
|-----|------|-------|-----------------|
| 021 | USDA API Integration | Forge | API client with retry, nutrient extraction by ID |
| 022 | Food Cache Layer | Sigma | Cache-first search, 52 seed foods, batch insert chunked at 50 |
| 023 | Food Search API | Forge | Quantity-based macro calc, single food lookup |
| 024 | Food Entry API | Forge | CRUD + daily macro totals, meal ordering |
| 025 | Saved Foods API | Forge | Library with usage_count tracking |
| 026 | FoodLogger UI | Pixel | Debounced search modal, live macro calc, meal sections |
| 027 | Quick-Add UI | Pixel | 3-tap flow, toast notifications, dashboard integration |
| 028 | Daily Metrics API | Forge | Upsert with read-merge-replace pattern |
| 029 | Weight Trend Chart | Pixel | uPlot with linear regression trend line, range selector |
| 030 | Daily Metrics UI | Pixel | Weight entry, hydration progress bar with quick-add, date nav |

**Key highlights:**
- Pixel delivered 4 major UI components (FoodLogger, QuickAdd, WeightChart, Metrics page)
- Sigma contributed food cache with 52 seed foods
- Two parallel tracks (food track + metrics track) converged cleanly
- **Overall progress: 30/47 work items complete (64%)**

### PeakProtocol Phase 2: Core Features — ALL 10 ITEMS COMPLETE

All 10 work items delivered (WRK-011 through WRK-020) across 3 specialist agents working in parallel waves:

| WRK | Task | Agent | Key Deliverables |
|-----|------|-------|-----------------|
| 011 | Supplement CRUD API | Forge | 5 REST endpoints, zod validation, snake-to-camelCase |
| 012 | Scheduling Engine | Forge | 4 schedule types, pure functions, date utils |
| 013 | Supplement Logging API | Forge | Log taken/skipped, daily logs, history |
| 014 | Dose Titration API | Forge | Atomic dose changes with DB.batch(), immutable history |
| 015 | Compliance Calculator | Forge | Daily/range/streak, time-of-day cutoffs |
| 016 | Supplement Tracker UI | Pixel | List, forms, detail, dose modal, nav bar, dark mode |
| 017 | Compliance Dashboard UI | Pixel | Compliance ring, quick-log, weekly view, streaks, optimistic UI |
| 018 | VAPID Key Generation | Cloud | Key gen script, VAPID module, frontend config |
| 019 | Web Push Subscription | Cloud | Full RFC 8291 encryption (pure Web Crypto, no dependencies) |
| 020 | Cron Triggers | Cloud | Missed supplement check (15min), weekly report (Sunday 9PM) |

**Key highlights:**
- Cloud implemented full RFC 8291 Web Push encryption using only Web Crypto APIs — zero external dependencies
- Pixel's first deployments (WRK-016, 017) delivered strong — mobile-first, dark mode, optimistic UI, SolidJS-correct
- Forge built pure service layer (scheduler, compliance) consumed by both frontend routes and cron triggers
- All 3 specialist agents (Forge, Cloud, Pixel) worked in parallel across waves
- **Phase 2 progress at time: 20/47 work items complete (43%)**

### PeakProtocol Phase 1: Foundation — COMPLETE AND AUDIT-CLEAN

All 10 work items delivered (WRK-001 through WRK-010):

| WRK | Task | Agent | Key Deliverables |
|-----|------|-------|-----------------|
| 001 | Frontend scaffold | Forge | SolidJS + UnoCSS + Vite monorepo at peakprotocol/packages/web/ |
| 002 | Backend scaffold | Cloud | Workers + Hono + D1/KV/R2 bindings at peakprotocol/packages/api/ |
| 003 | D1 schema | Sigma | 13 tables, 15 indexes, migration file |
| 004 | Migration system | Sigma | Wrangler-native migrations + runner script |
| 005 | KV sessions | Cloud | Session service + auth middleware |
| 006 | Passkey registration | Forge | WebAuthn + custom CBOR parser + recovery codes |
| 007 | Passkey login | Forge | Assertion verification + DER-to-raw + replay protection |
| 008 | Fallback auth | Forge | Device-bound tokens + cookies |
| 009 | Auth guard | Forge | Auth context + guard + logout |
| 010 | Security headers | Cloud | HSTS, CSP, nosniff (bundled with WRK-002) |

### Audit-Fix Loop (3 Iterations)

- **Audit 1:** 22 findings (3 CRITICAL, 5 HIGH, 8 MEDIUM, 6 LOW)
  - Critical: cookie name mismatch, missing Set-Cookie on register, no user_id on auth tables
  - High: no CORS, KV pollution, orphan recovery sessions, unused zod, polling callbacks
- **Fix Pass 1:** 9 fixes deployed (Cloud: 5, Forge: 4)
- **Audit 2:** All 9 verified. 2 new findings (AuthGuard still using POST challenge, missing userHandle)
- **Fix Pass 2:** 2 fixes (Alpha direct edits)
- **Audit 3:** CLEAN. Zero CRITICAL, zero HIGH remaining.

### PeakProtocol Phase 2 Audit-Fix Loop (2 Iterations)

- **Audit 1:** 14 findings (5 CRITICAL, 6 HIGH, 3 MEDIUM)
  - Systemic: frontend `lib/supplements.ts` used snake_case + wrong types vs backend camelCase
  - Route conflict: supplements/:id captured "logs" path
  - Tag LIKE escaping missing; Cron handlers missing ctx parameter
- **Fix Pass 1:** All 14 fixed (Pixel: 9, Forge: 2, Cloud: 2, Alpha: 1)
- **Audit 2:** 13/14 verified clean. 1 remaining: TIME_OPTIONS sent display values not enum values
- **Fix Pass 2:** Alpha direct fix — TIME_OPTIONS now uses value/label pairs
- **Status:** CLEAN. Ready for Phase 3.

**Recurring pattern — frontend type contract misalignment:** Happened in Mission Control (6 CRITICAL) and PeakProtocol Phase 2 (5 CRITICAL). Root cause: frontend types written independently without reading backend response shapes. **Mitigation:** Always have the frontend agent READ the backend route file first to match exact response shape.

### Key Technical Decisions (This Session)

- **DEC-016:** Infer-first over manual profiles — voice/brand extracted from existing content, not user-entered
- **DEC-017:** Section-based generation — per-section Claude calls with cascading rules (global → page-type → section), not whole-page generation
- **DEC-018:** Multi-agent site audit as Stage 1 — SEO, GEO, Schema, Pixel, content agents each audit live site
- **DEC-019:** Two-page content model — service pages + location pages (not landing pages or blog posts)
- **DEC-020:** Three new specialist agents — seo, geo, schema recruited for pipeline stages
- **DEC-014:** `claude -p` CLI subprocess as AI integration method (supersedes DEC-013 and DEC-012)
- **DEC-015:** Brand Knowledge Amplifier architecture (Design V2, superseded by V2.1)
- **DEC-011:** Local Node.js deployment over Cloudflare (supersedes DEC-002)
- **Claude token location:** `squad/claude_token.md` (dedicated) / `~/.claude/.credentials.json` (Claude Code)

### Key Technical Decisions (Previous Sessions)

- **PushForge** library for Web Push (not web-push npm — incompatible with Workers)
- **Custom CBOR parser** built from scratch (avoids dependency for WebAuthn)
- **Wrangler-native migration system** (not custom runner)
- **npm workspaces** monorepo structure
- `pp_session` cookie name with httpOnly, secure, sameSite=strict

### Shell Environment Learnings

- **pnpm not in PATH:** Claude Code bash shell on Windows doesn't have pnpm in PATH
- **Fallback:** Use `npm run tauri dev` when pnpm is unavailable
- **Path escaping:** Windows backslashes get stripped in bash commands - be cautious with path strings

### Previous Session Completions

- PeakProtocol FIRST FULL PIPELINE RUN (all 6 stages, all artifacts generated)
- Artifact Browser Path Fix (relative -> absolute path)
- Full Codebase Contract Audit (6 CRITICAL mismatches fixed)
- Interview Intake end-to-end tested
- Auditor Agent Created (#17)
- Scribe Heartbeat System Complete
- Mission Control Path Doubling Fix
- Interview Intake UI Verification
- Pack Performance Review (47 tasks, 84 reports)

### QA Status

- **Mission Control V1**: 8/8 tests PASSED (1 BLOCKED for human visual inspection)
- All integration tests verified cross-layer communication
- Rust backend tests all passing
- **PeakProtocol Phase 1**: Audit-clean after 3 audit iterations
- **PeakProtocol Phase 2**: Audit-clean after 2 iterations (14 findings → all fixed)
- **PeakProtocol Phase 3**: 10/10 items complete, audit passed
- **PeakProtocol Phase 4**: 9/9 items complete, audit passed (1 HIGH fixed)
- **PeakProtocol Phase 5**: 8/8 items complete, audit CLEAN (5 findings fixed)
- **PeakProtocol BUILD COMPLETE**: 47/47 items, 5 audit passes, 44 findings resolved (all phases audit-clean)
- **PeakProtocol MOUNT FIX**: Frontend renders locally — 3 root causes fixed (router pattern, render append, PWA devOptions) + auth offline handling (2026-04-02)
- **PeakProtocol DEPLOYED**: Production deployment verified — Pages frontend + Workers API + D1 + KV + R2 (2026-04-02)

## Open Items

- [x] Design Pack Memory System (task 2026-03-31-021) - completed
- [x] Initialize project memory for mission-control - completed
- [x] Mission Control V1 fully operational (all IPC/persistence issues fixed)
- [x] Recruit QA Specialist (Sentry) - completed
- [x] QA validation of Mission Control V1 - completed (8/8 PASSED, 1 BLOCKED)
- [x] Verify all 15 agents in registry and database - completed
- [x] Design Interview Intake System - completed (2026-04-01)
- [x] Recruit Interviewer agent (#16) - completed (2026-04-01)
- [x] Build interview infrastructure - completed (2026-04-01)
- [x] Integrate Interview Intake into Mission Control - completed (2026-04-01)
- [x] Fix Mission Control path doubling bug - completed (2026-04-01)
- [x] Design Scribe heartbeat system - completed (2026-04-01)
- [x] Implement Scribe heartbeat CLI warning - completed (2026-04-01)
- [x] Implement Scribe heartbeat Tauri command - completed (2026-04-01)
- [x] Implement Scribe heartbeat UI indicator - completed (2026-04-01)
- [x] Full Mission Control codebase audit - completed (2026-04-01)
- [x] Fix all 6 CRITICAL TypeScript/Rust contract mismatches - completed (2026-04-01)
- [x] Recruit Auditor agent (#17) - completed (2026-04-01)
- [x] Test Interview Intake end-to-end - completed (2026-04-01)
- [x] PeakProtocol full pipeline run - completed (2026-04-01)
- [x] Fix Dashboard pipeline progress display - completed (2026-04-01)
- [x] Recruit Cloud agent (#18) - completed (2026-04-01)
- [x] Recruit Pixel agent (#19) - completed (2026-04-01)
- [x] PeakProtocol Phase 1 Foundation (WRK-001 to WRK-010) - completed (2026-04-01)
- [x] PeakProtocol Phase 1 audit - CLEAN (2026-04-01)
- [x] PeakProtocol Phase 2: Core Features (WRK-011 through WRK-020) - completed (2026-04-01)
- [x] PeakProtocol Phase 2 audit — CLEAN (2 iterations, 14 findings all resolved)
- [x] PeakProtocol Phase 3: Nutrition (WRK-021 through WRK-030) - completed (2026-04-01), audit pending
- [x] PeakProtocol Phase 3 audit - passed (2026-04-01)
- [x] PeakProtocol Phase 4: Training & Reports (WRK-031 through WRK-039) - completed (2026-04-01)
- [x] PeakProtocol Phase 4 audit - 1 HIGH found and fixed (2026-04-01)
- [x] PeakProtocol Phase 5: Polish & Launch (WRK-040 through WRK-047) - completed (2026-04-01)
- [x] PeakProtocol Phase 5 audit — CLEAN (5 findings fixed: SQL injection on import, idempotency scoping, SW method filtering)
- [x] **RESOLVED:** PeakProtocol frontend mount failure — 3 root causes fixed (2026-04-02)
- [x] PeakProtocol auth flow crash when backend unreachable — ErrorBoundary + offline state (2026-04-02)
- [x] PeakProtocol Calendar Day Summary feature — 3-tab Dashboard (2026-04-02)
- [x] PeakProtocol auth simplified to passcode (2026-04-02)
- [x] PeakProtocol deployment to Cloudflare — COMPLETE (2026-04-02)
- [x] Bookingtimes Content Emulator full pipeline run (2026-04-02)
- [x] Bookingtimes Content Emulator build — 42/42 work items complete (2026-04-02)
- [x] Bookingtimes Content Emulator audit — all CRITICAL/HIGH fixed (2026-04-02)
- [ ] Bookingtimes Content Emulator — WYSIWYG paste test (EVAL-BCE-008, deferred to human)
- [ ] Bookingtimes Content Emulator — preview fidelity baseline (WRK-018, deferred to live testing)
- [ ] Bookingtimes Content Emulator — pre-existing type error in batch-queue.ts:208
- [x] Bookingtimes Content Emulator — pivoted from Cloudflare to local Node.js deployment (2026-04-02)
- [x] Bookingtimes Content Emulator — post-pivot fixes: Bootstrap SRI, pages API, iframe sandbox (2026-04-02)
- [x] Bookingtimes Content Emulator — Sites Management Page with scrape controls (2026-04-02)
- [x] Bookingtimes Content Emulator — Claude Code credential auth (zero-config) (2026-04-02)
- [x] Bookingtimes Content Emulator — first live site CSS scrape — confirmed working (2026-04-02)
- [x] Bookingtimes Content Emulator — AI generation via claude -p CLI subprocess — WORKING (2026-04-02)
- [x] Bookingtimes Content Emulator — page content scraper + import-to-editor (2026-04-02)
- [x] Bookingtimes Content Emulator — Design V2 review — completed, evolved to V2.1 (2026-04-02)
- [x] Bookingtimes Content Emulator — Scout SEO/GEO/Schema research — completed (2026-04-02)
- [x] Bookingtimes Content Emulator — Scout siloing/linking research — completed (2026-04-02)
- [x] Bookingtimes Content Emulator — Recruit seo, geo, schema agents (#20-22) — completed (2026-04-02)
- [x] Bookingtimes Content Emulator — Architect V2.1 consolidation — completed (2026-04-02)
- [ ] Bookingtimes Content Emulator — Human review of V2.1 design (design-v2.1.md) — in progress
- [ ] Bookingtimes Content Emulator — original OAuth dance returns 400 (fix or remove)
- [ ] Bookingtimes Content Emulator — templates/export/batch/version-history end-to-end testing
- [ ] Bookingtimes Content Emulator — AI generation end-to-end with content generation UI
- [ ] Bookingtimes Content Emulator — V2.1 open items: WYSIWYG paste test, Tier 3 CSS deployment, optimal section count
- [ ] Set up automation scripts for memory compression
- [ ] Create memory validation CI checks
- [ ] Plan V2 features for Mission Control
- [ ] Human visual inspection to unblock 1 remaining test
- [ ] Implement interview eval harness (tests/test_interview_eval.py)
- [ ] Integrate interview metrics into Mission Control

## Project Summaries

### bookingtimes-content-emulator (BUILD COMPLETE)

Content creation emulator replicating the Bookingtimes.com platform experience. Generates, previews, and exports website content sections styled with Bootstrap 5.3.3 + Font Awesome 6.5.1. AI-powered generation via Claude produces HTML snippets that can be batch-generated for multiple business locations (driving schools across QLD suburbs). **Second project to complete full pipeline + build.** 42 work items delivered by 4 specialist agents with 1 audit pass catching 14 findings.

**Stack:** SvelteKit (Svelte 5 runes), Node.js (adapter-node), better-sqlite3 (D1-compat wrapper), local filesystem storage, LRU cache, Claude via `claude -p` CLI subprocess (Max subscription), Bootstrap 5.3.3, Font Awesome 6.5.1

**Key capabilities:**
- CSS scraping and catalogue extraction (BS5: 387 classes, FA6: 203 icons) — working on live sites
- Sites management page with per-site scrape controls
- Page content scraper + import-to-editor
- iframe preview with full CSS isolation and site CSS injection
- AI content generation via claude -p CLI subprocess — working
- Template system with variant selection and export with class isolation
- Batch generation pipeline (50 suburbs, 3-retry) with review dashboard
- Append-only version history with non-destructive rollback
- Auth via Claude Code credentials (zero-config) with OAuth PKCE fallback

**Target sites (5 QLD driving schools):** affordabledrivingschoolbrisbane.com.au, racsom.com.au, easyasdta.com.au, metrodriving.com.au, learnersdrivertraining.com.au

**Design V2.1:** Research-first pipeline with infer-first brand profiles, section-based generation, multi-agent site audit, content siloing, and SEO/GEO/Schema as first-class concerns. Design doc at `artifacts/bookingtimes-content-emulator/design-v2.1.md`. Supersedes V2 ("Brand Knowledge Amplifier").

**New agents for pipeline:** seo (#20), geo (#21), schema (#22) — recruited this session.

**Research artifacts:** `squad/inbox/scout-seo-geo-schema-research.md`, `squad/inbox/scout-siloing-linking-research.md`, `squad/inbox/scout-skills-seo.md`, `squad/inbox/scout-skills-geo.md`, `squad/inbox/scout-skills-schema.md`

**Token:** Dedicated Claude token at `squad/claude_token.md`. Claude Code credentials at `~/.claude/.credentials.json`.

**Location:** `bookingtimes-emulator/` | **Status:** Functional, AI working, Design V2.1 consolidated and under human review (http://localhost, port varies via `npm run dev`)

### interview-intake (COMPLETE)

AI-powered structured interview system for project intake. Replaces manual intake protocol with an adaptive multi-turn conversation that extracts project requirements and produces validated Intake Briefs. **Fully integrated into Mission Control.**

Core components:
- **Interviewer agent** (`squad/agents/interviewer.md`) - Conducts 5-stage interviews
- **Interview CLI** (`squad/interview.py`) - Session management with `--json` flag
- **MCP tools** (`squad/tools/interview_tools.py`) - 4 tools for interview operations
- **Database tables** - `interviews`, `interview_responses` (DB version 2)
- **Design doc** (`artifacts/interview-intake/DESIGN.md`)
- **Eval spec** (`artifacts/interview-intake/eval-spec.md`) - 8 eval cases
- **Tauri backend** (`mission-control/src-tauri/src/interview.rs`) - 5 commands, all tests passing
- **React frontend** (`mission-control/src/components/InterviewIntake.tsx`) - Chat UI
- **Mode toggle** (`mission-control/src/views/IntakeView.tsx`) - Manual/Interview switch

**Interview Flow:** Problem Discovery -> User Identification -> Scope Definition -> Constraints -> Success Criteria -> Intake Brief JSON

**Output:** `artifacts/{project-slug}/intake-brief.json` -> Framer -> `problem.md`

### mission-control

Wolf Pack Mission Control is a desktop GUI application for managing and monitoring the Wolf Pack system. Built with Tauri v2 (Rust backend) and SolidJS/TypeScript frontend. **V1 COMPLETE + ALL CONTRACTS FIXED + DASHBOARD PROGRESS FIXED** (Sentry: 8/8 tests PASSED, 1 BLOCKED for human visual inspection).

Core features implemented:
- App shell with sidebar navigation
- Dashboard view with project stats (6-stage pipeline progress)
- Project view with pipeline visualization
- Artifact browser with Markdown rendering
- DB Explorer for querying wolfpack.db
- Intake form for new project submission (Manual + Interview modes)
- Interview Intake - Chat-based AI interview for requirements extraction
- Agent roster display
- Settings persistence (APPDATA/Roaming path)
- File system watching
- IPC communication (withGlobalTauri:true)
- Database reconnection without restart
- Memory status indicator (green/yellow/red based on staleness)

### project_development

Meta-development platform that turns ideas into implementation-ready project assets. Orchestrates a pipeline from problem definition through eval creation, PRDs, diagrams, and engineering handoff.

### peakprotocol (PROJECT COMPLETE — DEPLOYED TO PRODUCTION)

Personal health optimization app. Tracks supplements, food logging, training, and analyzes patterns to optimize health outcomes. **First project to complete the full pipeline AND all 5 implementation phases.** 47 work items delivered by 5 specialist agents with 5 audit passes catching 44 findings. Auth simplified to passcode, Calendar Day Summary added, deployed to Cloudflare (Pages + Workers + D1 + KV + R2). Production: https://peakprotocol-web.pages.dev

Core artifacts (pipeline):
- **Problem definition** (`problem.md`) - 12 success criteria, 8 open questions
- **Eval spec** (`eval-spec.md`) - 24 test cases across 7 categories
- **Architecture decisions** (`architecture-decisions.md`) - 8 decisions, stack: SolidJS + Cloudflare Workers + D1
- **PRD** (`prd.md`) - 19 requirements, 12-week timeline, 5 implementation phases
- **Diagrams** (`diagrams/`) - 5 Mermaid diagrams
- **Build plan** (`build-plan.md`) - 47 work items with dependency graph

Implementation (Phase 1 Foundation):
- **Frontend:** SolidJS + UnoCSS + Vite monorepo (`peakprotocol/packages/web/`)
- **Backend:** Cloudflare Workers + Hono + D1/KV/R2 (`peakprotocol/packages/api/`)
- **Database:** 13 tables, 15 indexes, wrangler-native migrations
- **Auth:** WebAuthn passkeys + device-bound fallback + KV sessions
- **Security:** HSTS, CSP, nosniff headers, httpOnly cookies

Implementation (Phase 2 Core Features):
- **Supplement CRUD:** 5 REST endpoints with zod validation
- **Scheduling:** 4 schedule types, pure service layer
- **Logging:** Take/skip tracking, daily logs, history
- **Dose Titration:** Atomic changes with DB.batch(), immutable history
- **Compliance:** Daily/range/streak calculations, time-of-day cutoffs
- **Tracker UI:** SolidJS list/forms/detail, dose modal, nav bar, dark mode (Pixel)
- **Dashboard UI:** Compliance ring, quick-log, weekly view, streaks, optimistic UI (Pixel)
- **Web Push:** VAPID keys, full RFC 8291 encryption (pure Web Crypto), notification manager (Cloud)
- **Cron Triggers:** Missed supplement check (15min), weekly report (Sunday 9PM) (Cloud)

Implementation (Phase 3 Nutrition):
- **USDA API:** Integration client with retry logic, nutrient extraction (Forge)
- **Food Cache:** Cache-first search, 52 seed foods, chunked batch insert (Sigma)
- **Food Search/Entry APIs:** Quantity-based macro calc, CRUD + daily totals, meal ordering (Forge)
- **Saved Foods:** Library with usage_count tracking (Forge)
- **Daily Metrics API:** Upsert with read-merge-replace pattern (Forge)
- **FoodLogger UI:** Debounced search modal, live macro calc, meal sections (Pixel)
- **Quick-Add UI:** 3-tap flow, toast notifications, dashboard integration (Pixel)
- **Weight Trend Chart:** uPlot with linear regression trend line, range selector (Pixel)
- **Daily Metrics UI:** Weight entry, hydration progress bar with quick-add, date nav (Pixel)

Implementation (Phase 4 Training & Reports):
- **Training Session API:** CRUD and tracking endpoints (Forge)
- **Training UI:** Simple + detailed entry modes, weekly summary (Pixel)
- **Journal Entry API:** CRUD with search (Forge)
- **Journal UI:** Full-text search (Pixel)
- **Correlation Analysis:** Pure Pearson correlation service (Forge)
- **Reports UI:** Correlation gauges (Pixel)
- **Weekly Cron Update:** Enhanced with real data (Cloud)

Implementation (Phase 5 Polish & Launch):
- **Service Worker:** Workbox with cache strategies and background sync (Pixel)
- **IndexedDB Offline Queue:** idb library, replay mechanism, 3-retry (Pixel)
- **Offline Connectivity UI:** Banner and sync status indicator (Pixel)
- **Bundle Optimization:** manualChunks, vendor splitting, bundle analyzer (Pixel)
- **PWA Manifest:** Icons, shortcuts, standalone mode (Pixel)
- **Data Export/Import:** R2 storage with batch import (Cloud)
- **Idempotency Middleware:** KV-cached responses with 5-min TTL (Cloud)
- **Eval Test Harness:** 24 test cases with Vitest, unit + API tests (Eval)

**Status:** PROJECT COMPLETE — DEPLOYED TO PRODUCTION. Frontend: https://peakprotocol-web.pages.dev | API: https://peakprotocol-api.jusbartholomew.workers.dev

## Notes

- All agents log reports via `squad/log.py`
- Database at `squad/wolfpack.db` is source of truth for tasks and reports
- Registry at `squad/registry.json` lists all available agents (22 agents)
- Protocol at `squad/PROTOCOL.md` defines rules of engagement
- Interviewer uses Claude Agent SDK with OAuth (internal tool, allowed per policy)
