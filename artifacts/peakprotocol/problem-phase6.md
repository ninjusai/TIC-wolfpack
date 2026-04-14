---
title: "PeakProtocol Phase 6 Problem Definition: Calendar Supplement Visibility + Multi-Source Food Diary"
version: "1.0.0"
status: draft
problem-id: PRB-peakprotocol-phase6-001
source: intake-brief-phase6.json
created: 2026-04-05
last-updated: 2026-04-05
author: Framer
project: peakprotocol
domain: health-tracking
complexity: high
parent: PRB-peakprotocol-001
phases-complete: 1-5
tags: [supplements, calendar, food-logging, multi-source, ai-estimation]
---

# Problem Definition: PeakProtocol Phase 6 — Calendar Supplement Visibility + Multi-Source Food Diary

## 1. Problem Statement

The Pack Owner manages a complex supplement routine spanning multiple scheduling types (daily, every N days, weekly, specific days of week) but the calendar view offers no visibility into which supplements are due or taken on any given day. The only visual indicator is a generic green activity dot per day — determining whether the morning stack was completed requires drilling into supplement-specific views, creating a daily blind spot that risks missed doses and protocol breaks. Separately, the food diary relies on a single data source (USDA FoodData Central API) which lacks coverage for prepared meals, restaurant food, international cuisine, branded products, and custom recipes. When a food cannot be found there is no fallback — the user must abandon the entry or guess at macros manually. Together these two gaps produce daily friction: the supplement blind spot undermines adherence tracking, and the single-source food limitation makes consistent nutrition logging unreliable.

## 2. Scope

### 2.1 In Scope

| # | Feature Area | Capability |
|---|-------------|------------|
| S1 | Supplement dots on calendar cells | Each active supplement scheduled for a given day renders as a small colored dot on the calendar grid cell, with color distinguishing taken (green), skipped (amber), and pending/not-yet-logged (gray) |
| S2 | Calendar day detail supplement checklist | Tapping a day opens a supplement checklist showing each scheduled supplement as a checkbox with name, dose, and time-of-day; checking a box logs it as taken with current timestamp; unchecking reverts to pending |
| S3 | Supplement color assignment | Each supplement receives a persistent color from a predefined palette, stored alongside the supplement record, so dots are visually distinguishable across the calendar |
| S4 | Monthly supplement compliance heatmap | Calendar cells with all supplements taken show a subtle green background tint; partial completion shows amber; nothing logged shows no tint — providing instant monthly compliance visibility |
| S5 | Batch supplement check-in | A "Mark All Taken" action on the day detail for occasions when the entire stack was taken together, with individual override capability |
| S6 | Multi-source food search | Expand food lookup beyond USDA to include OpenFoodFacts API for branded/packaged products, with USDA remaining the primary source and OpenFoodFacts as secondary |
| S7 | Manual food entry with AI macro estimation | When no API source has the food, the user can type a free-text food description (e.g., "homemade chicken stir fry with rice, large bowl") and request AI-powered calorie and macro estimation via a "Calculate" action |
| S8 | Daily food list with deferred calculation | Food items can be listed as text entries throughout the day without macro data; a "Calculate All" action triggers batch lookup/estimation for all unresolved items at once, so logging is fast and calculation is on-demand |
| S9 | Food source indicator | Each food entry displays a small badge showing its data source (USDA, OpenFoodFacts, AI estimate, Manual) so the user knows the confidence level of the macro data |
| S10 | Manual macro override | Regardless of source, the user can tap any food entry to manually edit calories, protein, carbs, fat, and fiber values |
| S11 | Improved Quick-Add for foods | Extend the existing Quick-Add UI to support searching across all available sources (USDA + OpenFoodFacts) in a unified search results list |

### 2.2 Out of Scope

| Exclusion | Rationale |
|-----------|-----------|
| Meal planning or meal prep scheduling | Deferred to v2 |
| Supplement interaction warnings or contraindication checks | Requires medical database; deferred to v2 |
| Barcode scanning for food products | Requires native camera access; deferred to v2 |
| Supplement purchase tracking or restock reminders | Deferred to v2 |
| Social or sharing features | Single-user application |
| Recipe builder with ingredient-level macro calculation | Deferred to v2 |
| Photo-based food recognition | Requires ML model; deferred to v2 |
| Nutrition goal setting or macro target alerts | Deferred to v2 |
| Integration with fitness trackers or wearables | Deferred to v2 |
| LLM API key management UI | Key will be configured as a deployment secret alongside existing API keys |
| Changes to existing supplement CRUD endpoints | Existing 5 endpoints remain unchanged; new fields are additive |
| Changes to existing food_entries table structure beyond additive columns | Backward compatibility required |

## 3. Users

### 3.1 Primary Persona: The Pack Owner

