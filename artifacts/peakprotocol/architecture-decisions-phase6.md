---
title: "PeakProtocol Phase 6 Architecture Decisions"
version: "1.0.0"
status: draft
created: 2026-04-05
author: Architect
problem-ref: PRB-peakprotocol-phase6-001
parent-decisions: architecture-decisions.md
---

# Architecture Decisions: PeakProtocol Phase 6

This document resolves the 7 Open Questions from the Phase 6 problem definition and establishes the architectural decisions for implementing Calendar Supplement Visibility and Multi-Source Food Diary features.

---

## DEC-phase6-001: Supplement Color Storage

| Attribute | Value |
|-----------|-------|
| **Question** | OQ1: What predefined color palette, and how to store supplement colors? |
| **Decision** | Add a `color` TEXT column to the `supplements` table. Provide a hardcoded palette of 16 visually distinct hex colors. Auto-assign the next unused color on supplement creation. |
| **Rationale** | Storing color on the supplements table (not a separate table) is the simplest approach and matches the existing pattern of supplement metadata living on one row. 16 colors provides sufficient variety for the user's 10+ supplements while remaining distinguishable at small dot sizes. Hex strings are compact, portable, and directly usable in CSS. |
| **Alternatives Considered** | |
| - Separate `supplement_colors` table | Adds a join for every calendar query. Unnecessary normalization for a 1:1 relationship. Rejected. |
| - User-chosen arbitrary colors (color picker) | More flexibility but harder UX on mobile. Predefined palette is faster and ensures visual distinction. Rejected for v1; could be added later. |
| - HSL-based auto-generation | Programmatic color generation risks producing similar-looking colors or colors that clash with the green/amber/gray status indicators. Curated palette is safer. Rejected. |
| **Impact on Existing System** | Requires D1 migration to add column. Existing supplement CRUD endpoints need minor update to accept/return `color` field. Backward compatible: existing rows get null color, auto-assigned on first calendar render or via migration default. |

### Color Palette (16 colors)

```typescript
const SUPPLEMENT_PALETTE = [
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EF4444', // red
  '#10B981', // emerald
  '#F97316', // orange
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#84CC16', // lime
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#A855F7', // violet
  '#0EA5E9', // sky
  '#D946EF', // fuchsia
  '#78716C', // stone
];
```

### Migration SQL

```sql
ALTER TABLE supplements ADD COLUMN color TEXT;
```

If D1 ALTER TABLE fails, fallback migration:

```sql
CREATE TABLE supplements_new (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, current_dose TEXT, unit TEXT,
  schedule_type TEXT, schedule_value TEXT, time_of_day TEXT, tags TEXT,
  active INTEGER DEFAULT 1, color TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO supplements_new SELECT id, name, current_dose, unit, schedule_type,
  schedule_value, time_of_day, tags, active, NULL, created_at, updated_at FROM supplements;
DROP TABLE supplements;
ALTER TABLE supplements_new RENAME TO supplements;
CREATE INDEX idx_supplements_active ON supplements(active);
```

---

## DEC-phase6-002: Calendar Dot Rendering Strategy

| Attribute | Value |
|-----------|-------|
| **Question** | C9: How to extend the calendar component from `activeDates: Set<string>` to per-supplement dot data? |
| **Decision** | Create a new API endpoint `GET /api/calendar-supplements/:month` that returns per-day supplement status data for an entire month. Extend the Calendar component to accept a `supplementDays` prop alongside (not replacing) the existing `activeDates` prop. |
| **Rationale** | A dedicated endpoint fetching an entire month of supplement status data in one call is far more efficient than calling daily-summary 30 times. Keeping the existing `activeDates` prop ensures backward compatibility (C9). The new prop carries richer data: for each date, an array of `{supplementId, name, color, status}` objects. |
| **Alternatives Considered** | |
| - Extend daily-summary API and call per-day | 30 API calls per month view. Unacceptable latency and D1 query volume. Rejected. |
| - Embed supplement data into existing `activeDates` | Would break the Set<string> interface. Existing consumers would break. Rejected. |
| - Single monolithic monthly-summary endpoint | Overloads the response with food/training/metrics data not needed for calendar rendering. Rejected. |
| **Impact on Existing System** | New endpoint added; no existing endpoints changed. Calendar component gets a new optional prop; existing usage with only `activeDates` continues to work. |

### New API Endpoint

