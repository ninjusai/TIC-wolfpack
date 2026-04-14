---
title: "Wolf Pack Mission Control - Tauri App Architecture"
version: "1.0.0"
status: "draft"
author: "architect"
last-updated: "2026-03-30"
approved-by: null
depends-on:
  - "squad/operating-model.md"
  - "squad/planning-ux.md"
---

# Wolf Pack Mission Control - Tauri App Architecture

This document defines the architecture for the Wolf Pack Mission Control desktop application. It replaces the standalone `squad/viewer.html` and CLI-based workflows with a native Tauri desktop app that provides integrated project management, pipeline visualization, and database exploration.

---

## 1. Tech Stack Decision

### 1.1 Frontend Framework: SolidJS

**Decision:** SolidJS with TypeScript.

**Rationale:**

| Framework | Bundle Size | Tauri Compat | Learning Curve | Reactivity Model | Verdict |
|-----------|-------------|--------------|----------------|------------------|---------|
| Plain HTML/JS | Minimal | Perfect | None | Manual | Too much boilerplate for this scope |
| React | ~45 KB gzipped | Good | Low (team knows TS) | Virtual DOM, re-renders | Overkill runtime cost for a local desktop app |
| Vue | ~33 KB gzipped | Good | Medium | Proxy-based reactivity | Good, but less TS-native than alternatives |
| Svelte | ~2 KB runtime | Good | Medium | Compiler-based | Strong contender, but less mature TS story |
| **SolidJS** | **~7 KB gzipped** | **Perfect** | **Medium** | **Fine-grained reactivity, no VDOM** | **Winner** |

Why SolidJS over the others:

1. **Performance** -- SolidJS has no virtual DOM. It compiles to direct DOM updates. For a desktop app reading local SQLite and rendering tables/pipelines, this means instant UI updates with zero diffing overhead.
2. **Bundle size** -- At ~7 KB gzipped runtime, it keeps the Tauri binary small. The entire app frontend will be under 200 KB.
3. **TypeScript-first** -- SolidJS has first-class TypeScript support. Forge (our TS specialist) will be productive immediately. The JSX syntax is familiar to any React developer.
4. **Tauri compatibility** -- SolidJS uses Vite as its default bundler. Tauri v2 has native Vite support. No configuration gymnastics required.
5. **Reactivity model** -- SolidJS signals map naturally to our data model: signals for DB query results, derived signals for computed pipeline state, effects for file-watch subscriptions.
6. **Ecosystem** -- Solid Router for navigation, solid-primitives for utilities. Small but sufficient for a desktop app.

**Risk:** Forge may not know SolidJS. Mitigation: SolidJS API surface is small (~10 core primitives). A React developer can be productive in SolidJS within a day. The JSX syntax is nearly identical to React; the mental model shift is "no re-renders, signals instead of useState."

**Fallback:** If SolidJS proves too unfamiliar, Svelte is the second choice. Both use Vite, so swapping is a half-day migration at most.

### 1.2 Tauri Version: v2

**Decision:** Tauri v2 (stable since October 2024).

**Rationale:**

- Tauri v2 is the current stable release. v1 is in maintenance mode.
- v2 has improved IPC (inter-process communication) with a permissions-based security model.
- v2 has better plugin architecture -- we will use `tauri-plugin-sql` for SQLite and `tauri-plugin-fs` for file system access.
- v2 supports the new `tauri::command` attribute macro with improved type serialization (serde-based).
- All new Tauri development and ecosystem plugins target v2.
- v2's `EventTarget` system allows targeted events from Rust to specific frontend windows/webviews -- useful for file-watch notifications.

### 1.3 CSS Approach: Tailwind CSS v4

**Decision:** Tailwind CSS v4 via the Vite plugin.

**Rationale:**

- The existing `viewer.html` uses a CSS custom properties design system (dark theme with `--bg`, `--surface`, `--border`, `--accent`, etc.). Tailwind CSS v4 supports custom themes natively and can replicate this exact palette.
- Tailwind eliminates the need for a component library. Every UI element is styled inline with utility classes. No CSS file management.
- Tailwind v4 uses the Vite plugin (`@tailwindcss/vite`) -- zero PostCSS configuration needed.
- Forge is a TypeScript developer, not a CSS specialist. Tailwind's utility-class approach means Forge styles components without writing CSS.
- Tailwind produces only the CSS that is used. Final CSS will be under 10 KB.

**Theme:** We will define a custom theme matching the existing viewer palette:

```
--color-bg: #0d1117
--color-surface: #161b22
--color-border: #30363d
--color-text: #e6edf3
--color-text-dim: #8b949e
--color-accent: #f97316
--color-green: #3fb950
--color-red: #f85149
--color-yellow: #d29922
--color-blue: #58a6ff
```

### 1.4 State Management: SolidJS Stores + Context

**Decision:** Native SolidJS stores (no external library).

SolidJS provides two state primitives:
- **Signals** (`createSignal`) -- for simple reactive values (current tab, filter text, selected project).
- **Stores** (`createStore`) -- for complex nested objects (project list, query results, pipeline state).

Architecture:
- A `DbContext` provides SQLite query functions to all components via Tauri IPC.
- A `ProjectContext` holds the active project and its manifest data.
- A `SettingsContext` holds app configuration (DB path, project root).
- Each view manages its own local state with signals.

