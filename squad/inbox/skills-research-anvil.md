# Skills Research: Anvil — Rust/Tauri Backend Specialist

**Researcher:** Scout
**Date:** 2026-03-30
**Status:** Complete

---

## 1. Core Technical Skills

### Rust (Stable Toolchain)
- **Ownership, borrowing, lifetimes** — the entire command handler layer must be written with correct lifetime annotations, especially when returning references from `State<'_, T>` in async commands
- **Error handling with `Result<T, E>`** — all command handlers must return `Result`. Use `thiserror` for defining typed error enums with `#[derive(Debug, thiserror::Error)]` and implement `serde::Serialize` on the error type so Tauri can send it to the frontend
- **Async/await** — Tauri v2 commands can be `async fn`, which runs them on a separate task via `async_runtime::spawn`. Critical: async commands cannot accept borrowed arguments like `&str` — use `String` instead. Async commands that panic will not crash the app but the JS Promise will never resolve, so always use `Result` return types
- **Interior mutability patterns** — `std::sync::Mutex` for wrapping `rusqlite::Connection` in managed state. Use `std::sync::Mutex` (not `tokio::Mutex`) because the critical section is short (just SQL queries), not async I/O awaits
- **Serde derives** — `#[derive(Serialize, Deserialize)]` with `#[serde(rename_all = "camelCase")]` on every IPC struct to match JavaScript naming conventions

### Tauri v2 Command System
- `#[tauri::command]` attribute macro to expose Rust functions as IPC endpoints
- `tauri::State<'_, T>` extractor to access managed state from commands
- `tauri::AppHandle` for app-level operations (event emission, path resolution, window management)
- `tauri::Manager` trait for emitting events from any context that has a handle
- Register commands via `.invoke_handler(tauri::generate_handler![cmd1, cmd2, ...])`
- Commands that accept state must use `tauri::State<'_, DbState>` — the lifetime is required for async commands returning `Result`

### rusqlite
- Open database with `Connection::open()` and immediately set `PRAGMA journal_mode=WAL`
- Wrap in `Mutex<Connection>` (not `Mutex<Option<Connection>>` unless lazy init is needed)
- Parameterized queries exclusively: `conn.execute("INSERT INTO t (a, b) VALUES (?1, ?2)", params![a, b])`
- Row mapping with `query_map` and closures for result sets
- `serde_rusqlite` crate for direct deserialization from rows into serde structs (optional but convenient)
- `rusqlite_migration` for schema versioning if needed

### File System Operations
- `std::fs` for synchronous operations (acceptable in Tauri commands since they run on a thread pool)
- `std::path::PathBuf` and `Path` for cross-platform path handling
- `canonicalize()` on all paths received from the frontend before any I/O
- `tauri::api::path` / `app.path()` resolver for standard directories (app data, config, etc.)

### File Watching (notify crate)
- `notify::RecommendedWatcher` for the platform-optimal backend (ReadDirectoryChangesW on Windows)
- `notify-debouncer-mini` or `notify-debouncer-full` crate for debouncing rapid events
- Event types: `EventKind::Create`, `Modify`, `Remove`, `Access` — map these to simplified frontend events
- Emit events to frontend via `app_handle.emit("file-changed", payload)` using Tauri's event system

---

## 2. Tools & Technologies (with Versions)

