---
title: "PeakProtocol Phase 6 PRD: Calendar Supplement Visibility + Multi-Source Food Diary"
version: "1.0.0"
status: draft
prd-id: PRD-peakprotocol-phase6-001
problem-ref: PRB-peakprotocol-phase6-001
eval-ref: EVL-peakprotocol-phase6-001
arch-ref: architecture-decisions-phase6.md
created: 2026-04-05
last-updated: 2026-04-05
author: Quill
project: peakprotocol
parent-prd: prd.md
phases-complete: 1-5
tags: [supplements, calendar, food-logging, multi-source, ai-estimation, prd]
---

# PRD: PeakProtocol Phase 6 --- Calendar Supplement Visibility + Multi-Source Food Diary

## 1. Problem Statement

The Pack Owner manages a complex supplement routine spanning multiple scheduling types (daily, every N days, weekly, specific days of week) but the calendar view offers no visibility into which supplements are due or taken on any given day. The only visual indicator is a generic green activity dot per day --- determining whether the morning stack was completed requires drilling into supplement-specific views, creating a daily blind spot that risks missed doses and protocol breaks.

Separately, the food diary relies on a single data source (USDA FoodData Central API) which lacks coverage for prepared meals, restaurant food, international cuisine, branded products, and custom recipes. When a food cannot be found there is no fallback --- the user must abandon the entry or guess at macros manually.

Together these two gaps produce daily friction: the supplement blind spot undermines adherence tracking, and the single-source food limitation makes consistent nutrition logging unreliable.

**Source:** PRB-peakprotocol-phase6-001

## 2. Goals

| # | Goal | Metric | Target |
|---|------|--------|--------|
| G1 | Provide at-a-glance supplement compliance visibility on the calendar | Colored dots per supplement per day with status indicators | 100% of scheduled supplements rendered on calendar cells |
| G2 | Enable one-tap supplement logging from the calendar | Supplement checklist with checkboxes on day detail | Check/uncheck persists to supplement_logs within 1 interaction |
| G3 | Expand food data coverage beyond USDA | Multi-source search (USDA + OpenFoodFacts) | Branded products resolvable via OFF when absent from USDA |
| G4 | Enable food logging even when no database match exists | AI macro estimation + manual entry | Any free-text food description produces a macro estimate |
| G5 | Decouple food entry from immediate macro resolution | Text-only entries with deferred batch calculation | Users can list foods fast, calculate later |
| G6 | Make data confidence transparent | Source badges on every food entry | 4 badge types visible: USDA, OFF, AI, Manual |

## 3. Requirements

### 3.1 Cluster 1 --- Calendar Supplement Visibility

#### REQ-P6-01: Calendar Day Cell Supplement Dots

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-01 |
| **Priority** | P0 |
| **Scope Item** | S1 |
| **Description** | Each active supplement scheduled for a given day renders as a small colored dot on the calendar grid cell. Dot color reflects the supplement's assigned palette color. Status is indicated by a secondary color treatment: green overlay for taken, amber for skipped, gray for pending/not-yet-logged. |
| **eval-trace** | EVL-P6-01, EVL-P6-01a, EVL-P6-01b |

**Acceptance Criteria (from eval spec):**

1. For a day with 3 scheduled supplements (1 taken, 1 skipped, 1 pending), the calendar cell renders exactly 3 dots with correct status coloring (green/amber/gray) and each dot is visually distinguishable. (EVL-P6-01)
2. A day with no scheduled supplements renders zero dots and no visual artifacts. (EVL-P6-01a)
3. A day with 12 scheduled supplements on mobile viewport renders dots without layout breakage, using a max-dot limit with "+N" overflow indicator per DEC-phase6-006. (EVL-P6-01b)

**Technical Constraints:**

- New API endpoint `GET /api/calendar-supplements/:month` returns per-day supplement status for the full month in one call (DEC-phase6-002).
- Calendar component receives a new `supplementDays` prop alongside the existing `activeDates` prop --- existing calendar behavior is preserved (C9, DEC-phase6-002).
- Dot overflow: max 6 dots on mobile, max 8 on desktop, with "+N" indicator (DEC-phase6-006).
- Historical dots are derived from supplement_logs (source of truth), not the scheduling engine (DEC-phase6-009).

---

