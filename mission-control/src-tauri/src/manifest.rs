use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// A project entry parsed from a manifest.json file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub slug: String,
    pub title: String,
    pub mode: String,
    pub priority: i32,
    pub status: String,
    pub current_stage: String,
    pub created: String,
    /// The full raw manifest as dynamic JSON for flexible frontend access.
    pub manifest: serde_json::Value,
}

/// Gate status for a pipeline stage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineGate {
    pub status: String,
    pub attempts: i32,
}

/// A single pipeline stage with status and gate info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStage {
    pub name: String,
    pub status: String,
    pub agent: String,
    pub artifact: String,
    pub gate: PipelineGate,
}

/// Extended project detail including pipeline stages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
    pub slug: String,
    pub title: String,
    pub mode: String,
    pub priority: i32,
    pub status: String,
    pub current_stage: String,
    pub created: String,
    pub manifest: serde_json::Value,
    pub stages: Vec<PipelineStage>,
    pub has_discrepancy: bool,
}

/// Canonical stage order and display names
const STAGE_ORDER: &[(&str, &str)] = &[
    ("problem", "Problem"),
    ("eval-spec", "Eval Spec"),
    ("architecture-decisions", "Architecture"),
    ("prd", "PRD"),
    ("diagrams", "Diagrams"),
    ("build-plan", "Build Plan"),
];

/// Scan an artifacts directory for project manifests and return all valid projects.
///
/// Looks for `{artifacts_dir}/*/manifest.json`. Directories without a valid
/// manifest.json are silently skipped (no error).
#[tauri::command]
pub async fn list_projects(artifacts_dir: String) -> Result<Vec<Project>, AppError> {
    let base = PathBuf::from(&artifacts_dir);
    if !base.is_dir() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();

    let entries = fs::read_dir(&base).map_err(|e| {
        AppError::Custom(format!(
            "Failed to read artifacts directory '{}': {}",
            artifacts_dir, e
        ))
    })?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }

        match parse_manifest(&manifest_path) {
            Ok(project) => projects.push(project),
            Err(_) => {
                // Skip directories with invalid manifest.json — no error surfaced.
                continue;
            }
        }
    }

    Ok(projects)
}

/// Read a single project's manifest by slug, returning full detail with stages.
#[tauri::command]
pub async fn get_project(artifacts_dir: String, slug: String) -> Result<ProjectDetail, AppError> {
    let project_dir = PathBuf::from(&artifacts_dir).join(&slug);
    let manifest_path = project_dir.join("manifest.json");

    if !manifest_path.is_file() {
        return Err(AppError::Custom(format!(
            "Manifest not found for project '{}' at '{}'",
            slug,
            manifest_path.display()
        )));
    }

    parse_manifest_detail(&manifest_path, &project_dir)
}

