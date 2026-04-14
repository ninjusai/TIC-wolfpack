---
title: "PeakProtocol Eval Specification"
version: "1.0.0"
status: draft
eval-id: EVL-peakprotocol-001
references: PRB-peakprotocol-001
created: 2026-04-01
author: Eval
domain: health-tracking
total-cases: 24
---

# Eval Specification: PeakProtocol

## 1. Overview

This document defines the evaluation specification for PeakProtocol, a personal health optimization platform. It transforms the 12 success criteria from PRB-peakprotocol-001 into formal, testable eval cases, plus additional negative tests, edge cases, and data integrity validations.

## 2. Eval Summary

| Category | Primary Cases | Additional Cases | Total |
|----------|---------------|------------------|-------|
| Compliance | 2 | 2 | 4 |
| Scheduling | 2 | 2 | 4 |
| Nutrition | 2 | 2 | 4 |
| Training | 1 | 1 | 2 |
| Reporting | 2 | 1 | 3 |
| Mobile | 3 | 1 | 4 |
| Data Integrity | 0 | 3 | 3 |
| **Total** | **12** | **12** | **24** |

---

## 3. Eval Cases - Compliance

### EVL-01: Dashboard Compliance Indicator (SC-01)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-01 |
| **Source** | SC-01 |
| **Category** | Compliance |
| **Priority** | Critical |

**Preconditions:**
1. User is authenticated and has an active session
2. At least one supplement is configured with a scheduled time
3. The scheduled time has passed without the supplement being marked complete
4. Dashboard view is accessible

**Test Steps:**
1. Configure a supplement "Vitamin D" scheduled for 08:00
2. Allow scheduled time to pass without marking complete
3. Wait 2 hours after scheduled time (until 10:00)
4. Navigate to the compliance dashboard
5. Observe the compliance indicator for "Vitamin D"

**Expected Result:**
- Dashboard displays a red indicator next to "Vitamin D"
- The supplement name "Vitamin D" is explicitly visible
- Indicator appears within the 2-hour window (not requiring manual refresh)

