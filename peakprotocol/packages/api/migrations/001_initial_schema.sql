-- ============================================================================
-- PeakProtocol D1 Initial Schema Migration
-- Migration: 001_initial_schema
-- Created:   2026-04-01
-- Engine:    Cloudflare D1 (SQLite at edge)
--
-- Conventions:
--   - TEXT for IDs (ULIDs/UUIDs generated in application code)
--   - TEXT for timestamps (ISO 8601 strings)
--   - TEXT for JSON fields (arrays and objects serialized as JSON strings)
--   - snake_case for all identifiers
--   - FOREIGN KEY declarations included for documentation; D1 does not
--     enforce them by default (requires PRAGMA foreign_keys = ON per conn)
-- ============================================================================

-- --------------------------------------------------------------------------
-- supplements: Master list of tracked supplements with dosing schedules
-- --------------------------------------------------------------------------
CREATE TABLE supplements (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  current_dose  TEXT,
  unit          TEXT,
  schedule_type TEXT,          -- 'daily', 'every_n_days', 'weekly', 'specific_days'
  schedule_value TEXT,         -- JSON: {"n": 2} or {"days": ["mon", "wed", "fri"]}
  time_of_day   TEXT,          -- 'morning', 'evening', 'with_food', 'anytime'
  tags          TEXT,          -- JSON array, e.g. ["focus", "sleep"]
  active        INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- dose_history: Audit trail of dose changes for each supplement
-- --------------------------------------------------------------------------
CREATE TABLE dose_history (
  id              TEXT PRIMARY KEY,
  supplement_id   TEXT NOT NULL REFERENCES supplements(id),
  dose            TEXT,
  unit            TEXT,
  changed_at      TEXT NOT NULL,
  notes           TEXT
);

-- --------------------------------------------------------------------------
-- supplement_logs: Daily intake records (taken / skipped / missed)
-- --------------------------------------------------------------------------
CREATE TABLE supplement_logs (
  id              TEXT PRIMARY KEY,
  supplement_id   TEXT NOT NULL REFERENCES supplements(id),
  scheduled_date  TEXT NOT NULL,
  scheduled_time  TEXT,
  taken_at        TEXT,
  actual_dose     TEXT,
  skipped         INTEGER DEFAULT 0,
  notes           TEXT
);

-- --------------------------------------------------------------------------
-- food_cache: Cached USDA FoodData Central entries to reduce API calls
-- --------------------------------------------------------------------------
CREATE TABLE food_cache (
  fdc_id        TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  serving_size  REAL,
  serving_unit  TEXT,
  calories      REAL,
  protein       REAL,
  carbs         REAL,
  fat           REAL,
  fiber         REAL,
  cached_at     TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- saved_foods: User's frequently used and custom food items
-- --------------------------------------------------------------------------
CREATE TABLE saved_foods (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  fdc_id              TEXT,
  custom_serving_size REAL,
  custom_serving_unit TEXT,
  is_custom           INTEGER DEFAULT 0,
  calories            REAL,
  protein             REAL,
  carbs               REAL,
  fat                 REAL,
  fiber               REAL,
  usage_count         INTEGER DEFAULT 0
);

-- --------------------------------------------------------------------------
-- food_entries: Individual food log entries grouped by date and meal
-- --------------------------------------------------------------------------
CREATE TABLE food_entries (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  meal          TEXT NOT NULL,   -- 'breakfast', 'lunch', 'dinner', 'snack'
  food_name     TEXT NOT NULL,
  fdc_id        TEXT,
  serving_size  REAL,
  serving_unit  TEXT,
  calories      REAL,
  protein       REAL,
  carbs         REAL,
  fat           REAL,
  fiber         REAL,
  logged_at     TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- daily_metrics: One row per day for weight, hydration, and daily notes
-- --------------------------------------------------------------------------
CREATE TABLE daily_metrics (
  date            TEXT PRIMARY KEY,
  weight          REAL,
  weight_unit     TEXT DEFAULT 'kg',
  water_ml        INTEGER,
  water_target_ml INTEGER DEFAULT 3000,
  notes           TEXT,
  tags            TEXT,           -- JSON array
  logged_at       TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- training_sessions: Workout log (weights, BJJ, cardio, walks, etc.)
-- --------------------------------------------------------------------------
CREATE TABLE training_sessions (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL,
  type              TEXT NOT NULL,   -- 'weights', 'bjj', 'cardio', 'walk'
  duration_minutes  INTEGER,
  intensity         TEXT,            -- 'low', 'medium', 'high'
  details           TEXT,            -- JSON: exercises for weights, distance for cardio, etc.
  notes             TEXT,
  logged_at         TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- journal_entries: Free-form daily journaling with tags
-- --------------------------------------------------------------------------
CREATE TABLE journal_entries (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT,               -- JSON array
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- credentials: WebAuthn / passkey credentials for passwordless auth
-- --------------------------------------------------------------------------
CREATE TABLE credentials (
  id            TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  sign_count    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- recovery_codes: Backup authentication codes (hashed)
-- --------------------------------------------------------------------------
CREATE TABLE recovery_codes (
  id          TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  used        INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- weekly_reports: Generated weekly summary snapshots (cron-driven)
-- --------------------------------------------------------------------------
CREATE TABLE weekly_reports (
  id                TEXT PRIMARY KEY,
  week_start        TEXT NOT NULL,
  week_end          TEXT NOT NULL,
  compliance_pct    REAL,
  avg_calories      REAL,
  avg_protein       REAL,
  avg_carbs         REAL,
  avg_fat           REAL,
  weight_start      REAL,
  weight_end        REAL,
  training_minutes  INTEGER,
  training_sessions INTEGER,
  report_json       TEXT,           -- Full report data as JSON
  generated_at      TEXT NOT NULL
);

-- --------------------------------------------------------------------------
-- schema_migrations: Tracks which migrations have been applied.
-- Used by WRK-004 migration tooling to determine current schema version.
-- --------------------------------------------------------------------------
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO schema_migrations (version, name) VALUES (1, '001_initial_schema');

-- ============================================================================
-- Indexes
-- Covering the primary query patterns: date-based lookups, foreign key joins,
-- and type/tag filtering.
-- ============================================================================

-- Supplement logs: queried by date (daily view) and by supplement (history)
CREATE INDEX idx_supplement_logs_date       ON supplement_logs(scheduled_date);
CREATE INDEX idx_supplement_logs_supplement ON supplement_logs(supplement_id);

-- Food entries: queried by date (daily nutrition view)
CREATE INDEX idx_food_entries_date          ON food_entries(date);

-- Daily metrics: date lookups for charts and weekly reports
CREATE INDEX idx_daily_metrics_date         ON daily_metrics(date);

-- Training sessions: date lookups and type filtering
CREATE INDEX idx_training_sessions_date     ON training_sessions(date);
CREATE INDEX idx_training_sessions_type     ON training_sessions(type);

-- Journal entries: date-based browsing
CREATE INDEX idx_journal_entries_date       ON journal_entries(date);

-- Dose history: view change history for a specific supplement
CREATE INDEX idx_dose_history_supplement    ON dose_history(supplement_id);

-- Weekly reports: lookup by week
CREATE INDEX idx_weekly_reports_week        ON weekly_reports(week_start);

-- Food entries: meal filtering within a date (composite for common query)
CREATE INDEX idx_food_entries_date_meal     ON food_entries(date, meal);

-- Saved foods: sort by usage for "frequently used" feature
CREATE INDEX idx_saved_foods_usage          ON saved_foods(usage_count DESC);

-- Supplements: filter active supplements (the default view)
CREATE INDEX idx_supplements_active         ON supplements(active);
