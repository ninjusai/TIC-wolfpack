---
title: "PeakProtocol Phase 6 Eval Specification"
version: "1.0.0"
status: draft
eval-id: EVL-peakprotocol-phase6-001
references: PRB-peakprotocol-phase6-001
created: 2026-04-05
author: Architect
domain: health-tracking
total-cases: 32
---

# Eval Specification: PeakProtocol Phase 6 — Calendar Supplement Visibility + Multi-Source Food Diary

## 1. Overview

This document defines evaluation criteria for PeakProtocol Phase 6, which adds two feature clusters: (1) calendar supplement dot visibility with compliance heatmap, and (2) multi-source food diary with OpenFoodFacts, AI macro estimation, and deferred calculation. It transforms the 10 success criteria from PRB-peakprotocol-phase6-001 into formal, testable eval cases, plus negative tests, edge cases, and data integrity validations.

## 2. Eval Summary

| Category | Primary Cases | Additional Cases | Total |
|----------|---------------|------------------|-------|
| Calendar Supplement Dots | 3 | 3 | 6 |
| Supplement Checklist & Batch | 2 | 3 | 5 |
| Compliance Heatmap | 1 | 2 | 3 |
| Multi-Source Food Search | 2 | 2 | 4 |
| AI Macro Estimation | 1 | 2 | 3 |
| Deferred Calculation | 1 | 2 | 3 |
| Source Badge & Manual Override | 2 | 2 | 4 |
| Data Integrity (Phase 6) | 0 | 4 | 4 |
| **Total** | **12** | **20** | **32** |

---

## 3. Cluster 1 — Calendar Supplement Visibility

### EVL-P6-01: Calendar Day Cells Display Colored Dots (SC1)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-01 |
| **Source** | SC1 |
| **Category** | Calendar Supplement Dots |
| **Priority** | Critical |

**Preconditions:**
1. User is authenticated
2. 3 supplements exist: "Vitamin D" (daily, morning), "Omega-3" (daily, evening), "BPC-157" (every 2 days)
3. For the test date: Vitamin D is logged as taken, Omega-3 is logged as skipped, BPC-157 has no log (pending)
4. Each supplement has a distinct color assignment

**Test Steps:**
1. Navigate to calendar view
2. Locate the test date cell on the calendar grid
3. Inspect the dots rendered within that cell
4. Verify dot count, colors, and status-based coloring

**Expected Result:**
- Calendar cell renders exactly 3 dots
- Vitamin D dot: rendered in its assigned color with green (taken) status indicator
- Omega-3 dot: rendered with amber (skipped) status indicator
- BPC-157 dot: rendered with gray (pending) status indicator
- Dots are visually distinct and do not overlap into unreadable state

**Pass/Fail Criteria:**
- PASS: 3 dots visible with correct status coloring (green/amber/gray) AND each dot is visually distinguishable
- FAIL: Wrong dot count OR incorrect status colors OR dots unreadable

