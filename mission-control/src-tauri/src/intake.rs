use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::manifest::Project;

/// Data submitted from the intake form in the frontend.
/// All fields use camelCase for seamless TypeScript interop.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntakeData {
    pub slug: String,
    pub title: String,
    pub mode: String,           // "standard" or "fast-track"
    pub problem: String,
    pub users: String,
    pub scope_in: Vec<String>,
    pub scope_out: Vec<String>,
    pub constraints: String,
    pub success_criteria: Vec<String>,
    pub prior_art: String,
}

/// Response for slug validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlugValidation {
    pub available: bool,
    pub suggestion: Option<String>,
}

/// Create a new project directory with intake.json and manifest.json.
///
/// - Creates `{artifacts_dir}/{slug}/`
/// - Creates `{artifacts_dir}/{slug}/diagrams/`
/// - Writes `intake.json` with all intake fields (empty vecs/strings as `[]`/`""`, never absent)
/// - Writes `manifest.json` with initial pipeline stage definitions
/// - Returns the created Project
#[tauri::command]
pub async fn scaffold_project(
    artifacts_dir: String,
    intake: IntakeData,
) -> Result<Project, AppError> {
    let base = PathBuf::from(&artifacts_dir);
    let project_dir = base.join(&intake.slug);

    // Guard: don't overwrite an existing project
    if project_dir.exists() {
        return Err(AppError::Custom(format!(
            "Project directory already exists: '{}'",
            project_dir.display()
        )));
    }

    // Create the project directory (and any missing parents in artifacts_dir)
    fs::create_dir_all(&project_dir)?;

    // Create the diagrams subdirectory
    fs::create_dir_all(project_dir.join("diagrams"))?;

    // --- Build and write intake.json ---
    // Per spec: empty optional fields are empty arrays/strings, not absent keys
    let intake_json_value = serde_json::json!({
        "problem": intake.problem,
        "users": intake.users,
        "scope_in": intake.scope_in,
        "scope_out": intake.scope_out,
        "constraints": intake.constraints,
        "success_criteria": intake.success_criteria,
        "prior_art": intake.prior_art,
    });
    let intake_json = serde_json::to_string_pretty(&intake_json_value)?;
    fs::write(project_dir.join("intake.json"), &intake_json)?;

    // --- Build and write manifest.json ---
    let now = chrono_iso_now();

    let manifest = serde_json::json!({
        "slug": intake.slug,
        "title": intake.title,
        "mode": intake.mode,
        "priority": 0,
        "status": "active",
        "current_stage": "problem",
        "created": now,
        "pipeline": {
            "stages": {
                "problem": stage_template(),
                "eval-spec": stage_template(),
                "prd": stage_template(),
                "diagrams": stage_template(),
                "build-plan": stage_template(),
            }
        }
    });

    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    fs::write(project_dir.join("manifest.json"), &manifest_json)?;

    // Return a Project struct matching what manifest::get_project would return
    Ok(Project {
        slug: intake.slug,
        title: intake.title,
        mode: intake.mode,
        priority: 0,
        status: "active".to_string(),
        current_stage: "problem".to_string(),
        created: now,
        manifest,
    })
}

/// Check whether a slug is available (no existing directory).
///
/// Returns `true` if `artifacts/{slug}/` does NOT exist (slug is available).
/// Returns `false` if directory already exists.
#[tauri::command]
pub async fn validate_slug(
    artifacts_dir: String,
    slug: String,
) -> Result<bool, AppError> {
    let base = PathBuf::from(&artifacts_dir);
    let target = base.join(&slug);

    // Return true if slug is available (directory doesn't exist)
    Ok(!target.exists())
}

/// Check whether a slug is available and suggest an alternative if taken.
/// This is a more detailed version that provides suggestions.
#[tauri::command]
pub async fn validate_slug_with_suggestion(
    artifacts_dir: String,
    slug: String,
) -> Result<SlugValidation, AppError> {
    let base = PathBuf::from(&artifacts_dir);
    let target = base.join(&slug);

    if !target.exists() {
        return Ok(SlugValidation {
            available: true,
            suggestion: None,
        });
    }

    // Slug is taken — suggest "{slug}-2", "{slug}-3", etc.
    for i in 2..=100 {
        let candidate = format!("{}-{}", slug, i);
        if !base.join(&candidate).exists() {
            return Ok(SlugValidation {
                available: false,
                suggestion: Some(candidate),
            });
        }
    }

    Ok(SlugValidation {
        available: false,
        suggestion: None,
    })
}

/// Build the default stage template used in manifest.json.
fn stage_template() -> serde_json::Value {
    serde_json::json!({
        "status": "pending",
        "agent": null,
        "artifact": null,
        "gate": {
            "status": "pending",
            "attempts": 0
        }
    })
}

/// Return the current UTC time as an ISO 8601 string.
///
/// Uses a minimal hand-rolled approach to avoid pulling in the `chrono` crate.
/// Format: "2026-03-30T12:34:56Z"
fn chrono_iso_now() -> String {
    use std::time::SystemTime;

    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();

    let secs = now.as_secs();

    // Constants for date calculation
    const SECS_PER_DAY: u64 = 86400;
    const DAYS_PER_400Y: u64 = 146097;
    const DAYS_PER_100Y: u64 = 36524;
    const DAYS_PER_4Y: u64 = 1461;

    let total_days = secs / SECS_PER_DAY;
    let time_of_day = secs % SECS_PER_DAY;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since 1970-01-01, shift epoch to 2000-03-01 for easier leap year handling
    let days = total_days as i64 - 10957; // days from 1970-01-01 to 2000-03-01

    let (year, month, day) = if days >= 0 {
        let era = days as u64 / DAYS_PER_400Y;
        let doe = days as u64 - era * DAYS_PER_400Y;
        let yoe = (doe - doe / DAYS_PER_4Y + doe / DAYS_PER_100Y - doe / DAYS_PER_400Y) / 365;
        let y = yoe + era * 400 + 2000;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100 + yoe / 400);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let m = if mp < 10 { mp + 3 } else { mp - 9 };
        let y = if m <= 2 { y + 1 } else { y };
        (y, m, d)
    } else {
        // Fallback for dates before 2000-03-01 (shouldn't happen for current timestamps)
        (2000u64, 1u64, 1u64)
    };

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stage_template_shape() {
        let t = stage_template();
        assert_eq!(t["status"], "pending");
        assert!(t["agent"].is_null());
        assert!(t["artifact"].is_null());
        assert_eq!(t["gate"]["status"], "pending");
        assert_eq!(t["gate"]["attempts"], 0);
    }

    #[test]
    fn test_chrono_iso_now_format() {
        let ts = chrono_iso_now();
        // Should look like "2026-03-30T12:34:56Z"
        assert!(ts.ends_with('Z'));
        assert_eq!(ts.len(), 20);
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[7..8], "-");
        assert_eq!(&ts[10..11], "T");
    }
}
