-- Wolf Pack Memory System Schema Extension
-- Version: 1 (PRAGMA user_version will be set to 1 after migration)
-- Purpose: Support three-layer persistent memory with automated extraction,
--          compression history, and pattern/solution indexing.
--
-- Tables:
--   memory_snapshots   - Tracks when memory files were last generated
--   archived_sessions  - Compressed summaries for sessions >30 days old
--   patterns           - Discovered patterns with tags and cross-references
--   solutions          - Reusable solutions indexed by problem type
--
-- Dependencies: Requires existing tables: reports, tasks, session_logs, agents

-- ============================================================================
-- memory_snapshots: Tracks when each memory file was last updated
-- Used by Scribe to know which files need regeneration
-- ============================================================================
CREATE TABLE IF NOT EXISTS memory_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT UNIQUE NOT NULL,           -- Relative path to memory file (e.g., "squad/memory/ephemeral.md")
    layer TEXT NOT NULL CHECK(layer IN ('ephemeral', 'project', 'historical')),
    project_id TEXT,                          -- NULL for ephemeral/historical, project name for project layer
    last_generated_at TEXT NOT NULL,          -- ISO timestamp of last generation
    last_source_hash TEXT,                    -- Hash of source data for change detection
    generation_count INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,                       -- Flexible metadata (generator version, config, etc.)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_snapshots_layer ON memory_snapshots(layer);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_project ON memory_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_generated ON memory_snapshots(last_generated_at);

-- ============================================================================
-- archived_sessions: Compressed session summaries for old sessions
-- Sessions >30 days get compressed to save space while preserving key insights
-- ============================================================================
CREATE TABLE IF NOT EXISTS archived_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,          -- Original session_id from session_logs
    session_date TEXT NOT NULL,               -- Date of the session (YYYY-MM-DD)
    agent_summary_json TEXT,                  -- JSON: {agent: {event_count, key_events}}
    task_summary_json TEXT,                   -- JSON: {task_id: {title, final_status, outcome}}
    report_count INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    key_decisions TEXT,                       -- Extracted important decisions
    key_outcomes TEXT,                        -- Extracted important outcomes
    patterns_discovered TEXT,                 -- Comma-separated pattern IDs found
    problems_encountered TEXT,                -- Summary of issues faced
    solutions_applied TEXT,                   -- Comma-separated solution IDs used
    compressed_from_rows INTEGER,             -- How many session_logs rows were compressed
    original_data_hash TEXT,                  -- Hash for integrity verification
    archived_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archived_sessions_date ON archived_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_archived_sessions_archived_at ON archived_sessions(archived_at);

-- ============================================================================
-- patterns: Discovered patterns with tags and references
-- Enables cross-project learning and pattern recognition
-- ============================================================================
CREATE TABLE IF NOT EXISTS patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT UNIQUE NOT NULL,          -- Human-readable ID (e.g., "PAT-001")
    name TEXT NOT NULL,                       -- Short pattern name
    description TEXT NOT NULL,                -- What this pattern is
    category TEXT NOT NULL,                   -- Category: workflow, code, architecture, communication, etc.
    tags_json TEXT,                           -- JSON array of tags for search
    trigger_conditions TEXT,                  -- When this pattern applies
    recommended_actions TEXT,                 -- What to do when pattern is recognized
    examples_json TEXT,                       -- JSON array of example occurrences
    source_reports_json TEXT,                 -- JSON array of report IDs where discovered
    source_sessions_json TEXT,                -- JSON array of session IDs where discovered
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.5 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
    is_active INTEGER NOT NULL DEFAULT 1,     -- 0 = deprecated/superseded
    superseded_by TEXT,                       -- pattern_id of newer pattern if deprecated
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_active ON patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen ON patterns(last_seen_at);

