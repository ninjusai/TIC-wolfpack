-- 0001_initial_schema.sql
-- Bookingtimes Content Emulator - D1 Database Schema
-- 11 tables for site management, CSS cataloguing, templating, page versioning,
-- AI chat sessions, batch generation, and suburb data.

-- 1. Sites
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. CSS Catalogues
CREATE TABLE IF NOT EXISTS css_catalogues (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  source_urls TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Catalogue Classes
CREATE TABLE IF NOT EXISTS catalogue_classes (
  id TEXT PRIMARY KEY,
  catalogue_id TEXT NOT NULL REFERENCES css_catalogues(id),
  class_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('bootstrap', 'fontawesome', 'custom')),
  properties TEXT,
  verified INTEGER DEFAULT 0,
  UNIQUE(catalogue_id, class_name)
);

CREATE INDEX IF NOT EXISTS idx_catalogue_classes_catalogue_class
  ON catalogue_classes(catalogue_id, class_name);

-- 4. Templates
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  site_ids TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Template Sections
CREATE TABLE IF NOT EXISTS template_sections (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  required INTEGER DEFAULT 1,
  html_skeleton TEXT,
  required_classes TEXT,
  content_rules TEXT,
  variant_pool TEXT
);

-- 6. Pages
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  site_id TEXT NOT NULL REFERENCES sites(id),
  template_id TEXT REFERENCES templates(id),
  suburb TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'exported')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Page Versions
CREATE TABLE IF NOT EXISTS page_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai', 'batch', 'rollback')),
  parent_version TEXT,
  change_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page_version
  ON page_versions(page_id, version_number);

-- 8. AI Sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'complete', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. AI Turns
CREATE TABLE IF NOT EXISTS ai_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  validation_report TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Batch Jobs
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  site_id TEXT NOT NULL REFERENCES sites(id),
  suburb TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'needs_review')),
  page_id TEXT REFERENCES pages(id),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. Suburb Data
CREATE TABLE IF NOT EXISTS suburb_data (
  id TEXT PRIMARY KEY,
  suburb_name TEXT NOT NULL,
  postcode TEXT,
  region TEXT,
  state TEXT DEFAULT 'QLD',
  distance_to_cbd_km REAL,
  landmarks TEXT,
  population INTEGER,
  extra_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
