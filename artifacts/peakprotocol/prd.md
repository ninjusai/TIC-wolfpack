---
title: "PeakProtocol Product Requirements Document"
version: "1.0.0"
status: draft
prd-id: PRD-peakprotocol-001
references:
  - PRB-peakprotocol-001
  - EVL-peakprotocol-001
  - DEC-peakprotocol-001 through DEC-peakprotocol-008
created: 2026-04-01
author: Quill
domain: health-tracking
---

# Product Requirements Document: PeakProtocol

## 1. Executive Summary

PeakProtocol is a personal health optimization platform designed for a solo user who requires comprehensive tracking of supplements, nutrition, body metrics, and multi-modal training. The system consolidates disparate tracking needs into a single mobile-accessible application with intelligent scheduling, compliance monitoring, and pattern analysis to drive body composition outcomes.

### Key Value Propositions

- **Never miss a supplement**: Flexible scheduling with proactive notifications
- **Understand what works**: Correlation analysis between inputs and outcomes
- **Reduce friction**: Quick-entry patterns and offline-first architecture
- **Single source of truth**: All health data consolidated with full history

---

## 2. Problem Statement

A solo user requires a comprehensive personal health optimization platform that consolidates supplement/peptide tracking with flexible scheduling (daily, every N days, weekly), dose titration history, food logging with automatic calorie/macro conversion, daily weight and hydration monitoring, multi-modal training logs (weights, jiu-jitsu, cardio), and pattern analysis to correlate intake and training with body composition outcomes.

The solution must be mobile-accessible (Android primary), provide at-a-glance compliance visibility, and proactively alert on missed scheduled items to prevent protocol breaks that could compromise health optimization goals.

### Problem Source

Reference: PRB-peakprotocol-001

---

## 3. Goals

### 3.1 Primary Goals (SMART)

| ID | Goal | Metric | Target | Timeline |
|----|------|--------|--------|----------|
| G-01 | Achieve full supplement compliance visibility | Dashboard shows accurate status for all scheduled items | 100% accuracy within 2 hours of missed time | MVP Launch |
| G-02 | Reduce missed supplements through notifications | Notification delivery rate for missed items | >95% delivered within 30 minutes | MVP Launch |
| G-03 | Enable rapid food logging | Taps to log saved food from dashboard | 3 taps or fewer | MVP Launch |
| G-04 | Provide accurate nutritional data | Macro calculation accuracy vs USDA reference | Within 5% tolerance | MVP Launch |
| G-05 | Support offline mobile usage | Data persistence and sync after offline entry | 100% data retained, sync within 30 seconds | MVP Launch |
| G-06 | Deliver actionable insights | Users can view macro/weight correlations | Correlation report available with 30 days data | Phase 2 |

### 3.2 Non-Goals (Explicit Exclusions)

- Multi-user or social features
- Prescription medication tracking
- Wearable device integration (Phase 2 consideration)
- Meal planning or recipe generation
- E-commerce or purchasing integration
- Medical advice or recommendations
- iOS-specific native app (PWA serves both)

---

## 4. Requirements

### 4.1 Functional Requirements - P0 (Must Have for MVP)

#### REQ-001: Supplement Scheduling Engine

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Users can define supplements with flexible recurrence patterns including daily, every N days, weekly, and specific days of week. Support time-of-day preferences (morning, evening, with food). |
| **Acceptance Criteria** | Calendar view shows correct scheduled dates for 30-day lookahead across all pattern types |
| **eval-trace** | EVL-03, EVL-03a, EVL-03b |
| **Threshold** | 100% scheduling accuracy for all supported patterns |
| **Dependencies** | D1 database schema |

