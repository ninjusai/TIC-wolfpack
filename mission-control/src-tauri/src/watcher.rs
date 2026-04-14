/// File System Watcher Module - WRK-016
///
/// Provides file watching capabilities using the `notify` crate to detect
/// external file changes and notify the frontend via Tauri events.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;

/// Allowed file extensions for emitting events.
const ALLOWED_EXTENSIONS: &[&str] = &["md", "json", "yaml", "mmd", "gv"];

/// Debounce window in milliseconds.
const DEBOUNCE_MS: u64 = 500;

/// Payload emitted to the frontend on every file-system change.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangedEvent {
    pub path: String,
    pub kind: String, // "created" | "modified" | "removed"
}

/// Internal message sent from watcher threads to signal shutdown.
enum WatcherControl {
    Stop,
}

/// Entry for a single watched directory.
pub(crate) struct WatcherEntry {
    /// Channel sender to signal the watcher thread to stop.
    stop_tx: Sender<WatcherControl>,
    /// Join handle for the watcher thread.
    thread_handle: Option<thread::JoinHandle<()>>,
}

/// Tauri managed state holding active file-system watchers.
///
/// Stores watchers in a HashMap keyed by path, allowing multiple directories
/// to be watched simultaneously.
pub struct WatcherState {
    pub watchers: Mutex<HashMap<String, WatcherEntry>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}

/// Check if a path has an allowed extension for emitting events.
fn has_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ALLOWED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Classify an event into "created", "modified", or "removed".
///
/// The debouncer-mini collapses event types, so we use a heuristic:
/// if the path exists it was created or modified, if not it was removed.
fn classify_event(path: &Path) -> String {
    if path.exists() {
        // Check if file was recently created (within debounce window)
        // This is a best-effort heuristic since debouncer collapses events
        if let Ok(metadata) = path.metadata() {
            if let Ok(created) = metadata.created() {
                if let Ok(elapsed) = created.elapsed() {
                    if elapsed < Duration::from_millis(DEBOUNCE_MS * 2) {
                        return "created".to_string();
                    }
                }
            }
        }
        "modified".to_string()
    } else {
        "removed".to_string()
    }
}

