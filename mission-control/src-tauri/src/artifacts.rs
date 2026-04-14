use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Metadata and content for a single artifact file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactInfo {
    pub path: String,
    pub exists: bool,
    pub content: Option<String>,
    /// Parsed YAML frontmatter for .md files (between `---` delimiters).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter: Option<serde_json::Value>,
    pub size_bytes: u64,
    pub modified: Option<String>,
}

/// A directory listing entry for an artifact or directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub last_modified: String,
    pub is_dir: bool,
}

/// Read a single artifact file and return its content with metadata.
///
/// For `.md` files, extracts and parses YAML frontmatter (content between `---` delimiters).
/// Handles file types: `.md`, `.mmd`, `.gv`, `.json`, `.yaml`.
/// Returns exists=false if the file does not exist (does not error).
#[tauri::command]
pub async fn read_artifact(path: String) -> Result<ArtifactInfo, AppError> {
    let file_path = PathBuf::from(&path);

    // If file doesn't exist, return a struct with exists=false
    if !file_path.is_file() {
        return Ok(ArtifactInfo {
            path,
            exists: false,
            content: None,
            frontmatter: None,
            size_bytes: 0,
            modified: None,
        });
    }

    let metadata = fs::metadata(&file_path)?;
    let size_bytes = metadata.len();
    let modified = Some(format_system_time(metadata.modified()?));

    let content = fs::read_to_string(&file_path).map_err(|e| {
        AppError::Custom(format!("Failed to read artifact '{}': {}", path, e))
    })?;

    let frontmatter = if path.ends_with(".md") {
        extract_frontmatter(&content)
    } else {
        None
    };

    Ok(ArtifactInfo {
        path,
        exists: true,
        content: Some(content),
        frontmatter,
        size_bytes,
        modified,
    })
}

/// Recursively list all files and directories under the given path.
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<ArtifactEntry>, AppError> {
    let base = PathBuf::from(&path);

    if !base.is_dir() {
        return Err(AppError::Custom(format!(
            "Directory not found: '{}'",
            path
        )));
    }

    let mut entries = Vec::new();
    collect_entries(&base, &mut entries)?;
    Ok(entries)
}

/// Alias for `list_directory` to maintain backward compatibility.
#[tauri::command]
pub async fn list_artifacts(dir: String) -> Result<Vec<ArtifactEntry>, AppError> {
    let base = PathBuf::from(&dir);

    if !base.is_dir() {
        return Err(AppError::Custom(format!(
            "Artifacts directory not found: '{}'",
            dir
        )));
    }

    let mut entries = Vec::new();
    collect_entries(&base, &mut entries)?;
    Ok(entries)
}

/// Recursively collect file/directory entries.
fn collect_entries(dir: &PathBuf, entries: &mut Vec<ArtifactEntry>) -> Result<(), AppError> {
    let read_dir = fs::read_dir(dir)?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        let last_modified = metadata
            .modified()
            .map(format_system_time)
            .unwrap_or_default();

        let is_dir = metadata.is_dir();

        entries.push(ArtifactEntry {
            path: path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
            last_modified,
            is_dir,
        });

        if is_dir {
            collect_entries(&path, entries)?;
        }
    }

    Ok(())
}

/// Extract YAML frontmatter from Markdown content.
/// Frontmatter is delimited by `---` at the start of the file.
fn extract_frontmatter(content: &str) -> Option<serde_json::Value> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }

    // Find the closing `---` delimiter (skip the opening one).
    let after_open = &trimmed[3..];
    let close_pos = after_open.find("---")?;
    let yaml_str = &after_open[..close_pos].trim();

    if yaml_str.is_empty() {
        return None;
    }

    // Parse YAML to serde_json::Value via serde_yaml.
    let yaml_value: serde_yaml::Value = serde_yaml::from_str(yaml_str).ok()?;
    serde_json::to_value(yaml_value).ok()
}

/// Format a SystemTime as an ISO 8601 timestamp string.
fn format_system_time(time: std::time::SystemTime) -> String {
    let duration = time.duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();

    // Simple ISO 8601 formatting without pulling in chrono.
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Calculate date from days since epoch (1970-01-01).
    let (year, month, day) = days_to_date(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// Convert days since Unix epoch to (year, month, day).
fn days_to_date(days: u64) -> (u64, u64, u64) {
    // Algorithm from Howard Hinnant's date library.
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