**Automation Level:** Automated (DOM inspection)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "date": "2026-04-05",
  "supplements": [
    {"name": "Vitamin D", "color": "#F59E0B", "status": "taken"},
    {"name": "Omega-3", "color": "#3B82F6", "status": "skipped"},
    {"name": "BPC-157", "color": "#8B5CF6", "status": "pending"}
  ],
  "expected_dots": 3
}
```

---

### EVL-P6-01a: Calendar Dots for Day with No Scheduled Supplements (Negative)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-01a |
| **Source** | SC1 (negative) |
| **Category** | Calendar Supplement Dots |
| **Priority** | Medium |

**Preconditions:**
1. All supplements are scheduled on specific days that exclude the test date
2. No supplements are due on the test date

**Test Steps:**
1. Navigate to calendar view
2. Locate the test date cell
3. Inspect for supplement dots

**Expected Result:**
- No supplement dots rendered on the cell
- Cell still functions normally for other data (food, training)

**Pass/Fail Criteria:**
- PASS: Zero dots on cell AND no visual artifacts
- FAIL: Phantom dots OR rendering errors

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-01b: Calendar Dots Overflow with 10+ Supplements (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-01b |
| **Source** | SC1, OQ2 |
| **Category** | Calendar Supplement Dots |
| **Priority** | High |

**Preconditions:**
1. 12 supplements are active and all scheduled for the same day
2. Mobile viewport (375px width)

**Test Steps:**
1. Navigate to calendar view on mobile viewport
2. Locate the day cell with 12 scheduled supplements
3. Observe dot rendering behavior

**Expected Result:**
- Cell does not overflow or break layout
- Either: all 12 dots render in a compact layout, OR a maximum number of dots render with an overflow indicator (e.g., "+4")
- Calendar grid remains usable and scrollable

**Pass/Fail Criteria:**
- PASS: Cell layout intact AND all supplements accounted for (dots or overflow indicator)
- FAIL: Layout breakage OR supplements not accounted for

**Automation Level:** Semi-automated (visual inspection on mobile viewport)

**Scorer Type:** Algorithmic + Human verification

---

### EVL-P6-02: Supplement Color Assignment Persists (SC9)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-02 |
| **Source** | SC9 |
| **Category** | Calendar Supplement Dots |
| **Priority** | High |

**Preconditions:**
1. Supplement "Vitamin D" exists
2. Color assignment feature is available

**Test Steps:**
1. Assign color #F59E0B to "Vitamin D"
2. Verify the calendar dot for Vitamin D renders in #F59E0B
3. Reload the page (full page refresh)
4. Navigate back to calendar view
5. Inspect the Vitamin D dot color

**Expected Result:**
- After reload, calendar dots for Vitamin D render in #F59E0B
- Color is stored in D1 supplements table (not local/session state)

**Pass/Fail Criteria:**
- PASS: Color #F59E0B persists after page reload
- FAIL: Color resets to default OR different color after reload

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "supplement": "Vitamin D",
  "assigned_color": "#F59E0B",
  "verification": "after_reload"
}
```

---

### EVL-P6-02a: Color Uniqueness Across Supplements (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-02a |
| **Source** | SC9, OQ1 |
| **Category** | Calendar Supplement Dots |
| **Priority** | Medium |

**Preconditions:**
1. 10+ supplements exist

**Test Steps:**
1. Assign colors to all 10+ supplements
2. Verify each supplement has a distinct color from the palette
3. Navigate to a day where all 10+ supplements are scheduled
4. Inspect dot color differentiation

**Expected Result:**
- Each supplement has a unique color from the predefined palette
- Colors are visually distinguishable from each other at dot size
- Palette provides at least 12 distinct colors

**Pass/Fail Criteria:**
- PASS: All supplements have unique, distinguishable colors
- FAIL: Duplicate colors OR visually indistinguishable colors at dot size

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic + Human verification (visual distinction)

---

### EVL-P6-02b: Default Color Assignment for New Supplements

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-02b |
| **Source** | SC9 (edge case) |
| **Category** | Calendar Supplement Dots |
| **Priority** | Medium |

**Preconditions:**
1. Some palette colors are already assigned to existing supplements

**Test Steps:**
1. Create a new supplement without explicitly choosing a color
2. Check the assigned color
3. Verify it does not duplicate an existing supplement's color (if palette permits)

**Expected Result:**
- New supplement receives a default color from the palette
- System selects the next available unused color when possible

**Pass/Fail Criteria:**
- PASS: Color assigned automatically AND is a valid palette color
- FAIL: No color assigned OR null color causes rendering errors

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-03: Day Detail Supplement Checklist (SC2)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-03 |
| **Source** | SC2 |
| **Category** | Supplement Checklist & Batch |
| **Priority** | Critical |

**Preconditions:**
1. 4 supplements are scheduled for the test date
2. None have been logged yet (all pending)

**Test Steps:**
1. Navigate to calendar view
2. Tap the test date to open day detail
3. Observe the supplement checklist section
4. Verify each supplement shows: checkbox, name, dose, time-of-day
5. Check the first supplement's checkbox
6. Verify the API call is made and the log is persisted
7. Uncheck the same supplement
8. Verify the log is reverted to pending

**Expected Result:**
- Day detail shows 4 supplements in a checklist format
- Each row has: unchecked checkbox, supplement name, dose value, time-of-day label
- Checking a box: fires POST to supplement log API with taken_at timestamp, checkbox shows checked
- Unchecking a box: deletes the log record, checkbox returns to unchecked
- supplement_logs table reflects the current state after each action

