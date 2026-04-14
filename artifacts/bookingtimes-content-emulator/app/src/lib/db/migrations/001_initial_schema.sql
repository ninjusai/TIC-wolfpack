-- 001_initial_schema.sql
-- Bookingtimes Content Emulator V2.1 — Full relational schema
-- Groups: Core, Brand Intelligence, Audit & Benchmark, Planning, Operations

--------------------------------------------------------------------------------
-- Group 1: Core
--------------------------------------------------------------------------------

CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  bootstrap_version TEXT DEFAULT '5.0.2',
  pipeline_stage TEXT DEFAULT 'not_started' CHECK (pipeline_stage IN (
    'not_started', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5', 'maintaining'
  )),
  last_scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  title TEXT,
  page_type TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'approved', 'deployed')),
  current_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, url)
);

CREATE TABLE page_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id),
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  change_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(page_id, version_number)
);

CREATE TABLE ai_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  page_id INTEGER REFERENCES pages(id),
  section_spec_id INTEGER,
  session_type TEXT NOT NULL CHECK (session_type IN (
    'brand_inference', 'section_generation', 'coherence_pass', 'refinement', 'gap_analysis'
  )),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id),
  turn_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  response_text TEXT,
  prompt_tokens INTEGER,
  response_tokens INTEGER,
  duration_ms INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--------------------------------------------------------------------------------
-- Group 2: Brand Intelligence
--------------------------------------------------------------------------------

CREATE TABLE brand_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL UNIQUE REFERENCES sites(id),
  voice_description TEXT,
  tone_keywords TEXT,
  terminology_patterns TEXT,
  sentence_style TEXT,
  recurring_phrases TEXT,
  anti_patterns TEXT,
  target_audience TEXT,
  key_differentiators TEXT,
  brand_personality TEXT,
  user_confirmed INTEGER DEFAULT 0,
  inference_confidence REAL,
  source_page_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE brand_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  category TEXT NOT NULL CHECK (category IN (
    'voice', 'structure', 'terminology', 'seo', 'geo',
    'localization', 'visual', 'schema', 'linking', 'anti-pattern'
  )),
  rule_text TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('manual', 'feedback', 'inferred', 'research')),
  scope TEXT NOT NULL DEFAULT 'brand' CHECK (scope IN (
    'global', 'brand', 'page_type', 'section_type', 'page'
  )),
  page_type TEXT,
  section_type TEXT,
  confidence REAL DEFAULT 1.0,
  confirmed INTEGER DEFAULT 0,
  source_session_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE brand_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  section_type TEXT,
  page_type TEXT,
  html_content TEXT NOT NULL,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  is_negative INTEGER DEFAULT 0,
  notes TEXT,
  source TEXT CHECK (source IN (
    'existing_content', 'generated_approved', 'generated_rejected', 'manual'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE brand_profile_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_profile_id INTEGER NOT NULL REFERENCES brand_profiles(id),
  snapshot TEXT NOT NULL,
  change_reason TEXT,
  changed_by TEXT CHECK (changed_by IN ('inference', 'user_edit', 'feedback', 'approval')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--------------------------------------------------------------------------------
-- Group 3: Audit & Benchmark
--------------------------------------------------------------------------------

CREATE TABLE site_structure_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  page_type TEXT,
  hierarchy_level INTEGER,
  word_count INTEGER,
  heading_structure TEXT,
  has_schema INTEGER DEFAULT 0,
  schema_types TEXT,
  has_canonical INTEGER DEFAULT 0,
  canonical_url TEXT,
  discovered_via TEXT DEFAULT 'sitemap' CHECK (discovered_via IN ('sitemap', 'crawl', 'manual')),
  url_pattern TEXT,
  status TEXT DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'audited', 'strong', 'adequate', 'weak', 'missing'
  )),
  last_scraped_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  structure_map_id INTEGER NOT NULL REFERENCES site_structure_map(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  seo_score REAL,
  geo_score REAL,
  schema_score REAL,
  design_score REAL,
  voice_score REAL,
  content_depth_score REAL,
  overall_score REAL,
  seo_deficiencies TEXT,
  geo_deficiencies TEXT,
  schema_deficiencies TEXT,
  design_deficiencies TEXT,
  voice_deficiencies TEXT,
  extracted_content TEXT,
  sections TEXT,
  ctas TEXT,
  has_direct_answer_block INTEGER DEFAULT 0,
  has_faq_content INTEGER DEFAULT 0,
  statistics_count INTEGER DEFAULT 0,
  freshness_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE schema_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  structure_map_id INTEGER NOT NULL REFERENCES site_structure_map(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  schema_types_found TEXT,
  schema_format TEXT,
  has_graph INTEGER DEFAULT 0,
  has_id_references INTEGER DEFAULT 0,
  has_same_as INTEGER DEFAULT 0,
  has_breadcrumb INTEGER DEFAULT 0,
  has_faq_schema INTEGER DEFAULT 0,
  validation_errors TEXT,
  missing_types TEXT,
  missing_properties TEXT,
  recommendations TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE css_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  class_name TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  source_file TEXT,
  properties TEXT,
  usage_count INTEGER DEFAULT 0,
  specificity_score INTEGER,
  quality TEXT CHECK (quality IN ('well-structured', 'hacky', 'redundant', 'orphaned')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, class_name)
);

CREATE TABLE benchmark_standards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN (
    'page_type', 'seo', 'geo', 'schema', 'content', 'linking'
  )),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE page_taxonomy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_type TEXT NOT NULL UNIQUE,
  hierarchy_level INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  h1_pattern TEXT,
  required_sections TEXT,
  optional_sections TEXT,
  target_word_count_min INTEGER,
  target_word_count_max INTEGER,
  primary_keyword_pattern TEXT,
  schema_types TEXT,
  silo TEXT,
  geo_requirements TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--------------------------------------------------------------------------------
-- Group 4: Planning
--------------------------------------------------------------------------------

CREATE TABLE gap_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  page_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('missing', 'weak', 'adequate', 'strong')),
  existing_page_id INTEGER REFERENCES site_structure_map(id),
  seo_gap_score REAL,
  geo_gap_score REAL,
  schema_gap_score REAL,
  design_gap_score REAL,
  content_gap_score REAL,
  gsc_impressions INTEGER,
  gsc_ctr REAL,
  gsc_avg_position REAL,
  traffic_potential_score REAL,
  deficiencies TEXT,
  priority INTEGER,
  silo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE work_backlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  gap_analysis_id INTEGER REFERENCES gap_analysis(id),
  page_type TEXT NOT NULL,
  target_url TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'improve', 'rewrite')),
  priority INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'blueprinted', 'in_progress', 'generated', 'approved', 'skipped'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE silo_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  silo_name TEXT NOT NULL,
  description TEXT,
  hub_page_type TEXT,
  hub_url TEXT,
  internal_linking_policy TEXT,
  cross_silo_links TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, silo_name)
);