```
GET /api/calendar-supplements/:month
  - month format: YYYY-MM (e.g., 2026-04)
  - Response: {
      days: {
        [date: string]: Array<{
          supplementId: string;
          name: string;
          color: string;
          status: 'taken' | 'skipped' | 'pending';
        }>
      },
      compliance: {
        [date: string]: 'full' | 'partial' | 'none' | null;
      }
    }
```

### Query Strategy

1. Fetch all active supplements with their schedules and colors
2. Use the existing scheduling engine to compute which supplements are due on each day of the month
3. Fetch all supplement_logs for the month in a single query: `SELECT * FROM supplement_logs WHERE scheduled_date BETWEEN ? AND ?`
4. Join in application code: for each day, match scheduled supplements against logs to determine taken/skipped/pending status
5. Compute compliance per day: all taken = "full", some taken = "partial", none = "none", no supplements scheduled = null

---

## DEC-phase6-003: OpenFoodFacts Integration Pattern

| Attribute | Value |
|-----------|-------|
| **Question** | How to integrate OpenFoodFacts as secondary food source? |
| **Decision** | Add an OpenFoodFacts API client alongside the existing USDA client. Use the same `food_cache` table with a `source` discriminator column to cache results from both sources. USDA remains primary; OpenFoodFacts is queried in parallel and results are merged. |
| **Rationale** | Sharing the cache table avoids schema proliferation and lets the existing cache-first search pattern work for both sources. Adding a `source` column to `food_cache` is a minimal change. Parallel queries to both APIs minimize latency — the user sees results from whichever responds first, with the other appending. This mirrors OQ4's discussion and picks the simpler single-table approach. |
| **Alternatives Considered** | |
| - Separate `off_food_cache` table | Cleaner separation but doubles cache management code and adds a second query for every search. Rejected. |
| - Sequential search (USDA first, OFF only if USDA returns no results) | Worse latency and misses branded products that exist in OFF alongside generic USDA results. Rejected. |
| - Client-side OFF API calls | Would expose API calls to the browser, bypass caching, and lose server-side rate limit control. Rejected. |
| **Impact on Existing System** | `food_cache` table needs a `source` column (default "usda" for existing rows). The `searchFoodsWithCache` service function needs to be extended to query both sources. Existing USDA-only search continues to work. |

### OpenFoodFacts API Details

```
Base URL: https://world.openfoodfacts.org
Search:   GET /cgi/search.pl?search_terms={query}&json=1&page_size={limit}
Product:  GET /api/v2/product/{barcode}.json

No API key required. Rate limit: ~100 requests/minute (be respectful).
User-Agent header required: "PeakProtocol/1.0 (personal health app)"
```

### Cache Table Migration

```sql
ALTER TABLE food_cache ADD COLUMN source TEXT DEFAULT 'usda';
```

### Merged Search Flow

```
1. Check food_cache for query (both sources)
2. If cache hits >= limit, return cached results
3. In parallel:
   a. Call USDA FoodData Central API
   b. Call OpenFoodFacts search API
4. Normalize OFF results to same schema as USDA (fdcId -> barcode, map nutrient fields)
5. Cache all new results with appropriate source tag
6. Merge: USDA results first, then OFF results, deduplicate by name similarity
7. Return merged results with source field on each item
```

---

## DEC-phase6-004: AI Macro Estimation Approach

| Attribute | Value |
|-----------|-------|
| **Question** | OQ3: Which LLM provider and model for AI macro estimation? |
| **Decision** | Use Anthropic Claude API (claude-3-5-haiku or equivalent fast model) called from Cloudflare Workers. API key stored as Wrangler secret `ANTHROPIC_API_KEY`. Structured JSON output via system prompt. |
| **Rationale** | Anthropic's Claude models produce reliable structured JSON output and handle nutritional estimation well. Haiku-class models are fast (< 2s typical) and cheap (sub-cent per request), well within the Workers 30s CPU limit. The Pack Owner's existing Anthropic relationship makes this the natural choice. Using an external API avoids the 128MB Workers memory constraint (C5). |
| **Alternatives Considered** | |
| - Cloudflare Workers AI (built-in models) | Limited model selection, lower quality for structured nutritional estimation, still in beta for some models. Rejected. |
| - OpenAI GPT-4o-mini | Comparable quality and speed, but adds a second vendor relationship. Rejected for simplicity. |
| - Local nutritional database lookup | Would need a comprehensive recipe/prepared-food database that doesn't exist. Only works for known foods, not free-text descriptions. Rejected. |
| - Prompt-based calculation with USDA data | Could try to decompose a dish into ingredients and look each up in USDA, but this is fragile and slow (multiple API calls). LLM estimation is more robust for complex descriptions. Rejected. |
| **Impact on Existing System** | New Wrangler secret: `ANTHROPIC_API_KEY`. New service module: `services/ai-estimation.ts`. New route: `POST /api/foods/estimate`. No changes to existing endpoints. |

