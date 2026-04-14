-- pending_items.sql
-- Get all open tasks, blockers, and in-progress work
-- Designed for Scribe to populate ephemeral memory layer
--
-- Parameters:
--   :include_old - Set to 1 to include items older than 7 days (default: 0)
--
-- Returns: All pending/blocked/in_progress items that need attention

-- ============================================================================
-- Section 1: Open Tasks (pending or in_progress)
-- ============================================================================
WITH open_tasks AS (
    SELECT
        t.task_id,
        t.title,
        t.status,
        t.assigned_to,
        t.objective,
        t.context,
        t.subtasks_json,
        t.created_at,
        t.updated_at,
        julianday('now') - julianday(t.created_at) as age_days,
        CASE
            WHEN t.status = 'blocked' THEN 1
            WHEN t.status = 'in_progress' THEN 2
            WHEN t.status = 'pending' THEN 3
            ELSE 4
        END as priority_order
    FROM tasks t
    WHERE t.status IN ('pending', 'in_progress', 'blocked')
      AND (
        COALESCE(:include_old, 0) = 1
        OR t.created_at >= datetime('now', '-7 days')
      )
),

-- ============================================================================
-- Section 2: Blocked Items (highest priority)
-- ============================================================================
blocked_items AS (
    SELECT
        'task' as item_type,
        t.task_id as item_id,
        t.title,
        t.assigned_to as owner,
        t.objective as description,
        t.context as blocker_info,
        t.created_at,
        t.age_days
    FROM open_tasks t
    WHERE t.status = 'blocked'

    UNION ALL

    SELECT
        'report' as item_type,
        CAST(r.id AS TEXT) as item_id,
        r.subject as title,
        r.agent as owner,
        r.summary as description,
        r.issues as blocker_info,
        r.created_at,
        julianday('now') - julianday(r.created_at) as age_days
    FROM reports r
    WHERE r.status = 'blocked'
      AND (
        COALESCE(:include_old, 0) = 1
        OR r.created_at >= datetime('now', '-7 days')
      )
),

-- ============================================================================
-- Section 3: In-Progress Work
-- ============================================================================
active_work AS (
    SELECT
        t.task_id,
        t.title,
        t.assigned_to,
        t.objective,
        t.created_at,
        t.updated_at,
        t.age_days,
        -- Flag stale in-progress items (no update in 24 hours)
        julianday('now') - julianday(t.updated_at) as hours_since_update,
        CASE
            WHEN julianday('now') - julianday(t.updated_at) > 1 THEN 1
            ELSE 0
        END as is_stale
    FROM open_tasks t
    WHERE t.status = 'in_progress'
),

-- ============================================================================
-- Section 4: Pending Tasks (not yet started)
-- ============================================================================
pending_work AS (
    SELECT
        t.task_id,
        t.title,
        t.assigned_to,
        t.objective,
        t.created_at,
        t.age_days
    FROM open_tasks t
    WHERE t.status = 'pending'
    ORDER BY t.created_at ASC
),

-- ============================================================================
-- Section 5: Recent Next Steps (from completed reports)
-- ============================================================================
pending_next_steps AS (
    SELECT
        r.id as report_id,
        r.agent,
        r.subject,
        r.next_steps,
        r.created_at
    FROM reports r
    WHERE r.next_steps IS NOT NULL
      AND r.next_steps != ''
      AND r.status = 'complete'
      AND r.created_at >= datetime('now', '-7 days')
    ORDER BY r.created_at DESC
    LIMIT 20
),

-- ============================================================================
-- Section 6: Unresolved Issues (from recent reports)
-- ============================================================================
unresolved_issues AS (
    SELECT
        r.id as report_id,
        r.agent,
        r.subject,
        r.issues,
        r.created_at
    FROM reports r
    WHERE r.issues IS NOT NULL
      AND r.issues != ''
      AND r.created_at >= datetime('now', '-7 days')
      -- Exclude issues from blocked reports (those are tracked separately)
      AND r.status != 'blocked'
    ORDER BY r.created_at DESC
)

-- ============================================================================
-- Main Output: Combined Pending Items Summary
-- ============================================================================
SELECT
    'pending_items' as query_type,
    datetime('now') as generated_at,
    COALESCE(:include_old, 0) as include_old,
    -- Counts
    (SELECT COUNT(*) FROM blocked_items) as blocked_count,
    (SELECT COUNT(*) FROM active_work) as in_progress_count,
    (SELECT COUNT(*) FROM active_work WHERE is_stale = 1) as stale_in_progress_count,
    (SELECT COUNT(*) FROM pending_work) as pending_count,
    (SELECT COUNT(*) FROM pending_next_steps) as pending_next_steps_count,
    (SELECT COUNT(*) FROM unresolved_issues) as unresolved_issues_count,
    -- Blocked items (highest priority)
    (SELECT json_group_array(json_object(
        'item_type', item_type,
        'item_id', item_id,
        'title', title,
        'owner', owner,
        'description', description,
        'blocker_info', blocker_info,
        'age_days', ROUND(age_days, 1)
    )) FROM blocked_items) as blocked_items_json,
    -- In-progress work
    (SELECT json_group_array(json_object(
        'task_id', task_id,
        'title', title,
        'assigned_to', assigned_to,
        'objective', objective,
        'age_days', ROUND(age_days, 1),
        'is_stale', is_stale
    )) FROM active_work) as active_work_json,
    -- Pending work
    (SELECT json_group_array(json_object(
        'task_id', task_id,
        'title', title,
        'assigned_to', assigned_to,
        'objective', objective,
        'age_days', ROUND(age_days, 1)
    )) FROM pending_work) as pending_work_json,
    -- Next steps to follow up on
    (SELECT json_group_array(json_object(
        'report_id', report_id,
        'agent', agent,
        'subject', subject,
        'next_steps', next_steps
    )) FROM pending_next_steps) as next_steps_json,
    -- Unresolved issues
    (SELECT json_group_array(json_object(
        'report_id', report_id,
        'agent', agent,
        'subject', subject,
        'issues', issues
    )) FROM unresolved_issues) as unresolved_issues_json;