-- ============================================================================
-- solutions: Reusable solutions indexed by problem type
-- Captures what worked so it can be reused
-- ============================================================================
CREATE TABLE IF NOT EXISTS solutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solution_id TEXT UNIQUE NOT NULL,         -- Human-readable ID (e.g., "SOL-001")
    problem_type TEXT NOT NULL,               -- Type of problem this solves
    problem_description TEXT NOT NULL,        -- Detailed problem statement
    solution_description TEXT NOT NULL,       -- How to solve it
    implementation_notes TEXT,                -- Specific implementation details
    prerequisites TEXT,                       -- What's needed before applying
    tags_json TEXT,                           -- JSON array of tags for search
    related_patterns_json TEXT,               -- JSON array of related pattern_ids
    tech_stack_json TEXT,                     -- JSON array of technologies involved
    source_report_id INTEGER,                 -- Report where solution was found
    source_task_id TEXT,                      -- Task where solution was applied
    success_count INTEGER NOT NULL DEFAULT 1, -- Times this solution worked
    failure_count INTEGER NOT NULL DEFAULT 0, -- Times this solution failed
    effectiveness_score REAL GENERATED ALWAYS AS (
        CASE WHEN (success_count + failure_count) > 0
        THEN CAST(success_count AS REAL) / (success_count + failure_count)
        ELSE 0.5 END
    ) STORED,
    last_used_at TEXT,
    is_verified INTEGER NOT NULL DEFAULT 0,   -- 1 = manually verified as good
    deprecated INTEGER NOT NULL DEFAULT 0,    -- 1 = no longer recommended
    deprecation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (source_report_id) REFERENCES reports(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_solutions_problem_type ON solutions(problem_type);
CREATE INDEX IF NOT EXISTS idx_solutions_effectiveness ON solutions(effectiveness_score);
CREATE INDEX IF NOT EXISTS idx_solutions_verified ON solutions(is_verified);
CREATE INDEX IF NOT EXISTS idx_solutions_deprecated ON solutions(deprecated);
CREATE INDEX IF NOT EXISTS idx_solutions_last_used ON solutions(last_used_at);

-- ============================================================================
-- Helper view: Recent activity summary for quick dashboard queries
-- ============================================================================
CREATE VIEW IF NOT EXISTS v_recent_activity AS
SELECT
    'report' as activity_type,
    r.id as activity_id,
    r.date,
    r.agent,
    r.subject as title,
    r.status,
    r.created_at
FROM reports r
WHERE r.created_at >= datetime('now', '-7 days')
UNION ALL
SELECT
    'task' as activity_type,
    t.id as activity_id,
    t.date,
    t.assigned_to as agent,
    t.title,
    t.status,
    t.created_at
FROM tasks t
WHERE t.created_at >= datetime('now', '-7 days')
UNION ALL
SELECT
    'session' as activity_type,
    sl.id as activity_id,
    sl.date,
    sl.agent,
    sl.event_type || ': ' || substr(sl.content, 1, 50) as title,
    sl.event_type as status,
    sl.created_at
FROM session_logs sl
WHERE sl.created_at >= datetime('now', '-7 days')
ORDER BY created_at DESC;

-- ============================================================================
-- Helper view: Pattern usage statistics
-- ============================================================================
CREATE VIEW IF NOT EXISTS v_pattern_stats AS
SELECT
    p.pattern_id,
    p.name,
    p.category,
    p.occurrence_count,
    p.confidence_score,
    p.last_seen_at,
    julianday('now') - julianday(p.last_seen_at) as days_since_seen,
    CASE
        WHEN p.is_active = 0 THEN 'deprecated'
        WHEN p.confidence_score >= 0.8 THEN 'high_confidence'
        WHEN p.confidence_score >= 0.5 THEN 'medium_confidence'
        ELSE 'low_confidence'
    END as status_label
FROM patterns p
ORDER BY p.confidence_score DESC, p.occurrence_count DESC;

-- ============================================================================
-- Helper view: Solution effectiveness ranking
-- ============================================================================
CREATE VIEW IF NOT EXISTS v_solution_rankings AS
SELECT
    s.solution_id,
    s.problem_type,
    s.solution_description,
    s.success_count,
    s.failure_count,
    s.effectiveness_score,
    s.is_verified,
    CASE
        WHEN s.deprecated = 1 THEN 'deprecated'
        WHEN s.is_verified = 1 AND s.effectiveness_score >= 0.8 THEN 'recommended'
        WHEN s.effectiveness_score >= 0.7 THEN 'good'
        WHEN s.effectiveness_score >= 0.5 THEN 'fair'
        ELSE 'needs_review'
    END as recommendation_level
FROM solutions s
WHERE s.deprecated = 0
ORDER BY s.effectiveness_score DESC, s.success_count DESC;
