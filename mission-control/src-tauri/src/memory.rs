//! Memory status checking for Wolf Pack Mission Control
//!
//! Provides Tauri commands to check the staleness of memory files
//! (particularly PACK_STATE.md) for the Scribe heartbeat feature.

use serde::Serialize;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Status information about the PACK_STATE.md memory file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatus {
    /// Full path to the PACK_STATE.md file
    pub pack_state_path: String,
    /// Whether the file exists on disk
    pub exists: bool,
    /// Unix timestamp of last modification (seconds since epoch)
    pub last_modified: Option<u64>,
    /// Age of the file in minutes
    pub age_minutes: Option<i64>,
    /// Whether the file is considered stale (age > threshold)
    pub is_stale: bool,
    /// The staleness threshold in minutes
    pub threshold_minutes: u32,
}

/// Check the status of the PACK_STATE.md memory file.
///
/// # Arguments
/// * `project_root` - The root directory of the project
/// * `threshold_minutes` - Optional staleness threshold (defaults to 15 minutes)
///
/// # Returns
/// A `MemoryStatus` struct with information about the file's existence and staleness.
#[tauri::command]
pub fn get_memory_status(project_root: String, threshold_minutes: Option<u32>) -> MemoryStatus {
    let threshold = threshold_minutes.unwrap_or(15);
    let pack_state_path = PathBuf::from(&project_root)
        .join("squad")
        .join("memory")
        .join("PACK_STATE.md");

    let path_str = pack_state_path.to_string_lossy().to_string();

    if !pack_state_path.exists() {
        return MemoryStatus {
            pack_state_path: path_str,
            exists: false,
            last_modified: None,
            age_minutes: None,
            is_stale: true,
            threshold_minutes: threshold,
        };
    }

    let metadata = match std::fs::metadata(&pack_state_path) {
        Ok(m) => m,
        Err(_) => {
            return MemoryStatus {
                pack_state_path: path_str,
                exists: false,
                last_modified: None,
                age_minutes: None,
                is_stale: true,
                threshold_minutes: threshold,
            };
        }
    };

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let age_minutes = modified.map(|m| ((now - m) / 60) as i64);
    let is_stale = age_minutes.map(|a| a > threshold as i64).unwrap_or(true);

    MemoryStatus {
        pack_state_path: path_str,
        exists: true,
        last_modified: modified,
        age_minutes,
        is_stale,
        threshold_minutes: threshold,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_missing_file_returns_not_exists() {
        let dir = tempdir().unwrap();
        let status = get_memory_status(dir.path().to_string_lossy().to_string(), None);

        assert!(!status.exists);
        assert!(status.is_stale);
        assert!(status.last_modified.is_none());
        assert!(status.age_minutes.is_none());
    }

    #[test]
    fn test_existing_file_returns_exists() {
        let dir = tempdir().unwrap();
        let memory_dir = dir.path().join("squad").join("memory");
        fs::create_dir_all(&memory_dir).unwrap();
        fs::write(memory_dir.join("PACK_STATE.md"), "# Pack State").unwrap();

        let status = get_memory_status(dir.path().to_string_lossy().to_string(), None);

        assert!(status.exists);
        assert!(status.last_modified.is_some());
        assert!(status.age_minutes.is_some());
        // File was just created, should not be stale
        assert!(!status.is_stale);
    }

    #[test]
    fn test_threshold_override() {
        let dir = tempdir().unwrap();
        let memory_dir = dir.path().join("squad").join("memory");
        fs::create_dir_all(&memory_dir).unwrap();
        fs::write(memory_dir.join("PACK_STATE.md"), "# Pack State").unwrap();

        let status = get_memory_status(dir.path().to_string_lossy().to_string(), Some(30));

        assert_eq!(status.threshold_minutes, 30);
    }
}