#### REQ-P6-02: Supplement Color Assignment

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-02 |
| **Priority** | P0 |
| **Scope Item** | S3 |
| **Description** | Each supplement receives a persistent color from a predefined 16-color palette, stored as a `color` TEXT column on the `supplements` table. New supplements auto-assign the next unused palette color. Colors persist across sessions. |
| **eval-trace** | EVL-P6-02, EVL-P6-02a, EVL-P6-02b |

**Acceptance Criteria (from eval spec):**

1. Supplement "Vitamin D" assigned color #F59E0B persists after full page reload --- calendar dots still render in #F59E0B. (EVL-P6-02)
2. With 10+ supplements, each has a unique color from the palette and colors are visually distinguishable at dot size. (EVL-P6-02a)
3. A newly created supplement receives an automatic palette color without explicit user selection; the color is a valid palette value. (EVL-P6-02b)

**Technical Constraints:**

- D1 migration: `ALTER TABLE supplements ADD COLUMN color TEXT` with fallback table-recreation migration if ALTER fails (DEC-phase6-001).
- 16-color curated palette defined in DEC-phase6-001.
- Existing supplement CRUD endpoints updated to accept/return the `color` field.

---

#### REQ-P6-03: Calendar Day Detail Supplement Checklist

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-03 |
| **Priority** | P0 |
| **Scope Item** | S2 |
| **Description** | Tapping a calendar day opens a supplement checklist showing each scheduled supplement as a checkbox row with name, dose, and time-of-day. Checking a box logs the supplement as taken (POST to supplement log API with current timestamp). Unchecking reverts to pending (deletes the log record). |
| **eval-trace** | EVL-P6-03 |

**Acceptance Criteria (from eval spec):**

1. Day detail view lists all 4 scheduled supplements with checkbox, name, dose, and time-of-day label.
2. Checking a checkbox fires POST to supplement log API with `taken_at` timestamp; checkbox shows checked; `supplement_logs` table reflects taken status.
3. Unchecking a checkbox deletes the log record; checkbox returns to unchecked; `supplement_logs` table reflects removal.
4. All check/uncheck operations persist correctly. (EVL-P6-03)

---

#### REQ-P6-04: Batch "Mark All Taken"

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-04 |
| **Priority** | P1 |
| **Scope Item** | S5 |
| **Description** | A "Mark All Taken" button on the day detail logs all pending supplements as taken in a single action. Uses D1 batch for atomicity. Supplements already logged as taken are not duplicated. Individual override is possible after batch action. |
| **eval-trace** | EVL-P6-04, EVL-P6-04a, EVL-P6-04b, EVL-P6-DI-04 |

**Acceptance Criteria (from eval spec):**

1. Clicking "Mark All Taken" on a day with 5 pending supplements creates 5 `supplement_logs` records with `taken_at` timestamps; all checkboxes show checked; dots turn green. (EVL-P6-04)
2. With 2 already taken and 3 pending, "Mark All Taken" creates only 3 new logs (no duplicates); total records = 5. (EVL-P6-04a)
3. After batch mark, unchecking one supplement reverts only that supplement's log; other 4 remain checked and unaffected. (EVL-P6-04b)
4. With 10 pending supplements, operation completes atomically within Workers 30s CPU limit using D1 batch; either all 10 records created or zero (no partial state). (EVL-P6-DI-04)

**Technical Constraints:**

- New endpoint: `POST /api/supplements/batch-log` (DEC-phase6-002).
- Uses D1 `batch()` for atomicity (A7, C5).

---

#### REQ-P6-05: Monthly Supplement Compliance Heatmap

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-05 |
| **Priority** | P1 |
| **Scope Item** | S4 |
| **Description** | Calendar cells display a background tint reflecting daily supplement compliance: green for all taken, amber for partial, no tint for nothing logged or no supplements scheduled. Compliance is computed based on all scheduled supplements for the day regardless of time-of-day (DEC-phase6-008). |
| **eval-trace** | EVL-P6-05, EVL-P6-05a, EVL-P6-05b |

**Acceptance Criteria (from eval spec):**