**Pass/Fail Criteria:**
- PASS: All 4 supplements listed with correct details AND check/uncheck persists correctly
- FAIL: Missing supplements OR check/uncheck does not persist OR wrong data in supplement_logs

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "date": "2026-04-05",
  "supplements": [
    {"name": "Vitamin D", "dose": "5000 IU", "time": "morning"},
    {"name": "Omega-3", "dose": "2g", "time": "morning"},
    {"name": "Magnesium", "dose": "400mg", "time": "evening"},
    {"name": "Zinc", "dose": "30mg", "time": "evening"}
  ]
}
```

---

### EVL-P6-04: Batch Mark All Taken (SC3)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-04 |
| **Source** | SC3 |
| **Category** | Supplement Checklist & Batch |
| **Priority** | High |

**Preconditions:**
1. 5 supplements are scheduled and pending for the test date

**Test Steps:**
1. Open day detail for the test date
2. Verify all 5 checkboxes are unchecked
3. Click "Mark All Taken"
4. Wait for the action to complete
5. Verify all 5 checkboxes are now checked
6. Query supplement_logs table for the test date
7. Verify 5 records exist with taken_at timestamps

**Expected Result:**
- All 5 supplement_logs records created with taken_at set to current timestamp
- All 5 checkboxes display as checked in the UI
- Calendar dot statuses update to green (taken) for all 5

**Pass/Fail Criteria:**
- PASS: 5 supplement_logs records created AND all checkboxes checked AND dots green
- FAIL: Fewer than 5 records OR any checkbox not checked OR API error

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "date": "2026-04-05",
  "pending_count": 5,
  "expected_logs_after": 5
}
```

---

### EVL-P6-04a: Batch Mark All with Some Already Taken (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-04a |
| **Source** | SC3 (edge case) |
| **Category** | Supplement Checklist & Batch |
| **Priority** | High |

**Preconditions:**
1. 5 supplements scheduled: 2 already logged as taken, 3 pending

**Test Steps:**
1. Open day detail
2. Verify 2 checkboxes checked, 3 unchecked
3. Click "Mark All Taken"
4. Verify behavior

**Expected Result:**
- Only the 3 pending supplements get new log records
- The 2 already-taken supplements are not duplicated
- Total supplement_logs for the day: 5 (2 pre-existing + 3 new)
- All 5 checkboxes now checked

