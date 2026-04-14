//! SQLite query commands for the wolfpack.db tables.
//!
//! Provides filtered, sorted, paginated queries for reports, tasks,
//! session_logs, and agents. All SQL uses parameterized queries via `params![]`.

use rusqlite::params_from_iter;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/// Generic query result returned to the frontend.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_count: u64,
}

/// A single session event for the recent-activity helper.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub id: i64,
    pub event_type: String,
    pub agent: Option<String>,
    pub content: String,
    pub timestamp: String,
}

/// Aggregate stats returned by `get_summary_stats`.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryStats {
    pub tasks_by_status: Vec<StatusCount>,
    pub total_reports: u64,
    pub total_agents: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusCount {
    pub status: String,
    pub count: u64,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT: u32 = 50;
const DEFAULT_OFFSET: u32 = 0;

/// Check whether a table exists in the database.
fn table_exists(conn: &rusqlite::Connection, table_name: &str) -> Result<bool, AppError> {
    let mut stmt = conn.prepare(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
    )?;
    let count: i64 = stmt.query_row(rusqlite::params![table_name], |row| row.get(0))?;
    Ok(count > 0)
}

fn empty_result(columns: Vec<String>) -> QueryResult {
    QueryResult {
        columns,
        rows: Vec::new(),
        total_count: 0,
    }
}

/// Validate and return a safe column name for sorting reports.
fn validate_reports_sort_column(sort_by: &str) -> Option<&'static str> {
    match sort_by {
        "id" => Some("id"),
        "agent" => Some("agent"),
        "subject" => Some("subject"),
        "status" => Some("status"),
        "summary" => Some("summary"),
        "created_at" => Some("created_at"),
        "date" => Some("date"),
        _ => None,
    }
}

/// Validate and return a safe column name for sorting tasks.
fn validate_tasks_sort_column(sort_by: &str) -> Option<&'static str> {
    match sort_by {
        "id" => Some("id"),
        "task_id" => Some("task_id"),
        "title" => Some("title"),
        "status" => Some("status"),
        "assigned_to" => Some("assigned_to"),
        "created_at" => Some("created_at"),
        "updated_at" => Some("updated_at"),
        "date" => Some("date"),
        _ => None,
    }
}

/// Validate and return a safe column name for sorting sessions.
fn validate_sessions_sort_column(sort_by: &str) -> Option<&'static str> {
    match sort_by {
        "id" => Some("id"),
        "event_type" => Some("event_type"),
        "agent" => Some("agent"),
        "content" => Some("content"),
        "timestamp" => Some("timestamp"),
        "created_at" => Some("created_at"),
        "date" => Some("date"),
        _ => None,
    }
}

/// Validate sort direction, defaulting to DESC.
fn validate_sort_dir(sort_dir: Option<&str>) -> &'static str {
    match sort_dir {
        Some(dir) if dir.eq_ignore_ascii_case("asc") => "ASC",
        Some(dir) if dir.eq_ignore_ascii_case("desc") => "DESC",
        _ => "DESC",
    }
}

// ---------------------------------------------------------------------------
// 1. query_reports
// ---------------------------------------------------------------------------

/// Error message when database is not connected.
const DB_NOT_CONNECTED_MSG: &str =
    "Database not connected. Please configure Project Root and DB Path in Settings, then click 'Apply & Reconnect'.";