#### REQ-002: Compliance Dashboard

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Dashboard displays at-a-glance compliance status with visual indicators (red/yellow/green) for missed, pending, and completed items. Shows daily and weekly views with streak tracking. |
| **Acceptance Criteria** | Red indicator appears within 2 hours of missed scheduled time with supplement name displayed |
| **eval-trace** | EVL-01, EVL-02a |
| **Threshold** | Status accuracy 100%, indicator appears within 2 hours |
| **Dependencies** | REQ-001, REQ-003 |

#### REQ-003: Missed Supplement Notifications

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Push or in-app notifications fire when scheduled supplements are not marked complete. Notifications include supplement name and actionable prompt. |
| **Acceptance Criteria** | Notification delivered within 30 minutes of scheduled time when supplement not completed |
| **eval-trace** | EVL-02, EVL-02b |
| **Threshold** | 95% delivery rate within 30 minutes |
| **Dependencies** | Web Push API, Service Worker |

#### REQ-004: Dose Tracking and Titration History

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Record actual dose taken per occurrence. Maintain immutable dose history with date-stamped changes. Support titration tracking with full audit trail. |
| **Acceptance Criteria** | History view shows all dose changes with correct values and timestamps |
| **eval-trace** | EVL-04 |
| **Threshold** | 100% preservation of dose change history |
| **Dependencies** | REQ-001 |

#### REQ-005: Food Search and Macro Calculation

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Search foods from USDA FoodData Central with local cache. Calculate calories and macros (protein, carbs, fat) automatically based on quantity. Support custom food creation. |
| **Acceptance Criteria** | System returns accurate macros within 5% of USDA values for searched foods |
| **eval-trace** | EVL-05, EVL-05a, EVL-05b |
| **Threshold** | +/- 5% accuracy vs USDA reference |
| **Dependencies** | USDA API integration, food_cache table |

#### REQ-006: Quick-Add Saved Foods

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Users can save frequently-used foods to library and add them quickly from dashboard without re-searching. |
| **Acceptance Criteria** | From dashboard to logged entry in 3 taps or fewer for saved foods |
| **eval-trace** | EVL-06 |
| **Threshold** | Maximum 3 taps from dashboard |
| **Dependencies** | REQ-005, saved_foods table |

#### REQ-007: Weight Tracking with Trend Visualization

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Log daily weight with trend visualization over time. Display graph with all data points and trend line. |
| **Acceptance Criteria** | Graph displays all data points with visible trend line for 14+ days of data |
| **eval-trace** | EVL-07 |
| **Threshold** | All logged weights visible, trend calculated correctly |
| **Dependencies** | daily_metrics table, charting library |

#### REQ-008: Multi-Modal Training Logs

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Log workouts by type: weight training (exercises, sets, reps, weight), jiu-jitsu (duration, intensity, notes), cardio/walks (duration, distance, type). Tiered approach with simple default and optional detailed logging for weights. |
| **Acceptance Criteria** | Weekly summary shows all workout types with appropriate fields captured |
| **eval-trace** | EVL-08, EVL-08a |
| **Threshold** | All modalities logged and displayed correctly |
| **Dependencies** | training_sessions table |

#### REQ-009: Offline Functionality

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | App works offline for logging supplements, food, weight, and training. Data persists locally and syncs automatically when connection restored. |
| **Acceptance Criteria** | Entries made offline persist and sync successfully when back online |
| **eval-trace** | EVL-10, EVL-10a |
| **Threshold** | 100% data retention, sync within 30 seconds |
| **Dependencies** | Service Worker, IndexedDB |

#### REQ-010: Mobile Performance

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Dashboard loads quickly on Android Chrome over 4G. Initial load under 3 seconds, subsequent loads under 1 second. |
| **Acceptance Criteria** | Time-to-interactive meets thresholds on target device |
| **eval-trace** | EVL-11 |
| **Threshold** | Initial < 3s, subsequent < 1s |
| **Dependencies** | SolidJS, code splitting, caching strategy |

