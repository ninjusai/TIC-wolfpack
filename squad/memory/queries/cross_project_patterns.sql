-- cross_project_patterns.sql
-- Find repeated patterns across all projects and sessions
-- Designed for building historical memory layer and pattern recognition
--
-- Parameters:
--   :min_occurrences - Minimum times a pattern must appear (default: 2)
--   :category_filter - Filter by category (optional, use '%' for all)
--
-- Returns: Discovered patterns from report/task data and existing pattern table

-- ============================================================================
-- Section 1: Recurring Issue Patterns (from reports.issues)
-- ============================================================================
WITH issue_patterns AS (
    SELECT
        r.issues as issue_text,
        COUNT(*) as occurrence_count,
        GROUP_CONCAT(DISTINCT r.agent) as agents_affected,
        GROUP_CONCAT(DISTINCT r.id) as report_ids,
        MIN(r.created_at) as first_seen,
        MAX(r.created_at) as last_seen
    FROM reports r
    WHERE r.issues IS NOT NULL
      AND r.issues != ''
    GROUP BY lower(substr(r.issues, 1, 100))  -- Group by first 100 chars normalized
    HAVING COUNT(*) >= COALESCE(:min_occurrences, 2)
    ORDER BY occurrence_count DESC
),

-- ============================================================================
-- Section 2: Agent Workload Patterns
-- ============================================================================
agent_patterns AS (
    SELECT
        r.agent,
        COUNT(*) as total_reports,
        SUM(CASE WHEN r.status = 'complete' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN r.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        ROUND(
            CAST(SUM(CASE WHEN r.status = 'complete' THEN 1 ELSE 0 END) AS REAL) /
            NULLIF(COUNT(*), 0) * 100, 1
        ) as completion_rate,
        GROUP_CONCAT(DISTINCT substr(r.subject, 1, 30)) as common_subjects
    FROM reports r
    GROUP BY r.agent
    HAVING COUNT(*) >= COALESCE(:min_occurrences, 2)
),

-- ============================================================================
-- Section 3: Blocked Task Patterns (what causes blocks)
-- ============================================================================
blocker_patterns AS (
    SELECT
        t.assigned_to as agent,
        COUNT(*) as block_count,
        GROUP_CONCAT(DISTINCT t.title) as blocked_tasks,
        GROUP_CONCAT(DISTINCT t.context) as block_contexts
    FROM tasks t
    WHERE t.status = 'blocked'
    GROUP BY t.assigned_to
    HAVING COUNT(*) >= COALESCE(:min_occurrences, 2)
),

-- ============================================================================
-- Section 4: Delegation Flow Patterns (Alpha's typical workflows)
-- ============================================================================
delegation_patterns AS (
    SELECT
        sl.agent as delegate_to,
        COUNT(*) as delegation_count,
        COUNT(DISTINCT sl.session_id) as sessions_involved
    FROM session_logs sl
    WHERE sl.event_type = 'delegation'
    GROUP BY sl.agent
    HAVING COUNT(*) >= COALESCE(:min_occurrences, 2)
    ORDER BY delegation_count DESC
),

-- ============================================================================
-- Section 5: Subject/Topic Clustering (what work is repeated)
-- ============================================================================
topic_clusters AS (
    SELECT
        -- Extract first significant word from subject as topic indicator
        CASE
            WHEN r.subject LIKE '%schema%' THEN 'schema'
            WHEN r.subject LIKE '%migration%' THEN 'migration'
            WHEN r.subject LIKE '%implement%' THEN 'implementation'
            WHEN r.subject LIKE '%fix%' THEN 'fix'
            WHEN r.subject LIKE '%create%' THEN 'creation'
            WHEN r.subject LIKE '%update%' THEN 'update'
            WHEN r.subject LIKE '%review%' THEN 'review'
            WHEN r.subject LIKE '%test%' THEN 'testing'
            WHEN r.subject LIKE '%document%' THEN 'documentation'
            WHEN r.subject LIKE '%research%' THEN 'research'
            ELSE 'other'
        END as topic,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT r.agent) as agents,
        MIN(r.created_at) as first_occurrence,
        MAX(r.created_at) as last_occurrence
    FROM reports r
    GROUP BY topic
    HAVING COUNT(*) >= COALESCE(:min_occurrences, 2)
    ORDER BY count DESC
),

-- ============================================================================
-- Section 6: Existing Registered Patterns (from patterns table)
-- ============================================================================
registered_patterns AS (
    SELECT
        p.pattern_id,
        p.name,
        p.category,
        p.description,
        p.trigger_conditions,
        p.recommended_actions,
        p.occurrence_count,
        p.confidence_score,
        p.last_seen_at,
        p.is_active
    FROM patterns p
    WHERE (:category_filter IS NULL OR :category_filter = '%' OR p.category LIKE :category_filter)
      AND p.is_active = 1
    ORDER BY p.confidence_score DESC, p.occurrence_count DESC
),

-- ============================================================================
-- Section 7: Solution Effectiveness Patterns
-- ============================================================================
solution_patterns AS (
    SELECT
        s.problem_type,
        COUNT(*) as solution_count,
        AVG(s.effectiveness_score) as avg_effectiveness,
        SUM(s.success_count) as total_successes,
        SUM(s.failure_count) as total_failures,
        GROUP_CONCAT(s.solution_id) as solution_ids
    FROM solutions s
    WHERE s.deprecated = 0
    GROUP BY s.problem_type
    HAVING COUNT(*) >= 1
    ORDER BY avg_effectiveness DESC
),

-- ============================================================================
-- Section 8: Time-based Activity Patterns
-- ============================================================================
activity_patterns AS (
    SELECT
        strftime('%w', created_at) as day_of_week,  -- 0=Sunday, 6=Saturday
        COUNT(*) as activity_count,
        COUNT(DISTINCT agent) as active_agents
    FROM reports
    GROUP BY day_of_week
    ORDER BY activity_count DESC
)

-- ============================================================================
-- Main Output: Combined Pattern Analysis
-- ============================================================================
SELECT
    'cross_project_patterns' as query_type,
    datetime('now') as generated_at,
    COALESCE(:min_occurrences, 2) as min_occurrences,
    COALESCE(:category_filter, '%') as category_filter,
    -- Discovered issue patterns
    (SELECT json_group_array(json_object(
        'issue_text', issue_text,
        'occurrences', occurrence_count,
        'agents_affected', agents_affected,
        'report_ids', report_ids,
        'first_seen', first_seen,
        'last_seen', last_seen
    )) FROM issue_patterns) as recurring_issues_json,
    -- Agent workload patterns
    (SELECT json_group_array(json_object(
        'agent', agent,
        'total_reports', total_reports,
        'completion_rate', completion_rate,
        'blocked_count', blocked,
        'common_subjects', common_subjects
    )) FROM agent_patterns) as agent_patterns_json,
    -- Blocker patterns
    (SELECT json_group_array(json_object(
        'agent', agent,
        'block_count', block_count,
        'blocked_tasks', blocked_tasks,
        'block_contexts', block_contexts
    )) FROM blocker_patterns) as blocker_patterns_json,
    -- Delegation patterns
    (SELECT json_group_array(json_object(
        'delegate_to', delegate_to,
        'delegation_count', delegation_count,
        'sessions_involved', sessions_involved
    )) FROM delegation_patterns) as delegation_patterns_json,
    -- Topic clusters
    (SELECT json_group_array(json_object(
        'topic', topic,
        'count', count,
        'agents', agents,
        'first_occurrence', first_occurrence,
        'last_occurrence', last_occurrence
    )) FROM topic_clusters) as topic_clusters_json,
    -- Registered patterns
    (SELECT json_group_array(json_object(
        'pattern_id', pattern_id,
        'name', name,
        'category', category,
        'description', description,
        'occurrence_count', occurrence_count,
        'confidence_score', confidence_score,
        'last_seen_at', last_seen_at
    )) FROM registered_patterns) as registered_patterns_json,
    -- Solution patterns
    (SELECT json_group_array(json_object(
        'problem_type', problem_type,
        'solution_count', solution_count,
        'avg_effectiveness', ROUND(avg_effectiveness, 2),
        'total_successes', total_successes,
        'total_failures', total_failures,
        'solution_ids', solution_ids
    )) FROM solution_patterns) as solution_patterns_json,
    -- Activity patterns
    (SELECT json_group_array(json_object(
        'day_of_week', day_of_week,
        'activity_count', activity_count,
        'active_agents', active_agents
    )) FROM activity_patterns) as activity_patterns_json;
