---
title: "PeakProtocol Problem Definition"
version: "1.0.0"
status: draft
problem-id: PRB-peakprotocol-001
created: 2026-04-01
author: Framer
domain: health-tracking
complexity: high
---

# Problem Definition: PeakProtocol

## 1. Problem Statement

A solo user requires a comprehensive personal health optimization platform that consolidates supplement/peptide tracking with flexible scheduling (daily, every N days, weekly), dose titration history, food logging with automatic calorie/macro conversion, daily weight and hydration monitoring, multi-modal training logs (weights, jiu-jitsu, cardio), and pattern analysis to correlate intake and training with body composition outcomes. The solution must be mobile-accessible (Android primary), provide at-a-glance compliance visibility, and proactively alert on missed scheduled items to prevent protocol breaks that could compromise health optimization goals.

## 2. Scope

### 2.1 In Scope

| Feature Area | Capabilities |
|--------------|--------------|
| **Supplement Scheduling** | Define supplements with flexible recurrence patterns: daily, every N days (2, 3, etc.), weekly, specific days of week; support for time-of-day preferences (morning, evening, with food) |
| **Dose Tracking & Titration** | Record actual dose taken per occurrence; maintain dose history with date-stamped changes; support titration up/down with target dose and increment tracking |
| **Compliance Dashboard** | Daily/weekly view showing scheduled vs. completed items; visual indicators (red/yellow/green) for missed, pending, completed; streak tracking |
| **Food Logging** | Quick-entry from saved foods library; search and add new foods; automatic calorie and macro (protein, carbs, fat) calculation |
| **Food Database Integration** | API or embedded database for food nutritional data lookup |
| **Hydration Tracking** | Daily water intake logging with configurable daily target |
| **Weight Tracking** | Daily weigh-in logging; trend visualization over time |
| **Training Logs** | Log workouts by type: weight training (exercises, sets, reps, weight), jiu-jitsu (duration, intensity, notes), cardio/walks (duration, distance, type) |
| **Journal/Notes** | Free-form daily notes; ability to tag entries for later search |
| **Pattern Analysis & Reporting** | Correlation reports: macro ratios vs. weight change; training volume vs. weight change; supplement compliance vs. outcomes; weekly/monthly summary reports |
| **Notifications** | Push or in-app alerts for missed scheduled supplements; configurable reminder timing |
| **Mobile-First Deployment** | Accessible on Android via browser (PWA) or native app; offline capability for logging when disconnected |

### 2.2 Out of Scope

| Exclusion | Rationale |
|-----------|-----------|
| Multi-user/social features | Personal app for single user |
| Prescription medication tracking | Regulatory complexity; user specified supplements/peptides |
| Wearable device integration | Phase 2 consideration; not initial requirement |
| Meal planning/recipe generation | User wants tracking, not planning |
| E-commerce/purchasing integration | Out of domain |
| Medical advice or recommendations | Liability; this is a logging tool only |
| iOS support | Android primary; can be reconsidered if PWA covers both |

## 3. Users

### 3.1 Primary Persona: The Optimizer

| Attribute | Value |
|-----------|-------|
| **Name** | Solo User (app owner) |
| **Role** | Health-conscious individual optimizing body composition |
| **Technical Level** | Comfortable with apps; expects intuitive UX |
| **Context** | Takes multiple supplements on varying schedules; actively titrating doses; trains multiple modalities; tracks nutrition for body recomposition |
| **Primary Device** | Android smartphone |
| **Usage Pattern** | Multiple daily check-ins: morning (supplements, weight), meals (food logging), evening (training, remaining supplements, journal) |
| **Pain Points** | Forgetting supplements on complex schedules; losing track of dose changes; no single place to see compliance and correlate outcomes |
| **Goal** | Never miss a scheduled supplement; understand what nutrition/training patterns drive desired outcomes |

## 4. Success Criteria

All success criteria are testable and measurable:

| ID | Criterion | Test Method | Pass Condition |
|----|-----------|-------------|----------------|
| SC-01 | Dashboard shows compliance status at a glance | Load dashboard after missed supplement window passes | Red indicator appears within 2 hours of missed scheduled time; specific supplement name displayed |
| SC-02 | Missed supplement notification delivered | Configure supplement for specific time; do not mark complete | Push/in-app notification fires within 30 minutes of scheduled time |
| SC-03 | Flexible scheduling works correctly | Create supplements with daily, every-2-day, every-3-day, weekly schedules | Calendar view shows correct scheduled dates for 30-day lookahead |
| SC-04 | Dose titration history preserved | Change dose 3 times over 2 weeks | History view shows all 3 dose values with correct date stamps |
| SC-05 | Food entry calculates macros automatically | Add "chicken breast 200g" via search | System returns accurate calories and macros (within 5% of USDA values) |
| SC-06 | Quick-add saved foods under 3 taps | Save a food item; add it on subsequent day | From dashboard to logged entry in 3 taps or fewer |
| SC-07 | Weight trend visible over time | Log weight daily for 14 days | Graph shows trend line with all 14 data points |
| SC-08 | Training logs capture all modalities | Log weight session, BJJ session, walk in same week | All three appear in weekly summary with appropriate fields captured |
| SC-09 | Pattern report correlates macros to weight | Have 30 days of food and weight data | Report shows correlation analysis between protein/carb/fat ratios and weight delta |
| SC-10 | Works offline on mobile | Enable airplane mode; log supplement, food, weight | Data persists locally; syncs when connection restored |
| SC-11 | Mobile load time acceptable | Load dashboard on Android Chrome over 4G | Initial load under 3 seconds; subsequent loads under 1 second |
| SC-12 | Journal entries searchable | Create 10 entries with various tags; search by tag | Correct entries returned within 500ms |