No Redux, no Zustand, no external state library. SolidJS's built-in reactivity is sufficient for this app's complexity.

### 1.5 SQLite Access: Tauri Commands (Rust Backend)

**Decision:** All SQLite access goes through Tauri commands in Rust. No `sql.js` in the frontend.

**Rationale:**

- The current `viewer.html` uses `sql.js` (SQLite compiled to WASM) to read the database in the browser. This requires loading the entire DB into browser memory and cannot write back to the file.
- Tauri provides native file system access. The Rust backend opens `wolfpack.db` directly using the `rusqlite` crate, which is a thin wrapper around the C SQLite library.
- This gives us read AND write access to the database file.
- Queries run in a native thread, not the UI thread. Large queries do not freeze the UI.
- The `rusqlite` crate supports WAL mode, which allows concurrent reads while agents write.

**Plugin consideration:** The `tauri-plugin-sql` plugin exists but is limited to predefined query patterns. We will use custom Tauri commands with `rusqlite` for full control.

---

## 2. Application Structure

The app has seven views, accessible via a sidebar navigation.

### 2.1 Dashboard View

**Purpose:** Overview of all projects, their pipeline stages, and recent activity.

**Data displayed:**
- Project cards showing: name, current stage (1-5), stage status (in-progress/gate-review/approved), priority, last activity timestamp.
- Summary statistics: total projects, active projects, projects awaiting gate review, total open tasks.
- Recent activity feed: last 20 session log entries across all projects (timestamped, showing agent + action).

**User actions:**
- Click a project card to navigate to Project View.
- Click "New Project" to navigate to Intake View.
- Drag project cards to reorder priority (writes to manifest.json).

**Tauri commands called:**
- `list_projects()` -- scans `artifacts/*/manifest.json` and returns all projects.
- `get_recent_activity(limit: u32)` -- queries `session_logs` for the N most recent entries.
- `get_summary_stats()` -- queries `tasks`, `reports`, `agents` for aggregate counts.

### 2.2 Project View

**Purpose:** Single project deep-dive showing its full artifact chain, gate status, and all associated records.

**Data displayed:**
- Project header: title, slug, mode (standard/fast-track), priority, status, creation date.
- Pipeline progress bar: visual 5-stage pipeline with gate pass/fail indicators.
- Artifact list: for each stage, show the artifact file path, its YAML frontmatter metadata (ID, version, status, author), and gate attempt history.
- Related tasks: all tasks from `wolfpack.db` where the title or context references this project slug.
- Related reports: all reports from `wolfpack.db` where the subject references this project slug.
- Related session logs: all session log entries referencing this project.

**User actions:**
- Click an artifact file to open it in the system default editor (or view its rendered Markdown).
- Click a gate to see its pass/fail history and rejection notes.
- Update project priority.
- Manually advance/regress pipeline stage (for corrections).

**Tauri commands called:**
- `get_project(slug: String)` -- reads manifest.json and returns full project state.
- `get_project_tasks(slug: String)` -- queries tasks table filtered by project slug.
- `get_project_reports(slug: String)` -- queries reports table filtered by project slug.
- `get_project_sessions(slug: String)` -- queries session_logs filtered by project slug.
- `read_artifact(path: String)` -- reads an artifact file and returns its content + parsed YAML frontmatter.
- `open_in_editor(path: String)` -- opens a file in the system default editor.
- `update_manifest(slug: String, updates: ManifestPatch)` -- writes changes to manifest.json.

### 2.3 Intake View

**Purpose:** Form-based project intake that replaces the conversational Q&A and template-paste flow.

**Data displayed:**
- Intake form with six fields matching the intake template:
  1. Problem (textarea)
  2. Users (textarea)
  3. Scope In (multi-line input)
  4. Scope Out (multi-line input)
  5. Constraints (textarea)
  6. Success Criteria (multi-line input, each line is one criterion)
  7. Prior Art (textarea)
- Project slug field (auto-generated from problem text, editable).
- Project title field.
- Mode selector: Standard / Fast-Track.
- Ready Check panel: live validation showing which of the four readiness criteria pass/fail:
  - Problem statement exists and contains no solution language.
  - At least one user/persona is identified.
  - At least one success criterion is stated.
  - Success criteria are testable.

**User actions:**
- Fill in the intake form.
- See real-time ready-check validation.
- Submit the intake: creates project scaffold (directories + manifest.json + placeholder files), inserts a row into the `projects` table in wolfpack.db, and logs the scaffolding event.
- Import from template: paste a filled-in intake template and have the form auto-populate.

**Tauri commands called:**
- `scaffold_project(intake: IntakeData)` -- creates the full project scaffold (mirrors `squad/scaffold.py` behavior, implemented in Rust).
- `validate_slug(slug: String)` -- checks if the slug is unique across `artifacts/`.
- `log_session_event(event: SessionEvent)` -- writes to `session_logs`.
- `create_task(task: TaskData)` -- writes to `tasks` table.

### 2.4 Pipeline View

**Purpose:** Visual pipeline for a single project showing stages, gates, progress, and artifact status.

**Data displayed:**
- Horizontal pipeline visualization with five stage nodes connected by arrows:
  ```
  [Problem Framing] -> G1 -> [Eval Spec] -> G2 -> [PRD] -> G3 -> [Diagrams] -> G4 -> [Build Plan] -> G5
  ```