1. April 1 (100% compliance) shows green tint; April 2 (67% compliance) shows amber; April 3 (0% logged) shows no tint; April 4 (nothing scheduled) shows no tint. (EVL-P6-05)
2. On the current day with morning supplements taken and evening supplements pending, cell shows amber (partial), consistent with the "all scheduled count" rule. (EVL-P6-05a)
3. Existing calendar features (food logging, training dots, day selection, navigation) continue to work alongside the new heatmap tinting. (EVL-P6-05b)

**Technical Constraints:**

- Compliance thresholds: full = `taken == scheduled && scheduled > 0`; partial = `taken > 0 && taken < scheduled`; none/n/a = no tint (DEC-phase6-008).
- Computed in the `GET /api/calendar-supplements/:month` response alongside dot data.

---

### 3.2 Cluster 2 --- Multi-Source Food Diary

#### REQ-P6-06: Multi-Source Food Search (USDA + OpenFoodFacts)

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-06 |
| **Priority** | P0 |
| **Scope Item** | S6, S11 |
| **Description** | Food search queries both USDA FoodData Central (primary) and OpenFoodFacts (secondary) in parallel. Results are merged with USDA first, deduplicated by name similarity. Each result includes a `source` field. The existing Quick-Add UI is extended to search across both sources in a unified result list. |
| **eval-trace** | EVL-P6-06, EVL-P6-06a, EVL-P6-06b, EVL-P6-07 |

**Acceptance Criteria (from eval spec):**

1. Searching "chicken breast" returns USDA results with `source: "usda"`; searching "Coca-Cola" returns OpenFoodFacts results with `source: "openfoodfacts"`; each result has a source field. (EVL-P6-06)
2. When both sources have matches (e.g., "milk"), USDA results appear first, each result is labeled with a source badge, and no obvious duplicates. (EVL-P6-06a)
3. If OpenFoodFacts API is unreachable, USDA results still return successfully within normal latency; no user-facing error. (EVL-P6-06b)
4. Second search for the same query uses the cache (no new OpenFoodFacts API call); results are identical. (EVL-P6-07)

**Technical Constraints:**

- OpenFoodFacts API: `GET /cgi/search.pl?search_terms={query}&json=1&page_size={limit}` with `User-Agent: PeakProtocol/1.0` (DEC-phase6-003).
- Shared `food_cache` table with new `source` column (default "usda" for existing rows). (DEC-phase6-003)
- Parallel API calls; merge with USDA-first ordering; deduplicate by name similarity.
- Graceful degradation: OFF failure does not block USDA results (C7).

---

#### REQ-P6-07: AI Macro Estimation

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-07 |
| **Priority** | P0 |
| **Scope Item** | S7 |
| **Description** | When no API source matches, the user can enter a free-text food description and request AI-powered macro estimation. The system calls Anthropic Claude API (Haiku-class model) with a structured prompt and returns estimated calories, protein, carbs, fat, and fiber. The entry is tagged with `source: "ai"`. |
| **eval-trace** | EVL-P6-08, EVL-P6-08a, EVL-P6-08b |

**Acceptance Criteria (from eval spec):**

1. Entering "large bowl of chicken fried rice" and triggering Calculate returns all 5 macro values in plausible ranges (calories 400-900, protein 15-50, carbs 40-120, fat 10-40, fiber 1-10), source badge "AI", response under 10s. (EVL-P6-08)
2. A vague description ("some food") is handled gracefully: either a best-effort estimate or a clear error message; no crash or 500 error. (EVL-P6-08a)
3. If the LLM API key is missing, the system returns a user-friendly "AI estimation not configured" error (503); no leaked key details; manual entry remains available. (EVL-P6-08b)

**Technical Constraints:**

- New endpoint: `POST /api/foods/estimate` (DEC-phase6-004).
- Anthropic Claude (Haiku-class): fast (< 2s typical), structured JSON output via system prompt.
- New Wrangler secret: `ANTHROPIC_API_KEY` (C8, DEC-phase6-004).
- Error handling: missing key = 503, API failure = 502 with one retry, invalid JSON = retry once then 502.
- Workers 128MB memory and 30s CPU limits respected (C5).

---

#### REQ-P6-08: Deferred Calculation (Text-Only Food Entries)

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-08 |
| **Priority** | P0 |
| **Scope Item** | S8 |
| **Description** | Food items can be added as text-only entries (food name/description, no macros) throughout the day. A "Calculate All" button triggers batch resolution for all unresolved entries on a given date. Resolution priority: USDA, then OpenFoodFacts, then AI estimation. Partial success is returned --- individual failures do not block resolved items. |
| **eval-trace** | EVL-P6-09, EVL-P6-09a, EVL-P6-09b |

