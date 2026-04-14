# PeakProtocol - Decision Log

## [2026-04-01] Frontend Type Contract Alignment Required Before UI Work
**Context:** Frontend type contract misalignment was caught in every audit phase. Phase 1 audit found cookie name mismatches and missing response fields. Phase 2 audit found 5 CRITICAL issues where frontend `lib/supplements.ts` used snake_case + wrong types vs backend camelCase responses.
**Decision:** Always have the agent building frontend types READ the backend route file first to match exact response shape. This is a mandatory pre-step before any UI work.
**Rationale:** Independently writing frontend types without reading backend response shapes caused the same class of bug in Mission Control (6 CRITICAL) and PeakProtocol Phase 2 (5 CRITICAL). The pattern is systemic, not accidental.
**Alternatives Considered:** Shared type definitions (rejected: adds coupling between packages), auto-generated types from API (rejected: no OpenAPI spec in place).
**Impact:** Every frontend work item must include a "read backend routes" step. Auditor checks for this pattern specifically.

## [2026-04-01] vite-plugin-pwa Must Be v1.x+ for Vite 6 Compatibility
**Context:** During frontend debugging, `vite-plugin-pwa` v0.20 caused a peer dependency conflict with Vite 6.
**Decision:** Updated to vite-plugin-pwa v1.2. Any Vite 6 project must use vite-plugin-pwa >= 1.0.
**Rationale:** v0.20 has a Vite 5 peer dep requirement that conflicts at build time.
**Alternatives Considered:** Downgrading Vite (rejected: SolidJS tooling targets Vite 6), removing PWA plugin (rejected: PWA is a core requirement).
**Impact:** Package.json updated. Future Vite upgrades should check plugin compatibility.

## [2026-04-01] JSX Must Be in .tsx Files, Not .ts
**Context:** `stores/auth.ts` contained JSX code but had a `.ts` extension. This caused an esbuild parse error that was difficult to trace because it failed silently in the browser.
**Decision:** All files containing JSX must use the `.tsx` extension. Renamed `stores/auth.ts` to `stores/auth.tsx`.
**Rationale:** esbuild (used by Vite) does not parse JSX in `.ts` files by default. The error was swallowed, making debugging difficult.
**Alternatives Considered:** Configuring esbuild to parse JSX in .ts files (rejected: non-standard, breaks conventions).
**Impact:** File renamed. Auditor should check for JSX in .ts files as a lint rule.

## [2026-04-01] Two-Strike Debugging Rule Enforcement
**Context:** Alpha spent 4+ rounds debugging the frontend mount issue directly instead of delegating to a specialist after 2 failed attempts. This violated the pack protocol.
**Decision:** After 2 failed debug attempts on any issue, Alpha MUST spawn a specialist agent. No exceptions.
**Rationale:** Alpha's role is orchestration, not implementation. Direct debugging wastes time and violates the chain of command. Specialists have deeper domain knowledge and can iterate faster.
**Alternatives Considered:** None — this is a protocol reinforcement, not a new decision.
**Impact:** Process discipline. Documented as a learning for future sessions.

## [2026-04-01] PushForge for Web Push (Not web-push npm)
**Context:** Web Push notifications required for supplement reminders. The standard `web-push` npm package uses Node.js crypto APIs incompatible with Cloudflare Workers runtime.
**Decision:** Built PushForge — custom RFC 8291 encryption using only Web Crypto APIs, zero external dependencies.
**Rationale:** Workers runtime only supports Web Crypto API. Building from spec ensures full compatibility without runtime polyfills.
**Alternatives Considered:** web-push npm (rejected: Node.js crypto dependency), polyfilling Node crypto (rejected: unreliable on edge runtime).
**Impact:** Cloud implemented full encryption spec in WRK-019. Zero dependency overhead.

## [2026-04-01] Custom CBOR Parser for WebAuthn
**Context:** WebAuthn passkey registration requires CBOR decoding for attestation objects. No lightweight CBOR library compatible with Workers existed.
**Decision:** Built custom CBOR parser from scratch, handling only the subset needed for WebAuthn attestation.
**Rationale:** Avoids pulling in a full CBOR library dependency for a narrow use case. The WebAuthn subset of CBOR is well-defined and small.
**Alternatives Considered:** cbor-x npm (rejected: too heavy), cbor-web (rejected: incomplete Workers compatibility).
**Impact:** Forge implemented in WRK-006. Minimal code footprint, no dependency.