## 5. Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| **Deployment: Cloudflare Workers/Pages** | Limited to edge-compatible runtime; no traditional server; 128MB memory limit per request; 50ms CPU time (can be extended with paid plan) | Use Workers KV or D1 (SQLite at edge) for storage; keep compute light; offload heavy analysis to scheduled jobs |
| **Mobile-first (Android)** | Must work well in mobile browser or as native app; touch-friendly UI; handle intermittent connectivity | PWA with service worker for offline; responsive design; consider Capacitor/Tauri for native wrapper if needed |
| **Single user** | No auth complexity, but still need data security | Simple auth (magic link, passkey, or device-bound); encrypted storage |
| **Food database dependency** | Need reliable nutritional data source | Options: Nutritionix API (freemium), Open Food Facts (free), USDA FoodData Central (free), or embedded subset |
| **Solo developer bandwidth** | User is building for self; maintenance overhead matters | Prioritize simplicity; avoid over-engineering; use managed services where possible |

## 6. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| A-01 | User has consistent internet access for sync | If frequently offline, need robust offline-first architecture with conflict resolution |
| A-02 | Cloudflare D1 is suitable for this data model | If D1 limitations hit (row size, query complexity), may need external DB (Turso, PlanetScale) |
| A-03 | A free/affordable food API exists with sufficient coverage | If not, must build/license a food database; significant effort |
| A-04 | PWA provides sufficient mobile experience | If native features needed (background notifications, widgets), must build Android app |
| A-05 | Pattern analysis can run client-side or in edge function | If too compute-heavy, need scheduled job on traditional server or external analytics service |
| A-06 | User will consistently log data | If logging friction too high, insights will be unreliable; UX must minimize friction |
| A-07 | Single timezone usage | If user travels frequently, scheduling logic needs timezone handling |

## 7. Open Questions

| ID | Question | Owner | Impact | Proposed Resolution |
|----|----------|-------|--------|---------------------|
| OQ-01 | Which food database/API to use? | Architect | Core feature depends on this | Evaluate: USDA FoodData Central (free), Nutritionix (paid), Open Food Facts (free/community). Recommend starting with USDA + fallback to Open Food Facts |
| OQ-02 | PWA or native Android app? | Architect | Affects notification reliability, offline capability, development effort | Start with PWA; evaluate notification behavior on Android; pivot to native (Capacitor) if insufficient |
| OQ-03 | How to handle background notifications on mobile web? | Architect | Critical for missed-supplement alerts | Web Push API with service worker; test on target Android device; may require native for reliability |
| OQ-04 | What storage strategy for Cloudflare? | Architect | Affects data model, query patterns, cost | D1 for structured data (supplements, logs); KV for user prefs; R2 for any media/exports |
| OQ-05 | How complex should pattern analysis be? | Architect | Affects compute requirements, UX | Start simple: 7-day/30-day rolling averages, basic correlation. Avoid ML initially |
| OQ-06 | Authentication approach for single user? | Architect | Security vs. friction tradeoff | Options: device-bound session, passkey, magic link. Recommend passkey for security + convenience |
| OQ-07 | Should supplements have categories or tags? | User | Affects organization UX | Suggest: allow tags for grouping (e.g., "morning stack", "peptides", "vitamins") |
| OQ-08 | What training metrics matter most? | User | Affects data model, reporting | Need input: just duration/type, or detailed exercise logging? |

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Food API rate limits or cost | Medium | High | Cache aggressively; consider embedded subset for common foods |
| Cloudflare Workers compute limits | Low | Medium | Profile early; use streaming/chunking for large responses |
| Notification unreliability on mobile web | High | High | Test early on target device; have native fallback plan |
| Data loss | Low | Critical | Regular exports to R2; client-side backup to device storage |
| Feature creep | Medium | Medium | Strict MVP scope; document Phase 2 wishlist separately |

## 9. Glossary

| Term | Definition |
|------|------------|
| **Titration** | Gradually adjusting dose up or down to find optimal level |
| **Stack** | A combination of supplements taken together as part of a protocol |
| **Macros** | Macronutrients: protein, carbohydrates, fat (measured in grams) |
| **PWA** | Progressive Web App; web app with native-like capabilities |
| **D1** | Cloudflare's edge SQLite database service |
| **BJJ** | Brazilian Jiu-Jitsu |

---

*Document generated by Framer | Wolf Pack Protocol*
