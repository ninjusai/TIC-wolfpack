# Decisions: mission-control

This file records technical and product decisions for the project. Each decision includes context, rationale, and alternatives considered.

---

## Decision Template

Copy this template for each new decision:

```markdown
## {YYYY-MM-DD}: {Decision Title}

**ID:** DEC-{NNN}
**Context:** {Why was this decision needed? What problem or question triggered it?}
**Decision:** {What was decided. Be specific and unambiguous.}
**Rationale:** {Why this choice over alternatives. What factors were decisive?}
**Alternatives Considered:**
- {Alternative 1}: {Why rejected}
- {Alternative 2}: {Why rejected}
**Decided By:** {agent_name}
**Status:** active
**Supersedes:** {DEC-XXX if replacing an earlier decision, else "N/A"}

---
```

## Status Values

- **active** - Currently in effect
- **superseded** - Replaced by a newer decision (link to it)
- **deprecated** - No longer relevant (project moved on)
- **experimental** - Being tested, not yet committed

---

## Decisions

{Newest decisions at top}

<!-- Add decisions below this line -->

## 2026-03-31: Tauri v2 Requires withGlobalTauri:true for IPC

**ID:** DEC-006
**Context:** The Mission Control app was showing mock data instead of real data from the Wolf Pack system. Frontend IPC calls to Tauri commands were returning undefined, causing the app to fall back to mock data.
**Decision:** Always include `withGlobalTauri: true` in the Tauri v2 capabilities configuration (tauri.conf.json) when using IPC commands.
**Rationale:**
- In Tauri v2, the `window.__TAURI__` global is NOT automatically injected into the webview
- Without this flag, frontend JavaScript has no way to call Rust backend commands
- The `invoke()` function from `@tauri-apps/api/core` silently fails without this flag
- This is a breaking change from Tauri v1 behavior where the global was always present
**Alternatives Considered:**
- None; this is a required configuration for Tauri v2 IPC to work
**Decided By:** alpha (after root cause investigation)
**Status:** active
**Supersedes:** N/A

---

## 2026-03-30: Use Tauri v2 + SolidJS + Tailwind CSS v4 Stack

**ID:** DEC-001
**Context:** Needed to choose a technology stack for building a desktop application that provides persistent project visibility, file system access, and SQLite database browsing. The application must run on Windows 11 without admin privileges.
**Decision:** Use Tauri v2 for the native backend (Rust), SolidJS for the reactive frontend, and Tailwind CSS v4 for styling.
**Rationale:**
- Tauri v2 provides native file system and SQLite access via Rust with small binary size (~10MB vs Electron's ~150MB)
- SolidJS offers fine-grained reactivity with JSX syntax familiar to React developers, but with better performance
- Tailwind CSS v4 enables rapid UI development with utility-first CSS
- WebView2 (required by Tauri) is pre-installed on Windows 11
- No admin privileges required for installation or operation
**Alternatives Considered:**
- Electron + React: Rejected due to large binary size and memory overhead
- Wails + Svelte: Considered viable but team had more TypeScript/JSX experience
- Native Win32: Rejected due to development velocity concerns
**Decided By:** alpha (based on architect recommendation)
**Status:** active
**Supersedes:** N/A

---

## 2026-03-30: Use rusqlite with WAL Mode for Database Access

**ID:** DEC-002
**Context:** The application needs to read wolfpack.db while CLI agents may be writing to it. Need to avoid lock contention and ensure the GUI never corrupts or modifies the database schema.
**Decision:** Use rusqlite with WAL (Write-Ahead Logging) mode for all database connections. The application is read-only for wolfpack.db and will never modify its schema.
**Rationale:**
- WAL mode supports concurrent readers and a single writer, eliminating lock contention for read operations
- The GUI only reads audit trail data; it has no need to write to wolfpack.db
- Schema integrity is preserved because the app never executes ALTER TABLE or CREATE TABLE
- rusqlite is a mature, well-maintained Rust binding for SQLite
**Alternatives Considered:**
- Default SQLite journal mode: Rejected due to lock contention with concurrent agent writes
- Separate database for GUI: Rejected because it would require data synchronization
- PostgreSQL: Rejected as overkill for local desktop app with single-digit table count
**Decided By:** anvil
**Status:** active
**Supersedes:** N/A

---

## 2026-03-30: Python Eval Harness with pytest for Validation

**ID:** DEC-003
**Context:** Needed a way to automate validation of all 27 eval cases defined in the eval spec. The harness must run in CI and report pass/fail clearly.
**Decision:** Build the eval harness using Python with pytest as the test framework. Use algorithmic scorers (deterministic checks) rather than LLM-based scorers for V1.
**Rationale:**
- pytest is standard in the pack's toolchain and integrates well with GitHub Actions
- Algorithmic scorers are deterministic and fast, suitable for CI
- Python has good libraries for file manipulation, JSON validation, and test reporting
- No LLM-based scorers needed because the system under test is a desktop app, not an AI model
**Alternatives Considered:**
- JavaScript/Vitest: Rejected because eval agent has stronger Python expertise
- Manual testing only: Rejected because it doesn't scale and can't run in CI
- Playwright alone: Rejected; pytest provides better structure for multiple eval cases
**Decided By:** eval
**Status:** active
**Supersedes:** N/A

---

## 2026-03-30: Manifest.json as Source of Truth (with Discrepancy Flagging)

**ID:** DEC-004
**Context:** Project state exists in both manifest.json files and wolfpack.db. These could diverge if agents update one but not the other. The GUI needs to know which to trust.
**Decision:** manifest.json is the primary source of truth for project state. When manifest.json and wolfpack.db conflict, display the manifest value as primary and show a visible warning indicating the discrepancy.
**Rationale:**
- manifest.json is the authoritative record created by the pipeline
- wolfpack.db is an audit trail, not a state store
- Showing both values with a warning lets the Pack Owner investigate conflicts
- Silently preferring one over the other would hide data integrity issues
**Alternatives Considered:**
- wolfpack.db as source of truth: Rejected because manifests are the pipeline's authoritative output
- Fail on discrepancy: Rejected because it would block the GUI on data issues
- Merge/reconcile automatically: Rejected due to complexity and risk of silent data loss
**Decided By:** alpha
**Status:** active
**Supersedes:** N/A

---

## 2026-03-30: V1 Shows Diagram Source as Code (No Visual Rendering)

**ID:** DEC-005
**Context:** The artifact browser needs to display .mmd (Mermaid) and .gv (Graphviz) diagram files. Visual rendering would require additional dependencies and development time.
**Decision:** V1 displays diagram source files as code in a monospaced viewer. Visual rendering is deferred to V2.
**Rationale:**
- Visual rendering requires additional libraries (mermaid-js, viz.js) and integration work
- Displaying source code meets the core need of viewing artifact content
- Keeps V1 scope focused on core functionality
- Pack Owner can copy source to external tools if visual rendering is needed
**Alternatives Considered:**
- Visual rendering in V1: Rejected to keep scope manageable
- External tool launch: Considered for V2 but not implemented in V1
**Decided By:** alpha
**Status:** active
**Supersedes:** N/A

---