**Pass/Fail Criteria:**
- PASS: Red indicator visible AND supplement name displayed AND indicator appeared within 2 hours of missed time
- FAIL: Any of the above conditions not met

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "supplement": "Vitamin D",
  "scheduled_time": "08:00",
  "check_time": "10:00",
  "expected_indicator": "red"
}
```

---

### EVL-02: Missed Supplement Notification (SC-02)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-02 |
| **Source** | SC-02 |
| **Category** | Compliance |
| **Priority** | Critical |

**Preconditions:**
1. User has push notifications enabled (or in-app notifications configured)
2. At least one supplement is scheduled with a specific time
3. Device has notification permissions granted
4. App is in background or closed state

**Test Steps:**
1. Configure supplement "Omega-3" scheduled for 12:00
2. Ensure notification preferences are enabled
3. Do not interact with the app at 12:00
4. Monitor notification stream for 30 minutes after scheduled time
5. Record notification arrival time and content

**Expected Result:**
- Push or in-app notification fires within 30 minutes of 12:00
- Notification clearly identifies "Omega-3" as the missed supplement
- Notification includes actionable prompt to log the supplement

**Pass/Fail Criteria:**
- PASS: Notification received within 30 minutes AND correct supplement identified
- FAIL: Notification delayed beyond 30 minutes OR wrong/no supplement identified

**Automation Level:** Semi-automated (requires notification monitoring tool)

**Scorer Type:** Algorithmic + Human verification

**Test Data:**
```json
{
  "supplement": "Omega-3",
  "scheduled_time": "12:00",
  "max_notification_delay_minutes": 30
}
```

---

### EVL-02a: Compliance with All Items Complete (Negative Test)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-02a |
| **Source** | SC-01, SC-02 (negative) |
| **Category** | Compliance |
| **Priority** | High |

**Preconditions:**
1. User has 3 supplements scheduled for the day
2. All supplements have been marked as complete on time

**Test Steps:**
1. Configure 3 supplements with morning, noon, and evening times
2. Mark each supplement complete within their scheduled windows
3. Navigate to compliance dashboard
4. Check notification history

**Expected Result:**
- Dashboard shows all green indicators
- No missed-supplement notifications were sent
- Overall compliance status shows 100%

**Pass/Fail Criteria:**
- PASS: All indicators green AND no false-positive notifications
- FAIL: Any red/yellow indicators OR notification sent for completed supplement

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-02b: Notification Timing Boundary (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-02b |
| **Source** | SC-02 (edge case) |
| **Category** | Compliance |
| **Priority** | Medium |

**Preconditions:**
1. Supplement scheduled with exact minute precision
2. Notification system is active

**Test Steps:**
1. Schedule supplement for 14:00:00
2. Mark supplement complete at 14:00:30 (30 seconds after scheduled time)
3. Observe notification behavior
4. Repeat with completion at 13:59:30 (30 seconds before)

**Expected Result:**
- Completion within reasonable grace window (e.g., 5 minutes) should NOT trigger notification
- System should have configurable grace period

**Pass/Fail Criteria:**
- PASS: No notification for completion within grace period
- FAIL: False-positive notification for on-time completion

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 4. Eval Cases - Scheduling

### EVL-03: Flexible Scheduling Accuracy (SC-03)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-03 |
| **Source** | SC-03 |
| **Category** | Scheduling |
| **Priority** | Critical |

**Preconditions:**
1. User is authenticated
2. Calendar view component is available
3. Current date is known and consistent for test

**Test Steps:**
1. Create supplement "Creatine" with DAILY schedule starting today
2. Create supplement "BPC-157" with every-2-day schedule starting today
3. Create supplement "MK-677" with every-3-day schedule starting today
4. Create supplement "B12 Injection" with WEEKLY schedule (Sundays) starting this week
5. Navigate to calendar/schedule view
6. Scroll through 30-day lookahead
7. Record scheduled dates for each supplement

**Expected Result:**
- Creatine: appears on all 30 days
- BPC-157: appears on days 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29 (15 occurrences)
- MK-677: appears on days 1, 4, 7, 10, 13, 16, 19, 22, 25, 28 (10 occurrences)
- B12 Injection: appears on all Sundays within 30-day window (4-5 occurrences)

**Pass/Fail Criteria:**
- PASS: All supplements show correct dates for their respective patterns
- FAIL: Any scheduling calculation error

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "schedules": [
    {"name": "Creatine", "pattern": "daily", "expected_count": 30},
    {"name": "BPC-157", "pattern": "every_2_days", "expected_count": 15},
    {"name": "MK-677", "pattern": "every_3_days", "expected_count": 10},
    {"name": "B12 Injection", "pattern": "weekly", "day": "sunday"}
  ],
  "lookahead_days": 30
}
```

---

### EVL-04: Dose Titration History (SC-04)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-04 |
| **Source** | SC-04 |
| **Category** | Scheduling |
| **Priority** | High |

**Preconditions:**
1. User has an existing supplement with an established dose
2. System supports dose modification with history tracking
3. Date/time can be simulated or test spans actual 2-week period

**Test Steps:**
1. Create supplement "Testosterone" with initial dose "100mg"
2. Record creation timestamp
3. After simulated/actual 5 days, change dose to "125mg"
4. Record modification timestamp
5. After simulated/actual 5 more days, change dose to "150mg"
6. Record modification timestamp
7. After simulated/actual 4 more days, change dose to "175mg"
8. Record modification timestamp
9. Navigate to dose history view for "Testosterone"

**Expected Result:**
- History shows 4 entries (initial + 3 changes)
- Each entry displays: dose value, effective date, timestamp
- Entries are in chronological order
- All 3 dose change events are preserved with accurate timestamps