## [2026-04-01] Wrangler-Native Migration System
**Context:** D1 database needs schema migrations. Options were custom migration runner or Wrangler's built-in migration support.
**Decision:** Use Wrangler-native migrations with `wrangler d1 migrations` commands.
**Rationale:** Built-in tooling, no custom code to maintain, follows Cloudflare's recommended approach.
**Alternatives Considered:** Custom migration runner (rejected: maintenance burden), Drizzle ORM migrations (rejected: adds ORM dependency).
**Impact:** Sigma implemented in WRK-004. Migrations live in `packages/api/migrations/`.

## [2026-04-02] SolidJS Router root Prop Pattern for Persistent Layout

**Context:** The SolidJS app rendered a blank page with no errors. `<Nav />` was a direct child of `<Router>` alongside `<Route>` components. In @solidjs/router v0.14+, non-Route children silently corrupt the route table — nothing renders and no console error is produced. Nav also called `useLocation()` before Router context existed.
**Decision:** Use `<Router root={AppLayout}>` pattern for persistent layout elements (nav bars, sidebars). Never place non-Route children directly inside `<Router>`.
**Rationale:** This is the idiomatic pattern for @solidjs/router v0.14+. The root prop wraps all routes in a layout component that has full access to router context.
**Alternatives Considered:** Wrapping Router in a layout (rejected: layout needs router context for useLocation), placing Nav inside every Route (rejected: duplication).
**Impact:** `App.tsx` restructured. Any future layout elements must go in the root component, not as Router siblings.

## [2026-04-02] Clear innerHTML Before SolidJS render()