**Pass/Fail Criteria:**
- PASS: Only 3 new log records created AND no duplicates AND all 5 checked
- FAIL: Duplicate logs for already-taken supplements OR fewer than expected new logs

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-04b: Individual Override After Batch Mark (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-04b |
| **Source** | SC3 (edge case) |
| **Category** | Supplement Checklist & Batch |
| **Priority** | Medium |

**Preconditions:**
1. "Mark All Taken" has been executed for 5 supplements

**Test Steps:**
1. After batch mark, uncheck one supplement (e.g., "Magnesium")
2. Verify that supplement's log is removed/reverted
3. Verify the other 4 remain checked

**Expected Result:**
- Magnesium log deleted; checkbox unchecked
- Other 4 supplements unaffected; checkboxes remain checked
- supplement_logs table shows 4 records for the day

**Pass/Fail Criteria:**
- PASS: Single supplement reverted without affecting others
- FAIL: Other supplements affected OR batch state corrupted

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-05: Monthly Compliance Heatmap (SC10)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-05 |
| **Source** | SC10 |
| **Category** | Compliance Heatmap |
| **Priority** | High |

**Preconditions:**
1. Calendar view shows April 2026
2. 3 supplements are scheduled daily
3. Test data:
   - April 1: all 3 taken (100% compliance)
   - April 2: 2 of 3 taken (partial compliance)
   - April 3: 0 of 3 taken (no compliance)
   - April 4: no supplements scheduled (n/a)

**Test Steps:**
1. Navigate to calendar view for April 2026
2. Inspect background tint of each test date cell
3. Compare against expected compliance states

**Expected Result:**
- April 1 cell: subtle green background tint (all taken)
- April 2 cell: subtle amber background tint (partial)
- April 3 cell: no tint (nothing logged)
- April 4 cell: no tint (no supplements scheduled)

**Pass/Fail Criteria:**
- PASS: All 4 cells have correct tint state
- FAIL: Any cell has wrong tint

**Automation Level:** Automated (CSS background-color inspection)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "month": "2026-04",
  "cells": [
    {"date": "2026-04-01", "compliance": 1.0, "expected_tint": "green"},
    {"date": "2026-04-02", "compliance": 0.67, "expected_tint": "amber"},
    {"date": "2026-04-03", "compliance": 0.0, "expected_tint": "none"},
    {"date": "2026-04-04", "scheduled": 0, "expected_tint": "none"}
  ]
}
```

---

### EVL-P6-05a: Heatmap for Current Day with Pending Evening Supplements (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-05a |
| **Source** | SC10, OQ6 |
| **Category** | Compliance Heatmap |
| **Priority** | Medium |

**Preconditions:**
1. Current day has 3 morning supplements (all taken) and 2 evening supplements (pending)

**Test Steps:**
1. View calendar at midday
2. Observe the current day's cell tint

**Expected Result:**
- Cell shows amber (partial) since evening supplements are still pending
- OR cell shows green with a time-aware indicator (if compliance is calculated only for supplements whose scheduled time has passed)
- Behavior is consistent and documented

**Pass/Fail Criteria:**
- PASS: Tint accurately reflects current compliance state with clear, consistent logic
- FAIL: Tint shows 100% when supplements are still pending with no explanation

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic + Human verification

---

### EVL-P6-05b: Heatmap Backward Compatibility (Regression)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-05b |
| **Source** | SC10, C9 |
| **Category** | Compliance Heatmap |
| **Priority** | High |

**Preconditions:**
1. Calendar component was previously using activeDates Set<string> prop
2. Existing calendar functionality (food logging, training dots) still works

**Test Steps:**
1. Load calendar with supplement dots AND existing data (food entries, training sessions)
2. Verify existing green activity dots still render for days with food/training data
3. Verify supplement dots are additive, not replacing existing functionality

**Expected Result:**
- Existing calendar behavior preserved
- Supplement dots render alongside existing activity indicators
- No regression in day selection or day detail navigation

**Pass/Fail Criteria:**
- PASS: Existing calendar features work AND new supplement dots render
- FAIL: Existing features broken OR dots interfere with each other

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 4. Cluster 2 — Multi-Source Food Diary

### EVL-P6-06: Multi-Source Food Search (SC4)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-06 |
| **Source** | SC4 |
| **Category** | Multi-Source Food Search |
| **Priority** | Critical |

**Preconditions:**
1. USDA API key configured
2. OpenFoodFacts API accessible
3. Food search endpoint is available

**Test Steps:**
1. Search "chicken breast" via food search API
2. Verify USDA results are returned
3. Search "Coca-Cola" via food search API
4. Verify OpenFoodFacts results are returned for the branded product
5. Check that each result includes a source field

**Expected Result:**
- "chicken breast" returns USDA results with source: "usda"
- "Coca-Cola" returns OpenFoodFacts results with source: "openfoodfacts"
- Results from both sources can appear in the same search when both have matches
- Each result object includes a `source` field

**Pass/Fail Criteria:**
- PASS: Both sources return results AND each result has a source identifier
- FAIL: Only one source returns results OR source field missing

**Automation Level:** Automated (API test)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "searches": [
    {"query": "chicken breast", "expected_source": "usda"},
    {"query": "Coca-Cola", "expected_source": "openfoodfacts"}
  ]
}
```

---

### EVL-P6-06a: Unified Search Result Ordering (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-06a |
| **Source** | SC4, SC11 |
| **Category** | Multi-Source Food Search |
| **Priority** | Medium |

**Preconditions:**
1. Both USDA and OpenFoodFacts have results for a common food (e.g., "milk")

**Test Steps:**
1. Search "milk"
2. Observe result ordering
3. Check that USDA results appear first (primary source)
4. Check that OpenFoodFacts results follow

**Expected Result:**
- USDA results displayed before OpenFoodFacts results
- Each result clearly labeled with source badge
- No duplicate results from both sources for the same food

**Pass/Fail Criteria:**
- PASS: USDA-first ordering AND source badges visible AND no obvious duplicates
- FAIL: Random ordering OR missing source badges

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-06b: OpenFoodFacts API Failure Graceful Degradation (Negative)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-06b |
| **Source** | SC4 (negative), C7 |
| **Category** | Multi-Source Food Search |
| **Priority** | High |

**Preconditions:**
1. OpenFoodFacts API is unreachable (simulated timeout or error)
2. USDA API is functional

**Test Steps:**
1. Search "chicken breast" with OpenFoodFacts API unavailable
2. Observe search behavior