- Each stage node shows: status (pending/in-progress/complete), assigned agent, start/complete timestamps.
- Each gate shows: status (pending/passed/failed), attempt count, last rejection reasons (if any).
- Current stage is highlighted. Completed stages are green. Failed gates are red.
- Below the pipeline: artifact detail panel for the selected stage, showing file contents or a "not yet created" placeholder.

**User actions:**
- Click a stage to see its artifact detail.
- Click a gate to see its full history (all attempts, rejection notes).
- Run automated gate checks (calls `gate-check.py` equivalent logic).

**Tauri commands called:**
- `get_project(slug: String)` -- reads manifest.json.
- `read_artifact(path: String)` -- reads artifact file content.
- `run_gate_check(slug: String, gate: String)` -- runs automated gate checklist items (YAML validation, ID format, trace checks).

### 2.5 DB Explorer View

**Purpose:** Replaces `squad/viewer.html`. Tabbed view into all wolfpack.db tables.

**Data displayed:**
- Four tabs matching the current viewer: Reports, Tasks, Session Log, Agents.
- Each tab shows a filterable, sortable data table.
- Filters: search text, agent dropdown, status dropdown, date range, event type (session log only).
- Row detail modal: click a row to see all fields in a detail panel.

**User actions:**
- Filter and sort data.
- Click rows for detail view.
- Export table data to CSV.
- Create new task (opens a form modal).
- Update task status inline.

**Tauri commands called:**
- `query_reports(filters: ReportFilters)` -- queries reports table with filtering/sorting/pagination.
- `query_tasks(filters: TaskFilters)` -- queries tasks table.
- `query_sessions(filters: SessionFilters)` -- queries session_logs table.
- `query_agents(filters: AgentFilters)` -- queries agents table.
- `update_task(task_id: String, updates: TaskPatch)` -- updates a task record.
- `create_task(task: TaskData)` -- creates a new task record.
- `export_csv(table: String, filters: Filters)` -- exports filtered data as CSV.

### 2.6 Agent Roster View

**Purpose:** View all agents, their roles, status, and activity.

**Data displayed:**
- Agent cards (grid layout) showing: name, role, status (active/inactive), reports-to, description.
- Per-agent activity summary: count of tasks assigned, count of reports filed, last activity date.
- Agent prompt file path (clickable to open).

**User actions:**
- Click an agent card to see full detail and activity history.
- Filter by status (active/inactive).
- Open agent prompt file in system editor.

**Tauri commands called:**
- `query_agents(filters: AgentFilters)` -- queries agents table.
- `get_agent_activity(name: String)` -- queries tasks and reports for a specific agent.
- `open_in_editor(path: String)` -- opens agent file in system editor.

### 2.7 Settings View

**Purpose:** App configuration.

**Data displayed / configurable:**
- Database path: path to `wolfpack.db` (default: `squad/wolfpack.db` relative to project root).
- Project root: path to the repository root (auto-detected, manually overridable).
- Artifacts directory: path to the `artifacts/` directory.
- Theme: dark (default), light (future).
- File watcher: enable/disable file system watching for live updates.

**User actions:**
- Browse for DB file path.
- Browse for project root path.
- Toggle file watcher.
- Reset to defaults.

**Tauri commands called:**
- `get_settings()` -- reads settings from a local config file.
- `update_settings(settings: AppSettings)` -- writes settings.
- `select_directory()` -- opens native directory picker dialog.
- `select_file(filters: Vec<String>)` -- opens native file picker dialog.

---

## 3. Rust Backend (Tauri Commands)

The Rust backend is intentionally thin. It provides four categories of commands: file system, SQLite, project management, and pipeline operations.

### 3.1 Shared Types

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Project {
    pub slug: String,
    pub title: String,
    pub mode: String,         // "standard" | "fast-track"
    pub priority: i32,
    pub status: String,       // "active" | "complete" | "archived"
    pub current_stage: String,
    pub created: String,      // ISO 8601
    pub manifest: serde_json::Value, // full manifest.json content
}

#[derive(Serialize, Deserialize)]
pub struct ArtifactInfo {
    pub path: String,
    pub exists: bool,
    pub content: Option<String>,
    pub frontmatter: Option<serde_json::Value>,
    pub size_bytes: u64,
    pub modified: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_count: u64,
}

#[derive(Serialize, Deserialize)]
pub struct IntakeData {
    pub slug: String,
    pub title: String,
    pub mode: String,
    pub problem: String,
    pub users: String,
    pub scope_in: Vec<String>,
    pub scope_out: Vec<String>,
    pub constraints: String,
    pub success_criteria: Vec<String>,
    pub prior_art: String,
}

