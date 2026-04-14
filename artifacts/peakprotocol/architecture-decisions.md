---
title: "PeakProtocol Architecture Decisions"
version: "1.0.0"
status: approved
created: 2026-04-01
author: Architect
problem-ref: PRB-peakprotocol-001
---

# Architecture Decisions: PeakProtocol

This document resolves the 8 Open Questions from the PeakProtocol problem definition and establishes the architectural foundation for implementation.

---

## DEC-peakprotocol-001: Food Database Selection

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-01: Which food database/API to use? |
| **Decision** | USDA FoodData Central as primary, with local cache of ~5,000 common foods |
| **Rationale** | USDA FoodData Central is free, authoritative, and provides comprehensive nutritional data. The API has generous rate limits (3,600 requests/hour with free API key). By caching common foods locally in D1, we minimize API calls and enable offline search for frequently-used items. |
| **Alternatives Considered** | |
| - Nutritionix | Excellent UX and natural language parsing, but costs ~$500/month for full access. Overkill for single user. |
| - Open Food Facts | Free and community-driven, but data quality is inconsistent. Better as supplementary source for branded products. |
| - Embedded full database | Would require ~500MB+ of data and complex ETL pipeline. Over-engineered for initial build. |
| **Trade-offs** | USDA focuses on generic foods (not branded products). User may need to manually add specific branded items. Natural language parsing is more limited than Nutritionix. |
| **Implementation Notes** | |
| 1. Obtain free API key from fdc.nal.usda.gov |
| 2. Create D1 table `food_cache` with columns: `fdc_id, name, serving_size, calories, protein, carbs, fat, fiber, cached_at` |
| 3. Pre-populate cache with top ~5,000 foods from USDA Foundation Foods and SR Legacy datasets |
| 4. Search local cache first; fall back to API for misses |
| 5. Cache all API results for 90 days |
| 6. Allow user to create custom foods stored entirely in D1 |

---

## DEC-peakprotocol-002: Mobile Platform Strategy

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-02: PWA or native Android app? |
| **Decision** | PWA-first with Capacitor-wrapped APK as fallback |
| **Rationale** | A PWA delivers 90% of native functionality with 30% of the effort. Modern Android Chrome supports PWA install prompts, service workers, and Web Push. Starting PWA-first allows rapid iteration. If notification reliability proves insufficient (see DEC-003), Capacitor can wrap the same codebase into a native APK with minimal additional work. |
| **Alternatives Considered** | |
| - Native-first (Kotlin) | Maximum platform capability, but doubles development effort and requires different skill set. Not justified for single user. |
| - React Native / Flutter | Cross-platform, but adds complexity (build tooling, native modules). Capacitor is lighter for "web app that needs native features" use case. |
| - Tauri Mobile | Promising but still in beta for Android. Too risky for production. |
| **Trade-offs** | PWA may have subtle UX differences from native (e.g., splash screen behavior, task switcher appearance). Acceptable for personal use. |
| **Implementation Notes** | |
| 1. Build with SolidJS or Preact for small bundle size (<50KB gzipped) |
| 2. Configure `manifest.json` with `display: standalone`, theme colors, icons |
| 3. Implement service worker with Workbox for caching strategies |
| 4. Test PWA install flow on target Android device in first sprint |
| 5. If PWA notifications fail (see DEC-003), add Capacitor: `npm init @capacitor/app` |
| 6. Capacitor plugins needed: `@capacitor/local-notifications`, `@capacitor/push-notifications` |

---