#[tauri::command]
pub async fn query_reports(
    state: State<'_, DbState>,
    search: Option<String>,
    agent: Option<String>,
    status: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    let columns: Vec<String> = vec![
        "id", "agent", "subject", "status", "summary", "decisions",
        "deliverables", "issues", "next_steps", "created_at",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    if !table_exists(&conn, "reports")? {
        return Ok(empty_result(columns));
    }

    // Build dynamic WHERE clause
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1u32;

    if let Some(ref search_term) = search {
        conditions.push(format!(
            "(subject LIKE ?{} OR summary LIKE ?{})",
            idx,
            idx + 1
        ));
        let pattern = format!("%{}%", search_term);
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern));
        idx += 2;
    }
    if let Some(ref agent_val) = agent {
        conditions.push(format!("agent = ?{}", idx));
        param_values.push(Box::new(agent_val.clone()));
        idx += 1;
    }
    if let Some(ref status_val) = status {
        conditions.push(format!("status = ?{}", idx));
        param_values.push(Box::new(status_val.clone()));
        idx += 1;
    }
    if let Some(ref from_date) = date_from {
        conditions.push(format!("created_at >= ?{}", idx));
        param_values.push(Box::new(from_date.clone()));
        idx += 1;
    }
    if let Some(ref to_date) = date_to {
        conditions.push(format!("created_at <= ?{}", idx));
        param_values.push(Box::new(to_date.clone()));
        idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Count query (using same params except limit/offset)
    let count_sql = format!("SELECT count(*) FROM reports {}", where_clause);
    let total_count: u64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| row.get::<_, i64>(0),
        )? as u64
    };

    // Determine sort column (with whitelist validation)
    let sort_column = sort_by
        .as_deref()
        .and_then(validate_reports_sort_column)
        .unwrap_or("created_at");
    let sort_direction = validate_sort_dir(sort_dir.as_deref());

    // Data query
    let limit_val = limit.unwrap_or(DEFAULT_LIMIT);
    let offset_val = offset.unwrap_or(DEFAULT_OFFSET);

    let data_sql = format!(
        "SELECT id, agent, subject, status, summary, decisions, deliverables, issues, next_steps, created_at \
         FROM reports {} ORDER BY {} {} LIMIT ?{} OFFSET ?{}",
        where_clause, sort_column, sort_direction, idx, idx + 1
    );

    param_values.push(Box::new(limit_val));
    param_values.push(Box::new(offset_val));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt
        .query_map(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| {
                Ok(vec![
                    row_to_json_i64(row, 0)?,
                    row_to_json_str(row, 1)?,
                    row_to_json_str(row, 2)?,
                    row_to_json_str(row, 3)?,
                    row_to_json_str_opt(row, 4)?,
                    row_to_json_str_opt(row, 5)?,
                    row_to_json_str_opt(row, 6)?,
                    row_to_json_str_opt(row, 7)?,
                    row_to_json_str_opt(row, 8)?,
                    row_to_json_str(row, 9)?,
                ])
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(QueryResult {
        columns,
        rows,
        total_count,
    })
}

// ---------------------------------------------------------------------------
// 2. query_tasks
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn query_tasks(
    state: State<'_, DbState>,
    search: Option<String>,
    assigned_to: Option<String>,
    status: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    let columns: Vec<String> = vec![
        "id", "taskId", "title", "assignedTo", "objective", "status", "createdAt", "updatedAt",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    if !table_exists(&conn, "tasks")? {
        return Ok(empty_result(columns));
    }

    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1u32;

    if let Some(ref search_term) = search {
        conditions.push(format!(
            "(title LIKE ?{} OR objective LIKE ?{})",
            idx,
            idx + 1
        ));
        let pattern = format!("%{}%", search_term);
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern));
        idx += 2;
    }
    if let Some(ref assigned) = assigned_to {
        conditions.push(format!("assigned_to = ?{}", idx));
        param_values.push(Box::new(assigned.clone()));
        idx += 1;
    }
    if let Some(ref status_val) = status {
        conditions.push(format!("status = ?{}", idx));
        param_values.push(Box::new(status_val.clone()));
        idx += 1;
    }
    if let Some(ref from_date) = date_from {
        conditions.push(format!("created_at >= ?{}", idx));
        param_values.push(Box::new(from_date.clone()));
        idx += 1;
    }
    if let Some(ref to_date) = date_to {
        conditions.push(format!("created_at <= ?{}", idx));
        param_values.push(Box::new(to_date.clone()));
        idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT count(*) FROM tasks {}", where_clause);
    let total_count: u64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| row.get::<_, i64>(0),
        )? as u64
    };

    // Determine sort column (with whitelist validation)
    let sort_column = sort_by
        .as_deref()
        .and_then(validate_tasks_sort_column)
        .unwrap_or("created_at");
    let sort_direction = validate_sort_dir(sort_dir.as_deref());

    let limit_val = limit.unwrap_or(DEFAULT_LIMIT);
    let offset_val = offset.unwrap_or(DEFAULT_OFFSET);

    let data_sql = format!(
        "SELECT id, task_id, title, assigned_to, objective, status, created_at, updated_at \
         FROM tasks {} ORDER BY {} {} LIMIT ?{} OFFSET ?{}",
        where_clause, sort_column, sort_direction, idx, idx + 1
    );

    param_values.push(Box::new(limit_val));
    param_values.push(Box::new(offset_val));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt
        .query_map(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| {
                Ok(vec![
                    row_to_json_i64(row, 0)?,
                    row_to_json_str(row, 1)?,
                    row_to_json_str(row, 2)?,
                    row_to_json_str_opt(row, 3)?,
                    row_to_json_str_opt(row, 4)?,
                    row_to_json_str(row, 5)?,
                    row_to_json_str(row, 6)?,
                    row_to_json_str(row, 7)?,
                ])
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(QueryResult {
        columns,
        rows,
        total_count,
    })
}

// ---------------------------------------------------------------------------
// 3. query_sessions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn query_sessions(
    state: State<'_, DbState>,
    search: Option<String>,
    agent: Option<String>,
    event_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    let columns: Vec<String> = vec!["id", "event", "agent", "content", "timestamp"]
        .into_iter()
        .map(String::from)
        .collect();

    if !table_exists(&conn, "session_logs")? {
        return Ok(empty_result(columns));
    }

    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1u32;

    if let Some(ref search_term) = search {
        conditions.push(format!("content LIKE ?{}", idx));
        let pattern = format!("%{}%", search_term);
        param_values.push(Box::new(pattern));
        idx += 1;
    }
    if let Some(ref agent_val) = agent {
        conditions.push(format!("agent = ?{}", idx));
        param_values.push(Box::new(agent_val.clone()));
        idx += 1;
    }
    if let Some(ref event) = event_type {
        conditions.push(format!("event_type = ?{}", idx));
        param_values.push(Box::new(event.clone()));
        idx += 1;
    }
    if let Some(ref from_date) = date_from {
        conditions.push(format!("timestamp >= ?{}", idx));
        param_values.push(Box::new(from_date.clone()));
        idx += 1;
    }
    if let Some(ref to_date) = date_to {
        conditions.push(format!("timestamp <= ?{}", idx));
        param_values.push(Box::new(to_date.clone()));
        idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT count(*) FROM session_logs {}", where_clause);
    let total_count: u64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| row.get::<_, i64>(0),
        )? as u64
    };

    // Determine sort column (with whitelist validation)
    let sort_column = sort_by
        .as_deref()
        .and_then(validate_sessions_sort_column)
        .unwrap_or("timestamp");
    let sort_direction = validate_sort_dir(sort_dir.as_deref());

    let limit_val = limit.unwrap_or(DEFAULT_LIMIT);
    let offset_val = offset.unwrap_or(DEFAULT_OFFSET);

    let data_sql = format!(
        "SELECT id, event_type, agent, content, timestamp \
         FROM session_logs {} ORDER BY {} {} LIMIT ?{} OFFSET ?{}",
        where_clause, sort_column, sort_direction, idx, idx + 1
    );

    param_values.push(Box::new(limit_val));
    param_values.push(Box::new(offset_val));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt
        .query_map(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| {
                Ok(vec![
                    row_to_json_i64(row, 0)?,
                    row_to_json_str(row, 1)?,
                    row_to_json_str_opt(row, 2)?,
                    row_to_json_str(row, 3)?,
                    row_to_json_str(row, 4)?,
                ])
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(QueryResult {
        columns,
        rows,
        total_count,
    })
}

// ---------------------------------------------------------------------------
// 4. query_agents
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn query_agents(
    state: State<'_, DbState>,
    search: Option<String>,
    status: Option<String>,
) -> Result<QueryResult, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    let columns: Vec<String> = vec![
        "id", "name", "role", "status", "file", "reportsTo", "description", "createdAt",
    ]
    .into_iter()
    .map(String::from)
    .collect();

    // If the agents table exists, query it directly.
    if table_exists(&conn, "agents")? {
        return query_agents_from_db(&conn, search, status, &columns);
    }

    // Fallback: read from squad/registry.json
    drop(guard); // release the lock before doing file I/O
    query_agents_from_registry(search, status, &columns)
}