### API Call Pattern

```typescript
// POST /api/foods/estimate
// Body: { description: "large bowl of chicken fried rice" }
// Response: { calories, protein, carbs, fat, fiber, source: "ai", confidence: "estimate" }

const ESTIMATION_PROMPT = `You are a nutritional estimation assistant. Given a food description, estimate the macronutrient content. Return ONLY valid JSON with this exact structure:
{
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "fiber": <number in grams>,
  "serving_description": "<what you estimated for>"
}
Be reasonable and conservative. If the description is vague, estimate for a typical adult portion. All numbers should be realistic for the described food and portion size.`;
```

### Error Handling

- If API key missing: return 503 with message "AI estimation not configured"
- If API call fails: return 502 with message "AI estimation temporarily unavailable"
- If response is not valid JSON: retry once, then return 502
- Always: manual entry remains available as fallback

---

## DEC-phase6-005: Deferred Calculation Data Model

| Attribute | Value |
|-----------|-------|
| **Question** | How to store unresolved food text entries? |
| **Decision** | Use the existing `food_entries` table. Text-only entries are rows where `food_name` is set but all macro columns (`calories`, `protein`, `carbs`, `fat`, `fiber`) are NULL. The new `source` column is NULL for unresolved entries. A new `description` TEXT column stores the raw user text for AI estimation. The "Calculate All" action queries for entries with NULL macros and processes them. |
| **Rationale** | Reusing the existing table avoids a separate "pending foods" concept. NULL macros already work correctly with the existing `calculateTotals` function (it treats null as 0). The `description` column preserves the original user text even after resolution (the `food_name` may be updated to a matched food name). This is the minimal-change approach. |
| **Alternatives Considered** | |
| - Separate `pending_food_entries` table | Requires moving rows between tables on resolution, adds complexity. Rejected. |
| - Status column (pending/resolved) | Redundant — NULL macros already indicate "unresolved" status. Adding a status column is over-engineering. Rejected. |
| - Store pending entries in KV | Loses SQL query capability, complicates the daily totals calculation. Rejected. |
| **Impact on Existing System** | `food_entries` table needs a `source` column and a `description` column. Existing entries work unchanged (null source defaults to "usda" display, null description is fine). The existing POST endpoint continues to work for entries with macros. |

### Migration SQL

```sql
ALTER TABLE food_entries ADD COLUMN source TEXT;
ALTER TABLE food_entries ADD COLUMN description TEXT;
```

### New API Endpoints

```
POST /api/food-entries/text
  Body: { date, meal, description }
  Creates entry with food_name = description, all macros NULL, source NULL

POST /api/food-entries/calculate-all
  Body: { date }
  Finds all entries for date with NULL calories
  For each: tries USDA search -> OFF search -> AI estimation
  Updates each entry with resolved macros and source
  Returns: { resolved: [...], failed: [...] }

PUT /api/food-entries/:id
  Body: { calories?, protein?, carbs?, fat?, fiber? }
  Updates macros and sets source = "manual"
  (Also supports updating food_name and other fields)
```

### Resolution Priority

1. Search USDA cache + API for `food_name`/`description`
2. Search OpenFoodFacts for `food_name`/`description`
3. If no match from either: call AI estimation with `description`
4. If all fail: mark as failed, return to user for manual entry

---

## DEC-phase6-006: Calendar Dot Overflow Strategy

| Attribute | Value |
|-----------|-------|
| **Question** | OQ2: How to handle calendar cells with more supplements than can physically fit as dots? |
| **Decision** | Render up to 8 dots in a 2-row grid layout within the cell. If more than 8 supplements are scheduled, render 7 dots plus a "+N" overflow indicator. On mobile, use 6 dots max with "+N" for overflow. |
| **Rationale** | Mobile calendar cells are approximately 48x48px. Testing shows 8 small dots (4x2 grid, each ~8px) fit without crowding. The "+N" indicator communicates that more supplements exist without overwhelming the visual. The day-detail view (tapped) always shows the complete list, so no information is lost. |
| **Alternatives Considered** | |
| - Show all dots regardless of count | Dots become unreadably small at 10+ and break cell layout. Rejected. |
| - Aggregated single indicator (e.g., pie chart) | Loses per-supplement visibility, which is the core feature request. Rejected. |
| - Scrollable dot area within cell | Too small to scroll on mobile; bad UX. Rejected. |
| - Stacked/overlapping dots | Reduces clarity; colors blend together. Rejected. |
| **Impact on Existing System** | Frontend-only concern. Calendar.tsx component needs dot layout logic with max-dot threshold. |