## DEC-peakprotocol-003: Mobile Notification Strategy

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-03: How to handle background notifications on mobile web? |
| **Decision** | Web Push API with service worker; escalate to Capacitor if unreliable |
| **Rationale** | Web Push is the standard for PWA notifications and works on Android Chrome when the browser is backgrounded. However, aggressive battery optimization on some Android devices can kill service workers. The strategy is: implement Web Push first, test rigorously on target device, and have a Capacitor escalation path ready. |
| **Alternatives Considered** | |
| - SMS notifications via Twilio | Reliable but costs money per message, feels intrusive for personal app. |
| - Email notifications | Reliable but slow; not suitable for time-sensitive supplement reminders. |
| - Native-only approach | Guaranteed reliability but abandons PWA benefits. |
| **Trade-offs** | Web Push requires user permission grant (one-time friction). May not fire reliably on Xiaomi/Huawei devices with aggressive battery management. User may need to whitelist app in battery settings. |
| **Implementation Notes** | |
| 1. Use `web-push` library on Cloudflare Workers for VAPID key generation and push sending |
| 2. Generate VAPID keys once, store public key in client, private key in Workers secrets |
| 3. Service worker listens for `push` event and displays notification via `self.registration.showNotification()` |
| 4. Schedule notifications via Workers Cron Triggers checking for upcoming/missed supplements |
| 5. **Reliability test protocol**: Set test reminder, close browser, wait 30 min, verify notification |
| 6. **If unreliable**: Wrap with Capacitor, use `@capacitor/local-notifications` for scheduled local notifications (no server push needed for single user) |
| 7. Capacitor local notifications work offline and survive battery optimization |

---

## DEC-peakprotocol-004: Cloudflare Storage Strategy

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-04: What storage strategy for Cloudflare? |
| **Decision** | D1 for all structured data, KV for session/config, R2 for exports |
| **Rationale** | D1 (SQLite at edge) provides full relational capability with SQL queries, ideal for the complex data model (supplements, schedules, logs, food entries, training sessions). KV handles simple key-value needs like session tokens and user preferences. R2 provides durable object storage for data exports and backups. |
| **Alternatives Considered** | |
| - KV-only | Would require denormalizing everything; queries become impossible. Not suitable for relational data. |
| - Turso | Distributed SQLite with more features, but adds external dependency. D1 is native to Cloudflare and sufficient. |
| - PlanetScale | MySQL-compatible, powerful, but overkill. Adds cost and latency. |
| - Durable Objects | Good for real-time collaboration, not needed for single-user app. |
| **Trade-offs** | D1 has a 10GB database size limit (free tier 500MB). Should be sufficient for years of personal logging. Row size limit of 1MB per row is not a concern for this data model. |
| **Implementation Notes** | |

### D1 Schema Design

```sql
-- Core tables
CREATE TABLE supplements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_dose TEXT,
  unit TEXT,
  schedule_type TEXT, -- 'daily', 'every_n_days', 'weekly', 'specific_days'
  schedule_value TEXT, -- JSON: {"n": 2} or {"days": ["mon", "wed", "fri"]}
  time_of_day TEXT,   -- 'morning', 'evening', 'with_food', 'anytime'
  tags TEXT,          -- JSON array
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE dose_history (
  id TEXT PRIMARY KEY,
  supplement_id TEXT REFERENCES supplements(id),
  dose TEXT,
  unit TEXT,
  changed_at TEXT,
  notes TEXT
);

CREATE TABLE supplement_logs (
  id TEXT PRIMARY KEY,
  supplement_id TEXT REFERENCES supplements(id),
  scheduled_date TEXT,
  scheduled_time TEXT,
  taken_at TEXT,
  actual_dose TEXT,
  skipped INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE food_entries (
  id TEXT PRIMARY KEY,
  date TEXT,
  meal TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
  food_name TEXT,
  fdc_id TEXT,
  serving_size REAL,
  serving_unit TEXT,
  calories REAL,
  protein REAL,
  carbs REAL,
  fat REAL,
  fiber REAL,
  logged_at TEXT
);

CREATE TABLE food_cache (
  fdc_id TEXT PRIMARY KEY,
  name TEXT,
  serving_size REAL,
  serving_unit TEXT,
  calories REAL,
  protein REAL,
  carbs REAL,
  fat REAL,
  fiber REAL,
  cached_at TEXT
);

CREATE TABLE saved_foods (
  id TEXT PRIMARY KEY,
  name TEXT,
  fdc_id TEXT,
  custom_serving_size REAL,
  custom_serving_unit TEXT,
  is_custom INTEGER DEFAULT 0,
  calories REAL,
  protein REAL,
  carbs REAL,
  fat REAL,
  fiber REAL,
  usage_count INTEGER DEFAULT 0
);

CREATE TABLE daily_metrics (
  date TEXT PRIMARY KEY,
  weight REAL,
  weight_unit TEXT DEFAULT 'kg',
  water_ml INTEGER,
  water_target_ml INTEGER DEFAULT 3000,
  notes TEXT,
  tags TEXT, -- JSON array
  logged_at TEXT
);

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  date TEXT,
  type TEXT, -- 'weights', 'bjj', 'cardio', 'walk'
  duration_minutes INTEGER,
  intensity TEXT, -- 'low', 'medium', 'high'
  details TEXT, -- JSON: exercises for weights, distance for cardio, etc.
  notes TEXT,
  logged_at TEXT
);

-- Indexes for common queries
CREATE INDEX idx_supplement_logs_date ON supplement_logs(scheduled_date);
CREATE INDEX idx_food_entries_date ON food_entries(date);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_training_sessions_date ON training_sessions(date);
```