#### REQ-011: Passkey Authentication

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Users authenticate via WebAuthn passkeys (biometric) with device-bound fallback. No passwords required. |
| **Acceptance Criteria** | User can register passkey and authenticate on subsequent visits |
| **eval-trace** | N/A (security requirement) |
| **Threshold** | Authentication completes successfully |
| **Dependencies** | WebAuthn API, credentials table |

### 4.2 Functional Requirements - P1 (Should Have)

#### REQ-012: Journal with Tags and Search

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | Free-form daily notes with tagging capability. Search entries by tag with fast results. |
| **Acceptance Criteria** | Search returns correct entries within 500ms |
| **eval-trace** | EVL-12 |
| **Threshold** | Results in < 500ms, 100% accuracy |
| **Dependencies** | daily_metrics table (notes field) |

#### REQ-013: Hydration Tracking

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | Log daily water intake with configurable daily target. Visual progress indicator. |
| **Acceptance Criteria** | Progress bar shows percentage of daily target reached |
| **eval-trace** | N/A |
| **Threshold** | Accurate calculation and display |
| **Dependencies** | daily_metrics table |

#### REQ-014: Supplement Tagging

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | Supplements support multiple tags for flexible organization (e.g., "morning stack", "vitamins", "peptides"). Filter supplement list by tag. |
| **Acceptance Criteria** | Tags can be assigned, displayed, and filtered |
| **eval-trace** | N/A |
| **Threshold** | Multi-tag support functioning |
| **Dependencies** | REQ-001 |

#### REQ-015: Pattern Correlation Reports

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | Generate correlation analysis between macro intake ratios and weight changes. Show protein/carb/fat vs weight delta correlations. Require minimum 14 days data. |
| **Acceptance Criteria** | All three macro correlations analyzed with coefficient displayed |
| **eval-trace** | EVL-09, EVL-09a |
| **Threshold** | Correlation coefficients calculated correctly |
| **Dependencies** | REQ-005, REQ-007, 30 days of data |

#### REQ-016: Data Export

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 |
| **Description** | Export all user data to JSON or CSV format. Support restore from export file. |
| **Acceptance Criteria** | Full data export and successful restore with data integrity |
| **eval-trace** | EVL-DI-03 |
| **Threshold** | 100% data preserved through export/import cycle |
| **Dependencies** | R2 storage |

### 4.3 Functional Requirements - P2 (Nice to Have)

#### REQ-017: Weekly Summary Reports

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | Auto-generated weekly summary showing compliance percentage, training volume, macro averages, and weight trend. |
| **Acceptance Criteria** | Report generated every Sunday with accurate aggregations |
| **eval-trace** | N/A |
| **Threshold** | Report accuracy 100% |
| **Dependencies** | REQ-015, Workers Cron |

#### REQ-018: Training Progressive Overload Tracking

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | For detailed weight training logs, calculate volume per exercise and estimated 1RM. Show trends over time. |
| **Acceptance Criteria** | Volume and 1RM calculations match expected formulas |
| **eval-trace** | N/A |
| **Threshold** | Calculation accuracy 100% |
| **Dependencies** | REQ-008 |

#### REQ-019: Timezone Handling

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 |
| **Description** | Graceful handling of timezone changes for scheduling and compliance calculations. |
| **Acceptance Criteria** | Consistent behavior when device timezone changes |
| **eval-trace** | EVL-03b |
| **Threshold** | No duplicate notifications or compliance errors |
| **Dependencies** | REQ-001, REQ-003 |

### 4.4 Non-Functional Requirements

#### REQ-NFR-001: Data Integrity

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | Database remains consistent after crashes. No duplicate entries from rapid submission. |
| **Acceptance Criteria** | Consistent state after force-kill; single entry despite multiple rapid taps |
| **eval-trace** | EVL-DI-01, EVL-DI-02 |
| **Threshold** | Zero data corruption or duplication |