### Dot Layout Specification

```
Mobile (< 640px):
  - Max visible dots: 6
  - Layout: 3 columns x 2 rows
  - Dot size: 6px diameter
  - Gap: 2px
  - Overflow: "+N" text (8px font) replaces last dot position

Desktop (>= 640px):
  - Max visible dots: 8
  - Layout: 4 columns x 2 rows
  - Dot size: 8px diameter
  - Gap: 2px
  - Overflow: "+N" text (10px font) replaces last dot position
```

---

## DEC-phase6-007: Calculate All Batch Workflow

| Attribute | Value |
|-----------|-------|
| **Question** | How should the "Calculate All" button workflow work? |
| **Decision** | Frontend sends `POST /api/food-entries/calculate-all` with the date. Backend processes entries sequentially (not in parallel) to respect API rate limits. Each entry is resolved independently — partial success is returned. Frontend polls for completion or receives a streaming response. |
| **Rationale** | Sequential processing avoids hitting OpenFoodFacts rate limits and keeps Workers CPU usage predictable. Partial success is critical: if 2 of 3 items resolve, the user should see those results immediately and be able to manually handle the failed item. Processing 3-5 items typically takes 3-8 seconds (USDA/OFF cache hits are fast; AI estimation adds 1-2s per item). This fits within the 30s Workers CPU limit (C5). |
| **Alternatives Considered** | |
| - Parallel processing of all entries | Risk hitting rate limits on external APIs. A single Workers request making 5+ parallel API calls could timeout. Rejected. |
| - Client-side orchestration (frontend calls per-entry) | Pushes complexity to frontend, loses atomic error handling. More network round trips. Rejected. |
| - Background processing via queue | Over-engineered for 3-5 items. Adds infrastructure (Cloudflare Queue). Rejected for v1. |
| - All-or-nothing batch | Bad UX: one failed item blocks all results. Rejected. |
| **Impact on Existing System** | New endpoint. Frontend needs a "calculating" loading state with per-entry progress feedback. |

### Batch Processing Flow

```
POST /api/food-entries/calculate-all { date: "2026-04-05" }

Backend:
1. SELECT * FROM food_entries WHERE date = ? AND calories IS NULL
2. For each entry (sequential):
   a. Search USDA cache/API for food_name
   b. If no USDA match: search OpenFoodFacts
   c. If no OFF match: call AI estimation with description
   d. If resolved: UPDATE food_entries SET calories=?, protein=?, ... source=? WHERE id=?
   e. If failed: add to failed list with reason
3. Return { resolved: [{id, source, macros}], failed: [{id, reason}] }

Response shape:
{
  "resolved": [
    { "id": "abc", "source": "usda", "calories": 330, "protein": 62, "carbs": 0, "fat": 7, "fiber": 0 },
    { "id": "def", "source": "ai", "calories": 650, "protein": 25, "carbs": 80, "fat": 20, "fiber": 3 }
  ],
  "failed": [
    { "id": "ghi", "reason": "No match found and AI estimation unavailable" }
  ]
}
```

---

## DEC-phase6-008: Compliance Heatmap Time Behavior