fn query_agents_from_db(
    conn: &rusqlite::Connection,
    search: Option<String>,
    status: Option<String>,
    columns: &[String],
) -> Result<QueryResult, AppError> {
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1u32;

    if let Some(ref search_term) = search {
        conditions.push(format!(
            "(name LIKE ?{} OR role LIKE ?{} OR description LIKE ?{})",
            idx,
            idx + 1,
            idx + 2
        ));
        let pattern = format!("%{}%", search_term);
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern.clone()));
        param_values.push(Box::new(pattern));
        idx += 3;
    }
    if let Some(ref status_val) = status {
        conditions.push(format!("status = ?{}", idx));
        param_values.push(Box::new(status_val.clone()));
        idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_sql = format!("SELECT count(*) FROM agents {}", where_clause);
    let total_count: u64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        stmt.query_row(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| row.get::<_, i64>(0),
        )? as u64
    };

    // Agents query doesn't need pagination/sorting per spec, but we'll use sensible defaults
    let data_sql = format!(
        "SELECT id, name, role, status, file, reports_to, description, created_at \
         FROM agents {} ORDER BY name ASC LIMIT ?{} OFFSET ?{}",
        where_clause, idx, idx + 1
    );

    param_values.push(Box::new(DEFAULT_LIMIT));
    param_values.push(Box::new(DEFAULT_OFFSET));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt
        .query_map(
            params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| {
                Ok(vec![
                    row_to_json_i64(row, 0)?,
                    row_to_json_str(row, 1)?,
                    row_to_json_str(row, 2)?,
                    row_to_json_str(row, 3)?,
                    row_to_json_str_opt(row, 4)?,
                    row_to_json_str_opt(row, 5)?,
                    row_to_json_str_opt(row, 6)?,
                    row_to_json_str(row, 7)?,
                ])
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(QueryResult {
        columns: columns.to_vec(),
        rows,
        total_count,
    })
}

fn query_agents_from_registry(
    search: Option<String>,
    status: Option<String>,
    columns: &[String],
) -> Result<QueryResult, AppError> {
    let registry_path = "squad/registry.json";
    let data = std::fs::read_to_string(registry_path).map_err(|e| {
        AppError::Custom(format!(
            "Could not read registry at '{}': {}. Neither agents table nor registry available.",
            registry_path, e
        ))
    })?;

    let registry: serde_json::Value = serde_json::from_str(&data)?;
    let agents = registry
        .get("agents")
        .and_then(|a| a.as_array())
        .cloned()
        .unwrap_or_default();

    // Apply filters in-memory
    let filtered: Vec<&serde_json::Value> = agents
        .iter()
        .filter(|a| {
            if let Some(ref search_term) = search {
                let s = search_term.to_lowercase();
                let name = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let role = a.get("role").and_then(|v| v.as_str()).unwrap_or("");
                let desc = a.get("description").and_then(|v| v.as_str()).unwrap_or("");
                if !name.to_lowercase().contains(&s)
                    && !role.to_lowercase().contains(&s)
                    && !desc.to_lowercase().contains(&s)
                {
                    return false;
                }
            }
            if let Some(ref status_val) = status {
                let agent_status = a.get("status").and_then(|v| v.as_str()).unwrap_or("");
                if agent_status != status_val.as_str() {
                    return false;
                }
            }
            true
        })
        .collect();

    let total_count = filtered.len() as u64;

    let rows: Vec<Vec<serde_json::Value>> = filtered
        .into_iter()
        .enumerate()
        .map(|(i, a)| {
            vec![
                serde_json::Value::Number(((i + 1) as u64).into()),
                json_str_or_null(a.get("name")),
                json_str_or_null(a.get("role")),
                json_str_or_null(a.get("status")),
                json_str_or_null(a.get("file")),
                json_str_or_null(a.get("reports_to")),
                json_str_or_null(a.get("description")),
                json_str_or_null(a.get("created")),
            ]
        })
        .collect();

    Ok(QueryResult {
        columns: columns.to_vec(),
        rows,
        total_count,
    })
}

// ---------------------------------------------------------------------------
// Helper commands
// ---------------------------------------------------------------------------

/// Return the last N session log entries.
#[tauri::command]
pub async fn get_recent_activity(
    state: State<'_, DbState>,
    limit: Option<u32>,
) -> Result<Vec<SessionEvent>, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    if !table_exists(&conn, "session_logs")? {
        return Ok(Vec::new());
    }

    let limit_val = limit.unwrap_or(20);
    let mut stmt = conn.prepare(
        "SELECT id, event_type, agent, content, timestamp \
         FROM session_logs ORDER BY timestamp DESC LIMIT ?1",
    )?;

    let events = stmt
        .query_map(rusqlite::params![limit_val], |row| {
            Ok(SessionEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                agent: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(events)
}

/// Return aggregate summary statistics.
#[tauri::command]
pub async fn get_summary_stats(state: State<'_, DbState>) -> Result<SummaryStats, AppError> {
    let guard = state.db.lock().map_err(|e| AppError::Custom(format!("Lock error: {}", e)))?;
    let conn = guard.as_ref().ok_or_else(|| AppError::Custom(DB_NOT_CONNECTED_MSG.to_string()))?;

    // Tasks by status
    let tasks_by_status = if table_exists(&conn, "tasks")? {
        let mut stmt =
            conn.prepare("SELECT status, count(*) FROM tasks GROUP BY status ORDER BY status")?;
        let rows = stmt.query_map([], |row| {
            Ok(StatusCount {
                status: row.get(0)?,
                count: row.get::<_, i64>(1)? as u64,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    } else {
        Vec::new()
    };

    // Total reports
    let total_reports = if table_exists(&conn, "reports")? {
        let mut stmt = conn.prepare("SELECT count(*) FROM reports")?;
        stmt.query_row([], |row| row.get::<_, i64>(0))? as u64
    } else {
        0
    };

    // Total agents
    let total_agents = if table_exists(&conn, "agents")? {
        let mut stmt = conn.prepare("SELECT count(*) FROM agents")?;
        stmt.query_row([], |row| row.get::<_, i64>(0))? as u64
    } else {
        0
    };

    Ok(SummaryStats {
        tasks_by_status,
        total_reports,
        total_agents,
    })
}

// ---------------------------------------------------------------------------
// Row-to-JSON helpers
// ---------------------------------------------------------------------------

fn row_to_json_i64(row: &rusqlite::Row, idx: usize) -> rusqlite::Result<serde_json::Value> {
    let val: i64 = row.get(idx)?;
    Ok(serde_json::Value::Number(val.into()))
}

fn row_to_json_str(row: &rusqlite::Row, idx: usize) -> rusqlite::Result<serde_json::Value> {
    let val: String = row.get(idx)?;
    Ok(serde_json::Value::String(val))
}

fn row_to_json_str_opt(row: &rusqlite::Row, idx: usize) -> rusqlite::Result<serde_json::Value> {
    let val: Option<String> = row.get(idx)?;
    Ok(val
        .map(serde_json::Value::String)
        .unwrap_or(serde_json::Value::Null))
}

fn json_str_or_null(val: Option<&serde_json::Value>) -> serde_json::Value {
    val.and_then(|v| v.as_str())
        .map(|s| serde_json::Value::String(s.to_string()))
        .unwrap_or(serde_json::Value::Null)
}