**Expected Result:**
- USDA results still return successfully
- No error shown to user (degraded mode, not broken mode)
- Optional: subtle indicator that secondary source is unavailable
- Search does not hang or timeout excessively

**Pass/Fail Criteria:**
- PASS: USDA results returned within normal latency AND no user-facing error
- FAIL: Search fails entirely OR hangs beyond 5s waiting for OpenFoodFacts

**Automation Level:** Automated (mock OpenFoodFacts failure)

**Scorer Type:** Algorithmic

---

### EVL-P6-07: OpenFoodFacts Results Cached (C7)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-07 |
| **Source** | C7 |
| **Category** | Multi-Source Food Search |
| **Priority** | High |

**Preconditions:**
1. OpenFoodFacts API accessible
2. Cache is empty for the test query

**Test Steps:**
1. Search "Coca-Cola" (first time - cache miss)
2. Verify API call made to OpenFoodFacts
3. Search "Coca-Cola" again (second time - should be cache hit)
4. Verify no new API call to OpenFoodFacts
5. Verify results are identical

**Expected Result:**
- First search: API call to OpenFoodFacts, results cached
- Second search: results served from cache, no external API call
- Results are identical between both searches

**Pass/Fail Criteria:**
- PASS: Second search uses cache AND results match
- FAIL: Cache miss on second search OR results differ

**Automation Level:** Automated (API call counting)

**Scorer Type:** Algorithmic

---

### EVL-P6-08: AI Macro Estimation (SC5)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-08 |
| **Source** | SC5 |
| **Category** | AI Macro Estimation |
| **Priority** | Critical |

**Preconditions:**
1. LLM API key configured as Wrangler secret
2. AI estimation endpoint is available

**Test Steps:**
1. Submit free-text food description: "large bowl of chicken fried rice"
2. Trigger "Calculate" action
3. Inspect returned macro data
4. Verify source badge

**Expected Result:**
- API returns estimated values for: calories, protein, carbs, fat, fiber
- All values are positive numbers (sanity check)
- Calories are in a plausible range (400-900 kcal for a large bowl of fried rice)
- Source badge shows "AI" or "AI estimate"
- Response completes within 10 seconds (LLM call latency)

**Pass/Fail Criteria:**
- PASS: All 5 macro values returned AND plausible range AND "AI" source badge AND response < 10s
- FAIL: Missing macro values OR wildly implausible values OR wrong source badge OR timeout

**Automation Level:** Automated (API test with plausibility checks)

**Scorer Type:** Algorithmic (range validation)

**Test Data:**
```json
{
  "description": "large bowl of chicken fried rice",
  "expected_ranges": {
    "calories": [400, 900],
    "protein": [15, 50],
    "carbs": [40, 120],
    "fat": [10, 40],
    "fiber": [1, 10]
  },
  "expected_source": "ai",
  "max_response_ms": 10000
}
```

---

### EVL-P6-08a: AI Estimation with Vague Description (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-08a |
| **Source** | SC5 (edge case) |
| **Category** | AI Macro Estimation |
| **Priority** | Medium |

**Preconditions:**
1. AI estimation endpoint available

**Test Steps:**
1. Submit vague description: "some food"
2. Trigger Calculate

**Expected Result:**
- System either: returns a best-effort estimate with lower confidence, OR returns an error indicating the description is too vague to estimate
- No crash or unhandled error

**Pass/Fail Criteria:**
- PASS: Graceful handling (estimate or clear error message)
- FAIL: Crash, 500 error, or nonsensical output (e.g., negative calories)

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-08b: AI Estimation When LLM API Key Missing (Negative)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-08b |
| **Source** | SC5 (negative), C8 |
| **Category** | AI Macro Estimation |
| **Priority** | High |

**Preconditions:**
1. LLM API key is not configured (missing secret)

**Test Steps:**
1. Submit food description and trigger Calculate
2. Observe error handling

**Expected Result:**
- Clear error message: "AI estimation is not configured" or similar
- No leaked API key details or stack traces
- Manual entry remains available as fallback

**Pass/Fail Criteria:**
- PASS: User-friendly error message AND manual entry still works
- FAIL: 500 error with stack trace OR silent failure with no feedback

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-09: Deferred Calculation Batch (SC6)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-09 |
| **Source** | SC6 |
| **Category** | Deferred Calculation |
| **Priority** | Critical |

