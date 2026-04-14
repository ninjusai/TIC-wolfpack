-- session_summary.sql
-- Summarize a session's reports, tasks, and events
-- Designed for archiving sessions and generating memory snapshots
--
-- Parameters:
--   :session_id - The session ID to summarize
--
-- Returns: Comprehensive session summary with all related activity

-- ============================================================================
-- Section 1: Session Event Statistics
-- ============================================================================
WITH session_events AS (
    SELECT
        sl.id,
        sl.event_type,
        sl.agent,
        sl.content,
        sl.timestamp,
        sl.created_at
    FROM session_logs sl
    WHERE sl.session_id = :session_id
),

event_stats AS (
    SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT agent) as unique_agents,
        MIN(timestamp) as session_start,
        MAX(timestamp) as session_end,
        GROUP_CONCAT(DISTINCT event_type) as event_types,
        GROUP_CONCAT(DISTINCT agent) as agents_involved
    FROM session_events
),

-- ============================================================================
-- Section 2: Events by Type Breakdown
-- ============================================================================
events_by_type AS (
    SELECT
        event_type,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT agent) as agents
    FROM session_events
    GROUP BY event_type
),

-- ============================================================================
-- Section 3: Agent Event Summary
-- ============================================================================
agent_events AS (
    SELECT
        agent,
        COUNT(*) as event_count,
        GROUP_CONCAT(DISTINCT event_type) as event_types,
        MIN(timestamp) as first_event,
        MAX(timestamp) as last_event
    FROM session_events
    WHERE agent IS NOT NULL
    GROUP BY agent
),

-- ============================================================================
-- Section 4: Reports Filed During Session
-- ============================================================================
session_reports AS (
    SELECT
        r.id,
        r.date,
        r.agent,
        r.subject,
        r.status,
        r.summary,
        r.decisions,
        r.deliverables,
        r.issues,
        r.next_steps,
        r.created_at
    FROM reports r
    WHERE EXISTS (
        SELECT 1 FROM session_events se
        WHERE se.agent = r.agent
          AND date(se.timestamp) = r.date
    )
    ORDER BY r.created_at
),

-- ============================================================================
-- Section 5: Tasks Active During Session
-- ============================================================================
session_tasks AS (
    SELECT
        t.task_id,
        t.title,
        t.status,
        t.assigned_to,
        t.objective,
        t.created_at,
        t.updated_at
    FROM tasks t
    WHERE EXISTS (
        SELECT 1 FROM session_events se
        WHERE (se.agent = t.assigned_to OR se.content LIKE '%' || t.task_id || '%')
          AND date(se.timestamp) = t.date
    )
),

-- ============================================================================
-- Section 6: Key Content Extraction (Decisions, Issues)
-- ============================================================================
key_decisions AS (
    SELECT
        r.agent,
        r.subject,
        r.decisions
    FROM session_reports r
    WHERE r.decisions IS NOT NULL AND r.decisions != ''
),

key_issues AS (
    SELECT
        r.agent,
        r.subject,
        r.issues
    FROM session_reports r
    WHERE r.issues IS NOT NULL AND r.issues != ''
),

-- ============================================================================
-- Section 7: Delegation Chain (request -> delegation -> report)
-- ============================================================================
delegation_chain AS (
    SELECT
        se.timestamp,
        se.event_type,
        se.agent,
        se.content
    FROM session_events se
    WHERE se.event_type IN ('request', 'delegation', 'report', 'decision')
    ORDER BY se.timestamp
)

-- ============================================================================
-- Main Output: Complete Session Summary
-- ============================================================================
SELECT
    :session_id as session_id,
    datetime('now') as generated_at,
    -- Basic stats
    (SELECT total_events FROM event_stats) as total_events,
    (SELECT unique_agents FROM event_stats) as unique_agents,
    (SELECT session_start FROM event_stats) as session_start,
    (SELECT session_end FROM event_stats) as session_end,
    (SELECT agents_involved FROM event_stats) as agents_involved,
    -- Reports
    (SELECT COUNT(*) FROM session_reports) as report_count,
    (SELECT SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) FROM session_reports) as completed_reports,
    (SELECT SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) FROM session_reports) as blocked_reports,
    -- Tasks
    (SELECT COUNT(*) FROM session_tasks) as task_count,
    (SELECT SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) FROM session_tasks) as completed_tasks,
    -- Structured JSON outputs
    (SELECT json_group_array(json_object(
        'event_type', event_type,
        'count', count,
        'agents', agents
    )) FROM events_by_type) as events_by_type_json,
    (SELECT json_group_array(json_object(
        'agent', agent,
        'event_count', event_count,
        'event_types', event_types,
        'first_event', first_event,
        'last_event', last_event
    )) FROM agent_events) as agent_summary_json,
    (SELECT json_group_array(json_object(
        'id', id,
        'agent', agent,
        'subject', subject,
        'status', status,
        'summary', summary,
        'decisions', decisions,
        'deliverables', deliverables,
        'issues', issues,
        'next_steps', next_steps
    )) FROM session_reports) as reports_json,
    (SELECT json_group_array(json_object(
        'task_id', task_id,
        'title', title,
        'status', status,
        'assigned_to', assigned_to,
        'objective', objective
    )) FROM session_tasks) as tasks_json,
    (SELECT json_group_array(json_object(
        'agent', agent,
        'subject', subject,
        'decisions', decisions
    )) FROM key_decisions) as key_decisions_json,
    (SELECT json_group_array(json_object(
        'agent', agent,
        'subject', subject,
        'issues', issues
    )) FROM key_issues) as key_issues_json,
    (SELECT json_group_array(json_object(
        'timestamp', timestamp,
        'event_type', event_type,
        'agent', agent,
        'content', content
    )) FROM delegation_chain) as delegation_chain_json;