#### REQ-NFR-002: Security

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | All data encrypted in transit (HTTPS). Authentication required for all data access. Secure headers implemented. |
| **Acceptance Criteria** | Security headers present; no unauthenticated data access |
| **eval-trace** | N/A |
| **Threshold** | 100% compliance |

#### REQ-NFR-003: PWA Compliance

| Attribute | Value |
|-----------|-------|
| **Priority** | P0 |
| **Description** | App meets PWA criteria: manifest, service worker, offline capability, installable. |
| **Acceptance Criteria** | Lighthouse PWA score > 90 |
| **eval-trace** | N/A |
| **Threshold** | PWA installable on Android Chrome |

---

## 5. Traceability Matrix

| Requirement | Eval Case(s) | Threshold | Success Criterion |
|-------------|--------------|-----------|-------------------|
| REQ-001 | EVL-03, EVL-03a, EVL-03b | 100% scheduling accuracy | SC-03 |
| REQ-002 | EVL-01, EVL-02a | Red indicator within 2 hours | SC-01 |
| REQ-003 | EVL-02, EVL-02b | 95% delivery within 30 min | SC-02 |
| REQ-004 | EVL-04 | 100% history preserved | SC-04 |
| REQ-005 | EVL-05, EVL-05a, EVL-05b | +/- 5% vs USDA | SC-05 |
| REQ-006 | EVL-06 | 3 taps maximum | SC-06 |
| REQ-007 | EVL-07 | All data points visible | SC-07 |
| REQ-008 | EVL-08, EVL-08a | All modalities captured | SC-08 |
| REQ-009 | EVL-10, EVL-10a | 100% sync success | SC-10 |
| REQ-010 | EVL-11 | Initial <3s, warm <1s | SC-11 |
| REQ-012 | EVL-12 | Results in <500ms | SC-12 |
| REQ-015 | EVL-09, EVL-09a | Correlations calculated | SC-09 |
| REQ-016 | EVL-DI-03 | 100% data integrity | Data loss mitigation |
| REQ-NFR-001 | EVL-DI-01, EVL-DI-02 | Zero corruption | Data integrity |

---

## 6. Success Metrics

### 6.1 Launch Metrics (MVP)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Supplement compliance visibility | 100% accurate | Automated test EVL-01 |
| Notification delivery rate | >95% within 30 min | Automated test EVL-02 |
| Food entry UX | 3 taps for saved foods | Automated test EVL-06 |
| Macro accuracy | Within 5% of USDA | Automated test EVL-05 |
| Offline data retention | 100% | Automated test EVL-10 |
| Dashboard load time (cold) | <3 seconds | Lighthouse/WebPageTest |
| Dashboard load time (warm) | <1 second | Lighthouse/WebPageTest |
| PWA score | >90 | Lighthouse audit |

### 6.2 Usage Metrics (Post-Launch)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Daily active logging | >80% of days | D1 query on log dates |
| Supplement compliance rate | >90% weekly average | Compliance calculation |
| Data export frequency | Monthly | R2 export count |

---

## 7. Technical Stack

### 7.1 Architecture Decisions

| Component | Decision | Reference |
|-----------|----------|-----------|
| Frontend Framework | SolidJS | DEC-peakprotocol-002 |
| Styling | UnoCSS (Tailwind preset) | DEC-peakprotocol-002 |
| Build Tool | Vite | DEC-peakprotocol-002 |
| Backend Runtime | Cloudflare Workers | Constraint |
| API Framework | Hono | DEC-peakprotocol-002 |
| Database | Cloudflare D1 (SQLite) | DEC-peakprotocol-004 |
| Session Store | Cloudflare KV | DEC-peakprotocol-004 |
| Object Storage | Cloudflare R2 | DEC-peakprotocol-004 |
| Authentication | WebAuthn Passkeys | DEC-peakprotocol-006 |
| Food API | USDA FoodData Central | DEC-peakprotocol-001 |
| Mobile Strategy | PWA-first, Capacitor fallback | DEC-peakprotocol-002 |
| Notifications | Web Push + Service Worker | DEC-peakprotocol-003 |

