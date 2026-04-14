-- 003_css_change_reports.sql
-- WRK-BCE2-056: CSS Change Detection
-- Stores CSS change reports when a re-scrape detects differences in the catalogue

CREATE TABLE css_change_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  added_classes TEXT NOT NULL DEFAULT '[]',       -- JSON array of class names
  removed_classes TEXT NOT NULL DEFAULT '[]',     -- JSON array of class names
  changed_classes TEXT NOT NULL DEFAULT '[]',     -- JSON array of {className, changedProperties}
  total_added INTEGER NOT NULL DEFAULT 0,
  total_removed INTEGER NOT NULL DEFAULT 0,
  total_changed INTEGER NOT NULL DEFAULT 0,
  flagged_content_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE css_catalogue_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  snapshot TEXT NOT NULL,                         -- JSON: full css_audit snapshot at scrape time
  class_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_css_change_reports_site ON css_change_reports(site_id);
CREATE INDEX idx_css_catalogue_snapshots_site ON css_catalogue_snapshots(site_id, created_at);