**Pass/Fail Criteria:**
- PASS: All 3 dose changes visible with correct values and timestamps
- FAIL: Missing entries OR incorrect values OR missing/wrong timestamps

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "supplement": "Testosterone",
  "dose_history": [
    {"dose": "100mg", "day": 0},
    {"dose": "125mg", "day": 5},
    {"dose": "150mg", "day": 10},
    {"dose": "175mg", "day": 14}
  ]
}
```

---

### EVL-03a: Schedule with Start Date in Future (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-03a |
| **Source** | SC-03 (edge case) |
| **Category** | Scheduling |
| **Priority** | Medium |

**Preconditions:**
1. Current date is known
2. User can configure future start dates

**Test Steps:**
1. Create supplement with start date 7 days in future
2. Set pattern to every-2-days
3. View 30-day calendar from today
4. Verify no occurrences shown for first 7 days

**Expected Result:**
- First 7 days show no scheduled occurrence
- Day 8 shows first occurrence
- Subsequent occurrences follow every-2-day pattern

**Pass/Fail Criteria:**
- PASS: No premature occurrences AND correct pattern after start date
- FAIL: Occurrences shown before start date OR wrong pattern

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-03b: Timezone Change Handling (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-03b |
| **Source** | SC-03, A-07 (edge case) |
| **Category** | Scheduling |
| **Priority** | Medium |

**Preconditions:**
1. User has supplements scheduled with specific times
2. Device timezone can be changed

**Test Steps:**
1. Configure supplement for 09:00 in timezone UTC-5
2. Change device timezone to UTC+3 (8 hour difference)
3. Check scheduled time display
4. Verify compliance calculation uses correct local time

**Expected Result:**
- System either: (a) converts time to new timezone, OR (b) maintains original time with clear indication
- Compliance calculations remain consistent
- No duplicate or missed notifications due to timezone shift

**Pass/Fail Criteria:**
- PASS: Consistent behavior with clear timezone handling
- FAIL: Ambiguous times OR compliance errors OR duplicate notifications

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic + Human verification

---

## 5. Eval Cases - Nutrition

### EVL-05: Food Macro Calculation Accuracy (SC-05)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-05 |
| **Source** | SC-05 |
| **Category** | Nutrition |
| **Priority** | Critical |

**Preconditions:**
1. Food database/API is connected and functional
2. USDA reference values are available for comparison
3. User can search and add foods

**Test Steps:**
1. Search for "chicken breast"
2. Select plain cooked chicken breast entry
3. Enter quantity: 200g
4. Submit food entry
5. Record returned values for: calories, protein, carbs, fat
6. Compare against USDA FoodData Central values for same food/quantity

**Expected Result:**
- USDA reference for 200g cooked chicken breast (approximate):
  - Calories: 330 kcal
  - Protein: 62g
  - Carbs: 0g
  - Fat: 7g
- System values within 5% of USDA values

**Pass/Fail Criteria:**
- PASS: All macro values within +/- 5% of USDA reference
- FAIL: Any value outside 5% tolerance

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "food": "chicken breast, cooked",
  "quantity_g": 200,
  "usda_reference": {
    "calories": 330,
    "protein_g": 62,
    "carbs_g": 0,
    "fat_g": 7
  },
  "tolerance_percent": 5
}
```

---

### EVL-06: Quick-Add Saved Foods (SC-06)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-06 |
| **Source** | SC-06 |
| **Category** | Nutrition |
| **Priority** | High |

**Preconditions:**
1. User has previously saved at least one food to their library
2. User is starting from the main dashboard
3. Tap counter or screen recording is available

**Test Steps:**
1. Start from main dashboard (Tap 0)
2. Navigate to food logging section (Tap 1)
3. Access saved foods / quick-add menu (Tap 2)
4. Select saved food item (Tap 3)
5. Confirm/log the entry (Tap 4 if required)
6. Count total taps to complete entry

**Expected Result:**
- Food entry logged successfully
- Total taps required: 3 or fewer
- No additional screens or confirmations required beyond 3 taps

**Pass/Fail Criteria:**
- PASS: Entry logged in 3 taps or fewer from dashboard
- FAIL: More than 3 taps required

