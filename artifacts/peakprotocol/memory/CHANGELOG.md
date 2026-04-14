# PeakProtocol - Changelog

## [2026-04-05/06] Phase 6 — Calendar Supplements, Food Diary, AI Estimation

### Planning Pipeline (Full Re-Run)
- Interviewer: intake brief (2 feature clusters, 10 UX enhancements)
- Framer: problem definition (11 in-scope, 7 open questions, backward compat)
- Architect: eval spec (32 test cases) + 9 architecture decisions (DEC-phase6-001 to 009)
- Quill: PRD (13 requirements: 7 P0, 6 P1)
- Planner: build plan (28 work items, 4 sub-phases)

### Phase 6A: Infrastructure
- Sigma: 4 D1 migrations (supplement color, food_cache source, food_entries description)
- Cloud: ANTHROPIC_API_KEY Wrangler secret setup

### Phase 6B: Backend (Forge — 10 APIs)
- Calendar supplement dots endpoint (`GET /api/calendar-supplements/:month`)
- Supplement checklist with color + log tracking
- Multi-source food search with source discriminator
- AI macro estimation via Anthropic Claude Haiku
- Deferred calculation (NULL macros, "Calculate All" batch)
- Manual macro override, source badges
- Auditor: 2 passes (0C/1H/6M/4L → all fixed)

### Phase 6C: Frontend (Pixel — 9 components)
- Calendar dots with overflow (+N indicator, 8 desktop / 6 mobile)
- Supplement checklist UI
- Compliance heatmap
- Multi-source food search with source badges
- AI estimation UI + deferred calc display
- Manual macro override

### Phase 6D: Integration & Testing
- Integration audit: 2H/3M/2L → all fixed
- Eval harness: 52 tests, 104 passing assertions
- Sentry verification: PASSED

### Production Hotfixes (3)
1. Null color on pre-existing supplements — lazy backfill on first GET
2. Supplement checkboxes hidden — total count fixed to include scheduled (not just logged), logId added to response
3. every_n_days supplements invisible — frontend sent `{every_n_days: 3}`, scheduler expected `{n: 3}`. Fixed both + backward compat shim

### Additional Fixes
- Manual food entry: "Quick text entry" button now always visible (was hidden behind search no-results) — Pixel
- WeightChart on Metrics page: wired up existing uPlot component (WRK-029) into Metrics.tsx — Pixel
- Weekly schedule supplements not showing on calendar — case mismatch (same class as `every_n_days`). Frontend sent `"Mon"`/`"Morning"`, backend `isDayName()` only accepted lowercase. Forge fixed at 3 levels: frontend SupplementForm sends lowercase; backend `dates.ts` got `normalizeDayName()` helper (any case/length variant); scheduler normalizes timeOfDay and day values for legacy DB records.

### Deployment
- 4 D1 migrations applied to production
- API Worker + Frontend Pages redeployed
- Multiple hotfix redeploys during user testing

---

## [2026-04-02] Project Complete — Deployed to Production

### Mount Blocker Resolved (3 root causes)
- **@solidjs/router v0.15 non-Route children pattern** — `<Nav />` as direct child of `<Router>` silently corrupted route table. Fixed with `<Router root={AppLayout}>` pattern. (File: `App.tsx`)
- **SolidJS render() appends not replaces** — Placeholder text never removed. Fixed with `root.innerHTML = ""` before render(). (File: `index.tsx`)
- **vite-plugin-pwa devOptions interference** — `enabled: true` caused SW compilation failure in dev. Fixed with `enabled: false`. (File: `vite.config.ts`)

### Auth Flow Crash Fixed
- Added ErrorBoundary in AuthGuard for network failures
- Added "offline" auth state with "Server Unavailable" UI + retry button
- Added `friendlyAuthError()` helper
- Files: `AuthGuard.tsx`, `auth.ts`, `AuthSetup.tsx`, `AuthLogin.tsx`, `DeviceAuth.tsx`

### New Feature: Calendar Day Summary
- New API endpoint: `GET /api/daily-summary/:date` (5 parallel D1 queries)
- New components: `Calendar.tsx`, `DaySummary.tsx`, `dailySummary.ts`
- Dashboard.tsx updated with 3-tab layout: Calendar | Today | Week
- Contrast fix on selected day styling

### Auth Replaced with Simple Passcode
- `POST /api/auth/passcode` checks `APP_PASSCODE` Wrangler secret
- Fixed user ID "owner" for cross-device data persistence
- `PasscodeLogin.tsx` replaces all previous WebAuthn auth flows
- `AuthGuard.tsx` simplified to passcode-only

