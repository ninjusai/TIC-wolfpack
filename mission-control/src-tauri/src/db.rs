use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppError;

/// Tauri managed state wrapping an optional SQLite connection behind a Mutex.
/// The connection is opened in WAL mode with a busy timeout for concurrent access.
///
/// The connection may be `None` if the database file doesn't exist or couldn't be opened.
/// Commands should handle this gracefully and return appropriate errors.
pub struct DbState {
    pub db: Mutex<Option<Connection>>,
}

impl DbState {
    /// Create a new DbState with no connection.
    pub fn empty() -> Self {
        Self {
            db: Mutex::new(None),
        }
    }

    /// Create a new DbState with an established connection.
    pub fn with_connection(conn: Connection) -> Self {
        Self {
            db: Mutex::new(Some(conn)),
        }
    }

    /// Replace the current connection with a new one.
    /// Returns the old connection if there was one.
    pub fn set_connection(&self, conn: Option<Connection>) -> Result<Option<Connection>, AppError> {
        let mut guard = self.db.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        Ok(std::mem::replace(&mut *guard, conn))
    }
}

/// Open a SQLite connection to `wolfpack.db` at the given path.
///
/// - Sets `PRAGMA journal_mode=WAL` for concurrent read access while agents write.
/// - Sets `PRAGMA busy_timeout=5000` to wait up to 5 seconds on lock contention.
/// - Returns a descriptive error if the DB file does not exist (does NOT create it).
/// - Succeeds on an empty DB (exists but has no tables/data).
/// - Never modifies the schema — read-only access pattern.
pub fn open_database(db_path: &str) -> Result<Connection, AppError> {
    // Check that the file exists before opening — rusqlite would create it otherwise.
    if !std::path::Path::new(db_path).exists() {
        return Err(AppError::Custom(format!(
            "Database file not found at '{}'. Please run 'python squad/init_db.py' to initialize it.",
            db_path
        )));
    }

    let conn = Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;

    Ok(conn)
}