| Tool/Crate | Version | Purpose |
|---|---|---|
| **Tauri** | v2.10.x (latest stable) | Desktop app framework, IPC bridge |
| **tauri-build** | v2.x (match tauri version) | Build script for Tauri compilation |
| **Rust toolchain** | stable (1.85+) | Compilation; MSVC target on Windows |
| **rusqlite** | 0.32.x | SQLite bindings; use `bundled` feature to embed SQLite |
| **serde** | 1.x | Serialization/deserialization for IPC types |
| **serde_json** | 1.x | JSON handling for dynamic fields |
| **serde_yaml** | 0.9.x | Parsing artifact frontmatter from Markdown files |
| **notify** | 7.x or 9.0.0-rc.x | File system watcher; use with debouncer crate |
| **notify-debouncer-mini** | latest compatible | Debouncing for notify events |
| **thiserror** | 2.x | Error type derive macros |
| **open** | 5.x | Open files in system default application |
| **serde_rusqlite** | 0.36.x | Optional: direct serde bridge for rusqlite rows |
| **Cargo** | (bundled with rustup) | Build system and dependency management |
| **WiX Toolset** | v3 | Windows .msi installer generation |
| **WebView2** | (system or bundled) | Windows webview runtime |

---

## 3. Domain Knowledge

### Tauri v2 Architecture (Key Differences from v1)
- **Permissions/Capabilities model**: Tauri v2 replaced the v1 allowlist with a fine-grained ACL system. Capability files live in `src-tauri/capabilities/` as JSON or TOML. Each capability targets specific windows and declares allowed/denied permissions. All potentially dangerous plugin commands are blocked by default.
- **Plugin system**: v2 uses a new plugin architecture. SQL access, file dialogs, shell commands all go through plugins with explicit permission grants.
- **Event system**: `app.emit("event-name", payload)` for global events; `app.emit_to("window-label", "event", payload)` for targeted. Frontend listens with `listen("event-name", callback)`.
- **Window management**: Configured via `tauri.conf.json` under `app.windows[]`. Properties: label, title, width, height, resizable, decorations, center. Window state persistence via `tauri-plugin-window-state`.
- **Path resolver**: `app.path().app_data_dir()`, `app.path().app_config_dir()` etc. replace v1's `tauri::api::path` module.

### SQLite/rusqlite Patterns for Desktop Apps
- WAL mode enables concurrent reads while one writer holds the connection — critical when file watcher events and UI queries happen simultaneously
- Connection pooling is typically unnecessary for a single-user desktop app; one `Mutex<Connection>` suffices
- Use `PRAGMA busy_timeout=5000` alongside WAL to handle brief lock contention
- `rusqlite::Connection` is `Send` but not `Sync`, which is why the Mutex wrapper is required for Tauri's multi-threaded command execution

### Windows Desktop App Distribution
- **MSVC toolchain required**: `x86_64-pc-windows-msvc` is the required Rust target; GCC/MinGW is not supported
- **WebView2**: Windows 10/11 ships with it; installer can embed the bootstrapper, embed the offline installer, or download on demand. Default behavior downloads the bootstrapper at install time.
- **Code signing**: OV certificates or Azure Key Vault for signing. Required to avoid SmartScreen warnings and for Microsoft Store listing.
- **Installer formats**: `.msi` (WiX Toolset v3) or `.exe` (NSIS). MSI is preferred for enterprise deployment.

### IPC Contract Design
- All types crossing the Rust/JS boundary must implement `Serialize + Deserialize`
- Use `#[serde(rename_all = "camelCase")]` on all structs
- Use `Option<T>` for nullable/optional fields with `#[serde(skip_serializing_if = "Option::is_none")]`
- For type-safe IPC generation, consider `taurpc` crate which auto-generates TypeScript types from Rust trait definitions — but this is optional; manual type alignment works for 28 commands
- `serde_json::Value` for dynamic/unstructured JSON fields (e.g., flexible metadata)

---

## 4. Best Practices

### Error Handling
1. Define a single `AppError` enum using `thiserror`:
   ```rust
   #[derive(Debug, thiserror::Error)]
   pub enum AppError {
       #[error("Database error: {0}")]
       Database(#[from] rusqlite::Error),
       #[error("IO error: {0}")]
       Io(#[from] std::io::Error),
       #[error("Serialization error: {0}")]
       Serde(#[from] serde_json::Error),
       #[error("{0}")]
       Custom(String),
   }
   impl serde::Serialize for AppError {
       fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
       where S: serde::Serializer {
           serializer.serialize_str(&self.to_string())
       }
   }
   ```
