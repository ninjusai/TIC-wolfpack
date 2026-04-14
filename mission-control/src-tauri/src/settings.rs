use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

use crate::db::{open_database, DbState};
use crate::error::AppError;

/// Application settings persisted to `{app_data_dir}/settings.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub db_path: String,
    pub project_root: String,
    pub artifacts_dir: String,
    pub file_watcher_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            db_path: "squad/wolfpack.db".to_string(),
            project_root: String::new(),
            artifacts_dir: "artifacts".to_string(),
            file_watcher_enabled: true,
        }
    }
}

/// Resolve the path to `settings.json` inside the app data directory.
fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Custom(format!("Failed to resolve app data directory: {}", e)))?;

    Ok(data_dir.join("settings.json"))
}

/// Read application settings from disk.
///
/// If the settings file doesn't exist, returns sensible defaults.
/// The `project_root` default is auto-detected from the app's resource directory.
#[tauri::command]
pub async fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, AppError> {
    let path = settings_path(&app)?;

    if path.is_file() {
        let content = fs::read_to_string(&path)?;
        let settings: AppSettings = serde_json::from_str(&content)?;
        return Ok(settings);
    }

    // Return defaults — auto-detect project_root from the app's resource directory.
    let mut defaults = AppSettings::default();

    if let Ok(resource_dir) = app.path().resource_dir() {
        defaults.project_root = resource_dir.to_string_lossy().to_string();
    }

    Ok(defaults)
}

/// Write application settings to disk.
///
/// Creates the app data directory if it doesn't exist.
#[tauri::command]
pub async fn update_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), AppError> {
    let path = settings_path(&app)?;
    eprintln!("[settings] Saving settings to: {}", path.display());

    // Ensure the parent directory exists.
    if let Some(parent) = path.parent() {
        eprintln!("[settings] Creating parent directory: {}", parent.display());
        fs::create_dir_all(parent).map_err(|e| {
            eprintln!("[settings] Failed to create directory: {}", e);
            AppError::Custom(format!("Failed to create settings directory: {}", e))
        })?;
    }

    let content = serde_json::to_string_pretty(&settings)?;
    eprintln!("[settings] Writing {} bytes", content.len());

    fs::write(&path, &content).map_err(|e| {
        eprintln!("[settings] Failed to write file: {}", e);
        AppError::Custom(format!("Failed to write settings: {}", e))
    })?;

    eprintln!("[settings] Settings saved successfully");
    Ok(())
}

/// Reinitialize the database connection based on current settings.
///
/// This should be called after settings are updated to reload the database
/// without requiring an app restart.
#[tauri::command]
pub async fn reinit_database(
    app: tauri::AppHandle,
    db_state: State<'_, DbState>,
) -> Result<String, AppError> {
    // Read the current settings
    let settings = get_settings(app.clone()).await?;

    // Compute the database path with smart path handling
    let db_path = if !settings.project_root.is_empty() {
        let project_root_path = PathBuf::from(&settings.project_root);

        // Check if project_root already ends with "squad" directory
        let ends_with_squad = project_root_path
            .file_name()
            .map(|n| n == "squad")
            .unwrap_or(false);

        // If db_path is relative (like "squad/wolfpack.db") and project_root
        // already points to the squad directory, use just the filename
        let effective_db_path = if ends_with_squad && settings.db_path.starts_with("squad/") {
            settings.db_path.trim_start_matches("squad/")
        } else {
            &settings.db_path
        };

        let full_path = project_root_path.join(effective_db_path);
        eprintln!(
            "[settings] DB path computation: project_root={}, db_path={}, effective={}, result={}",
            settings.project_root, settings.db_path, effective_db_path, full_path.display()
        );
        full_path.to_string_lossy().to_string()
    } else if PathBuf::from(&settings.db_path).is_absolute() {
        settings.db_path.clone()
    } else {
        settings.db_path.clone()
    };

    eprintln!("[settings] Reinitializing database connection to: {}", db_path);

    // Try to open the new database
    match open_database(&db_path) {
        Ok(conn) => {
            // Replace the connection in state
            db_state.set_connection(Some(conn))?;
            eprintln!("[settings] Database reinitialized successfully");
            Ok(format!("Database connected to: {}", db_path))
        }
        Err(e) => {
            // Clear the connection on failure
            db_state.set_connection(None)?;
            eprintln!("[settings] Failed to reinitialize database: {}", e);
            Err(e)
        }
    }
}