CREATE TABLE page_blueprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backlog_id INTEGER NOT NULL REFERENCES work_backlog(id),
  site_id INTEGER NOT NULL REFERENCES sites(id),
  target_keywords TEXT,
  working_title TEXT,
  h1_text TEXT,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  page_level_seo_rules TEXT,
  page_level_geo_rules TEXT,
  page_level_voice_rules TEXT,
  page_level_css_rules TEXT,
  section_count INTEGER,
  section_count_rationale TEXT,
  internal_links_required TEXT,
  internal_links_optional TEXT,
  breadcrumb_path TEXT,
  silo_membership TEXT,
  schema_spec TEXT,
  section_order TEXT,
  coherence_requirements TEXT,
  user_approved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE section_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blueprint_id INTEGER NOT NULL REFERENCES page_blueprints(id),
  section_type TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  heading_text TEXT,
  target_word_count_min INTEGER,
  target_word_count_max INTEGER,
  cta_required INTEGER DEFAULT 0,
  cta_text TEXT,
  content_requirements TEXT,
  links_required TEXT,
  direct_answer_block_required INTEGER DEFAULT 0,
  statistics_required INTEGER DEFAULT 0,
  faq_questions TEXT,
  css_classes TEXT,
  design_pattern TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'approved', 'rejected')),
  generated_html TEXT,
  generation_attempt_count INTEGER DEFAULT 0,
  last_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE internal_link_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN (
    'contextual', 'navigation', 'breadcrumb', 'cta', 'hub-spoke', 'sibling', 'footer'
  )),
  anchor_text TEXT,
  anchor_variant TEXT CHECK (anchor_variant IN (
    'exact', 'partial', 'branded', 'natural', 'generic', 'localized'
  )),
  section TEXT,
  status TEXT DEFAULT 'existing' CHECK (status IN ('existing', 'planned', 'generated', 'approved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE anchor_text_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  target_url TEXT NOT NULL,
  variant_type TEXT NOT NULL CHECK (variant_type IN (
    'exact', 'partial', 'branded', 'natural', 'generic', 'localized'
  )),
  anchor_text TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, target_url, anchor_text)
);

CREATE TABLE css_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  pattern_name TEXT NOT NULL,
  description TEXT,
  classes_used TEXT NOT NULL,
  tiers_used TEXT,
  page_types TEXT,
  section_types TEXT,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  usage_count INTEGER DEFAULT 0,
  html_snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE css_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  decision_type TEXT NOT NULL CHECK (decision_type IN ('use', 'avoid', 'replace', 'custom')),
  class_name TEXT,
  replacement_class TEXT,
  rationale TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--------------------------------------------------------------------------------
-- Group 5: Operations
--------------------------------------------------------------------------------

CREATE TABLE gsc_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  url TEXT NOT NULL,
  date_range_start TEXT NOT NULL,
  date_range_end TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0.0,
  average_position REAL,
  top_queries TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE scribe_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER REFERENCES sites(id),
  stage TEXT NOT NULL,
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
    'stage_complete', 'session_pause', 'milestone'
  )),
  deliverables TEXT NOT NULL,
  decisions TEXT,
  state_for_next_session TEXT,
  issues TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_freshness (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  page_url TEXT NOT NULL,
  last_generated_at TEXT,
  last_approved_at TEXT,
  last_deployed_at TEXT,
  freshness_status TEXT DEFAULT 'unknown' CHECK (freshness_status IN (
    'fresh', 'aging', 'stale', 'unknown'
  )),
  next_review_due TEXT,
  alert_sent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, page_url)
);

--------------------------------------------------------------------------------
-- Indexes
--------------------------------------------------------------------------------

CREATE INDEX idx_work_backlog_site_status ON work_backlog(site_id, status);
CREATE INDEX idx_css_audit_site_class ON css_audit(site_id, class_name);
CREATE INDEX idx_anchor_text_bank_site_target ON anchor_text_bank(site_id, target_url, anchor_text);
CREATE INDEX idx_pages_site_url ON pages(site_id, url);
CREATE INDEX idx_site_structure_map_site ON site_structure_map(site_id);
CREATE INDEX idx_content_audit_site ON content_audit(site_id);
CREATE INDEX idx_gap_analysis_site ON gap_analysis(site_id);
CREATE INDEX idx_section_specs_blueprint ON section_specs(blueprint_id);
CREATE INDEX idx_ai_sessions_site ON ai_sessions(site_id);
CREATE INDEX idx_ai_turns_session ON ai_turns(session_id);