### Deployed to Cloudflare Production
- **Frontend:** https://peakprotocol-web.pages.dev (Cloudflare Pages)
- **API:** https://peakprotocol-api.jusbartholomew.workers.dev (Cloudflare Workers)
- D1 database created + migrations applied remotely
- KV namespace + R2 bucket created and bound
- Secrets set: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `USDA_API_KEY`, `APP_PASSCODE`
- CORS updated for Pages origin
- `getApiBase()` fixed with `VITE_API_URL` env var + `.env.production` file

### Defensive Measures Added
- SW unregistration script in `index.html`
- Global error/unhandledrejection listeners in `index.html`
- `optimizeDeps` for key packages in `vite.config.ts`

## [2026-04-01] Full Build Complete — 47/47 Work Items

### Phase 5: Polish & Launch (WRK-040 to WRK-047)
- Service Worker with Workbox cache strategies and background sync (Pixel)
- IndexedDB offline queue with 3-retry replay mechanism (Pixel)
- Offline connectivity banner and sync status indicator (Pixel)
- Bundle optimization with manual chunks and vendor splitting (Pixel)
- PWA manifest with icons, shortcuts, standalone mode (Pixel)
- Data export/import via R2 storage with batch import (Cloud)
- Idempotency middleware with KV-cached responses, 5-min TTL (Cloud)
- Eval test harness: 24 test cases with Vitest (Eval)
- **Phase 5 audit:** 5 findings (SQL injection on import, idempotency scoping, SW method filtering) — all fixed

### Phase 4: Training & Reports (WRK-031 to WRK-039)
- Training session CRUD API and tracking endpoints (Forge)
- Training UI with simple + detailed entry modes and weekly summary (Pixel)
- Journal entry CRUD API with search (Forge)
- Journal UI with full-text search (Pixel)
- Pearson correlation analysis service (Forge)
- Reports UI with correlation gauges (Pixel)
- Weekly report cron enhanced with real data (Cloud)
- **Phase 4 audit:** 1 HIGH found and fixed (createTrainingSession unwrap)

### Phase 3: Nutrition (WRK-021 to WRK-030)
- USDA API client with retry logic and nutrient extraction (Forge)
- Food cache with 52 seed foods, cache-first search, chunked batch insert (Sigma)
- Food search/entry APIs with quantity-based macro calc (Forge)
- Saved foods library with usage_count tracking (Forge)
- Daily metrics API with upsert read-merge-replace pattern (Forge)
- FoodLogger UI with debounced search and live macro calc (Pixel)
- Quick-Add UI with 3-tap flow and toast notifications (Pixel)
- Weight trend chart with uPlot + linear regression (Pixel)
- Daily metrics UI with hydration progress bar (Pixel)
- **Phase 3 audit:** passed (merged into Phase 4 audit)

### Phase 2: Core Features (WRK-011 to WRK-020)
- Supplement CRUD: 5 REST endpoints with zod validation (Forge)
- Scheduling engine: 4 schedule types, pure functions (Forge)
- Supplement logging, dose titration, compliance calculator (Forge)
- Supplement tracker UI: list, forms, detail, dose modal, nav, dark mode (Pixel)
- Compliance dashboard: ring, quick-log, weekly view, streaks, optimistic UI (Pixel)
- VAPID key generation, Web Push (full RFC 8291 encryption, pure Web Crypto) (Cloud)
- Cron triggers: missed supplement check (15min), weekly report (Cloud)
- **Phase 2 audit:** 14 findings in 2 iterations — all fixed

### Phase 1: Foundation (WRK-001 to WRK-010)
- SolidJS + UnoCSS + Vite monorepo scaffold (Forge)
- Cloudflare Workers + Hono + D1/KV/R2 backend scaffold (Cloud)
- D1 schema: 13 tables, 15 indexes (Sigma)
- Wrangler-native migration system (Sigma)
- KV sessions + auth middleware (Cloud)
- WebAuthn passkey registration + login (Forge)
- Device-bound token fallback auth (Forge)
- Auth guard + context + logout (Forge)
- Security headers: HSTS, CSP, nosniff (Cloud)
- **Phase 1 audit:** 22 findings in 3 iterations — all fixed

### Pipeline Artifacts Generated
- intake.json, problem.md (12 success criteria)
- eval-spec.md (24 test cases)
- architecture-decisions.md (8 decisions)
- prd.md (19 requirements, 12-week timeline, 5 phases)
- 5 Mermaid diagrams (system-context, container, data-flow, ERD, component)
- build-plan.md (47 work items with dependency graph)