/// Parse a manifest.json file into a Project struct.
fn parse_manifest(path: &PathBuf) -> Result<Project, AppError> {
    let content = fs::read_to_string(path)?;
    let raw: serde_json::Value = serde_json::from_str(&content)?;

    let slug = raw
        .get("slug")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let title = raw
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let mode = raw
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("standard")
        .to_string();

    let priority = raw
        .get("priority")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    let status = raw
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let current_stage = raw
        .get("current_stage")
        .or_else(|| raw.get("currentStage"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let created = raw
        .get("created")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(Project {
        slug,
        title,
        mode,
        priority,
        status,
        current_stage,
        created,
        manifest: raw,
    })
}

/// Parse a manifest.json file into a ProjectDetail struct with stages.
fn parse_manifest_detail(path: &PathBuf, project_dir: &PathBuf) -> Result<ProjectDetail, AppError> {
    let content = fs::read_to_string(path)?;
    let raw: serde_json::Value = serde_json::from_str(&content)?;

    let slug = raw
        .get("slug")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let title = raw
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let mode = raw
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("standard")
        .to_string();

    let priority = raw
        .get("priority")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    let status = raw
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let current_stage = raw
        .get("current_stage")
        .or_else(|| raw.get("currentStage"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let created = raw
        .get("created")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Parse pipeline stages from manifest
    let stages = parse_pipeline_stages(&raw, project_dir);

    // Check for discrepancies between manifest and actual artifacts
    let has_discrepancy = check_discrepancies(&stages, project_dir);

    Ok(ProjectDetail {
        slug,
        title,
        mode,
        priority,
        status,
        current_stage,
        created,
        manifest: raw,
        stages,
        has_discrepancy,
    })
}

/// Parse pipeline stages from manifest JSON, falling back to artifact detection
fn parse_pipeline_stages(raw: &serde_json::Value, project_dir: &PathBuf) -> Vec<PipelineStage> {
    let mut stages = Vec::new();

    // Try to get stages from manifest pipeline data
    let manifest_stages = raw
        .get("pipeline")
        .and_then(|p| p.get("stages"))
        .and_then(|s| s.as_object());

    for (stage_key, display_name) in STAGE_ORDER {
        let stage = if let Some(manifest_stages) = manifest_stages {
            // Use manifest data if available
            if let Some(stage_data) = manifest_stages.get(*stage_key) {
                let agent = stage_data
                    .get("agent")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let artifact = stage_data
                    .get("artifact")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let status = stage_data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("pending")
                    .to_string();

                let gate_status = stage_data
                    .get("gate")
                    .and_then(|g| g.get("status"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("pending")
                    .to_string();

                let gate_attempts = stage_data
                    .get("gate")
                    .and_then(|g| g.get("attempts"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;

                PipelineStage {
                    name: display_name.to_string(),
                    status,
                    agent,
                    artifact,
                    gate: PipelineGate {
                        status: gate_status,
                        attempts: gate_attempts,
                    },
                }
            } else {
                // Stage not in manifest - detect from artifacts
                create_stage_from_artifacts(stage_key, display_name, project_dir)
            }
        } else {
            // No manifest pipeline data - detect from artifacts
            create_stage_from_artifacts(stage_key, display_name, project_dir)
        };

        stages.push(stage);
    }

    stages
}

/// Create a pipeline stage by detecting artifacts on disk
fn create_stage_from_artifacts(stage_key: &str, display_name: &str, project_dir: &PathBuf) -> PipelineStage {
    let (artifact_path, agent) = match stage_key {
        "problem" => ("problem.md", "framer"),
        "eval-spec" => ("eval-spec.md", "eval"),
        "architecture-decisions" => ("architecture-decisions.md", "architect"),
        "prd" => ("prd.md", "quill"),
        "diagrams" => ("diagrams", "sketch"),
        "build-plan" => ("build-plan.md", "planner"),
        _ => ("", ""),
    };

    let artifact_exists = if artifact_path.is_empty() {
        false
    } else {
        let full_path = project_dir.join(artifact_path);
        full_path.exists()
    };

    let status = if artifact_exists { "complete" } else { "pending" };
    let gate_status = if artifact_exists { "passed" } else { "pending" };
    let gate_attempts = if artifact_exists { 1 } else { 0 };

    PipelineStage {
        name: display_name.to_string(),
        status: status.to_string(),
        agent: agent.to_string(),
        artifact: if artifact_exists { artifact_path.to_string() } else { String::new() },
        gate: PipelineGate {
            status: gate_status.to_string(),
            attempts: gate_attempts,
        },
    }
}

/// Check for discrepancies between manifest stage status and actual artifacts
fn check_discrepancies(stages: &[PipelineStage], project_dir: &PathBuf) -> bool {
    for stage in stages {
        if stage.artifact.is_empty() {
            continue;
        }

        let artifact_path = project_dir.join(&stage.artifact);
        let artifact_exists = artifact_path.exists();

        // Discrepancy: manifest says complete but artifact doesn't exist
        if stage.status == "complete" && !artifact_exists {
            return true;
        }

        // Discrepancy: artifact exists but manifest says pending
        if stage.status == "pending" && artifact_exists {
            return true;
        }
    }

    false
}