**Acceptance Criteria (from eval spec):**

1. Three text-only entries ("grilled chicken breast", "Coca-Cola 330ml", "homemade pasta with meat sauce") are all resolved via Calculate All with correct source assignments (usda, openfoodfacts, ai respectively); all have non-null macros; daily totals update. (EVL-P6-09)
2. With 3 entries where 1 is unresolvable, 2 resolve successfully and the failed entry shows a clear error indicator; no data loss for successful entries. (EVL-P6-09a)
3. Unresolved text-only entries appear in the food list with a visual distinction (e.g., dashed border), contribute 0 to daily totals, and display no NaN/undefined values. (EVL-P6-09b)

**Technical Constraints:**

- Unresolved = NULL macros in `food_entries` table; `description` column stores raw user text (DEC-phase6-005).
- New endpoints: `POST /api/food-entries/text`, `POST /api/food-entries/calculate-all` (DEC-phase6-005).
- Sequential backend processing to respect API rate limits; partial success returned (DEC-phase6-007).
- Resolution priority: USDA cache/API, then OFF, then AI estimation, then fail (DEC-phase6-005).
- Processing 3-5 items takes 3-8s, within Workers 30s CPU limit (DEC-phase6-007).

---

#### REQ-P6-09: Food Source Badge Display

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-09 |
| **Priority** | P1 |
| **Scope Item** | S9 |
| **Description** | Each food entry displays a visible badge indicating its data source: "USDA", "OFF" (OpenFoodFacts), "AI" (AI estimate), or "Manual". Badges are visible without requiring tap or hover. Pre-Phase-6 entries with null source default to displaying "USDA" (per assumption A8). |
| **eval-trace** | EVL-P6-10, EVL-P6-10a |

**Acceptance Criteria (from eval spec):**

1. Four entries from different sources display correct badges: "USDA", "OFF", "AI", "Manual" --- all visible without interaction. (EVL-P6-10)
2. Pre-Phase-6 entries with null `source` column display "USDA" badge by default; no rendering errors; entry remains fully functional. (EVL-P6-10a)

---

#### REQ-P6-10: Manual Macro Override

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-10 |
| **Priority** | P1 |
| **Scope Item** | S10 |
| **Description** | Regardless of original data source, the user can tap any food entry to edit calories, protein, carbs, fat, and fiber values. Saving updates the entry and changes the source to "manual". Daily totals recalculate with the new values. |
| **eval-trace** | EVL-P6-11, EVL-P6-11a |

**Acceptance Criteria (from eval spec):**

1. Editing a USDA-sourced entry (calories 200 to 250, protein 30 to 35) persists the changes, updates source to "manual", badge to "Manual", and daily totals reflect new values. (EVL-P6-11)
2. Editing only one field (fat) on an AI-sourced entry updates that field, changes source to "manual", and leaves other macro fields intact. (EVL-P6-11a)

**Technical Constraints:**

- Endpoint: `PUT /api/food-entries/:id` sets `source = "manual"` on any macro edit (DEC-phase6-005).

---

### 3.3 Data Integrity Requirements

#### REQ-P6-DI-01: Supplement Color Column Migration

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-DI-01 |
| **Priority** | P0 |
| **Scope Item** | C4, C6 |
| **Description** | D1 migration adds `color` TEXT column to `supplements` table. All pre-existing supplement records are preserved. Existing CRUD endpoints continue to function. |
| **eval-trace** | EVL-P6-DI-01 |

**Acceptance Criteria (from eval spec):**

1. Zero data loss after migration; all pre-existing supplement records intact.
2. `color` column defaults to null; existing CRUD endpoints (GET, POST, PUT, DELETE) function without regression. (EVL-P6-DI-01)

---

#### REQ-P6-DI-02: Food Entry Source + Description Column Migration

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-DI-02 |
| **Priority** | P0 |
| **Scope Item** | C10, C6 |
| **Description** | D1 migration adds `source` TEXT and `description` TEXT columns to `food_entries` table, and `source` TEXT column (default "usda") to `food_cache` table. All pre-existing food entries and cache records are preserved. |
| **eval-trace** | EVL-P6-DI-02 |