### 7.2 Key Dependencies

| Dependency | Type | Purpose | Risk |
|------------|------|---------|------|
| Cloudflare Workers | Platform | Edge compute | Low (mature platform) |
| Cloudflare D1 | Database | Structured data | Medium (GA but newer) |
| USDA FoodData Central | External API | Food nutrition data | Low (free, rate-limited) |
| WebAuthn | Browser API | Authentication | Low (well-supported) |
| Web Push API | Browser API | Notifications | Medium (device-dependent) |

---

## 8. Dependencies

### 8.1 Technical Dependencies

| Dependency | Required By | Blocking | Notes |
|------------|-------------|----------|-------|
| Cloudflare account | All backend | Yes | Free tier sufficient for MVP |
| USDA API key | REQ-005 | Yes | Free, request at fdc.nal.usda.gov |
| Android test device | All mobile testing | Yes | Chrome 90+ required |
| D1 schema migration | All data features | Yes | Must run before first deploy |
| VAPID keys | REQ-003 | Yes | Generate once for Web Push |

### 8.2 Data Dependencies

| Dependency | Required By | Blocking | Notes |
|------------|-------------|----------|-------|
| Food cache population | REQ-005, REQ-006 | No | Can start empty, caches on use |
| 30 days of data | REQ-015 | No | Reports unavailable until threshold |
| Initial passkey setup | All features | Yes | First-run ceremony required |

---

## 9. Timeline and Milestones

### 9.1 Phase 1: Foundation (Weeks 1-3)

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| M1.1: Project Setup | Vite + SolidJS scaffold, Cloudflare Workers project, D1 database created | Build and deploy "Hello World" to production |
| M1.2: Auth System | Passkey registration and login, session management | User can authenticate via biometric |
| M1.3: Core Data Model | D1 schema deployed, CRUD APIs for supplements | API returns supplement data correctly |

### 9.2 Phase 2: Core Features (Weeks 4-6)

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| M2.1: Supplement Tracking | Scheduling engine, logging UI, compliance calculation | EVL-03 passes |
| M2.2: Compliance Dashboard | Status display, indicators, streak tracking | EVL-01 passes |
| M2.3: Notifications | Web Push integration, missed supplement alerts | EVL-02 passes |

### 9.3 Phase 3: Nutrition (Weeks 7-8)

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| M3.1: Food Database | USDA API integration, food cache, search UI | EVL-05 passes |
| M3.2: Food Logging | Entry UI, quick-add saved foods, macro display | EVL-06 passes |
| M3.3: Daily Metrics | Weight logging, hydration tracking, trend charts | EVL-07 passes |

### 9.4 Phase 4: Training and Reporting (Weeks 9-10)

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| M4.1: Training Logs | Multi-modal logging UI, weekly summary view | EVL-08 passes |
| M4.2: Journal | Notes entry, tagging, search | EVL-12 passes |
| M4.3: Pattern Reports | Correlation analysis, visualization | EVL-09 passes |

### 9.5 Phase 5: Polish and Launch (Weeks 11-12)

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| M5.1: Offline Support | Service worker, IndexedDB sync | EVL-10 passes |
| M5.2: Performance | Bundle optimization, caching strategy | EVL-11 passes |
| M5.3: Data Integrity | Export/import, crash recovery validation | EVL-DI-01, EVL-DI-02, EVL-DI-03 pass |
| M5.4: Launch | Production deployment, monitoring setup | All P0 requirements verified |

### 9.6 Post-MVP Considerations

| Item | Priority | Notes |
|------|----------|-------|
| Capacitor native wrapper | If Web Push unreliable | DEC-peakprotocol-003 escalation path |
| Wearable integration | Phase 2 | Out of scope for MVP |
| Advanced ML analysis | Phase 3 | Keep simple stats for now |