2. All commands return `Result<T, AppError>` — never `Result<T, ()>` or `Result<T, String>`
3. Never `.unwrap()` in command handlers; always propagate with `?`
4. Never panic in commands — synchronous panics crash the app; async panics leave unresolved Promises

### State Management
1. Initialize state in `setup()` hook: `app.manage(DbState { db: Mutex::new(conn) })`
2. Use `std::sync::Mutex` (not tokio::Mutex) for database connections — lock duration is short
3. Lock pattern: `let conn = state.db.lock().map_err(|e| AppError::Custom(e.to_string()))?;` then execute query and drop the guard promptly
4. If lock poisoning is a concern, use `parking_lot::Mutex` which never poisons

### Command Design
1. Keep commands thin — extract SQL logic into separate functions for testability
2. Use `async` commands for anything involving I/O
3. Accept `String` not `&str` in async command signatures (borrowed types do not work in async commands)
4. Group related commands in modules: `commands/filesystem.rs`, `commands/database.rs`, `commands/project.rs`
5. Validate all inputs before database/filesystem operations

### File Watching
1. Start the watcher in the `setup()` hook with a cloned `AppHandle`
2. Use `notify-debouncer-mini` with a 300-500ms timeout to collapse rapid events
3. Filter events to only relevant file types (`.md`, `.yaml`, `.json`)
4. Emit structured events: `{ path: String, kind: String }` with kind mapped to "created", "modified", "removed"
5. Run the watcher on a dedicated thread (`std::thread::spawn`) with its own event loop

### Build Configuration
1. Keep `Cargo.toml` dependencies minimal — every crate adds compile time
2. Use `rusqlite` with `bundled` feature to embed SQLite (avoids system library dependency)
3. Pin major versions of tauri, tauri-build, and tauri-cli to the same minor version
4. Use `[profile.release]` with `strip = true` and `lto = true` for smaller binaries

---

## 5. Common Pitfalls

| Pitfall | Impact | Prevention |
|---|---|---|
| **SQL injection via `format!()`** | Security vulnerability | Always use `params![]` macro; never interpolate variables into SQL strings |
| **Blocking the main thread** | UI freezes | Use `async` commands; use `spawn_blocking` for CPU-heavy work |
| **Missing `#[serde(rename_all = "camelCase")]`** | Silent IPC failures — fields arrive as `null` on frontend | Enforce via code review; add a lint or test that checks all IPC types |
| **Using `&str` in async command signatures** | Compilation error with cryptic lifetime messages | Always use `String` for async commands; Tauri docs call this out explicitly |
| **Not debouncing file watcher events** | Frontend flooded with duplicate events per save | Use `notify-debouncer-mini` crate; 300-500ms window |
| **`.unwrap()` in command handlers** | App crash (sync) or hung Promise (async) | Use `?` operator with proper error types; enforce with clippy lint |
| **Mutex poisoning on panic** | All subsequent state access fails | Use `parking_lot::Mutex` (never poisons) or handle `PoisonError` gracefully |
| **Forgetting capabilities/permissions** | Frontend `invoke()` calls fail silently or with permission denied | Create capability files in `src-tauri/capabilities/` for every command group; test each command after wiring |
| **Hardcoded file paths** | Breaks on different machines/installs | Use `app.path()` resolver or settings-based paths; canonicalize inputs |
| **Stale tauri-cli vs tauri crate version** | Build failures, mysterious runtime errors | Pin tauri, tauri-build, and @tauri-apps/cli to the same minor version |
| **Not setting WAL mode at startup** | Database locked errors under concurrent access | Execute `PRAGMA journal_mode=WAL` immediately after `Connection::open()` |
| **Returning `()` error type** | Frontend gets no error information | Always return descriptive error strings/enums |
| **ReadDirectoryChangesW buffer overflow (Windows)** | Missed file events under heavy I/O | Increase buffer size in notify config; batch/debounce events |

