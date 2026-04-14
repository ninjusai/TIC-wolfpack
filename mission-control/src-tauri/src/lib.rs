/// Wolf Pack Mission Control - Rust backend library
///
/// This crate provides the Tauri command handlers, database integration,
/// file watching, and IPC bridge for the Mission Control desktop app.

mod artifacts;
mod db;
mod error;
mod intake;
mod interview;
mod manifest;
mod memory;
mod queries;
mod settings;
mod watcher;

use std::path::PathBuf;

use tauri::Manager;

use db::DbState;
use watcher::WatcherState;

#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello from Wolf Pack Mission Control, {}!", name)
}

/// Resolve the database path from saved settings or fall back to defaults.
fn resolve_db_path(app: &tauri::App) -> PathBuf {
    // Try to read saved settings from app data directory
    let settings_path = app
        .path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("settings.json"));

    eprintln!("[mission-control] Looking for settings at: {:?}", settings_path);

    if let Some(ref path) = settings_path {
        eprintln!("[mission-control] Settings file exists: {}", path.is_file());
        if path.is_file() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) {
                    let project_root = settings
                        .get("projectRoot")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let db_path = settings
                        .get("dbPath")
                        .and_then(|v| v.as_str())
                        .unwrap_or("squad/wolfpack.db");

                    // If project_root is set, compute the database path intelligently
                    if !project_root.is_empty() {
                        // Check if project_root already ends with "squad" directory
                        let project_root_path = PathBuf::from(project_root);
                        let ends_with_squad = project_root_path
                            .file_name()
                            .map(|n| n == "squad")
                            .unwrap_or(false);

                        // If db_path is relative (like "squad/wolfpack.db") and project_root
                        // already points to the squad directory, use just the filename
                        let effective_db_path = if ends_with_squad && db_path.starts_with("squad/") {
                            db_path.trim_start_matches("squad/")
                        } else {
                            db_path
                        };

                        let full_path = project_root_path.join(effective_db_path);
                        eprintln!(
                            "[mission-control] Using database from settings: {} (project_root={}, db_path={}, effective={})",
                            full_path.display(), project_root, db_path, effective_db_path
                        );
                        return full_path;
                    }

                    // If db_path is absolute, use it directly
                    let db_pathbuf = PathBuf::from(db_path);
                    if db_pathbuf.is_absolute() {
                        eprintln!(
                            "[mission-control] Using absolute database path: {}",
                            db_pathbuf.display()
                        );
                        return db_pathbuf;
                    }
                }
            }
        }
    }

    // Fall back to relative path (works when launched from project directory)
    eprintln!("[mission-control] Using default database path: squad/wolfpack.db");
    PathBuf::from("squad/wolfpack.db")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            manifest::list_projects,
            manifest::get_project,
            artifacts::read_artifact,
            artifacts::list_directory,
            artifacts::list_artifacts,
            settings::get_settings,
            settings::update_settings,
            settings::reinit_database,
            queries::query_reports,
            queries::query_tasks,
            queries::query_sessions,
            queries::query_agents,
            queries::get_recent_activity,
            queries::get_summary_stats,
            intake::scaffold_project,
            intake::validate_slug,
            intake::validate_slug_with_suggestion,
            interview::start_interview,
            interview::get_interview_status,
            interview::list_interviews,
            interview::save_interview_response,
            interview::abandon_interview,
            watcher::watch_directory,
            watcher::unwatch_directory,
            watcher::start_watching,
            watcher::stop_watching,
            memory::get_memory_status,
        ])
        .manage(WatcherState::new())
        .setup(|app| {
            // Resolve database path from settings (if saved) or use default
            let db_path = resolve_db_path(app);
            let db_path_str = db_path.to_string_lossy();

            // Always register DbState - commands will handle None gracefully
            let db_state = match db::open_database(&db_path_str) {
                Ok(conn) => {
                    eprintln!("[mission-control] Database connected successfully to: {}", db_path_str);
                    DbState::with_connection(conn)
                }
                Err(e) => {
                    eprintln!(
                        "[mission-control] Warning: Could not open database at '{}': {}. \
                         DB-dependent commands will return errors until configured. \
                         Please configure Project Root in Settings.",
                        db_path_str, e
                    );
                    DbState::empty()
                }
            };
            app.manage(db_state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