### KV Usage

| Key Pattern | Purpose |
|-------------|---------|
| `session:{token}` | Session data (expires in 30 days) |
| `push_subscription` | Web Push subscription object |
| `user_prefs` | UI preferences (theme, units, targets) |

### R2 Usage

| Object Pattern | Purpose |
|----------------|---------|
| `exports/{date}-full.json` | Full data export |
| `backups/{date}.sqlite` | D1 backup snapshot |

---

## DEC-peakprotocol-005: Pattern Analysis Approach

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-05: How complex should pattern analysis be? |
| **Decision** | Simple statistical analysis: rolling averages, basic correlation coefficients, no ML |
| **Rationale** | ML/AI analysis is overkill for a single user with months of data. Simple statistics (7-day and 30-day rolling averages, Pearson correlation between variables) provide actionable insights without compute overhead. These calculations can run client-side in JavaScript or in a Workers Cron job. The user can visually inspect charts and draw conclusions. |
| **Alternatives Considered** | |
| - ML-based pattern detection | Requires external compute (can't run in Workers), needs large datasets to be meaningful. Over-engineered. |
| - External analytics service | Adds dependency, cost, and data privacy concerns. |
| - No analysis, just raw data | Misses the core value proposition of understanding what works. |
| **Trade-offs** | Won't detect complex non-linear patterns. User must interpret correlation (not causation). Acceptable for personal optimization use case. |
| **Implementation Notes** | |

### Analysis Features

| Analysis | Calculation | Display |
|----------|-------------|---------|
| Weight trend | 7-day and 30-day simple moving average | Line chart with trend line |
| Macro vs weight | Pearson correlation: daily protein/carbs/fat ratio vs. 7-day weight delta | Correlation coefficient (-1 to 1) with plain-English interpretation |
| Training vs weight | Correlation: weekly training volume (minutes) vs. weekly weight change | Bar chart + correlation |
| Supplement compliance | % of scheduled items taken per week | Percentage + color indicator |
| Compliance vs outcomes | Compare weeks with >90% compliance vs <90% compliance | Side-by-side stats |

### Correlation Interpretation

```javascript
function interpretCorrelation(r) {
  const abs = Math.abs(r);
  const direction = r > 0 ? 'positive' : 'negative';
  if (abs < 0.2) return 'No meaningful correlation';
  if (abs < 0.4) return `Weak ${direction} correlation`;
  if (abs < 0.6) return `Moderate ${direction} correlation`;
  if (abs < 0.8) return `Strong ${direction} correlation`;
  return `Very strong ${direction} correlation`;
}
```

### Compute Strategy

1. Run analysis client-side for real-time exploration
2. Workers Cron job generates weekly summary report every Sunday 9 PM
3. Store computed reports in D1 `weekly_reports` table for quick retrieval

---

## DEC-peakprotocol-006: Authentication Approach

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-06: Authentication approach for single user? |
| **Decision** | Passkey (WebAuthn) as primary, with device-bound fallback |
| **Rationale** | Passkeys provide strong security (phishing-resistant) with excellent UX (biometric unlock). For a single-user app, this is ideal: no password to remember, no magic link emails to set up. Fallback to device-bound session handles browsers/devices that don't support passkeys yet. |
| **Alternatives Considered** | |
| - Password auth | Requires secure storage, reset flow, etc. Unnecessary complexity for single user. |
| - Magic link email | Requires email service setup (Mailgun, Resend). Friction for every login. |
| - No auth (device only) | Risk if device is lost/stolen. No way to access data from new device. |
| - OAuth (Google, etc.) | Adds external dependency. Privacy concern for personal health data. |
| **Trade-offs** | Passkey requires initial setup ceremony. If passkey device is lost and no backup exists, account recovery is complex (would need pre-configured recovery code). |
| **Implementation Notes** | |

### Passkey Flow

1. **Setup (first use)**:
   - User visits app, prompted to create passkey
   - Browser triggers WebAuthn `navigator.credentials.create()`
   - Public key stored in D1 `credentials` table
   - Generate backup recovery codes (6 codes, 8 chars each), display once

2. **Login (subsequent)**:
   - Browser triggers `navigator.credentials.get()`
   - User authenticates via fingerprint/face/PIN
   - Server validates signature, issues session token
   - Session token stored in KV with 30-day TTL

3. **Fallback (no passkey support)**:
   - Generate device-bound token on first visit
   - Store token in localStorage + secure httpOnly cookie
   - Effectively "trust this device" model

### Security Headers

```javascript
// Cloudflare Workers response headers
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
}
```

---

## DEC-peakprotocol-007: Supplement Organization Model

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-07: Should supplements have categories or tags? |
| **Decision** | Tags (flexible, multi-assign) rather than categories (rigid, single-assign) |
| **Rationale** | Supplements often belong to multiple logical groups. For example, "Vitamin D" could be tagged both "morning stack" and "vitamins" and "fat-soluble". Tags allow flexible organization that matches how the user actually thinks about their protocol. Categories would force artificial hierarchy. |
| **Alternatives Considered** | |
| - Single category | Too restrictive. Where does a supplement go if it's both a "vitamin" and part of a "sleep stack"? |
| - Hierarchical categories | Complex to implement and navigate. Overkill for ~20-50 supplements. |
| - No organization | Would make the supplement list unwieldy as it grows. |
| **Trade-offs** | Tags require more UI work (tag input, filter by tag). User must create their own organizational scheme. |
| **Implementation Notes** | |

### Tag System Design

1. **Supplement tags**: Stored as JSON array in `supplements.tags`
2. **Suggested tags** (pre-populated):
   - Time-based: `morning`, `evening`, `with-food`, `empty-stomach`
   - Category: `vitamin`, `mineral`, `amino-acid`, `peptide`, `herb`, `probiotic`
   - Protocol: `sleep-stack`, `focus-stack`, `workout-stack`
3. **Filter UI**: Multi-select dropdown or chip-based filter on supplement list
4. **Dashboard grouping**: Option to group today's supplements by tag

### Data Model

```sql
-- Tags stored inline (simple, fast)
UPDATE supplements SET tags = '["morning", "vitamin", "fat-soluble"]' WHERE id = 'xyz';

-- Query by tag (using JSON functions)
SELECT * FROM supplements WHERE tags LIKE '%"morning"%' AND active = 1;
```

---

## DEC-peakprotocol-008: Training Metrics Model

| Attribute | Value |
|-----------|-------|
| **Question** | OQ-08: What training metrics matter most? |
| **Decision** | Tiered approach: simple logging default, optional detailed logging for weights |
| **Rationale** | The user trains multiple modalities (weights, BJJ, cardio). Each has different logging needs. Rather than force detailed logging for everything, provide a simple default (type, duration, intensity, notes) with optional detailed mode for weight training. This reduces friction for quick logs while enabling detailed analysis when desired. |
| **Alternatives Considered** | |
| - Detailed logging only | High friction; user might skip logging entirely. |
| - Simple logging only | Loses valuable data for progressive overload tracking in weights. |
| - Separate apps per modality | Defeats the purpose of consolidated tracking. |
| **Trade-offs** | Detailed weight logging adds complexity. Need good UX to make it feel optional rather than required. |
| **Implementation Notes** | |

### Training Types and Fields

| Type | Required Fields | Optional Detailed Fields |
|------|-----------------|-------------------------|
| **Weights** | date, duration, intensity | exercises[] with: name, sets, reps, weight, rpe |
| **BJJ** | date, duration, intensity | rounds, techniques_practiced, sparring_notes |
| **Cardio** | date, duration, type (run/bike/etc) | distance, pace, heart_rate_avg |
| **Walk** | date, duration | distance, steps |

### Weight Training Detail Schema

```json
{
  "exercises": [
    {
      "name": "Squat",
      "sets": [
        {"reps": 5, "weight": 100, "unit": "kg", "rpe": 7},
        {"reps": 5, "weight": 100, "unit": "kg", "rpe": 8},
        {"reps": 5, "weight": 100, "unit": "kg", "rpe": 9}
      ]
    }
  ]
}
```

### Progressive Overload Tracking

For detailed weight sessions, calculate and display:
- Volume (sets x reps x weight) per exercise
- Volume trend over time
- Estimated 1RM using Epley formula: `1RM = weight x (1 + reps/30)`

### Quick Log UX

1. **Default**: "Log Training" -> Select type -> Duration slider -> Intensity (L/M/H) -> Optional notes -> Save
2. **Detailed (weights only)**: Toggle "Log exercises" -> Exercise picker (from history) -> Sets/reps/weight quick entry

---

## Summary: Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend Framework** | SolidJS | Reactive, fast, small bundle (~7KB), familiar JSX syntax |
| **Styling** | UnoCSS (Tailwind preset) | Atomic CSS, tree-shaken, tiny output |
| **Build Tool** | Vite | Fast dev server, optimized production builds |
| **Backend Runtime** | Cloudflare Workers | Edge deployment, low latency, integrated services |
| **API Framework** | Hono | Lightweight, fast, Workers-native, familiar Express-like API |
| **Database** | Cloudflare D1 | SQLite at edge, SQL queries, sufficient for single user |
| **Session Store** | Cloudflare KV | Fast key-value, TTL support |
| **Object Storage** | Cloudflare R2 | Backups and exports |
| **Auth** | Passkeys (WebAuthn) | Phishing-resistant, great UX |
| **Food API** | USDA FoodData Central | Free, authoritative, generous limits |
| **Mobile Strategy** | PWA-first, Capacitor fallback | Fast iteration, native fallback ready |
| **Notifications** | Web Push + service worker | Standard, with native escalation path |

---

## Decision Register

| ID | Question | Decision Summary |
|----|----------|------------------|
| DEC-peakprotocol-001 | Food database | USDA FoodData Central + local cache |
| DEC-peakprotocol-002 | Mobile platform | PWA-first, Capacitor fallback |
| DEC-peakprotocol-003 | Notifications | Web Push API, escalate to Capacitor if unreliable |
| DEC-peakprotocol-004 | Storage | D1 for data, KV for sessions, R2 for exports |
| DEC-peakprotocol-005 | Pattern analysis | Simple stats (rolling averages, correlation), no ML |
| DEC-peakprotocol-006 | Authentication | Passkeys primary, device-bound fallback |
| DEC-peakprotocol-007 | Supplement org | Tags (flexible, multi-assign) |
| DEC-peakprotocol-008 | Training metrics | Tiered: simple default, optional detailed for weights |

---

*Document generated by Architect | Wolf Pack Protocol*