**Preconditions:**
1. User is authenticated
2. Both USDA/OpenFoodFacts APIs and AI estimation are available

**Test Steps:**
1. Add food entry "grilled chicken breast" as text-only (no macros)
2. Add food entry "Coca-Cola 330ml" as text-only (no macros)
3. Add food entry "homemade pasta with meat sauce" as text-only (no macros)
4. Verify all 3 entries exist with null macro values
5. Click "Calculate All"
6. Wait for batch processing to complete
7. Verify macro data is populated for all 3 entries
8. Verify daily totals update

**Expected Result:**
- "grilled chicken breast" resolved via USDA (source: "usda")
- "Coca-Cola 330ml" resolved via OpenFoodFacts (source: "openfoodfacts")
- "homemade pasta with meat sauce" resolved via AI estimation (source: "ai")
- All 3 entries now have non-null calories, protein, carbs, fat, fiber
- Daily totals reflect the sum of all 3 entries

**Pass/Fail Criteria:**
- PASS: All 3 entries resolved with macros AND correct source assignments AND daily totals updated
- FAIL: Any entry unresolved OR wrong source assignment OR totals incorrect

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "entries": [
    {"text": "grilled chicken breast", "expected_source": "usda"},
    {"text": "Coca-Cola 330ml", "expected_source": "openfoodfacts"},
    {"text": "homemade pasta with meat sauce", "expected_source": "ai"}
  ]
}
```

---

### EVL-P6-09a: Calculate All with Partial Failures (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-09a |
| **Source** | SC6 (edge case), OQ5 |
| **Category** | Deferred Calculation |
| **Priority** | High |

**Preconditions:**
1. 3 text-only food entries exist
2. AI estimation is unavailable (simulated failure)
3. USDA and OpenFoodFacts are available

**Test Steps:**
1. Add "chicken breast" (USDA-resolvable), "xyznotafood999" (unresolvable), "banana" (USDA-resolvable)
2. Click "Calculate All"
3. Observe results

**Expected Result:**
- "chicken breast" and "banana" resolve successfully with macros
- "xyznotafood999" shows an error indicator (e.g., "Could not resolve")
- Successfully resolved entries have correct daily totals
- User can retry the failed entry or manually enter macros

**Pass/Fail Criteria:**
- PASS: 2 of 3 resolved AND failed entry clearly indicated AND no data loss
- FAIL: Entire batch fails OR successful entries lost OR no error indication

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-09b: Text-Only Entries Show Zero in Daily Totals (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-09b |
| **Source** | SC6 (edge case) |
| **Category** | Deferred Calculation |
| **Priority** | Medium |

**Preconditions:**
1. 2 text-only food entries exist with null macros

**Test Steps:**
1. View daily food summary
2. Check daily totals
3. Verify text-only entries are listed but contribute 0 to totals

**Expected Result:**
- Text-only entries appear in the food list (visible, not hidden)
- Daily totals show 0 calories, 0 protein, etc. (null macros treated as 0)
- Visual indicator (e.g., dashed border, grayed text) distinguishes unresolved entries

**Pass/Fail Criteria:**
- PASS: Entries visible AND totals are 0 AND visual distinction for unresolved
- FAIL: Entries hidden OR totals show NaN/undefined OR no visual distinction

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-10: Food Source Badge Display (SC7)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-10 |
| **Source** | SC7 |
| **Category** | Source Badge & Manual Override |
| **Priority** | High |

**Preconditions:**
1. 4 food entries exist for the test date, each from a different source:
   - Entry A: from USDA search
   - Entry B: from OpenFoodFacts search
   - Entry C: from AI estimation
   - Entry D: manually entered macros

**Test Steps:**
1. Navigate to daily food log for the test date
2. Inspect each food entry for source badge
3. Verify badge text matches the data source

**Expected Result:**
- Entry A: badge reads "USDA"
- Entry B: badge reads "OFF"
- Entry C: badge reads "AI"
- Entry D: badge reads "Manual"
- All badges are visible without requiring tap/hover

**Pass/Fail Criteria:**
- PASS: All 4 badges display correct source text AND are visible
- FAIL: Any badge missing OR wrong source text

**Automation Level:** Automated (DOM inspection)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "entries": [
    {"source": "usda", "expected_badge": "USDA"},
    {"source": "openfoodfacts", "expected_badge": "OFF"},
    {"source": "ai", "expected_badge": "AI"},
    {"source": "manual", "expected_badge": "Manual"}
  ]
}
```