**Acceptance Criteria (from eval spec):**

1. Zero data loss after migration; all pre-existing food_entries intact.
2. `source` column on food_entries defaults to null (treated as "usda" at display time per A8).
3. `source` column on food_cache defaults to "usda" for existing rows.
4. Existing food entry CRUD endpoints function without regression. (EVL-P6-DI-02)

---

#### REQ-P6-DI-03: Daily Summary API Backward Compatibility

| Attribute | Value |
|-----------|-------|
| **ID** | REQ-P6-DI-03 |
| **Priority** | P0 |
| **Scope Item** | A5, C9 |
| **Description** | The Daily Summary API (`GET /api/daily-summary/:date`) response shape is a strict superset of the Phase 5 shape. New fields are additive. No existing fields are renamed or removed. |
| **eval-trace** | EVL-P6-DI-03 |

**Acceptance Criteria (from eval spec):**

1. Response contains all existing fields (supplements, nutrition, training, metrics, journal) with same types and names.
2. New Phase 6 data included as additional fields only. (EVL-P6-DI-03)

---

## 4. Traceability Matrix

| Requirement | Eval Case(s) | Success Threshold | Priority |
|-------------|-------------|-------------------|----------|
| REQ-P6-01 (Calendar dots) | EVL-P6-01, EVL-P6-01a, EVL-P6-01b | Correct dot count + status colors + overflow handling | P0 |
| REQ-P6-02 (Color assignment) | EVL-P6-02, EVL-P6-02a, EVL-P6-02b | Color persists after reload; unique across supplements; auto-assigned | P0 |
| REQ-P6-03 (Supplement checklist) | EVL-P6-03 | All scheduled supplements listed; check/uncheck persists to DB | P0 |
| REQ-P6-04 (Batch mark all) | EVL-P6-04, EVL-P6-04a, EVL-P6-04b, EVL-P6-DI-04 | Correct log count; no duplicates; individual override works; atomic | P1 |
| REQ-P6-05 (Compliance heatmap) | EVL-P6-05, EVL-P6-05a, EVL-P6-05b | Correct tint per compliance state; backward compatible | P1 |
| REQ-P6-06 (Multi-source search) | EVL-P6-06, EVL-P6-06a, EVL-P6-06b, EVL-P6-07 | Both sources return results; USDA-first order; graceful OFF failure; caching works | P0 |
| REQ-P6-07 (AI estimation) | EVL-P6-08, EVL-P6-08a, EVL-P6-08b | Plausible macro ranges; vague input handled; missing key = 503 | P0 |
| REQ-P6-08 (Deferred calc) | EVL-P6-09, EVL-P6-09a, EVL-P6-09b | Batch resolves all sources; partial failure handled; unresolved = 0 in totals | P0 |
| REQ-P6-09 (Source badge) | EVL-P6-10, EVL-P6-10a | 4 badge types visible; pre-Phase-6 entries show "USDA" | P1 |
| REQ-P6-10 (Manual override) | EVL-P6-11, EVL-P6-11a | Values persist; source changes to "manual"; totals recalculate | P1 |
| REQ-P6-DI-01 (Supplement migration) | EVL-P6-DI-01 | Zero data loss; column added; APIs work | P0 |
| REQ-P6-DI-02 (Food migration) | EVL-P6-DI-02 | Zero data loss; columns added with correct defaults; APIs work | P0 |
| REQ-P6-DI-03 (API compat) | EVL-P6-DI-03 | Response is strict superset of Phase 5 shape | P0 |

## 5. Success Metrics

| Metric | Baseline (Phase 5) | Target (Phase 6) |
|--------|-------------------|-------------------|
| Supplement visibility from calendar | 0 (single generic dot) | Per-supplement colored dots with status |
| Taps to log a supplement from calendar | 4+ (navigate to supplement view) | 2 (tap day, tap checkbox) |
| Food sources available | 1 (USDA only) | 3 (USDA + OpenFoodFacts + AI estimation) |
| Food entry abandonment rate | High (when food not in USDA) | Near zero (AI fallback + manual entry) |
| Data source transparency | None | 100% of entries show source badge |

## 6. Dependencies (on Phases 1-5)