#[derive(Serialize, Deserialize)]
pub struct TaskData {
    pub task_id: Option<String>,
    pub title: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub objective: Option<String>,
    pub context: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SessionEvent {
    pub event_type: String,
    pub agent: Option<String>,
    pub content: String,
}

#[derive(Serialize, Deserialize)]
pub struct GateCheckResult {
    pub gate: String,
    pub checks: Vec<GateCheck>,
    pub passed: bool,
    pub summary: String,
}

#[derive(Serialize, Deserialize)]
pub struct GateCheck {
    pub name: String,
    pub passed: bool,
    pub automatable: bool,
    pub detail: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AppSettings {
    pub db_path: String,
    pub project_root: String,
    pub artifacts_dir: String,
    pub file_watcher_enabled: bool,
}
```

### 3.2 File System Commands

```rust
#[tauri::command]
async fn read_artifact(path: String) -> Result<ArtifactInfo, String>
```
- Reads a file at `path`, returns content, parsed YAML frontmatter (if present), file size, and last-modified timestamp.
- Error: returns descriptive error string if file does not exist or is unreadable.

```rust
#[tauri::command]
async fn write_artifact(path: String, content: String) -> Result<(), String>
```
- Writes content to a file at `path`. Creates parent directories if needed.
- Error: returns error if write fails (permissions, disk space).

```rust
#[tauri::command]
async fn open_in_editor(path: String) -> Result<(), String>
```
- Opens the file at `path` in the system default editor using `open::that()`.
- Error: returns error if the system cannot open the file.

```rust
#[tauri::command]
async fn select_directory() -> Result<Option<String>, String>
```
- Opens the native directory picker dialog. Returns `None` if the user cancels.

```rust
#[tauri::command]
async fn select_file(filters: Vec<String>) -> Result<Option<String>, String>
```
- Opens the native file picker dialog with extension filters. Returns `None` if cancelled.

```rust
#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<DirEntry>, String>
```
- Lists the contents of a directory. Returns file names, types, sizes.

```rust
#[tauri::command]
async fn watch_directory(path: String) -> Result<(), String>
```
- Starts a file system watcher on `path`. Emits `file-changed` events to the frontend when files are created, modified, or deleted.
- Uses the `notify` crate for cross-platform file watching.

```rust
#[tauri::command]
async fn unwatch_directory(path: String) -> Result<(), String>
```
- Stops watching a directory.

### 3.3 SQLite Commands

All SQLite commands operate on the configured `wolfpack.db` path. The database connection is opened once at app startup and held in Tauri managed state (`tauri::State<DbState>`), protected by a `Mutex`.

```rust
#[tauri::command]
async fn query_reports(
    state: tauri::State<'_, DbState>,
    search: Option<String>,
    agent: Option<String>,
    status: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, String>
```
- Queries the `reports` table with optional filters, sorting, and pagination.
- Builds a parameterized SQL query (no string interpolation -- prevents SQL injection).
- Returns columns, rows, and total count (for pagination).

```rust
#[tauri::command]
async fn query_tasks(
    state: tauri::State<'_, DbState>,
    search: Option<String>,
    assigned_to: Option<String>,
    status: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, String>
```
- Same pattern as `query_reports` but for the `tasks` table.

```rust
#[tauri::command]
async fn query_sessions(
    state: tauri::State<'_, DbState>,
    search: Option<String>,
    agent: Option<String>,
    event_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<QueryResult, String>
```
- Same pattern for `session_logs` table.

```rust
#[tauri::command]
async fn query_agents(
    state: tauri::State<'_, DbState>,
    search: Option<String>,
    status: Option<String>,
) -> Result<QueryResult, String>
```
- Queries the `agents` table.

```rust
#[tauri::command]
async fn get_summary_stats(
    state: tauri::State<'_, DbState>,
) -> Result<SummaryStats, String>
```
- Returns aggregate counts: active agents, open tasks, total reports, projects by status.

```rust
#[tauri::command]
async fn create_task(
    state: tauri::State<'_, DbState>,
    task: TaskData,
) -> Result<String, String>
```
- Inserts a new task into the `tasks` table. Auto-generates task_id if not provided (matching `log.py` format: `YYYY-MM-DD-NNN`).
- Returns the task_id of the created task.

```rust
#[tauri::command]
async fn update_task(
    state: tauri::State<'_, DbState>,
    task_id: String,
    status: Option<String>,
    assigned_to: Option<String>,
    title: Option<String>,
) -> Result<(), String>
```
- Updates an existing task. Only non-None fields are updated.

```rust
#[tauri::command]
async fn log_session_event(
    state: tauri::State<'_, DbState>,
    event: SessionEvent,
) -> Result<(), String>
```
- Inserts a session log entry.

```rust
#[tauri::command]
async fn export_csv(
    state: tauri::State<'_, DbState>,
    table: String,
    filters: serde_json::Value,
    output_path: String,
) -> Result<String, String>
```
- Exports filtered query results to a CSV file at `output_path`.

### 3.4 Project Commands

```rust
#[tauri::command]
async fn list_projects(
    settings: tauri::State<'_, AppSettings>,
) -> Result<Vec<Project>, String>
```
- Scans `{artifacts_dir}/*/manifest.json`. Reads each manifest, returns a list of `Project` structs sorted by priority.
- Error: returns partial results if some manifests are malformed (logs warnings, does not fail entirely).

```rust
#[tauri::command]
async fn get_project(
    slug: String,
    settings: tauri::State<'_, AppSettings>,
) -> Result<Project, String>
```
- Reads `{artifacts_dir}/{slug}/manifest.json` and returns the full project data.

```rust
#[tauri::command]
async fn scaffold_project(
    intake: IntakeData,
    state: tauri::State<'_, DbState>,
    settings: tauri::State<'_, AppSettings>,
) -> Result<Project, String>
```
- Creates the project directory structure (matching `squad/scaffold.py` behavior):
  - `artifacts/{slug}/manifest.json`
  - `artifacts/{slug}/problem.md` (placeholder with YAML frontmatter)
  - `artifacts/{slug}/eval-spec.md` (placeholder)
  - `artifacts/{slug}/prd.md` (placeholder)
  - `artifacts/{slug}/build-plan.md` (placeholder)
  - `artifacts/{slug}/diagrams/` (empty directory)
- For fast-track mode: only `manifest.json` and directories.
- Inserts a row into the `projects` table in wolfpack.db.
- Logs a scaffolding event to `session_logs`.
- Returns the created `Project`.

```rust
#[tauri::command]
async fn validate_slug(
    slug: String,
    settings: tauri::State<'_, AppSettings>,
) -> Result<bool, String>
```
- Checks if `{artifacts_dir}/{slug}/` already exists. Returns `true` if the slug is available.

```rust
#[tauri::command]
async fn update_manifest(
    slug: String,
    updates: serde_json::Value,
    settings: tauri::State<'_, AppSettings>,
) -> Result<(), String>
```
- Reads the manifest, deep-merges updates, writes back to manifest.json.

```rust
#[tauri::command]
async fn get_recent_activity(
    state: tauri::State<'_, DbState>,
    limit: Option<u32>,
) -> Result<Vec<ActivityItem>, String>
```
- Queries `session_logs` ordered by timestamp descending, limited to `limit` (default 20).

### 3.5 Pipeline Commands

```rust
#[tauri::command]
async fn run_gate_check(
    slug: String,
    gate: String,
    settings: tauri::State<'_, AppSettings>,
) -> Result<GateCheckResult, String>
```
- Runs the automatable gate checklist items (mirrors `squad/gate-check.py` logic):
  - YAML frontmatter completeness
  - Artifact ID format validation
  - `traces-to` reference validation
  - Orphan requirement detection (for G3)
  - Dependency acyclicity check (for G5)
- Returns a structured result with pass/fail for each check.

```rust
#[tauri::command]
async fn get_artifact_status(
    slug: String,
    settings: tauri::State<'_, AppSettings>,
) -> Result<Vec<ArtifactStatus>, String>
```
- Returns the status of all artifacts for a project: which files exist, their sizes, last-modified dates, and frontmatter status fields.

### 3.6 Error Handling Approach

All Tauri commands follow a consistent error pattern:

1. **Return type** is always `Result<T, String>` where the error string is a human-readable message.
2. **Internal errors** (rusqlite, IO) are mapped using `.map_err(|e| format!("description: {}", e))`.
3. **Validation errors** return early with descriptive messages (e.g., "Slug 'my-project' already exists").
4. **Panics are never allowed.** All `unwrap()` calls are replaced with `?` or explicit error handling.
5. **Logging:** All errors are also written to a Tauri-side log file (`app.log`) for debugging.

### 3.7 State Management (Rust Side)

```rust
pub struct DbState {
    pub conn: Mutex<rusqlite::Connection>,
}

pub struct WatcherState {
    pub watchers: Mutex<HashMap<String, notify::RecommendedWatcher>>,
}
```

Both are registered as Tauri managed state in `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .manage(DbState { conn: Mutex::new(open_db(&settings.db_path)) })
        .manage(WatcherState { watchers: Mutex::new(HashMap::new()) })
        .manage(settings)
        .invoke_handler(tauri::generate_handler![
            list_projects, get_project, scaffold_project, validate_slug,
            update_manifest, get_recent_activity,
            query_reports, query_tasks, query_sessions, query_agents,
            get_summary_stats, create_task, update_task, log_session_event,
            export_csv,
            read_artifact, write_artifact, open_in_editor,
            select_directory, select_file, list_directory,
            watch_directory, unwatch_directory,
            run_gate_check, get_artifact_status,
            get_settings, update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. Data Flow

### 4.1 Project Discovery

```
App starts
  -> read AppSettings (from config file or defaults)
  -> scan {artifacts_dir}/ for subdirectories
  -> for each subdirectory, check if manifest.json exists
  -> parse each manifest.json
  -> sort by priority
  -> return to frontend as Vec<Project>
```

The frontend calls `list_projects()` on mount and stores the result in a SolidJS store. The Dashboard view renders from this store.

### 4.2 Project State Reading

Each project has two sources of truth:
- **`manifest.json`** -- pipeline state, stage status, gate history, intake data.
- **`wolfpack.db`** -- audit trail (who did what when), tasks, reports, session logs.

Reading project state:

```
Frontend requests project "chatbot"
  -> Rust: read artifacts/chatbot/manifest.json -> parse JSON
  -> Rust: query tasks WHERE title LIKE '%chatbot%' OR context LIKE '%chatbot%'
  -> Rust: query reports WHERE subject LIKE '%chatbot%'
  -> Rust: query session_logs WHERE content LIKE '%chatbot%'
  -> Return combined data to frontend
```

### 4.3 File System Sync (File Watching)

Agents modify files externally (via Claude Code in the terminal). The app must detect these changes.

```
App starts
  -> if file_watcher_enabled:
       start notify::Watcher on artifacts/ directory (recursive)
  -> on file event (create/modify/delete):
       emit Tauri event "file-changed" { path, event_type }
  -> Frontend listens for "file-changed" events:
       if path matches current project's artifacts -> re-fetch project data
       if path matches any manifest.json -> re-fetch project list
       if path matches wolfpack.db -> re-fetch current query results
```

Implementation detail: `wolfpack.db` changes are detected via file modification time, not WAL checkpoint events. The watcher debounces by 500ms to avoid rapid re-reads during bulk agent writes.

### 4.4 Intake Data Flow

```
User fills intake form in Intake View
  -> Frontend validates (ready-check, slug uniqueness)
  -> Frontend calls scaffold_project(IntakeData)
  -> Rust:
       1. Validate slug is unique (check artifacts/{slug}/ doesn't exist)
       2. Create directory: artifacts/{slug}/
       3. Create directory: artifacts/{slug}/diagrams/
       4. Write manifest.json with initial state
       5. Write placeholder files (problem.md, eval-spec.md, prd.md, build-plan.md)
       6. INSERT INTO projects table in wolfpack.db
       7. INSERT INTO session_logs (event: "project-created")
  -> Return Project to frontend
  -> Frontend navigates to Project View for the new project
```

### 4.5 Pipeline State Updates

The app is a viewer/manager -- it does not run the pipeline. Agents advance the pipeline via CLI tools. But the app can:

1. **Display current state** by reading manifest.json on demand.
2. **Detect external changes** via file watcher and refresh.
3. **Allow manual corrections** (e.g., marking a gate as passed if Alpha approved in CLI).

```
Pipeline update flow (external):
  Agent completes artifact -> writes file
  Alpha approves gate -> updates manifest.json via manifest.py
  -> File watcher detects manifest.json change
  -> Emits "file-changed" event
  -> Frontend re-reads project, updates pipeline visualization

Pipeline update flow (manual, via app):
  User clicks "Mark gate G2 as passed" in Pipeline View
  -> Frontend calls update_manifest(slug, { pipeline.stages.eval-spec.gate.status: "passed", ... })
  -> Rust writes updated manifest.json
  -> Frontend updates local state immediately (optimistic update)
```

---

## 5. V1 Scope

### 5.1 V1 -- MVP (Must Have)

These features make the app a genuine replacement for the current tooling.

| Feature | Replaces | Priority |
|---------|----------|----------|
| DB Explorer (Reports, Tasks, Sessions, Agents tabs) | `viewer.html` | P0 |
| Dashboard with project list | `manifest.py --action list` | P0 |
| Project View with manifest display | `manifest.py --action detail` | P0 |
| Intake form with scaffolding | `scaffold.py` + conversational intake | P0 |
| Pipeline visualization (read-only) | Manual manifest.json inspection | P0 |
| Settings (DB path, project root) | Hardcoded paths | P0 |
| File watcher for live updates | Manual refresh | P1 |
| Agent Roster view | `log.py agent --action list` | P1 |

**V1 goal:** A user can open Mission Control and do everything they currently do with `viewer.html`, `manifest.py`, `scaffold.py`, and `log.py task --action list` -- in a single app with a proper UI.

### 5.2 V2 Candidates (Deferred)

| Feature | Why Deferred |
|---------|--------------|
| Automated gate checking (run gate-check.py logic from app) | Requires implementing gate logic in Rust; Alpha can still run checks in CLI |
| Markdown artifact preview (rendered) | Requires a Markdown renderer; raw text view is sufficient for v1 |
| Mermaid diagram rendering | Requires embedding a Mermaid renderer; can view source in v1 |
| Task creation and update from within the app | Useful but agents create tasks via CLI; v1 is read-heavy |
| CSV export | Nice-to-have, not critical for daily workflow |
| Light theme | Dark theme matches existing viewer; light theme is cosmetic |
| Multi-window support | Tauri v2 supports it, but single-window is fine for v1 |
| Project priority drag-to-reorder | Can type priority numbers instead |
| Keyboard shortcuts | Useful for power users, not MVP |
| Notification system (e.g., desktop notifications when gates pass) | File watcher + visual update is sufficient for v1 |

### 5.3 V1 Development Estimate

| Component | Complexity | Estimated Effort |
|-----------|------------|------------------|
| Tauri project setup + Rust scaffolding | S | 1 session |
| SolidJS project setup + routing + layout | S | 1 session |
| DB Explorer view (port from viewer.html) | M | 2 sessions |
| Dashboard view | M | 1-2 sessions |
| Project View | M | 2 sessions |
| Intake View + scaffolding logic | M | 2 sessions |
| Pipeline visualization | M | 2 sessions |
| Agent Roster view | S | 1 session |
| Settings view | S | 1 session |
| File watcher integration | S | 1 session |
| Rust command layer (all commands) | L | 3-4 sessions |
| Tailwind theme + polish | S | 1 session |
| Testing + bug fixes | M | 2 sessions |
| **Total** | | **~18-20 sessions** |

A session is one agent context window (one focused work block). With Forge and a Rust specialist working in parallel, v1 is achievable in approximately 10 calendar days of active development.

---

## 6. Recruitment Gaps

### 6.1 Rust Specialist -- REQUIRED

**Role:** Tauri Backend Developer
**Why:** The Rust backend is thin but it still requires someone who knows Rust idioms, the `rusqlite` crate, `serde` serialization, Tauri command registration, and the `notify` crate for file watching. Forge is a TypeScript specialist -- asking Forge to write Rust is outside their core competency.

**Responsibilities:**
- Set up the Tauri v2 project (`src-tauri/` directory, `Cargo.toml`, `tauri.conf.json`).
- Implement all Tauri commands defined in Section 3.
- Manage the SQLite connection lifecycle and state management.
- Implement file watching with the `notify` crate.
- Build the app for Windows (NSIS installer or MSI).

**Agent name suggestion:** `anvil` (forges the Rust backend to complement Forge's TypeScript frontend).

**Recruitment path:** Alpha tasks Peter + Scout to recruit a Rust/Tauri specialist.

### 6.2 Forge -- Frontend Lead

**Status:** Available and capable.

Forge handles:
- SolidJS frontend implementation (all views, components, routing).
- Tailwind CSS theming.
- Tauri IPC integration (calling Rust commands from TypeScript).
- Frontend state management.

**Gap:** Forge may need a brief ramp-up on SolidJS. If this is a blocker, Forge can use React instead (see Section 1.1 fallback).

### 6.3 Pipeline -- Build Pipeline Setup

**Status:** Available.

Pipeline should:
- Set up GitHub Actions workflow for building the Tauri app on Windows.
- Configure the Tauri build to produce a Windows installer (.msi or .exe).
- Add linting and type-checking steps for the TypeScript frontend.

**When:** After Anvil and Forge have the project scaffolded. Pipeline work is a P1 task for v1.

### 6.4 Sketch -- NOT Needed for v1

Sketch's diagrams are for product artifacts, not for the app UI itself. The app UI is designed in code by Forge.

### 6.5 Summary

| Role | Agent | Status | Action |
|------|-------|--------|--------|
| Rust/Tauri backend | **anvil** (new) | Needs recruitment | Peter + Scout recruit |
| TypeScript frontend | **forge** | Available | Assign after architecture approval |
| CI/CD build pipeline | **pipeline** | Available | Assign after scaffolding |
| Architecture oversight | **architect** | This document | Review and iterate |

---

## 7. Project Structure

### 7.1 Directory Layout

```
project_development/                  # Repository root
  app/                                # Tauri application root
    package.json                      # Node.js dependencies (SolidJS, Tailwind, etc.)
    tsconfig.json                     # TypeScript configuration
    vite.config.ts                    # Vite configuration for SolidJS
    index.html                        # Entry HTML file (Vite SPA entry point)
    src/                              # Frontend source (SolidJS + TypeScript)
      index.tsx                       # App entry point
      App.tsx                         # Root component with router
      styles/                         # Tailwind config and global styles
        app.css                       # Tailwind imports + custom theme
      lib/                            # Shared utilities
        tauri.ts                      # Typed wrappers around Tauri invoke() calls
        types.ts                      # Shared TypeScript types (matching Rust structs)
        stores/                       # SolidJS stores and contexts
          db.ts                       # DbContext -- query functions
          projects.ts                 # ProjectContext -- active project state
          settings.ts                 # SettingsContext -- app configuration
      views/                          # Page-level components (one per view)
        Dashboard.tsx
        ProjectView.tsx
        IntakeView.tsx
        PipelineView.tsx
        DbExplorer.tsx
        AgentRoster.tsx
        Settings.tsx
      components/                     # Reusable UI components
        Sidebar.tsx                   # Navigation sidebar
        DataTable.tsx                 # Filterable, sortable table (reused in DB Explorer)
        Badge.tsx                     # Status badge component
        PipelineChart.tsx             # Stage pipeline visualization
        Modal.tsx                     # Detail modal
        IntakeForm.tsx                # Intake form with validation
        ProjectCard.tsx               # Project summary card
        FilterBar.tsx                 # Filter controls for tables
    src-tauri/                        # Rust backend (Tauri)
      Cargo.toml                      # Rust dependencies
      tauri.conf.json                 # Tauri configuration (window size, title, permissions)
      capabilities/                   # Tauri v2 capability files (permissions)
        default.json                  # Default capability: fs, dialog, shell access
      src/
        main.rs                       # Tauri app entry point, command registration
        commands/                     # Tauri command modules
          mod.rs                      # Module declarations
          db.rs                       # SQLite query commands
          projects.rs                 # Project management commands
          files.rs                    # File system commands
          pipeline.rs                 # Pipeline/gate commands
          settings.rs                 # Settings commands
        state.rs                      # Managed state (DbState, WatcherState, AppSettings)
        db.rs                         # Database connection helpers, query builders
        watcher.rs                    # File system watcher setup
        error.rs                      # Error types and conversions
      icons/                          # App icons (Tauri build requirement)
  squad/                              # Existing Wolf Pack infrastructure (unchanged)
    wolfpack.db
    log.py
    init_db.py
    viewer.html                       # Kept for backwards compatibility; deprecated
    ...
  artifacts/                          # Project artifacts (read by the app)
    {project-slug}/
      manifest.json
      problem.md
      eval-spec.md
      prd.md
      build-plan.md
      diagrams/
```

### 7.2 Key Configuration Files

**`app/package.json`** (dependencies):
```json
{
  "name": "wolfpack-mission-control",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "solid-js": "^1.9.x",
    "@solidjs/router": "^0.14.x",
    "@tauri-apps/api": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "vite-plugin-solid": "^2.x",
    "@tailwindcss/vite": "^4.x",
    "tailwindcss": "^4.x",
    "@tauri-apps/cli": "^2.x"
  }
}
```

**`app/src-tauri/Cargo.toml`** (Rust dependencies):
```toml
[package]
name = "wolfpack-mission-control"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-build = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
notify = "7"
open = "5"
csv = "1"
chrono = "0.4"
```

**`app/src-tauri/tauri.conf.json`** (key settings):
```json
{
  "productName": "Wolf Pack Mission Control",
  "version": "0.1.0",
  "identifier": "com.wolfpack.missioncontrol",
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Wolf Pack Mission Control",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "decorations": true
      }
    ]
  }
}
```

### 7.3 Relationship to Existing Directories

| Directory | App's relationship |
|-----------|-------------------|
| `squad/wolfpack.db` | Read and write via Rust backend. App does NOT own or migrate this file. |
| `squad/log.py` | Not called by the app. The Rust backend reimplements the same DB operations. `log.py` continues to work independently for CLI-based agent workflows. |
| `squad/registry.json` | Read by the app to display agent roster. The app does not modify it. |
| `artifacts/` | Read by the app to discover projects and their artifacts. The app writes to this directory only during scaffolding (new project creation). |
| `squad/viewer.html` | Deprecated by the app. Kept in the repo for backwards compatibility but no longer the primary viewer. |

### 7.4 Build and Dev Commands

```bash
# Development (from app/ directory)
cd app
npm install                    # Install frontend dependencies
npm run tauri dev              # Start Tauri in dev mode (hot-reload frontend + Rust backend)

# Build for production
npm run tauri build            # Builds the app; output in app/src-tauri/target/release/bundle/

# Frontend only (for rapid UI iteration without Rust compilation)
npm run dev                    # Starts Vite dev server at localhost:1420
```

**Windows build output:** `app/src-tauri/target/release/bundle/nsis/Wolf Pack Mission Control_0.1.0_x64-setup.exe`

### 7.5 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | Frontend tooling (Vite, SolidJS) |
| Rust | >= 1.77 | Tauri backend compilation |
| pnpm or npm | Latest | Package management |
| Tauri CLI | v2 | `npm install -g @tauri-apps/cli` |
| Visual Studio Build Tools | 2022 | Required on Windows for Rust compilation |
| WebView2 | Runtime | Pre-installed on Windows 11 |

---

## 8. IPC Contract Summary

This table provides a quick reference for all Tauri commands and which views call them.

| Command | Views Using It | Category |
|---------|---------------|----------|
| `list_projects` | Dashboard | Project |
| `get_project` | ProjectView, PipelineView | Project |
| `scaffold_project` | IntakeView | Project |
| `validate_slug` | IntakeView | Project |
| `update_manifest` | ProjectView, PipelineView | Project |
| `get_recent_activity` | Dashboard | Project |
| `query_reports` | DbExplorer, ProjectView | SQLite |
| `query_tasks` | DbExplorer, ProjectView | SQLite |
| `query_sessions` | DbExplorer, ProjectView | SQLite |
| `query_agents` | DbExplorer, AgentRoster | SQLite |
| `get_summary_stats` | Dashboard | SQLite |
| `create_task` | DbExplorer, IntakeView | SQLite |
| `update_task` | DbExplorer | SQLite |
| `log_session_event` | IntakeView | SQLite |
| `export_csv` | DbExplorer | SQLite |
| `read_artifact` | ProjectView, PipelineView | FileSystem |
| `write_artifact` | (v2: artifact editing) | FileSystem |
| `open_in_editor` | ProjectView, AgentRoster | FileSystem |
| `select_directory` | Settings | FileSystem |
| `select_file` | Settings | FileSystem |
| `list_directory` | (internal) | FileSystem |
| `watch_directory` | (auto on startup) | FileSystem |
| `unwatch_directory` | (auto on shutdown) | FileSystem |
| `run_gate_check` | PipelineView | Pipeline |
| `get_artifact_status` | ProjectView, PipelineView | Pipeline |
| `get_settings` | Settings, (app init) | Settings |
| `update_settings` | Settings | Settings |

---

## 9. Security Model

Tauri v2 uses a capabilities-based permission model. The app needs these permissions:

```json
{
  "identifier": "default",
  "description": "Default capability for Mission Control",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "shell:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir"
  ]
}
```

**Scope restrictions:**
- File system access is scoped to `$APPDATA`, `$RESOURCE`, and explicitly configured paths (artifacts dir, squad dir).
- No network access is required. The app is fully offline.
- Shell access is limited to `open::that()` for opening files in the default editor.

---

## 10. Document Control

| Field | Value |
|-------|-------|
| **Document ID** | `ARCH-APP-001` |
| **Version** | 1.0.0 |
| **Status** | Draft -- pending Alpha approval |
| **Author** | Architect |
| **Depends on** | `squad/operating-model.md` v1.0.0, `squad/planning-ux.md` v1.0.0 |
| **Effective date** | Upon Alpha approval |

**Change log:**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-03-30 | architect | Initial Tauri app architecture |
