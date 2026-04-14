//! Interview system Tauri commands.
//!
//! Provides commands for managing interview sessions via the Python CLI.
//! All commands use `std::process::Command` to invoke `squad/interview.py`.

use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Deserializer, Serialize};

use crate::error::AppError;
use crate::settings::get_settings;

/// Deserialize an optional boolean that may come as an integer (0/1) from SQLite.
fn deserialize_optional_bool<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BoolOrInt {
        Bool(bool),
        Int(i64),
        Null,
    }

    match BoolOrInt::deserialize(deserializer)? {
        BoolOrInt::Bool(b) => Ok(Some(b)),
        BoolOrInt::Int(i) => Ok(Some(i != 0)),
        BoolOrInt::Null => Ok(None),
    }
}

/// Result from starting a new interview session.
/// Uses snake_case for Python CLI compatibility, serializes as camelCase for TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterviewSession {
    pub success: bool,
    #[serde(alias = "session_id", rename(serialize = "sessionId"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(alias = "project_slug", rename(serialize = "projectSlug"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_slug: Option<String>,
    #[serde(alias = "project_title", rename(serialize = "projectTitle"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(alias = "current_stage", rename(serialize = "currentStage"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_stage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Interview record from the database.
/// Uses snake_case for Python CLI compatibility, serializes as camelCase for TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interview {
    pub id: Option<i64>,
    #[serde(alias = "session_id", rename(serialize = "sessionId"))]
    pub session_id: String,
    #[serde(alias = "project_slug", rename(serialize = "projectSlug"))]
    pub project_slug: Option<String>,
    pub status: String,
    #[serde(alias = "current_stage", rename(serialize = "currentStage"))]
    pub current_stage: Option<String>,
    #[serde(alias = "turn_count", rename(serialize = "turnCount"))]
    pub turn_count: i32,
    #[serde(alias = "started_at", rename(serialize = "startedAt"))]
    pub started_at: Option<String>,
    #[serde(alias = "updated_at", rename(serialize = "updatedAt"))]
    pub updated_at: Option<String>,
    #[serde(alias = "completed_at", rename(serialize = "completedAt"))]
    pub completed_at: Option<String>,
    /// SQLite stores booleans as integers (0/1), deserialize flexibly
    #[serde(default, deserialize_with = "deserialize_optional_bool")]
    pub abandoned: Option<bool>,
    #[serde(alias = "abandon_reason", rename(serialize = "abandonReason"))]
    pub abandon_reason: Option<String>,
    #[serde(alias = "intake_brief_path", rename(serialize = "intakeBriefPath"))]
    pub intake_brief_path: Option<String>,
}

/// Detailed interview status with response counts.
/// Uses snake_case for Python CLI compatibility, serializes as camelCase for TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterviewStatus {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interview: Option<Interview>,
    #[serde(alias = "responses_by_stage", rename(serialize = "responsesByStage"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responses_by_stage: Option<std::collections::HashMap<String, i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// List of interviews result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterviewList {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interviews: Option<Vec<Interview>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result from saving an interview response.
/// Uses snake_case for Python CLI compatibility, serializes as camelCase for TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveResponseResult {
    pub success: bool,
    #[serde(alias = "response_saved", rename(serialize = "responseSaved"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_saved: Option<bool>,
    #[serde(alias = "turn_number", rename(serialize = "turnNumber"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_number: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result from abandoning an interview.
/// Uses snake_case for Python CLI compatibility, serializes as camelCase for TypeScript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbandonResult {
    pub success: bool,
    #[serde(alias = "session_id", rename(serialize = "sessionId"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Resolve the project root directory from settings.
/// If project_root ends with "squad", return the parent directory
/// since interview.py expects to find squad/ inside project_root.
async fn get_project_root(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let settings = get_settings(app.clone()).await?;

    if settings.project_root.is_empty() {
        return Err(AppError::Custom(
            "Project root not configured. Please set it in Settings.".to_string(),
        ));
    }

    let path = PathBuf::from(&settings.project_root);
    if !path.exists() {
        return Err(AppError::Custom(format!(
            "Project root does not exist: {}",
            settings.project_root
        )));
    }

    // If project_root ends with "squad", use the parent directory
    // because the CLI expects project_root/squad/interview.py structure
    let ends_with_squad = path
        .file_name()
        .map(|n| n == "squad")
        .unwrap_or(false);

    if ends_with_squad {
        if let Some(parent) = path.parent() {
            eprintln!(
                "[interview] project_root ends with 'squad', using parent: {}",
                parent.display()
            );
            return Ok(parent.to_path_buf());
        }
    }

    Ok(path)
}