---

## 6. Quality Criteria

1. **Compilation**: `cargo check` passes with zero errors
2. **Linting**: `cargo clippy` passes with zero warnings (document any `#[allow()]` exceptions)
3. **Command signatures**: All 28 commands match the specs in `squad/app-architecture.md` exactly
4. **SQL safety**: Zero instances of `format!()` or string concatenation in SQL queries — all parameterized with `params![]`
5. **Error propagation**: Zero `.unwrap()` calls in command handlers — all errors use `?` with `Result<T, AppError>`
6. **IPC types**: All structs crossing the IPC boundary have `Serialize + Deserialize` derives with `camelCase` renaming
7. **WAL mode**: Database opens with `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000`
8. **State safety**: Database connection wrapped in `Mutex<Connection>` as Tauri managed state
9. **Path safety**: All frontend-supplied paths canonicalized before filesystem operations
10. **Error messages**: Every error returned to the frontend contains an actionable human-readable message
11. **Debouncing**: File watcher uses debouncer crate, not raw event stream
12. **Permissions**: Every command has a corresponding capability declaration in `src-tauri/capabilities/`
13. **Minimal dependencies**: No unnecessary crates in `Cargo.toml`; every dependency justified

---

## 7. Recommended Prompt Elements

When spawning Anvil for a task, include these elements in the prompt:

### Always Include
- Reference to `squad/app-architecture.md` for command specifications
- Specific command names or groups being implemented (e.g., "filesystem commands", "SQLite query commands")
- Expected input/output types for the commands
- Whether the task is new implementation, modification, or bug fix

### Context to Provide
- Any frontend TypeScript types that define the expected IPC contract (so Anvil can match them)
- Database schema details if writing SQL queries (table names, column types)
- File paths or directory structures being watched or accessed

### Constraints to Emphasize
- "Rust layer is THIN — no business logic"
- "All SQL must be parameterized — zero string interpolation"
- "All IPC structs use `#[serde(rename_all = \"camelCase\")]`"
- "Return `Result<T, AppError>` from all commands — no unwrap, no panic"
- "Verify with `cargo check` before reporting"

### Example Spawn Prompt Pattern
```
Implement the [X] group of Tauri commands as defined in squad/app-architecture.md.
Reference the command signatures in section [Y]. The database schema is in [Z].
All commands return Result<T, AppError>. All SQL is parameterized. All types use
camelCase serde renaming. Run cargo check when done. Report via squad/log.py.
```

---

## Research Sources

- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/)
- [Tauri v2 Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Permissions](https://v2.tauri.app/security/permissions/)
- [Tauri v2 Tests](https://v2.tauri.app/develop/tests/)
- [Tauri v2 Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri v2 Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri v2 Configuration Files](https://v2.tauri.app/develop/configuration-files/)
- [Tauri Error Handling Recipes](https://tbt.qkation.com/posts/tauri-error-handling/)
- [Handling Errors in Tauri](https://tauritutorials.com/blog/handling-errors-in-tauri)
- [Tauri Command Fundamentals](https://tauritutorials.com/blog/tauri-command-fundamentals)
- [rusqlite Connection docs](https://docs.rs/rusqlite/latest/rusqlite/struct.Connection.html)
- [serde_rusqlite](https://docs.rs/serde_rusqlite)
- [notify crate (GitHub)](https://github.com/notify-rs/notify)
- [notify EventKind](https://docs.rs/notify/latest/notify/event/enum.EventKind.html)
- [Notify 9.0 RC announcement](https://cargo-run.news/p/notify-9-0-rc-enhances-filesystem-watching-with-robust-debouncing)
- [File Watcher with Debouncing in Rust](https://oneuptime.com/blog/post/2026-01-25-file-watcher-debouncing-rust/view)
- [Tauri + SQLite guide](https://dev.to/randomengy/tauri-sqlite-p3o)