| Dependency | Phase | What Phase 6 Needs |
|------------|-------|-------------------|
| Supplement CRUD API (5 endpoints) | Phase 2 (WRK-011) | Additive `color` field on existing endpoints |
| Scheduling Engine (4 schedule types) | Phase 2 (WRK-012) | Computes which supplements are due per day |
| Supplement Logging API | Phase 2 (WRK-013) | Read/write supplement_logs for dot status |
| Compliance Calculator | Phase 2 (WRK-015) | Heatmap tinting reuses compliance logic |
| Calendar Component (`Calendar.tsx`) | Phase 2 (WRK-017) | New `supplementDays` prop alongside `activeDates` |
| USDA API Integration + Food Cache | Phase 3 (WRK-021, 022) | Primary food source; cache pattern extended for OFF |
| Food Entry CRUD API | Phase 3 (WRK-024) | Extended with `source`, `description` columns |
| Saved Foods / Quick-Add UI | Phase 3 (WRK-025, 027) | Quick-Add extended for multi-source search |
| Daily Summary API | Phase 3 (WRK-024) | Additive extension for supplement dot data |
| D1 Schema (13 tables) | Phase 1 (WRK-003) | Migration 003 adds columns to existing tables |
| Auth / Session middleware | Phase 1 (WRK-005-009) | All new endpoints use existing auth guard |
| Service Worker / Offline Queue | Phase 5 (WRK-040, 041) | New API calls must be queued when offline |

## 7. Schema Changes Summary

### New Columns

| Table | Column | Type | Default | Migration |
|-------|--------|------|---------|-----------|
| `supplements` | `color` | TEXT | NULL | `ALTER TABLE supplements ADD COLUMN color TEXT` |
| `food_entries` | `source` | TEXT | NULL | `ALTER TABLE food_entries ADD COLUMN source TEXT` |
| `food_entries` | `description` | TEXT | NULL | `ALTER TABLE food_entries ADD COLUMN description TEXT` |
| `food_cache` | `source` | TEXT | 'usda' | `ALTER TABLE food_cache ADD COLUMN source TEXT DEFAULT 'usda'` |

### New API Endpoints

| Method | Path | Purpose | Requirement |
|--------|------|---------|-------------|
| GET | `/api/calendar-supplements/:month` | Monthly supplement dot + compliance data | REQ-P6-01, REQ-P6-05 |
| POST | `/api/supplements/batch-log` | Mark all pending supplements as taken | REQ-P6-04 |
| POST | `/api/food-entries/text` | Create text-only food entry (deferred calc) | REQ-P6-08 |
| POST | `/api/food-entries/calculate-all` | Batch resolve unresolved food entries | REQ-P6-08 |
| PUT | `/api/food-entries/:id` | Update food entry macros (manual override) | REQ-P6-10 |
| POST | `/api/foods/estimate` | AI macro estimation for free-text description | REQ-P6-07 |

### New Wrangler Secrets

| Secret | Purpose | Requirement |
|--------|---------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API for AI macro estimation | REQ-P6-07 |

### Migration File

```
migrations/003_phase6_calendar_food.sql
```

D1 ALTER TABLE fallback: if `ALTER TABLE ... ADD COLUMN` fails, use table-recreation pattern (CREATE new table, INSERT from old, DROP old, RENAME new) per DEC-phase6-001.

## 8. Timeline Estimate

| Phase | Scope | Estimated Duration |
|-------|-------|--------------------|
| 8a: Migrations + Backend APIs | D1 migration, calendar-supplements endpoint, batch-log endpoint, OpenFoodFacts client, AI estimation endpoint, text-entry + calculate-all endpoints, food-entry update endpoint | 1 week |
| 8b: Frontend --- Cluster 1 | Calendar dot rendering, color assignment display, day-detail supplement checklist, batch mark-all UI, compliance heatmap tinting | 1 week |
| 8c: Frontend --- Cluster 2 | Multi-source search UI, AI estimation trigger, deferred calculation UI, source badges, manual override form, Quick-Add extension | 1 week |
| 8d: Integration + Audit | End-to-end testing, eval case validation (32 cases), audit-fix loop, offline queue integration | 0.5-1 week |
| **Total** | | **3.5-4 weeks** |

