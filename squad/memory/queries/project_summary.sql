-- project_summary.sql
-- Get recent activity summary for a project
-- Designed for Scribe to generate project memory layer files
--
-- Parameters:
--   :project_name - The project identifier (or '%' for all projects)
--   :days_back    - How many days of activity to include (default: 30)
--
-- Returns: Aggregated activity metrics and key events for the project

-- ============================================================================
-- Section 1: Task Statistics
-- ============================================================================
WITH task_stats AS (
    SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active_tasks,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        GROUP_CONCAT(DISTINCT assigned_to) as agents_involved
    FROM tasks
    WHERE created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
),

-- ============================================================================
-- Section 2: Report Statistics by Agent
-- ============================================================================
report_stats AS (
    SELECT
        COUNT(*) as total_reports,
        COUNT(DISTINCT agent) as unique_agents,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as successful_reports,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_reports,
        GROUP_CONCAT(DISTINCT agent) as reporting_agents
    FROM reports
    WHERE created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
),

-- ============================================================================
-- Section 3: Agent Activity Breakdown
-- ============================================================================
agent_activity AS (
    SELECT
        r.agent,
        COUNT(*) as report_count,
        GROUP_CONCAT(r.subject, ' | ') as subjects_worked_on,
        MAX(r.created_at) as last_active
    FROM reports r
    WHERE r.created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
    GROUP BY r.agent
    ORDER BY report_count DESC
),

-- ============================================================================
-- Section 4: Recent Key Decisions
-- ============================================================================
key_decisions AS (
    SELECT
        r.date,
        r.agent,
        r.subject,
        r.decisions
    FROM reports r
    WHERE r.decisions IS NOT NULL
      AND r.decisions != ''
      AND r.created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
    ORDER BY r.created_at DESC
    LIMIT 10
),

-- ============================================================================
-- Section 5: Issues Encountered
-- ============================================================================
recent_issues AS (
    SELECT
        r.date,
        r.agent,
        r.subject,
        r.issues
    FROM reports r
    WHERE r.issues IS NOT NULL
      AND r.issues != ''
      AND r.created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
    ORDER BY r.created_at DESC
    LIMIT 10
),

-- ============================================================================
-- Section 6: Deliverables Summary
-- ============================================================================
deliverables_summary AS (
    SELECT
        r.agent,
        r.subject,
        r.deliverables,
        r.created_at
    FROM reports r
    WHERE r.deliverables IS NOT NULL
      AND r.deliverables != ''
      AND r.created_at >= datetime('now', '-' || COALESCE(:days_back, 30) || ' days')
    ORDER BY r.created_at DESC
    LIMIT 20
)

-- ============================================================================
-- Main Output: Combined Project Summary
-- ============================================================================
SELECT
    'project_summary' as query_type,
    COALESCE(:days_back, 30) as days_covered,
    datetime('now') as generated_at,
    (SELECT total_tasks FROM task_stats) as total_tasks,
    (SELECT completed_tasks FROM task_stats) as completed_tasks,
    (SELECT active_tasks FROM task_stats) as active_tasks,
    (SELECT blocked_tasks FROM task_stats) as blocked_tasks,
    (SELECT total_reports FROM report_stats) as total_reports,
    (SELECT unique_agents FROM report_stats) as unique_agents,
    (SELECT agents_involved FROM task_stats) as all_agents_involved,
    (SELECT json_group_array(json_object(
        'agent', agent,
        'report_count', report_count,
        'last_active', last_active
    )) FROM agent_activity) as agent_breakdown_json,
    (SELECT json_group_array(json_object(
        'date', date,
        'agent', agent,
        'subject', subject,
        'decision', decisions
    )) FROM key_decisions) as key_decisions_json,
    (SELECT json_group_array(json_object(
        'date', date,
        'agent', agent,
        'subject', subject,
        'issue', issues
    )) FROM recent_issues) as issues_json,
    (SELECT json_group_array(json_object(
        'agent', agent,
        'subject', subject,
        'deliverables', deliverables
    )) FROM deliverables_summary) as deliverables_json;