| Attribute | Value |
|-----------|-------|
| **Question** | OQ6: Should compliance tint consider time-of-day? |
| **Decision** | Compliance heatmap computes based on all scheduled supplements for the day, regardless of whether their scheduled time has passed. For the current day, pending evening supplements count as "not yet taken" (contributing to partial/amber tint). Past days use final end-of-day state. |
| **Rationale** | Real-time tinting based on scheduled time adds complexity (need to know current time relative to each supplement's schedule) and causes confusing color transitions throughout the day. The simpler model — all scheduled supplements count — is consistent and predictable. The user already has the checklist view for real-time per-supplement status. The heatmap is a monthly overview tool, not a real-time tracker. |
| **Alternatives Considered** | |
| - Time-aware tinting (only count supplements whose time has passed) | More accurate in real-time but causes confusing color changes during the day. A cell might go green->amber->green as supplements come due and get taken. Rejected. |
| - End-of-day-only calculation (no tint until day is over) | Delays feedback too much. Users want to see progress during the day. Rejected. |
| - Separate "in progress" tint for current day | Adds a fourth tint state that needs explanation. Over-complicated. Rejected. |
| **Impact on Existing System** | Compliance calculation is straightforward: `taken_count / scheduled_count` for each day. Computed in the `GET /api/calendar-supplements/:month` endpoint alongside dot data. |

### Compliance Thresholds

```
full (green tint):    taken_count == scheduled_count AND scheduled_count > 0
partial (amber tint): taken_count > 0 AND taken_count < scheduled_count
none (no tint):       taken_count == 0 (regardless of whether supplements are scheduled)
n/a (no tint):        scheduled_count == 0
```

---

## DEC-phase6-009: Historical Calendar Dots for Modified Schedules

| Attribute | Value |
|-----------|-------|
| **Question** | OQ7: What about calendar dots for past dates where the schedule has changed? |
| **Decision** | Historical calendar dots are derived from `supplement_logs` records, not from the current scheduling engine. If a log exists for a date, the dot shows. If no log exists but the supplement was scheduled at that time, the dot shows as pending/gray only if the scheduling engine still computes it as due (best-effort). |
| **Rationale** | The supplement_logs table is the source of truth for what actually happened. The scheduling engine is forward-looking and may not accurately reconstruct historical schedules after changes (e.g., a supplement switched from daily to weekly). Using logs for historical data is both accurate and simple. The edge case of "was scheduled but never logged and schedule later changed" is low-impact for a personal app — the user knows their own history. |
| **Alternatives Considered** | |
| - Snapshot schedule at time of log creation | Would require storing schedule metadata per log record. Adds significant complexity for marginal benefit. Rejected. |
| - Schedule versioning table | Full audit trail of schedule changes. Over-engineered for single-user app. Rejected. |
| - Only show dots for days with logs (no pending dots for past days) | Simpler but loses the "missed dose" visibility. Rejected. |
| **Impact on Existing System** | No schema changes needed. The calendar endpoint queries supplement_logs for the month and cross-references with current schedules for the "pending" computation. |

---

## Summary: Phase 6 Schema Changes

### New Columns

| Table | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| `supplements` | `color` | TEXT | NULL | Hex color for calendar dot |
| `food_entries` | `source` | TEXT | NULL | Data source: usda, openfoodfacts, ai, manual |
| `food_entries` | `description` | TEXT | NULL | Raw user text for AI estimation |
| `food_cache` | `source` | TEXT | 'usda' | Distinguishes USDA vs OpenFoodFacts cached items |

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/calendar-supplements/:month` | Monthly supplement dot + compliance data |
| POST | `/api/food-entries/text` | Create text-only food entry (deferred calc) |
| POST | `/api/food-entries/calculate-all` | Batch resolve unresolved food entries |
| PUT | `/api/food-entries/:id` | Update food entry macros (manual override) |
| POST | `/api/foods/estimate` | AI macro estimation for free-text description |
| POST | `/api/supplements/batch-log` | Mark all pending supplements as taken |

### New Wrangler Secrets

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API for AI macro estimation |

### Migration File

```
migrations/003_phase6_calendar_food.sql
```

---

## Decision Register (Phase 6)

| ID | Question | Decision Summary |
|----|----------|------------------|
| DEC-phase6-001 | Supplement color storage | `color` TEXT column on supplements table, 16-color palette |
| DEC-phase6-002 | Calendar dot rendering | New `/api/calendar-supplements/:month` endpoint, additive prop on Calendar component |
| DEC-phase6-003 | OpenFoodFacts integration | Shared `food_cache` table with `source` column, parallel search |
| DEC-phase6-004 | AI macro estimation | Anthropic Claude (Haiku-class), `ANTHROPIC_API_KEY` secret |
| DEC-phase6-005 | Deferred calculation model | NULL macros in `food_entries` = unresolved, `description` column for AI |
| DEC-phase6-006 | Calendar dot overflow | Max 8 dots (6 mobile) with "+N" overflow indicator |
| DEC-phase6-007 | Calculate All workflow | Sequential backend processing, partial success returned |
| DEC-phase6-008 | Compliance heatmap timing | All scheduled supplements count regardless of time-of-day |
| DEC-phase6-009 | Historical schedule dots | Logs are source of truth; scheduling engine is best-effort for pending |

---

*Document generated by Architect | Wolf Pack Protocol*