/// Run the interview.py CLI with the given arguments.
fn run_interview_cli(project_root: &PathBuf, args: &[&str]) -> Result<String, AppError> {
    let interview_script = project_root.join("squad").join("interview.py");

    if !interview_script.exists() {
        return Err(AppError::Custom(format!(
            "Interview script not found: {}",
            interview_script.display()
        )));
    }

    let mut cmd_args = vec![interview_script.to_string_lossy().to_string()];
    cmd_args.extend(args.iter().map(|s| s.to_string()));
    cmd_args.push("--json".to_string());

    eprintln!(
        "[interview] Running: python {}",
        cmd_args.join(" ")
    );

    let output = Command::new("python")
        .args(&cmd_args[..])
        .current_dir(project_root)
        .output()
        .map_err(|e| AppError::Custom(format!("Failed to run interview CLI: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stderr.is_empty() {
        eprintln!("[interview] stderr: {}", stderr);
    }

    if !output.status.success() && stdout.is_empty() {
        return Err(AppError::Custom(format!(
            "Interview CLI failed: {}",
            if stderr.is_empty() {
                "Unknown error".to_string()
            } else {
                stderr
            }
        )));
    }

    Ok(stdout)
}

/// Start a new interview session.
///
/// Creates a new interview record in the database and returns the session details.
#[tauri::command]
pub async fn start_interview(
    app: tauri::AppHandle,
    project_slug: String,
    title: String,
) -> Result<InterviewSession, AppError> {
    let project_root = get_project_root(&app).await?;

    let output = run_interview_cli(
        &project_root,
        &[
            "--action",
            "start",
            "--project-slug",
            &project_slug,
            "--title",
            &title,
        ],
    )?;

    let result: InterviewSession = serde_json::from_str(&output).map_err(|e| {
        AppError::Custom(format!(
            "Failed to parse interview response: {} (output: {})",
            e, output
        ))
    })?;

    Ok(result)
}

/// Get the status of an existing interview session.
///
/// Returns detailed interview status including response counts per stage.
#[tauri::command]
pub async fn get_interview_status(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<InterviewStatus, AppError> {
    let project_root = get_project_root(&app).await?;

    let output = run_interview_cli(
        &project_root,
        &["--action", "status", "--session-id", &session_id],
    )?;

    let result: InterviewStatus = serde_json::from_str(&output).map_err(|e| {
        AppError::Custom(format!(
            "Failed to parse interview status: {} (output: {})",
            e, output
        ))
    })?;

    Ok(result)
}

/// List interview sessions with optional filtering.
///
/// Can filter by status (in_progress, paused, complete, abandoned).
#[tauri::command]
pub async fn list_interviews(
    app: tauri::AppHandle,
    status: Option<String>,
) -> Result<InterviewList, AppError> {
    let project_root = get_project_root(&app).await?;

    let mut args = vec!["--action", "list"];
    let status_ref;
    if let Some(ref s) = status {
        status_ref = s.clone();
        args.push("--status");
        args.push(&status_ref);
    }

    let output = run_interview_cli(&project_root, &args)?;

    let result: InterviewList = serde_json::from_str(&output).map_err(|e| {
        AppError::Custom(format!(
            "Failed to parse interview list: {} (output: {})",
            e, output
        ))
    })?;

    Ok(result)
}

/// Save an interview response.
///
/// Persists a single question/response pair from the interview.
#[tauri::command]
pub async fn save_interview_response(
    app: tauri::AppHandle,
    session_id: String,
    stage: String,
    field_name: String,
    question: String,
    response: String,
    turn_number: i32,
) -> Result<SaveResponseResult, AppError> {
    let project_root = get_project_root(&app).await?;
    let turn_str = turn_number.to_string();

    let output = run_interview_cli(
        &project_root,
        &[
            "--action",
            "save-response",
            "--session-id",
            &session_id,
            "--stage",
            &stage,
            "--field-name",
            &field_name,
            "--question",
            &question,
            "--response",
            &response,
            "--turn-number",
            &turn_str,
        ],
    )?;

    let result: SaveResponseResult = serde_json::from_str(&output).map_err(|e| {
        AppError::Custom(format!(
            "Failed to parse save response result: {} (output: {})",
            e, output
        ))
    })?;

    Ok(result)
}

/// Abandon an interview session.
///
/// Marks the interview as abandoned with the given reason.
#[tauri::command]
pub async fn abandon_interview(
    app: tauri::AppHandle,
    session_id: String,
    reason: String,
) -> Result<AbandonResult, AppError> {
    let project_root = get_project_root(&app).await?;

    let output = run_interview_cli(
        &project_root,
        &[
            "--action",
            "abandon",
            "--session-id",
            &session_id,
            "--reason",
            &reason,
        ],
    )?;

    let result: AbandonResult = serde_json::from_str(&output).map_err(|e| {
        AppError::Custom(format!(
            "Failed to parse abandon result: {} (output: {})",
            e, output
        ))
    })?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interview_session_deserialize_snake_case() {
        // Test deserialization from Python CLI (snake_case)
        let json = r#"{
            "success": true,
            "session_id": "sess_abc123",
            "project_slug": "test-project",
            "project_title": "Test Project",
            "status": "in_progress",
            "current_stage": "problem_discovery"
        }"#;

        let session: InterviewSession = serde_json::from_str(json).unwrap();
        assert!(session.success);
        assert_eq!(session.session_id, Some("sess_abc123".to_string()));
        assert_eq!(session.current_stage, Some("problem_discovery".to_string()));
    }

    #[test]
    fn test_interview_list_deserialize_snake_case() {
        // Test deserialization from Python CLI (snake_case)
        let json = r#"{
            "success": true,
            "interviews": [
                {
                    "id": 1,
                    "session_id": "sess_abc123",
                    "project_slug": "test",
                    "status": "in_progress",
                    "current_stage": "problem_discovery",
                    "turn_count": 5,
                    "started_at": "2025-01-01 12:00:00",
                    "updated_at": "2025-01-01 12:30:00"
                }
            ]
        }"#;

        let list: InterviewList = serde_json::from_str(json).unwrap();
        assert!(list.success);
        assert_eq!(list.interviews.as_ref().unwrap().len(), 1);
        assert_eq!(
            list.interviews.as_ref().unwrap()[0].session_id,
            "sess_abc123"
        );
    }

    #[test]
    fn test_interview_with_abandoned_integer() {
        // Test SQLite integer boolean (abandoned: 1)
        let json = r#"{
            "id": 1,
            "session_id": "sess_abc123",
            "project_slug": "test",
            "status": "abandoned",
            "current_stage": "problem_discovery",
            "turn_count": 5,
            "started_at": "2025-01-01 12:00:00",
            "updated_at": "2025-01-01 12:30:00",
            "abandoned": 1,
            "abandon_reason": "Test"
        }"#;

        let interview: Interview = serde_json::from_str(json).unwrap();
        assert_eq!(interview.abandoned, Some(true));
    }

    #[test]
    fn test_abandon_result_deserialize_snake_case() {
        // Test deserialization from Python CLI (snake_case)
        let json = r#"{
            "success": true,
            "session_id": "sess_abc123",
            "status": "abandoned",
            "reason": "User canceled"
        }"#;

        let result: AbandonResult = serde_json::from_str(json).unwrap();
        assert!(result.success);
        assert_eq!(result.session_id, Some("sess_abc123".to_string()));
        assert_eq!(result.status, Some("abandoned".to_string()));
        assert_eq!(result.reason, Some("User canceled".to_string()));
    }

    #[test]
    fn test_interview_session_serialize_camel_case() {
        // Test that serialization outputs camelCase for TypeScript
        let session = InterviewSession {
            success: true,
            session_id: Some("sess_abc123".to_string()),
            project_slug: Some("test-project".to_string()),
            project_title: Some("Test Project".to_string()),
            status: Some("in_progress".to_string()),
            current_stage: Some("problem_discovery".to_string()),
            error: None,
        };

        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("sessionId"));
        assert!(json.contains("projectSlug"));
        assert!(json.contains("currentStage"));
        assert!(!json.contains("session_id"));
    }
}