| Attribute | Value |
|-----------|-------|
| **Role** | Sole user of a personal health optimization PWA |
| **Goal** | See supplement schedule compliance at a glance on the calendar and log all food intake accurately regardless of data source availability |
| **Context** | Uses the app morning and evening daily. Manages 10+ supplements across 4 schedule types (daily, every N days, weekly, specific days). Tracks diverse food intake including home-cooked meals, restaurant food, and branded items that frequently do not exist in the USDA database. |
| **Primary Device** | Android smartphone (PWA in browser) |
| **Current Pain Points** | (1) Cannot tell from the calendar whether supplements were taken without drilling into supplement views. (2) Cannot log foods absent from USDA — must abandon entry or guess macros. (3) Quick-Add only searches USDA, missing branded products. |

## 4. Success Criteria

Each criterion below is independently testable by a third party.

| # | Criterion | Measurement |
|---|-----------|-------------|
| SC1 | Calendar day cells display colored dots for each supplement scheduled on that date | For a day with 3 scheduled supplements (1 taken, 1 skipped, 1 pending), the calendar cell renders 3 dots: 1 green, 1 amber, 1 gray |
| SC2 | Tapping a calendar day shows a supplement checklist with checkboxes | Day detail view lists all supplements scheduled for selected date with checkbox, name, dose, and time-of-day; checking a box calls the supplement log API and persists taken status |
| SC3 | Batch "Mark All Taken" logs all pending supplements for the day in a single action | Clicking "Mark All Taken" on a day with 5 pending supplements results in 5 supplement_logs records with taken_at timestamps; all checkboxes show as checked |
| SC4 | Food search returns results from both USDA and OpenFoodFacts | Searching "Coca-Cola" returns a branded result from OpenFoodFacts; searching "chicken breast" returns a USDA result; results are labeled with source badge |
| SC5 | Manual food entry with AI estimation returns calorie and macro breakdown | Entering "large bowl of chicken fried rice" and triggering calculation returns estimated calories, protein, carbs, fat, and fiber with "AI estimate" source badge |
| SC6 | Food items can be listed without macros and batch-calculated later | User adds 3 food items as text-only entries (no macros); triggering "Calculate All" populates macro data for all 3 items; daily totals update accordingly |
| SC7 | Each food entry displays its data source | Food entries show a visible badge: "USDA", "OFF", "AI", or "Manual" depending on how the macro data was obtained |
| SC8 | Manual macro override works on any food entry regardless of original source | Tapping a food entry with USDA-sourced data opens an edit form; changing calories from 200 to 250 persists the change and updates daily totals; source badge changes to "Manual" |
| SC9 | Supplement color assignments persist across sessions | Supplement "Vitamin D" is assigned color #F59E0B; after page reload, calendar dots for Vitamin D still render in #F59E0B |
| SC10 | Calendar monthly compliance heatmap provides visual feedback | A day with all supplements taken shows green tint on cell background; partial compliance shows amber; no logs shows no tint |

## 5. Constraints

| # | Constraint | Impact if Violated |
|---|-----------|-------------------|
| C1 | Must deploy on existing Cloudflare stack: Workers (Hono), Pages (SolidJS), D1, KV, R2 | Replatforming would invalidate all 5 phases of existing work and production deployment |
| C2 | Frontend must use SolidJS + UnoCSS + Vite — no framework changes | Framework change would require rewriting all existing UI components (14 Pixel work items) |
| C3 | Single-user app with fixed "owner" user ID and passcode auth | No multi-tenant considerations; any multi-user work is wasted effort |
| C4 | D1 has limited ALTER TABLE support — new columns may require migration with table recreation or new tables | Migrations must be tested carefully; naive ALTER TABLE may fail in some D1 contexts |
| C5 | Cloudflare Workers: 128MB memory limit, 30s CPU time (standard plan) | AI macro estimation must use an external API call, not local inference; batch operations must stay within time limits |
| C6 | Existing supplement_logs table schema must be preserved for backward compatibility | New fields must be additive only; existing log data must remain queryable with no migration of existing rows |
| C7 | OpenFoodFacts API is free but rate-limited | Must implement caching similar to existing USDA food_cache pattern to avoid rate limit errors during repeated searches |
| C8 | AI macro estimation requires an LLM API key configured as a Wrangler secret | Deployment requires a new secret; no key management UI (consistent with existing USDA_API_KEY and APP_PASSCODE pattern) |
| C9 | Calendar component currently uses a single `activeDates` Set<string> prop | Supplement dots require richer per-day data; the component interface must be extended without breaking existing calendar functionality |
| C10 | Existing food_entries table has fdc_id column but no source column | A source discriminator must be added to distinguish USDA, OpenFoodFacts, AI, and Manual origins; existing rows should default to "usda" or null |

## 6. Assumptions