---

### EVL-P6-11: Manual Macro Override (SC8)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-11 |
| **Source** | SC8 |
| **Category** | Source Badge & Manual Override |
| **Priority** | High |

**Preconditions:**
1. A food entry exists with USDA-sourced data: 200 calories

**Test Steps:**
1. Tap the food entry to open edit form
2. Change calories from 200 to 250
3. Change protein from 30 to 35
4. Save changes
5. Verify the entry is updated in the database
6. Verify source badge changes to "Manual"
7. Verify daily totals reflect the new values

**Expected Result:**
- Food entry calories: 250 (was 200)
- Food entry protein: 35 (was 30)
- Source field: "manual" (was "usda")
- Source badge: "Manual"
- Daily totals recalculated with new values

**Pass/Fail Criteria:**
- PASS: Values updated AND source changed to "manual" AND totals recalculated
- FAIL: Values not persisted OR source unchanged OR totals stale

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "original": {"calories": 200, "protein": 30, "source": "usda"},
  "updated": {"calories": 250, "protein": 35, "source": "manual"}
}
```

---

### EVL-P6-11a: Override AI-Estimated Entry (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-11a |
| **Source** | SC8 (edge case) |
| **Category** | Source Badge & Manual Override |
| **Priority** | Medium |

**Preconditions:**
1. A food entry with source "ai" exists

**Test Steps:**
1. Open edit form for the AI-estimated entry
2. Modify only the fat value
3. Save

**Expected Result:**
- Fat value updated; other macros unchanged
- Source changes from "ai" to "manual"
- No data loss on unchanged fields

**Pass/Fail Criteria:**
- PASS: Single field updated AND source changed AND other fields intact
- FAIL: Other macro fields reset OR source unchanged

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-10a: Source Badge for Pre-Phase-6 Entries (Backward Compatibility)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-10a |
| **Source** | SC7, C10, A8 |
| **Category** | Source Badge & Manual Override |
| **Priority** | High |

**Preconditions:**
1. Existing food_entries from Phase 3-5 have no `source` column (or null values)

**Test Steps:**
1. View a food entry that was created before Phase 6
2. Inspect its source badge

**Expected Result:**
- Pre-existing entries display badge "USDA" (default assumption per A8)
- No rendering errors for null source values
- Entry remains fully functional (editable, deletable)

**Pass/Fail Criteria:**
- PASS: Default badge displayed AND no errors AND entry functional
- FAIL: Missing badge OR rendering error OR broken entry

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 5. Data Integrity (Phase 6 Specific)

### EVL-P6-DI-01: Supplement Color Column Migration

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-DI-01 |
| **Source** | C4, C6 |
| **Category** | Data Integrity |
| **Priority** | Critical |

**Preconditions:**
1. Existing supplements table has data from Phases 1-5
2. Migration adds `color` column to supplements table

**Test Steps:**
1. Apply Phase 6 migration
2. Query existing supplements
3. Verify all existing supplements retain their data
4. Verify `color` column exists with default value
5. Verify existing supplement CRUD endpoints still work

**Expected Result:**
- All pre-existing supplement records intact (no data loss)
- New `color` column defaults to null or a default palette color
- Existing CRUD endpoints (GET, POST, PUT, DELETE) function without changes

**Pass/Fail Criteria:**
- PASS: Zero data loss AND column added AND existing APIs work
- FAIL: Any data loss OR migration failure OR API regression

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-DI-02: Food Source Column Migration

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-DI-02 |
| **Source** | C10, C6 |
| **Category** | Data Integrity |
| **Priority** | Critical |

**Preconditions:**
1. Existing food_entries table has data from Phases 3-5
2. Migration adds `source` column to food_entries table

**Test Steps:**
1. Apply Phase 6 migration
2. Query existing food entries
3. Verify all existing entries retain their data
4. Verify `source` column exists
5. Verify existing food entry CRUD endpoints still work

**Expected Result:**
- All pre-existing food_entries intact
- New `source` column defaults to "usda" for existing rows (per A8)
- Existing food entry API (GET, POST, DELETE) functions without changes

**Pass/Fail Criteria:**
- PASS: Zero data loss AND column added with correct default AND existing APIs work
- FAIL: Any data loss OR migration failure OR API regression

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-P6-DI-03: Daily Summary API Backward Compatibility

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-DI-03 |
| **Source** | A5, C9 |
| **Category** | Data Integrity |
| **Priority** | High |

**Preconditions:**
1. Daily summary API extended with supplement dot data

**Test Steps:**
1. Call GET /api/daily-summary/:date
2. Verify the response contains all existing fields (supplements, nutrition, training, metrics, journal)
3. Verify new fields are additive (supplementDots or similar)
4. Verify no existing fields renamed or removed

**Expected Result:**
- Response shape is a superset of the Phase 5 shape
- All existing fields present with same types and names
- New Phase 6 data included as additional fields

**Pass/Fail Criteria:**
- PASS: All existing fields present AND new fields additive
- FAIL: Any existing field missing or renamed

**Automation Level:** Automated (response schema validation)

**Scorer Type:** Algorithmic

---

### EVL-P6-DI-04: Batch Mark All Taken Atomicity

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-P6-DI-04 |
| **Source** | A7, C5 |
| **Category** | Data Integrity |
| **Priority** | High |

**Preconditions:**
1. 10 supplements scheduled for a day (testing D1 batch limits)

**Test Steps:**
1. Click "Mark All Taken" with 10 pending supplements
2. Verify all 10 log records created
3. If the operation fails mid-batch, verify either all succeed or all fail (atomicity)

**Expected Result:**
- All 10 records created within Workers CPU time limit (30s)
- Operation uses D1 batch for atomicity
- No partial state (e.g., 7 of 10 created)

**Pass/Fail Criteria:**
- PASS: All 10 records OR zero records (atomic) AND within CPU time limit
- FAIL: Partial records created OR timeout

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 6. Test Environment Requirements

| Requirement | Specification |
|-------------|---------------|
| **Primary Device** | Android phone (API level 29+) with Chrome |
| **Viewport** | 375px mobile + 1024px desktop |
| **Database** | Cloudflare D1 staging instance with Phase 6 migration applied |
| **USDA API** | Connected with valid API key |
| **OpenFoodFacts API** | Connected (public, no key required) |
| **LLM API** | Anthropic or OpenAI key configured as Wrangler secret |
| **Test Data** | Seed script with 10+ supplements, 4 schedule types, 30 days of existing data |

## 7. Automation Strategy

| Level | Count | Approach |
|-------|-------|----------|
| **Fully Automated** | 24 | Vitest API tests + Playwright DOM inspection |
| **Semi-Automated** | 6 | Visual verification + mobile viewport testing |
| **Manual** | 2 | Color distinction judgment, UX flow verification |

## 8. Scorer Distribution

| Scorer Type | Count | Use Case |
|-------------|-------|----------|
| **Algorithmic** | 26 | Pass/fail on data, API responses, DOM state |
| **Algorithmic + Human** | 4 | Visual verification (dot overflow, color distinction, heatmap) |
| **Range Validation** | 2 | AI estimation plausibility checks |

---

## 9. Traceability Matrix

| Success Criterion | Eval Case(s) | Priority |
|-------------------|--------------|----------|
| SC1 (Calendar dots) | EVL-P6-01, EVL-P6-01a, EVL-P6-01b | Critical |
| SC2 (Supplement checklist) | EVL-P6-03 | Critical |
| SC3 (Batch mark all) | EVL-P6-04, EVL-P6-04a, EVL-P6-04b | High |
| SC4 (Multi-source search) | EVL-P6-06, EVL-P6-06a, EVL-P6-06b, EVL-P6-07 | Critical |
| SC5 (AI estimation) | EVL-P6-08, EVL-P6-08a, EVL-P6-08b | Critical |
| SC6 (Deferred calc) | EVL-P6-09, EVL-P6-09a, EVL-P6-09b | Critical |
| SC7 (Source badge) | EVL-P6-10, EVL-P6-10a | High |
| SC8 (Manual override) | EVL-P6-11, EVL-P6-11a | High |
| SC9 (Color persistence) | EVL-P6-02, EVL-P6-02a, EVL-P6-02b | High |
| SC10 (Compliance heatmap) | EVL-P6-05, EVL-P6-05a, EVL-P6-05b | High |
| Data Integrity | EVL-P6-DI-01 to DI-04 | Critical/High |

---

*Document generated by Architect | Wolf Pack Protocol*