---

## 10. Risks and Mitigations

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Web Push unreliable on Android | High | High | Test early on target device; have Capacitor native wrapper ready (DEC-peakprotocol-003) |
| USDA API rate limits | Medium | High | Cache aggressively; pre-populate 5K common foods; implement retry with backoff |
| D1 performance at scale | Low | Medium | Profile queries early; add indexes; simple data model keeps queries fast |
| Bundle size exceeds targets | Medium | Medium | SolidJS is small (~7KB); use code splitting; monitor with bundlesize CI check |
| Offline sync conflicts | Low | Medium | Simple conflict resolution: last-write-wins with timestamp; single user simplifies |

### 10.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Logging friction too high | Medium | High | Prioritize quick-add UX; 3-tap target for saved foods; minimize required fields |
| Feature creep | Medium | Medium | Strict MVP scope in this PRD; document Phase 2 wishlist separately |
| Data loss | Low | Critical | Automated R2 backups; client-side IndexedDB backup; export feature |
| Pattern analysis misleading | Low | Medium | Clear "correlation not causation" messaging; require minimum data thresholds |

### 10.3 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Solo developer bandwidth | Medium | Medium | MVP scope minimized; use managed services; avoid over-engineering |
| Cloudflare service disruption | Low | High | No mitigation needed for personal app; accept occasional downtime |

---

## 11. Open Items

| ID | Item | Owner | Due Date | Status |
|----|------|-------|----------|--------|
| OI-01 | Obtain USDA API key | Developer | Week 1 | Pending |
| OI-02 | Generate VAPID keys for Web Push | Developer | Week 1 | Pending |
| OI-03 | Acquire Android test device | Developer | Week 1 | Pending |
| OI-04 | Validate Web Push on target device | Developer | Week 3 | Pending |
| OI-05 | Finalize food cache seed list | Developer | Week 7 | Pending |

---

## 12. Appendices

### Appendix A: D1 Schema Reference

See DEC-peakprotocol-004 for complete schema definition including:
- supplements, dose_history, supplement_logs
- food_entries, food_cache, saved_foods
- daily_metrics, training_sessions

### Appendix B: Eval Case Summary

| Category | Cases | Coverage |
|----------|-------|----------|
| Compliance | EVL-01, EVL-02, EVL-02a, EVL-02b | Dashboard, notifications, edge cases |
| Scheduling | EVL-03, EVL-04, EVL-03a, EVL-03b | Patterns, titration, future dates, timezone |
| Nutrition | EVL-05, EVL-06, EVL-05a, EVL-05b | Macros, quick-add, unknown foods, fractions |
| Training | EVL-08, EVL-08a | Multi-modal, empty week |
| Reporting | EVL-07, EVL-09, EVL-09a | Weight trend, correlations, insufficient data |
| Mobile | EVL-10, EVL-11, EVL-12, EVL-10a | Offline, performance, search, extended offline |
| Data Integrity | EVL-DI-01, EVL-DI-02, EVL-DI-03 | Crash recovery, duplicates, export/restore |

**Total: 24 eval cases covering 12 success criteria plus edge cases and data integrity**

### Appendix C: Glossary

| Term | Definition |
|------|------------|
| Titration | Gradually adjusting dose up or down to find optimal level |
| Stack | A combination of supplements taken together as part of a protocol |
| Macros | Macronutrients: protein, carbohydrates, fat (measured in grams) |
| PWA | Progressive Web App; web app with native-like capabilities |
| D1 | Cloudflare's edge SQLite database service |
| KV | Cloudflare Workers Key-Value storage |
| R2 | Cloudflare's S3-compatible object storage |
| BJJ | Brazilian Jiu-Jitsu |
| Passkey | WebAuthn-based passwordless authentication credential |

---

*Document generated by Quill | Wolf Pack Protocol*