| # | Assumption | Impact if Wrong |
|---|-----------|----------------|
| A1 | The existing scheduling engine correctly calculates which supplements are due on any given date across all 4 schedule types | If the scheduler has edge cases, calendar dots will show incorrect supplement-per-day data; would require scheduler fixes before this phase |
| A2 | The existing supplement_logs table can accommodate a color column addition (or a new supplement_colors table) without disrupting current logging queries | If existing queries break, Phase 2 compliance features could regress |
| A3 | OpenFoodFacts API provides sufficient branded product coverage for the user's typical diet | If coverage is poor, the multi-source search may not materially improve the food logging experience |
| A4 | An LLM API (Anthropic or OpenAI) can estimate macros from free-text food descriptions with acceptable accuracy for personal tracking purposes | If estimates are wildly inaccurate, the AI estimation feature provides false confidence; user should always have manual override (S10) as fallback |
| A5 | The Daily Summary API (`GET /api/daily-summary/:date`) can be extended to include per-supplement status without breaking existing consumers | If the response shape change breaks the frontend, the existing Day Summary tab could regress |
| A6 | Calendar cell layout has enough physical space to render 10+ colored dots without becoming unreadable on mobile | If space is insufficient, an alternative visualization (e.g., aggregated indicator) may be needed instead of per-supplement dots |
| A7 | D1 batch operations can handle a "Mark All Taken" action for 10+ supplements within a single Workers request without exceeding CPU time limits | If batch insert of 10+ logs times out, the batch action would need to be chunked or made asynchronous |
| A8 | Existing food_entries records with null source can be treated as USDA-origin for backward compatibility | If any existing entries came from manual input (pre-phase-6), their source badge will be inaccurate; low impact for personal use |

## 7. Open Questions

| # | Question | Why It Matters |
|---|----------|---------------|
| OQ1 | What predefined color palette should be used for supplement dots, and how many distinct colors are needed given the user manages 10+ supplements? | With 10+ supplements, color differentiation becomes difficult; may need a palette of 12-16 visually distinct colors that work on both light/dark themes |
| OQ2 | Should the calendar dot visualization degrade gracefully when a day has more supplements than can physically fit as dots in a cell? | Mobile calendar cells are small; 10+ dots may be unreadable. Need to decide on a max-dot count with an overflow indicator (e.g., "+3") or alternative compact visualization |
| OQ3 | Which LLM provider and model should be used for AI macro estimation, and what prompt structure produces the most reliable calorie/macro outputs? | Different models have different accuracy profiles for nutritional estimation; prompt engineering affects result consistency |
| OQ4 | Should OpenFoodFacts search results be cached in the same food_cache table as USDA results, or in a separate cache table? | Sharing a cache table is simpler but may require a source discriminator column; separate tables are cleaner but add schema complexity |
| OQ5 | How should the "Calculate All" batch action handle partial failures (e.g., 2 of 3 items resolved, 1 fails)? | Need to decide whether to show partial results with an error indicator on the failed item, or fail the entire batch — partial success is likely the better UX |
| OQ6 | Should the compliance heatmap tint consider time-of-day (e.g., show amber in the morning if evening supplements are still pending) or only compute at end-of-day? | Real-time tinting could cause confusing color changes throughout the day; end-of-day-only tinting delays feedback |
| OQ7 | What happens to calendar supplement dots for past dates where supplements were scheduled but the scheduling engine has since been modified (e.g., supplement deactivated)? | Historical accuracy requires either snapshotting the schedule at the time or reconstructing it; the current scheduling engine is forward-looking |

## 8. Background and Prior Art

This problem definition covers Phase 6 of PeakProtocol, building on a fully deployed production application with 5 completed phases (47 work items, all audit-clean).

**Existing capabilities relevant to this phase:**

- **Supplement CRUD:** 5 REST endpoints with zod validation, supporting 4 schedule types (daily, every N days, weekly, specific days)
- **Scheduling Engine:** Pure functions computing supplement due dates across all schedule types
- **Supplement Logging API:** Log taken/skipped status, retrieve daily logs, query history
- **Compliance Calculator:** Daily, range, and streak calculations with time-of-day cutoffs
- **Calendar Component:** `Calendar.tsx` renders a monthly grid with a single green dot per active day via `activeDates: Set<string>` prop
- **Daily Summary API:** `GET /api/daily-summary/:date` joins supplement_logs with supplements table and aggregates food entries by meal
- **Food Logging:** USDA FoodData Central integration with cache-first search (52 seed foods), food entry CRUD, saved foods library, Quick-Add UI
- **D1 Schema:** supplements, supplement_logs, food_cache, saved_foods, food_entries tables with indexes

**Key database tables affected:**

- `supplements` — may need a `color` column for persistent color assignment
- `supplement_logs` — read-heavy for calendar dot rendering; schema preserved, no breaking changes
- `food_entries` — needs a `source` column to distinguish data origins (currently has `fdc_id` for USDA)
- `food_cache` — may be extended or paralleled for OpenFoodFacts caching

## 9. Backward Compatibility Requirements

Since this is a feature enhancement to a deployed production application, the following backward compatibility constraints apply:

1. **Existing supplement_logs data** must remain queryable with no migration of existing rows
2. **Existing food_entries data** must continue to function; new `source` column should default to a sensible value for existing rows
3. **Existing API endpoints** must not change their response shape in breaking ways; new fields should be additive
4. **Daily Summary API** response can be extended but must not remove or rename existing fields
5. **Calendar component** must continue to function for its current consumers while supporting the new richer data model
6. **Saved foods library** must continue to work; Quick-Add extension should be backward-compatible