/// Start watching a directory recursively for file changes.
///
/// Emits `file-changed` events to the frontend for allowed file types
/// (`.md`, `.json`, `.yaml`, `.mmd`, `.gv`).
///
/// Uses a 500ms debounce window to collapse rapid events.
#[tauri::command]
pub async fn watch_directory(
    app: AppHandle,
    watcher_state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<(), AppError> {
    let watch_path = PathBuf::from(&path);

    // Validate that the path exists and is a directory
    if !watch_path.exists() {
        return Err(AppError::Custom(format!(
            "Path does not exist: {}",
            path
        )));
    }

    if !watch_path.is_dir() {
        return Err(AppError::Custom(format!(
            "Path is not a directory: {}",
            path
        )));
    }

    // Canonicalize the path for consistent HashMap keys
    let canonical_path = watch_path
        .canonicalize()
        .map_err(|e| AppError::Custom(format!("Failed to canonicalize path '{}': {}", path, e)))?;
    let path_key = canonical_path.to_string_lossy().to_string();

    let mut guard = watcher_state
        .watchers
        .lock()
        .map_err(|e| AppError::Custom(format!("Watcher lock poisoned: {}", e)))?;

    // If already watching this path, stop the existing watcher first
    if let Some(entry) = guard.remove(&path_key) {
        let _ = entry.stop_tx.send(WatcherControl::Stop);
        if let Some(handle) = entry.thread_handle {
            let _ = handle.join();
        }
    }

    // Create a channel for controlling the watcher thread
    let (stop_tx, stop_rx) = channel::<WatcherControl>();

    // Clone values for the thread
    let app_handle = app;
    let watch_path_clone = canonical_path.clone();
    let path_key_clone = path_key.clone();

    // Spawn a dedicated thread for the watcher
    let thread_handle = thread::spawn(move || {
        // Create a debounced watcher (500ms debounce window)
        let debouncer_result = new_debouncer(
            Duration::from_millis(DEBOUNCE_MS),
            move |result: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
                match result {
                    Ok(events) => {
                        for event in events {
                            // Filter by allowed extensions
                            if !has_allowed_extension(&event.path) {
                                continue;
                            }

                            let path_str = event.path.to_string_lossy().to_string();

                            // Map the debounced event kind
                            let kind = match event.kind {
                                DebouncedEventKind::Any => classify_event(&event.path),
                                DebouncedEventKind::AnyContinuous => "modified".to_string(),
                                _ => "modified".to_string(),
                            };

                            let payload = FileChangedEvent {
                                path: path_str,
                                kind,
                            };

                            if let Err(e) = app_handle.emit("file-changed", &payload) {
                                eprintln!("[watcher] Failed to emit file-changed event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[watcher] Error receiving fs events: {}", e);
                    }
                }
            },
        );

        let mut debouncer = match debouncer_result {
            Ok(d) => d,
            Err(e) => {
                eprintln!(
                    "[watcher] Failed to create debouncer for '{}': {}",
                    path_key_clone, e
                );
                return;
            }
        };

        // Start watching the directory recursively
        if let Err(e) = debouncer
            .watcher()
            .watch(&watch_path_clone, RecursiveMode::Recursive)
        {
            eprintln!(
                "[watcher] Failed to watch directory '{}': {}",
                watch_path_clone.display(),
                e
            );
            return;
        }

        println!(
            "[watcher] Started watching directory: {}",
            watch_path_clone.display()
        );

        // Wait for stop signal
        // The recv() call blocks until a message is received or the sender is dropped
        loop {
            match stop_rx.recv_timeout(Duration::from_secs(1)) {
                Ok(WatcherControl::Stop) => {
                    println!(
                        "[watcher] Stopping watcher for: {}",
                        watch_path_clone.display()
                    );
                    break;
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Continue waiting
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    // Sender dropped, stop the watcher
                    println!(
                        "[watcher] Control channel disconnected, stopping watcher for: {}",
                        watch_path_clone.display()
                    );
                    break;
                }
            }
        }

        // Debouncer and watcher are dropped here, cleaning up resources
    });

    // Store the watcher entry
    guard.insert(
        path_key,
        WatcherEntry {
            stop_tx,
            thread_handle: Some(thread_handle),
        },
    );

    Ok(())
}

/// Stop watching a directory.
///
/// Removes the watcher for the specified path and cleans up resources.
/// Idempotent - safe to call even if the path is not being watched.
#[tauri::command]
pub async fn unwatch_directory(
    watcher_state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<(), AppError> {
    let watch_path = PathBuf::from(&path);

    // Try to canonicalize the path; if it fails (path doesn't exist),
    // try the raw path as key
    let path_key = watch_path
        .canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.clone());

    let mut guard = watcher_state
        .watchers
        .lock()
        .map_err(|e| AppError::Custom(format!("Watcher lock poisoned: {}", e)))?;

    if let Some(entry) = guard.remove(&path_key) {
        // Signal the watcher thread to stop
        let _ = entry.stop_tx.send(WatcherControl::Stop);

        // Wait for the thread to finish (with timeout via drop)
        if let Some(handle) = entry.thread_handle {
            // Join the thread to ensure clean shutdown
            let _ = handle.join();
        }

        println!("[watcher] Stopped watching directory: {}", path);
    }

    Ok(())
}

/// Legacy API: Start watching artifacts and database.
///
/// This is kept for backward compatibility with existing frontend code.
/// Internally delegates to the new `watch_directory` function.
#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    state: tauri::State<'_, WatcherState>,
    artifacts_dir: String,
    db_path: String,
) -> Result<(), AppError> {
    // Watch artifacts directory
    watch_directory(app.clone(), state.clone(), artifacts_dir).await?;

    // Watch the database file's parent directory
    let db_file_path = PathBuf::from(&db_path);
    if let Some(db_parent) = db_file_path.parent() {
        if db_parent.is_dir() {
            watch_directory(app, state, db_parent.to_string_lossy().to_string()).await?;
        }
    }

    Ok(())
}

/// Legacy API: Stop all watchers.
///
/// This is kept for backward compatibility with existing frontend code.
#[tauri::command]
pub async fn stop_watching(state: tauri::State<'_, WatcherState>) -> Result<(), AppError> {
    let mut guard = state
        .watchers
        .lock()
        .map_err(|e| AppError::Custom(format!("Watcher lock poisoned: {}", e)))?;

    // Stop all watchers
    for (path, entry) in guard.drain() {
        let _ = entry.stop_tx.send(WatcherControl::Stop);
        if let Some(handle) = entry.thread_handle {
            let _ = handle.join();
        }
        println!("[watcher] Stopped watching directory: {}", path);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_allowed_extension() {
        assert!(has_allowed_extension(Path::new("test.md")));
        assert!(has_allowed_extension(Path::new("test.json")));
        assert!(has_allowed_extension(Path::new("test.yaml")));
        assert!(has_allowed_extension(Path::new("test.mmd")));
        assert!(has_allowed_extension(Path::new("test.gv")));
        assert!(has_allowed_extension(Path::new("/path/to/file.MD"))); // case insensitive
        assert!(!has_allowed_extension(Path::new("test.txt")));
        assert!(!has_allowed_extension(Path::new("test.rs")));
        assert!(!has_allowed_extension(Path::new("test"))); // no extension
    }

    #[test]
    fn test_classify_event_nonexistent() {
        let path = Path::new("/nonexistent/path/to/file.md");
        assert_eq!(classify_event(path), "removed");
    }
}