**Automation Level:** Semi-automated (UI automation + tap counting)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "saved_food": "Protein Shake",
  "max_taps": 3,
  "start_screen": "dashboard"
}
```

---

### EVL-05a: Unknown Food Search (Negative Test)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-05a |
| **Source** | SC-05 (negative) |
| **Category** | Nutrition |
| **Priority** | Medium |

**Preconditions:**
1. Food database is connected
2. Search functionality is available

**Test Steps:**
1. Search for a nonsensical food name "xyzfoodnotexist123"
2. Observe search results
3. Verify system behavior

**Expected Result:**
- System returns "no results found" message
- User is offered option to manually add custom food
- No crash or error state

**Pass/Fail Criteria:**
- PASS: Graceful handling with no-results message and manual entry option
- FAIL: Crash, error, or misleading results

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-05b: Partial Quantity Entry (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-05b |
| **Source** | SC-05 (edge case) |
| **Category** | Nutrition |
| **Priority** | Medium |

**Preconditions:**
1. Food can be selected
2. Quantity input field is available

**Test Steps:**
1. Search for and select "rice"
2. Enter quantity as "0.5 cups"
3. Submit entry
4. Verify macro calculations

**Expected Result:**
- System accepts fractional quantities
- Macros calculated proportionally (half of 1 cup values)
- Entry logged correctly

**Pass/Fail Criteria:**
- PASS: Fractional quantity accepted and macros scaled correctly
- FAIL: Rejection of fractional input OR incorrect calculation

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 6. Eval Cases - Training

### EVL-08: Multi-Modal Training Logs (SC-08)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-08 |
| **Source** | SC-08 |
| **Category** | Training |
| **Priority** | High |

**Preconditions:**
1. User can access training log functionality
2. Multiple training types are supported
3. Week view/summary is available

**Test Steps:**
1. Log a WEIGHT TRAINING session:
   - Exercises: Squat (3x5x225lbs), Bench (3x5x185lbs)
   - Duration: 60 minutes
   - Date: Monday of test week
2. Log a BJJ session:
   - Duration: 90 minutes
   - Intensity: High
   - Notes: "Focused on guard passing"
   - Date: Wednesday of test week
3. Log a CARDIO/WALK session:
   - Type: Walk
   - Duration: 45 minutes
   - Distance: 3 miles
   - Date: Friday of test week
4. Navigate to weekly summary view

**Expected Result:**
- Weekly summary shows all 3 workout types
- Weight training entry shows: exercises, sets, reps, weight
- BJJ entry shows: duration, intensity, notes
- Walk entry shows: duration, distance, type
- All entries have correct dates

**Pass/Fail Criteria:**
- PASS: All 3 modalities visible in summary with appropriate fields captured
- FAIL: Missing modality OR missing required fields

**Automation Level:** Automated

**Scorer Type:** Algorithmic + Human verification for completeness

**Test Data:**
```json
{
  "workouts": [
    {
      "type": "weight_training",
      "day": "monday",
      "exercises": [
        {"name": "Squat", "sets": 3, "reps": 5, "weight": "225lbs"},
        {"name": "Bench", "sets": 3, "reps": 5, "weight": "185lbs"}
      ],
      "duration_minutes": 60
    },
    {
      "type": "bjj",
      "day": "wednesday",
      "duration_minutes": 90,
      "intensity": "high",
      "notes": "Focused on guard passing"
    },
    {
      "type": "cardio",
      "day": "friday",
      "subtype": "walk",
      "duration_minutes": 45,
      "distance_miles": 3
    }
  ]
}
```

---

### EVL-08a: Empty Training Week (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-08a |
| **Source** | SC-08 (edge case) |
| **Category** | Training |
| **Priority** | Low |

**Preconditions:**
1. User has not logged any training for the current week
2. Weekly summary view is accessible

**Test Steps:**
1. Ensure no training entries exist for current week
2. Navigate to weekly training summary
3. Observe display behavior

**Expected Result:**
- System displays empty state gracefully
- Message indicates "No workouts logged this week"
- Option to add workout is visible
- No errors or blank screen

**Pass/Fail Criteria:**
- PASS: Graceful empty state with call-to-action
- FAIL: Error, crash, or confusing display

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 7. Eval Cases - Reporting

### EVL-07: Weight Trend Visualization (SC-07)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-07 |
| **Source** | SC-07 |
| **Category** | Reporting |
| **Priority** | High |

**Preconditions:**
1. User can log daily weight
2. Charting/visualization component is available
3. Test data spans 14 consecutive days

**Test Steps:**
1. Log weight for 14 consecutive days:
   - Day 1: 185.0 lbs
   - Day 2: 184.8 lbs
   - Day 3: 185.2 lbs
   - Day 4: 184.5 lbs
   - Day 5: 184.3 lbs
   - Day 6: 184.0 lbs
   - Day 7: 184.2 lbs
   - Day 8: 183.8 lbs
   - Day 9: 183.5 lbs
   - Day 10: 183.7 lbs
   - Day 11: 183.2 lbs
   - Day 12: 183.0 lbs
   - Day 13: 182.8 lbs
   - Day 14: 182.5 lbs
2. Navigate to weight trend visualization
3. Verify graph display

**Expected Result:**
- Graph displays all 14 data points
- Trend line shows downward trajectory
- X-axis shows dates, Y-axis shows weight
- Data points are interactive/hoverable (if supported)

**Pass/Fail Criteria:**
- PASS: All 14 data points visible on graph with correct values
- FAIL: Missing data points OR incorrect values OR no trend line

**Automation Level:** Semi-automated (visual verification may be needed)

**Scorer Type:** Algorithmic + AI (for visual verification)

**Test Data:**
```json
{
  "weights": [185.0, 184.8, 185.2, 184.5, 184.3, 184.0, 184.2, 183.8, 183.5, 183.7, 183.2, 183.0, 182.8, 182.5],
  "expected_trend": "downward",
  "data_points_required": 14
}
```

---

### EVL-09: Pattern Correlation Report (SC-09)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-09 |
| **Source** | SC-09 |
| **Category** | Reporting |
| **Priority** | High |

**Preconditions:**
1. User has 30 days of food logging data with macro breakdown
2. User has 30 days of weight data
3. Pattern analysis feature is available

**Test Steps:**
1. Ensure 30 days of food data exists with varying macro ratios
2. Ensure 30 days of weight data exists showing changes
3. Navigate to pattern/correlation report
4. Generate macro vs. weight correlation analysis
5. Review report output

**Expected Result:**
- Report shows correlation analysis for:
  - Protein intake vs. weight delta
  - Carbohydrate intake vs. weight delta
  - Fat intake vs. weight delta
- Correlation coefficients or trend indicators displayed
- Visualizations (charts/graphs) support the analysis
- Time period (30 days) is clearly indicated

**Pass/Fail Criteria:**
- PASS: All three macro correlations analyzed and presented
- FAIL: Missing correlation OR no numerical/visual analysis

**Automation Level:** Semi-automated

**Scorer Type:** AI + Human verification

**Test Data:**
```json
{
  "data_period_days": 30,
  "required_correlations": ["protein_vs_weight", "carbs_vs_weight", "fat_vs_weight"],
  "minimum_data_points": 30
}
```

---

### EVL-09a: Insufficient Data for Pattern Report (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-09a |
| **Source** | SC-09 (edge case) |
| **Category** | Reporting |
| **Priority** | Medium |

**Preconditions:**
1. User has only 5 days of data (insufficient for meaningful correlation)

**Test Steps:**
1. With only 5 days of food and weight data
2. Attempt to generate correlation report
3. Observe system behavior

**Expected Result:**
- System indicates insufficient data
- Message specifies minimum data requirement (e.g., "Need at least 14 days of data")
- No misleading partial analysis shown

**Pass/Fail Criteria:**
- PASS: Clear insufficient-data message with guidance
- FAIL: Misleading analysis OR cryptic error

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

## 8. Eval Cases - Mobile

### EVL-10: Offline Functionality (SC-10)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-10 |
| **Source** | SC-10 |
| **Category** | Mobile |
| **Priority** | Critical |

**Preconditions:**
1. App is installed/accessible on Android device
2. Device can enable airplane mode
3. Initial data sync has occurred while online

**Test Steps:**
1. Ensure app is open and synced while online
2. Enable airplane mode on device
3. Log a supplement completion: "Creatine - completed"
4. Log a food entry: "Eggs - 3 large"
5. Log weight: "184.5 lbs"
6. Verify entries appear in local UI
7. Disable airplane mode (restore connection)
8. Wait for sync to complete
9. Verify data persists after sync (check on another device or web view if available)

**Expected Result:**
- All entries recorded locally while offline
- UI reflects entries immediately without errors
- After connection restored, data syncs successfully
- No data loss or duplication

**Pass/Fail Criteria:**
- PASS: All 3 entries persisted locally AND synced successfully when online
- FAIL: Any entry lost OR sync failure OR data duplication

**Automation Level:** Semi-automated (requires device manipulation)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "offline_entries": [
    {"type": "supplement", "name": "Creatine", "action": "completed"},
    {"type": "food", "name": "Eggs", "quantity": "3 large"},
    {"type": "weight", "value": "184.5 lbs"}
  ]
}
```