**Note:** Phases 8a and 8b/8c can partially overlap since backend and frontend are separate packages. The audit-fix phase estimate is based on prior phase patterns (typically 1-2 iterations).

## 9. Open Questions

### Inherited from Problem Definition

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| OQ1 | Color palette size and composition for 10+ supplements? | **Resolved** | DEC-phase6-001: 16-color curated hex palette |
| OQ2 | Calendar dot overflow for days with more supplements than fit? | **Resolved** | DEC-phase6-006: Max 6 (mobile) / 8 (desktop) dots + "+N" overflow |
| OQ3 | Which LLM provider/model for AI estimation? | **Resolved** | DEC-phase6-004: Anthropic Claude Haiku-class |
| OQ4 | Shared or separate cache table for OpenFoodFacts? | **Resolved** | DEC-phase6-003: Shared `food_cache` with `source` column |
| OQ5 | How does "Calculate All" handle partial failures? | **Resolved** | DEC-phase6-007: Partial success returned; failed items indicated |
| OQ6 | Should compliance heatmap consider time-of-day? | **Resolved** | DEC-phase6-008: All scheduled supplements count regardless of time |
| OQ7 | Historical calendar dots for modified schedules? | **Resolved** | DEC-phase6-009: supplement_logs are source of truth for history |

### New Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ8 | Should the supplement checklist on day detail support drag-to-reorder for time-of-day grouping? | Low priority; could improve UX for users with morning/evening stacks. Defer to implementation decision. |
| OQ9 | What is the maximum acceptable latency for the "Calculate All" batch action before showing a progress indicator? | If > 2s, a progress bar or per-item spinner should display. Suggest 1s threshold for showing loading state. |
| OQ10 | Should AI-estimated macros include a confidence indicator (e.g., low/medium/high) beyond the "AI" source badge? | Could help user decide whether to manually verify. Low priority; the source badge already signals "estimate". |

## 10. Out of Scope

| Exclusion | Rationale |
|-----------|-----------|
| Meal planning or meal prep scheduling | Deferred to v2 |
| Supplement interaction warnings | Requires medical database; deferred to v2 |
| Barcode scanning for food products | Requires native camera access; deferred to v2 |
| Supplement purchase tracking or restock reminders | Deferred to v2 |
| Recipe builder with ingredient-level macro calculation | Deferred to v2 |
| Photo-based food recognition | Requires ML model; deferred to v2 |
| Nutrition goal setting or macro target alerts | Deferred to v2 |
| Integration with fitness trackers or wearables | Deferred to v2 |
| LLM API key management UI | Key configured as Wrangler secret (consistent with existing pattern) |

## 11. Glossary

| Term | Definition |
|------|-----------|
| **Supplement dot** | A small colored circle rendered in a calendar day cell representing one scheduled supplement |
| **Status indicator** | Color treatment on a dot: green = taken, amber = skipped, gray = pending |
| **Compliance heatmap** | Background tint on calendar cells: green = all taken, amber = partial, none = no logs or no schedule |
| **OFF** | OpenFoodFacts --- a free, open-source food product database |
| **Deferred calculation** | Pattern where food items are listed as text without macros and resolved in batch later |
| **Source badge** | A small label on food entries indicating data origin: USDA, OFF, AI, or Manual |
| **Calculate All** | Batch action that resolves all text-only food entries for a given date |
| **AI estimation** | LLM-powered calorie/macro estimation from free-text food descriptions |
| **D1 batch** | Cloudflare D1's `batch()` method for atomic multi-statement execution |

---

**Cross-References:**

- Problem Definition: `artifacts/peakprotocol/problem-phase6.md` (PRB-peakprotocol-phase6-001)
- Eval Specification: `artifacts/peakprotocol/eval-spec-phase6.md` (EVL-peakprotocol-phase6-001, 32 test cases)
- Architecture Decisions: `artifacts/peakprotocol/architecture-decisions-phase6.md` (9 decisions: DEC-phase6-001 through DEC-phase6-009)
- Intake Brief: `artifacts/peakprotocol/intake-brief-phase6.json`
- Project Context: `artifacts/peakprotocol/memory/CONTEXT.md`
- Phase 1-5 PRD: `artifacts/peakprotocol/prd.md`

---

*Document generated by Quill | Wolf Pack Protocol*