**Context:** SolidJS `render()` appends children to the container rather than replacing its contents (unlike React's createRoot). The "Loading PeakProtocol..." placeholder text from index.html was never removed, causing confusion about whether the app mounted.
**Decision:** Always add `root.innerHTML = ""` before calling `render()` in index.tsx when the container has static placeholder content.
**Rationale:** SolidJS render behavior is append-only by design. Static placeholder content from HTML must be explicitly cleared.
**Alternatives Considered:** Removing placeholder from HTML (rejected: worse UX during load), using a SolidJS portal (rejected: unnecessary complexity).
**Impact:** `index.tsx` updated. Pattern documented for all future SolidJS projects.

## [2026-04-02] ErrorBoundary Required on Auth Flows

**Context:** Auth components (AuthSetup, AuthLogin, DeviceAuth) made fetch calls to localhost:8787 API. When the API was unreachable, network errors crashed the entire SolidJS render tree to a white screen — no ErrorBoundary existed to catch the failure.
**Decision:** Wrap all network-dependent component trees (auth, data fetching) in SolidJS ErrorBoundary. Add an "offline" auth flow state with "Server Unavailable" UI and retry button.
**Rationale:** SolidJS swallows errors in reactive computations silently. Network failures are expected in local dev and on mobile. Graceful degradation is mandatory.
**Alternatives Considered:** Try/catch in every fetch (rejected: doesn't catch errors in reactive effects), global error handler only (rejected: can't provide contextual UI).
**Impact:** `AuthGuard.tsx` now wraps children in ErrorBoundary. `auth.ts` has new "offline" state. `friendlyAuthError()` helper added. All auth components handle network failures gracefully.

## [2026-04-02] vite-plugin-pwa devOptions Disabled in Dev

**Context:** `devOptions: { enabled: true }` in vite-plugin-pwa config caused Vite to attempt compiling sw.ts in dev mode, but `self.__WB_MANIFEST` is never injected by Workbox during dev builds, causing compilation failures.
**Decision:** Set `devOptions: { enabled: false }` unless specifically debugging service worker behavior in dev mode.
**Rationale:** InjectManifest strategy + enabled:true causes compilation issues because the manifest placeholder is only replaced during production builds.
**Alternatives Considered:** Using generateSW instead of injectManifest (rejected: less control over SW behavior), conditionally injecting manifest in dev (rejected: fragile).
**Impact:** `vite.config.ts` updated. Dev mode no longer attempts SW compilation.

## [2026-04-02] Simple Passcode Auth Replacing WebAuthn

**Context:** PeakProtocol was built with full WebAuthn passkey authentication (registration, login, device-bound fallback, recovery codes). However, this is a single-user personal health app — the complexity of WebAuthn was overkill and caused friction during deployment and cross-device usage.
**Decision:** Replace all WebAuthn/passkey auth flows with a simple passcode system. POST /api/auth/passcode checks APP_PASSCODE Wrangler secret. PasscodeLogin.tsx replaces AuthSetup, AuthLogin, and DeviceAuth components. AuthGuard.tsx simplified to passcode-only flow.
**Rationale:** Single-user app does not need multi-user authentication. Passcode stored as Wrangler secret is secure enough for personal use. Dramatically simplifies auth flow and eliminates WebAuthn browser compatibility issues.
**Alternatives Considered:** Keeping WebAuthn (rejected: unnecessary complexity for single user), no auth at all (rejected: app is publicly accessible), basic auth header (rejected: worse UX than passcode form).
**Impact:** All previous auth components (AuthSetup, AuthLogin, DeviceAuth) replaced by PasscodeLogin.tsx. AuthGuard.tsx simplified. APP_PASSCODE secret set in Wrangler.

## [2026-04-02] Fixed "owner" User ID for Cross-Device Data Persistence

**Context:** With WebAuthn removed, there's no user registration flow to generate unique user IDs. Data needs to be accessible from any device that has the passcode.
**Decision:** Use a fixed user ID string "owner" for all data operations.
**Rationale:** Single-user app — all data belongs to the same person. A fixed ID ensures data is accessible from any authenticated device without user management overhead.
**Alternatives Considered:** Random ID generated on first login (rejected: would create orphan data when accessing from a new device), no user ID (rejected: schema requires it).
**Impact:** All API endpoints use "owner" as the user ID after passcode authentication.

## [2026-04-02] Calendar as Default Dashboard View

**Context:** The Dashboard previously showed a compliance-focused view. Users want to see a daily overview of all health data at a glance.
**Decision:** Dashboard now uses a 3-tab layout: Calendar | Today | Week. Calendar is the default view. New Calendar.tsx and DaySummary.tsx components show a monthly calendar with day selection, and a summary panel showing supplements, food, training, metrics, and journal for the selected day.
**Rationale:** Calendar view provides the most natural navigation for a daily health tracking app. Users can quickly browse any day's data.
**Alternatives Considered:** Keeping compliance dashboard as default (rejected: too narrow), list view (rejected: less intuitive for date-based data).
**Impact:** New API endpoint GET /api/daily-summary/:date (5 parallel D1 queries). New components: Calendar.tsx, DaySummary.tsx, dailySummary.ts. Dashboard.tsx updated with 3-tab layout.

## [2026-04-02] Cloudflare Pages for Frontend Hosting

**Context:** Frontend needed to be deployed to production. Options were Cloudflare Pages, Workers Sites, or external hosting.
**Decision:** Deploy frontend to Cloudflare Pages at peakprotocol-web.pages.dev. API remains on Workers at peakprotocol-api.jusbartholomew.workers.dev.
**Rationale:** Pages provides free static hosting with automatic builds, integrated with the Cloudflare ecosystem. Separating frontend and API allows independent deployments. CORS configured for the Pages origin.
**Alternatives Considered:** Workers Sites (rejected: more complex for static content), Vercel/Netlify (rejected: adds external dependency when already on Cloudflare), single Workers deployment (rejected: mixing static and API adds complexity).
**Impact:** .env.production file added with VITE_API_URL. getApiBase() updated to use env var. CORS updated for Pages origin. Secrets configured via wrangler secret.

## [2026-04-05] DEC-phase6-001: Supplement Color Column with Lazy Backfill
**Context:** Calendar dots need color-coded supplement indicators. Pre-existing supplements have no color assigned.
**Decision:** Add `color TEXT` column to supplements table. Use a 16-color palette. Lazy backfill: color auto-assigned on first GET if NULL.
**Rationale:** Lazy backfill avoids a migration script that touches all rows. Colors assigned on-demand means zero downtime and backward compatibility with existing data.
**Alternatives Considered:** Eager migration to assign colors (rejected: unnecessary complexity), client-side color assignment (rejected: inconsistent across devices).
**Impact:** D1 migration added. GET /api/supplements assigns color on read if missing.

## [2026-04-05] DEC-phase6-002: Calendar Dots via Dedicated Endpoint
**Context:** Dashboard calendar needs to show colored dots for each day's scheduled supplements.
**Decision:** New `GET /api/calendar-supplements/:month` endpoint returns per-day supplement dot data for an entire month in one call.
**Rationale:** Single request per month view is more efficient than 28-31 individual day requests. Endpoint aggregates schedule + log data server-side.
**Alternatives Considered:** Client-side aggregation (rejected: too many API calls), embedding in daily-summary (rejected: calendar view doesn't need full summary data).
**Impact:** New API endpoint. Frontend Calendar component consumes it.

## [2026-04-05] DEC-phase6-003: Multi-Source Food Search with Shared Cache
**Context:** Food search needed to support multiple sources (USDA, custom, AI-estimated) with unified results.
**Decision:** Shared `food_cache` table with source discriminator column. Search queries all sources, results tagged with source badges.
**Rationale:** Single cache table simplifies queries and deduplication. Source discriminator allows filtering and display differentiation.
**Alternatives Considered:** Separate tables per source (rejected: complex JOIN queries), client-side merging (rejected: inconsistent ranking).
**Impact:** D1 migration adds source column. Search endpoint updated. Frontend shows source badges.

## [2026-04-05] DEC-phase6-004: AI Macro Estimation via Anthropic Claude Haiku
**Context:** Users entering custom foods need macro estimates without manually looking up nutrition data.
**Decision:** Use Anthropic Claude Haiku model via ANTHROPIC_API_KEY for AI-powered macro estimation from food descriptions.
**Rationale:** Haiku is fast and cheap, suitable for quick estimations. Anthropic API is reliable. Returns structured JSON with macro values.
**Alternatives Considered:** OpenAI (rejected: already using Anthropic ecosystem), local model (rejected: too heavy for edge), nutrition database lookup only (rejected: doesn't cover custom/homemade foods).
**Impact:** New ANTHROPIC_API_KEY secret required. Returns 503 if key not set. Estimation endpoint added.

## [2026-04-05] DEC-phase6-005: Deferred Calculation with NULL Macros
**Context:** AI estimation may not be available (key not set) or user may want to log food now and calculate later.
**Decision:** NULL macros = unresolved entry. Added `description TEXT` column to food_entries for AI input. "Calculate All" batch operation processes unresolved entries.
**Rationale:** Decouples food logging from macro calculation. Users can log meals quickly and resolve macros later in batch.
**Alternatives Considered:** Blocking on estimation (rejected: poor UX if API unavailable), zero-filling macros (rejected: misleading data).
**Impact:** D1 migration adds description column. New "Calculate All" UI button. Sequential batch processing with partial success.

## [2026-04-05] DEC-phase6-006: Dot Overflow with +N Indicator
**Context:** Some days may have many supplements scheduled, and displaying all dots creates visual clutter.
**Decision:** Max 8 dots on desktop (6 on mobile) with "+N" overflow indicator showing count of remaining.
**Rationale:** Balances information density with visual clarity. "+N" communicates there's more without overwhelming the calendar grid.
**Alternatives Considered:** Scrollable dot row (rejected: fiddly on mobile), single summary dot (rejected: loses individual supplement identity).
**Impact:** Frontend Calendar component implements responsive dot limits.

## [2026-04-05] DEC-phase6-007: Calculate All as Sequential Batch with Partial Success
**Context:** "Calculate All" needs to process multiple unresolved food entries via AI estimation.
**Decision:** Sequential batch processing. Each entry estimated independently. Partial success allowed — successfully estimated entries saved even if some fail.
**Rationale:** Sequential avoids rate limiting on Anthropic API. Partial success ensures one bad entry doesn't block all others.
**Alternatives Considered:** Parallel batch (rejected: rate limit risk), all-or-nothing (rejected: one failure blocks everything).
**Impact:** Backend processes entries sequentially, returns success/failure count.

## [2026-04-05] DEC-phase6-008: Heatmap Compliance Counts All Scheduled
**Context:** Compliance heatmap needs to count supplement adherence correctly regardless of time of day.
**Decision:** All scheduled supplements count toward daily total, regardless of time-of-day scheduling. Compliance = logged / total_scheduled.
**Rationale:** Users want to see overall daily adherence, not time-slot-specific compliance. Simplifies the mental model.
**Alternatives Considered:** Time-slot compliance (rejected: overly granular for heatmap view), only counting taken (rejected: doesn't show adherence rate).
**Impact:** Backend compliance calculation updated. Heatmap reflects total daily adherence.

## [2026-04-05] DEC-phase6-009: Historical Dots Use supplement_logs as Source of Truth
**Context:** Calendar dots for past days need to reflect what was actually taken, not just what was scheduled.
**Decision:** For historical dates, use `supplement_logs` table as source of truth. Current/future dates use schedule projection.
**Rationale:** supplement_logs captures what actually happened. Schedule may have changed since a past date, so projecting current schedule backward would be inaccurate.
**Alternatives Considered:** Always use current schedule (rejected: inaccurate for historical data), dual display (rejected: confusing UX).
**Impact:** Calendar endpoint queries supplement_logs for past dates, schedule for current/future.

## [2026-04-07] Lesson Learned: Frontend/Backend Casing Convention is a Systemic Bug Class
**Context:** Three distinct production bugs in PeakProtocol have now traced to the same root cause: frontend sends a user-facing display label as the value, while the backend expects a normalized lowercase enum.
1. **Meal type** — Phase 2 audit, TIME_OPTIONS sent display values not enum values.
2. **every_n_days** — Phase 6 hotfix, frontend sent `{every_n_days: 3}`, scheduler expected `{n: 3}` (key-name variant of the same problem).
3. **Weekly day / timeOfDay** — 2026-04-07, frontend sent `"Mon"`/`"Morning"`, backend `isDayName()` only accepted lowercase. Supplements never appeared on calendar.

**Decision:** Treat this as a systemic bug class, not isolated incidents. Mandate the following project-wide pattern:
- **Any user-facing label that gets sent to a backend must use `{value, label}` separation.** The `label` is what humans see; the `value` is what crosses the wire and matches the backend enum exactly.
- **Backend normalization helpers** (like the new `normalizeDayName()` in `dates.ts`) should exist as a defensive second layer for any enum-like field, accepting any reasonable case/length variant.
- **Legacy DB record normalization** should happen at read-time in the scheduler/service layer for any field that has historically been stored in inconsistent casing.

**Rationale:** Three is a pattern. The fix-on-demand approach has cost 3 production hotfixes and one audit cycle. A project-wide audit pattern is cheaper than continuing to find these one at a time.

**Recommended action:** Auditor should run a sweep across all frontend forms looking for raw string literals being sent as form values (especially capitalized words). Cross-reference against backend zod schemas / enum validators.

**Alternatives Considered:** Shared TypeScript enums between packages (rejected previously: adds coupling, no monorepo type sharing in place); auto-generated types from backend zod schemas (deferred: worth revisiting).

**Impact:** New audit pattern. Any future form work must use value/label separation. Any future enum field must have a backend normalization helper.

---

## [2026-04-01] npm Workspaces Monorepo (Not Turborepo/Nx)
**Context:** PeakProtocol has two packages (web frontend, api backend) that need to coexist in a monorepo.
**Decision:** Use npm workspaces for monorepo management.
**Rationale:** Simple, zero extra tooling. Two packages don't justify the complexity of Turborepo or Nx.
**Alternatives Considered:** Turborepo (rejected: overkill for 2 packages), Nx (rejected: heavy setup), separate repos (rejected: complicates shared types).
**Impact:** Root package.json configures workspaces. Scripts run via `npm run -w packages/web` or `npm run -w packages/api`.