---

### EVL-11: Mobile Load Time (SC-11)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-11 |
| **Source** | SC-11 |
| **Category** | Mobile |
| **Priority** | High |

**Preconditions:**
1. App deployed to production/staging environment
2. Android device with Chrome browser
3. 4G network connection (or throttled to 4G speeds)
4. Performance monitoring tools available

**Test Steps:**
1. Clear browser cache and data for the app
2. Connect to 4G network (or simulate)
3. Start timer and navigate to dashboard URL
4. Record time to First Contentful Paint (FCP)
5. Record time to fully interactive
6. Navigate away from dashboard
7. Return to dashboard (warm load)
8. Record subsequent load time

**Expected Result:**
- Initial (cold) load: under 3 seconds to interactive
- Subsequent (warm) load: under 1 second to interactive

**Pass/Fail Criteria:**
- PASS: Initial load < 3s AND subsequent load < 1s
- FAIL: Initial load >= 3s OR subsequent load >= 1s

**Automation Level:** Automated (Lighthouse, WebPageTest, or similar)

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "network": "4G",
  "device": "Android Chrome",
  "initial_load_max_ms": 3000,
  "subsequent_load_max_ms": 1000,
  "metric": "time_to_interactive"
}
```

---

### EVL-12: Journal Search Performance (SC-12)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-12 |
| **Source** | SC-12 |
| **Category** | Mobile |
| **Priority** | Medium |

**Preconditions:**
1. User has created at least 10 journal entries
2. Entries have various tags applied
3. Search functionality is available

**Test Steps:**
1. Create 10 journal entries with tags: "energy", "sleep", "mood", "training", "diet"
2. Distribute tags: 3 entries with "energy", 2 with "sleep", 2 with "mood", 2 with "training", 1 with "diet"
3. Navigate to journal search
4. Start timer
5. Search by tag "energy"
6. Record time to results displayed
7. Verify correct entries returned

**Expected Result:**
- Search results returned within 500ms
- Exactly 3 entries with "energy" tag shown
- Results are accurate (no false positives/negatives)

**Pass/Fail Criteria:**
- PASS: Results in < 500ms AND correct entries returned
- FAIL: Response time >= 500ms OR incorrect results

**Automation Level:** Automated

**Scorer Type:** Algorithmic

**Test Data:**
```json
{
  "total_entries": 10,
  "search_tag": "energy",
  "expected_results": 3,
  "max_response_time_ms": 500
}
```

---

### EVL-10a: Sync After Extended Offline Period (Edge Case)

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-10a |
| **Source** | SC-10 (edge case) |
| **Category** | Mobile |
| **Priority** | High |

**Preconditions:**
1. App has data synced initially
2. Device can remain offline for extended period

**Test Steps:**
1. Go offline
2. Create multiple entries over simulated "3 days" (20+ entries)
3. Modify some existing entries
4. Delete one entry
5. Restore connection
6. Monitor sync behavior

**Expected Result:**
- All 20+ entries sync without manual intervention
- Modifications applied correctly
- Deletion propagated
- Sync completes within reasonable time (< 30 seconds)
- No data corruption or conflicts

**Pass/Fail Criteria:**
- PASS: Full sync completed with all operations applied correctly
- FAIL: Data loss, conflicts, or sync failure

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic + Human verification

---

## 9. Eval Cases - Data Integrity

### EVL-DI-01: Database Consistency After Crash

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-DI-01 |
| **Source** | Risk Register (Data loss) |
| **Category** | Data Integrity |
| **Priority** | Critical |

**Preconditions:**
1. App can be force-killed during operation
2. Database state can be inspected

**Test Steps:**
1. Begin entering a complex supplement schedule
2. Force-kill app mid-operation (before save completes)
3. Restart app
4. Check database and UI consistency

**Expected Result:**
- Database is in consistent state (no partial records)
- Either the operation completed OR rolled back cleanly
- No orphaned or corrupted data
- UI reflects accurate database state

**Pass/Fail Criteria:**
- PASS: Consistent state after recovery
- FAIL: Corrupted data OR partial records OR UI/DB mismatch

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic

---

### EVL-DI-02: Duplicate Entry Prevention

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-DI-02 |
| **Source** | Data Integrity |
| **Category** | Data Integrity |
| **Priority** | High |

**Preconditions:**
1. Network latency can be simulated
2. User can rapidly tap submit

**Test Steps:**
1. Simulate slow network (3 second latency)
2. Fill out food entry form
3. Rapidly tap submit button 5 times
4. Wait for operation to complete
5. Check for duplicate entries

**Expected Result:**
- Only ONE food entry created
- UI disables submit button after first tap OR shows loading state
- No duplicate entries in database

**Pass/Fail Criteria:**
- PASS: Single entry created despite multiple taps
- FAIL: Duplicate entries created

**Automation Level:** Automated

**Scorer Type:** Algorithmic

---

### EVL-DI-03: Data Export and Restore

| Attribute | Value |
|-----------|-------|
| **Test ID** | EVL-DI-03 |
| **Source** | Risk Register (Data loss mitigation) |
| **Category** | Data Integrity |
| **Priority** | High |

**Preconditions:**
1. Export functionality exists
2. User has substantial data (30+ days)

**Test Steps:**
1. With 30 days of data in system
2. Trigger data export
3. Verify export file created (JSON, CSV, or similar)
4. Clear all local data (simulate data loss)
5. Import/restore from export file
6. Verify all data restored accurately

**Expected Result:**
- Export file contains all user data
- Import successfully restores:
  - Supplement schedules and history
  - Food logs with macros
  - Weight entries
  - Training logs
  - Journal entries
- Data integrity maintained (no corruption)

**Pass/Fail Criteria:**
- PASS: Full data restore with integrity verified
- FAIL: Missing data OR corrupted values after restore

**Automation Level:** Semi-automated

**Scorer Type:** Algorithmic + Human verification

---

## 10. Test Environment Requirements

| Requirement | Specification |
|-------------|---------------|
| **Primary Device** | Android phone (API level 29+) with Chrome |
| **Network Conditions** | WiFi, 4G, Offline modes |
| **Database** | Cloudflare D1 or equivalent staging instance |
| **Food API** | Connected to test/staging food database |
| **Notification Service** | Push notification capability (Web Push or native) |
| **Monitoring Tools** | Lighthouse, WebPageTest, custom performance scripts |
| **Test Data Generator** | Scripts to populate 30 days of synthetic data |

## 11. Automation Strategy

| Level | Count | Approach |
|-------|-------|----------|
| **Fully Automated** | 14 | Playwright/Puppeteer for UI, API tests for backend |
| **Semi-Automated** | 8 | Device manipulation required, human verification step |
| **Manual** | 2 | Complex visual verification or edge cases |

## 12. Scorer Distribution

| Scorer Type | Count | Use Case |
|-------------|-------|----------|
| **Algorithmic** | 18 | Binary pass/fail, numeric comparisons, timing |
| **AI** | 3 | Visual verification, correlation report quality |
| **Human** | 3 | UX quality, edge case judgment calls |

---

## 13. Traceability Matrix

| Success Criterion | Eval Case(s) | Priority |
|-------------------|--------------|----------|
| SC-01 | EVL-01, EVL-02a | Critical |
| SC-02 | EVL-02, EVL-02a, EVL-02b | Critical |
| SC-03 | EVL-03, EVL-03a, EVL-03b | Critical |
| SC-04 | EVL-04 | High |
| SC-05 | EVL-05, EVL-05a, EVL-05b | Critical |
| SC-06 | EVL-06 | High |
| SC-07 | EVL-07 | High |
| SC-08 | EVL-08, EVL-08a | High |
| SC-09 | EVL-09, EVL-09a | High |
| SC-10 | EVL-10, EVL-10a | Critical |
| SC-11 | EVL-11 | High |
| SC-12 | EVL-12 | Medium |
| Data Integrity | EVL-DI-01, EVL-DI-02, EVL-DI-03 | Critical/High |

---

*Document generated by Eval | Wolf Pack Protocol*
