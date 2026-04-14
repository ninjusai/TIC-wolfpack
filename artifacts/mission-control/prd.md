---
id: "PRD-mission-control-001"
title: "Wolf Pack Mission Control V1 - Product Requirements Document"
version: "1.0.0"
status: "draft"
author: "quill"
last-updated: "2026-03-30"
traces-to:
  problem: "PRB-mission-control-001"
  eval-spec: "EVL-mission-control-001"
---

# Wolf Pack Mission Control V1 — Product Requirements Document

## 1. Problem Summary

The Pack Owner manages 13 AI specialist agents through a five-stage eval-first pipeline but lacks a persistent interface for doing so. All interaction occurs through the CLI, project state is lost between sessions, pipeline progress is invisible, and there is no structured way to create projects or browse data. The Pack Owner must reconstruct context from scratch at every session.

Full problem definition: [PRB-mission-control-001] (`artifacts/mission-control/problem.md`)

---

## 2. Goals

Each goal is derived from the eval spec thresholds in [EVL-mission-control-001].

| ID | Goal | Measure | Target | Source |
|----|------|---------|--------|--------|
| GOAL-01 | Eliminate session context loss | All project data persists across close/reopen with zero manual recovery actions | 100% persistence, zero prompts | EVL-CASE-001, 002 |
| GOAL-02 | Provide instant project status visibility | Every project with a valid manifest.json is listed with correct stage, status, and priority | 100% completeness and accuracy | EVL-CASE-003, 004 |
| GOAL-03 | Make pipeline progress visible per project | All five stages displayed with gate status, attempt count, agent, and artifact existence | 100% stage and gate data accuracy | EVL-CASE-005, 006, 007 |
| GOAL-04 | Enable structured project intake | Capture all six intake fields and produce valid intake.json consumable by Alpha | Valid JSON with all fields, form validation blocks incomplete submissions | EVL-CASE-008, 009, 010 |
| GOAL-05 | Allow browsing of all project artifacts | Every artifact file in a project directory is listed and viewable (Markdown rendered, diagram source as code) | 100% of files listed and viewable | EVL-CASE-011, 012, 013 |
| GOAL-06 | Replace manual DB exploration | All four wolfpack.db tables browsable with project and agent filtering | All tables accessible, filters return exact correct subsets | EVL-CASE-014, 015, 016 |
| GOAL-07 | Support fluid multi-project navigation | Switching between projects loads correct data within 2 seconds | <= 2000ms per switch, zero data carryover | EVL-CASE-017, 018 |
| GOAL-08 | Guarantee data accuracy across all sources | Displayed data matches manifest.json, wolfpack.db, and artifact files; discrepancies are flagged | Zero silent discrepancies | EVL-CASE-019, 020 |
| GOAL-09 | Run on Windows 11 without friction | Launches with standard user permissions, no WSL or non-standard dependencies | No admin required, clean install on Win11 | EVL-CASE-023, 024 |
| GOAL-10 | Perform at scale for the Pack Owner's workload | Handle up to 20 concurrent projects with responsive UI | Project list < 3s, switch < 2s, DB load < 2s | EVL-CASE-027 |

---

## 3. Requirements

### 3.1 Session & State (P0)

#### REQ-mission-control-001 — Persistent project state across sessions

**Priority:** P0
**Description:** When the Pack Owner closes the interface and reopens it, all project statuses, pipeline stages, and gate results are displayed without any manual action. No file-loading prompts, error dialogs, or empty states appear on reopen.
**Eval Trace:** [EVL-CASE-mission-control-001], [EVL-CASE-mission-control-002]
**Acceptance Criteria:**
- All projects with their pipeline stages, gate statuses, and assigned agents display identically after reopen.
- Zero prompts for manual file loading. Zero empty-state screens. Zero error dialogs after reopen.

---

### 3.2 Project Overview (P0)

#### REQ-mission-control-002 — Project list with correct metadata

**Priority:** P0
**Description:** The interface displays a list of all projects that have a valid `manifest.json` in their `artifacts/{project}/` directory. For each project, the list shows: name, current pipeline stage (1-5), stage status, and priority. All values match the manifest file.
**Eval Trace:** [EVL-CASE-mission-control-003], [EVL-CASE-mission-control-004]
**Acceptance Criteria:**
- Every project with a valid `manifest.json` appears in the list with name, stage, status, and priority matching the manifest.
- Directories without a valid `manifest.json` do not appear in the list.

---

### 3.3 Pipeline Visualization (P0)

#### REQ-mission-control-003 — Five-stage pipeline display per project

**Priority:** P0
**Description:** For a selected project, the interface displays all five pipeline stages (Problem, Eval Spec, PRD, Diagrams, Build Plan) with each stage's gate status (pending/passed/failed), attempt count, assigned agent, and whether the artifact file exists.
**Eval Trace:** [EVL-CASE-mission-control-005], [EVL-CASE-mission-control-006], [EVL-CASE-mission-control-007]
**Acceptance Criteria:**
- All five stages are shown with gate status, attempt count, agent, and artifact existence matching `manifest.json`.
- Partially complete pipelines show correct mixed states (completed, in-progress, pending).
- Gate retry counts are displayed accurately (e.g., a gate that failed once and passed on retry shows attempt count 2).

---

### 3.4 Structured Project Intake (P0)

#### REQ-mission-control-004 — Intake form captures all six fields

**Priority:** P0
**Description:** The interface provides a structured intake form capturing six fields: Problem, Users, Scope, Constraints, Success Criteria, and Prior Art. On submission, the form writes `artifacts/{project}/intake.json` containing all fields in valid JSON conforming to the intake schema.
**Eval Trace:** [EVL-CASE-mission-control-008], [EVL-CASE-mission-control-009]
**Acceptance Criteria:**
- Output file `artifacts/{project}/intake.json` is valid JSON with all six fields present and correctly typed.
- Minimal intake (required fields only, optional fields empty) produces valid output with empty fields represented as empty arrays or empty strings, not absent keys.

#### REQ-mission-control-005 — Intake form validates required fields

**Priority:** P0
**Description:** The intake form prevents submission when required fields (at minimum: Problem) are empty. Validation errors are displayed to the Pack Owner, and no `intake.json` file is created until validation passes.
**Eval Trace:** [EVL-CASE-mission-control-010]
**Acceptance Criteria:**
- Form does not submit when the problem field is empty.
- Validation error is displayed for the empty required field.
- No `intake.json` file is created when validation fails.

#### REQ-mission-control-006 — Standard intake only (no fast-track)

**Priority:** P0
**Description:** V1 supports only the standard intake flow. There is no fast-track intake path in the interface.
**Eval Trace:** [EVL-CASE-mission-control-008] (standard intake is the tested path)
**Acceptance Criteria:**
- The intake form presents the standard six-field flow.
- No fast-track option is available in the UI.

---

### 3.5 Artifact Browsing (P0)

#### REQ-mission-control-007 — List all artifact files per project

**Priority:** P0
**Description:** For a selected project, the interface lists every file in the `artifacts/{project}/` directory, including files in subdirectories (e.g., `diagrams/`).
**Eval Trace:** [EVL-CASE-mission-control-011]
**Acceptance Criteria:**
- 100% of files in the project's artifact directory are listed. Zero files missing from the list.

#### REQ-mission-control-008 — View artifact content with rendered Markdown

**Priority:** P0
**Description:** Selecting an artifact file displays its content. Markdown files (.md) are rendered as formatted HTML (headings, lists, tables). YAML frontmatter is displayed as a metadata block or hidden, not as raw text.
**Eval Trace:** [EVL-CASE-mission-control-012]
**Acceptance Criteria:**
- Markdown headings, lists, and tables render as HTML elements, not raw syntax.
- YAML frontmatter is not shown as raw text mixed into content.

#### REQ-mission-control-009 — Display diagram source as code

**Priority:** P0
**Description:** Diagram source files (`.mmd`, `.gv`) are displayed as source text in a code block or monospaced viewer. V1 does not render diagrams visually.
**Eval Trace:** [EVL-CASE-mission-control-013]
**Acceptance Criteria:**
- Diagram source text is displayed in a code block with monospaced font.
- Content matches the file on disk exactly.

---

### 3.6 Database Exploration (P0)

#### REQ-mission-control-010 — Browse all four wolfpack.db tables

**Priority:** P0
**Description:** The interface provides a database explorer that lists all four tables (reports, tasks, session_logs, agents) and allows the Pack Owner to select and browse each table's rows.
**Eval Trace:** [EVL-CASE-mission-control-014]
**Acceptance Criteria:**
- All four tables are listed and selectable.
- Selecting a table displays its rows. Row count matches the database.

#### REQ-mission-control-011 — Filter database tables by project and agent

**Priority:** P0
**Description:** The database explorer supports filtering table rows by project and by agent, returning exact correct subsets with zero false positives.
**Eval Trace:** [EVL-CASE-mission-control-015], [EVL-CASE-mission-control-016]
**Acceptance Criteria:**
- Filtering by project returns only rows matching that project. Exact row count matches expected.
- Filtering by agent returns only rows matching that agent. Zero false positives.

---

### 3.7 Multi-Project Navigation (P0)

#### REQ-mission-control-012 — Switch between projects with correct data

**Priority:** P0
**Description:** The Pack Owner can navigate from one project to another. After switching, all displayed data matches the target project. No data from the previous project is carried over.
**Eval Trace:** [EVL-CASE-mission-control-017]
**Acceptance Criteria:**
- After switching projects, all data (name, pipeline, gates, artifacts) matches the target project's `manifest.json`.
- Zero data carryover from the previous project.

#### REQ-mission-control-013 — Project switch within 2 seconds

**Priority:** P0
**Description:** Switching from one project's detail view to another completes (data fully rendered) within 2 seconds.
**Eval Trace:** [EVL-CASE-mission-control-018]
**Acceptance Criteria:**
- Every project switch completes in <= 2000ms.

---

### 3.8 Data Accuracy (P0)

#### REQ-mission-control-014 — Displayed data matches all sources of truth

**Priority:** P0
**Description:** Every data point displayed in the interface matches its source of truth: `manifest.json` for project state, `wolfpack.db` for audit trail, and artifact files for content. Zero discrepancies on spot-check.
**Eval Trace:** [EVL-CASE-mission-control-019]
**Acceptance Criteria:**
- Zero discrepancies between displayed data and source files/database across all projects.

#### REQ-mission-control-015 — Manifest is primary; discrepancies with DB are flagged

**Priority:** P0
**Description:** When `manifest.json` and `wolfpack.db` contain conflicting information, the interface displays the manifest value as the primary state and shows a visible warning indicating the discrepancy.
**Eval Trace:** [EVL-CASE-mission-control-020]
**Acceptance Criteria:**
- The manifest value is displayed as the primary state.
- A visible warning or flag identifies the discrepancy.
- The warning content makes the nature of the conflict identifiable.

---

### 3.9 Database Compatibility (P0)

#### REQ-mission-control-016 — Read existing wolfpack.db without schema changes

**Priority:** P0
**Description:** The interface reads `wolfpack.db` in its current schema (tables: reports, tasks, session_logs, agents) without requiring any schema migration. The database file schema is unchanged after interface use.
**Eval Trace:** [EVL-CASE-mission-control-021]
**Acceptance Criteria:**
- Interface launches and displays data from an unmodified `wolfpack.db`.
- Schema (sqlite_master) is identical before and after interface use.
- No migration scripts execute.

#### REQ-mission-control-017 — Handle empty database gracefully

**Priority:** P0
**Description:** An empty `wolfpack.db` (correct schema, zero rows) loads without error. The database explorer shows all four tables with an empty state, not an error or crash.
**Eval Trace:** [EVL-CASE-mission-control-022]
**Acceptance Criteria:**
- Interface launches without error on an empty database.
- Each table shows zero rows with an empty-state indicator, not an error dialog.

---

### 3.10 Platform (P0)

#### REQ-mission-control-018 — Run on Windows 11 without admin privileges

**Priority:** P0
**Description:** The interface launches and operates on Windows 11 with standard user permissions. No UAC prompt, no administrator requirement.
**Eval Trace:** [EVL-CASE-mission-control-023]
**Acceptance Criteria:**
- Application launches without UAC elevation.
- All features are functional under a standard user account.

#### REQ-mission-control-019 — No WSL or non-standard dependencies

**Priority:** P0
**Description:** All dependencies install on a clean Windows 11 machine with only Node.js (LTS) and Python 3.10+ installed. No WSL, Visual Studio Build Tools, or non-standard native modules required.
**Eval Trace:** [EVL-CASE-mission-control-024]
**Acceptance Criteria:**
- All npm/pip install commands complete with exit code 0 on clean Win11.
- No dependency requires WSL or native compilation.

---

### 3.11 Data Refresh (P1)

#### REQ-mission-control-020 — File system watching detects external changes

**Priority:** P1
**Description:** When `manifest.json` or `wolfpack.db` files are modified externally (e.g., by an agent working in the CLI), the interface detects the change and updates the displayed data without manual user action.
**Eval Trace:** [EVL-CASE-mission-control-025]
**Acceptance Criteria:**
- The project list updates to reflect external file changes within 5 seconds.

#### REQ-mission-control-021 — Manual reload button refreshes all data

**Priority:** P1
**Description:** A manual reload button refreshes all displayed data from `manifest.json` files and `wolfpack.db`, serving as a fallback when file watching misses a change.
**Eval Trace:** [EVL-CASE-mission-control-026]
**Acceptance Criteria:**
- All displayed data refreshes to match current file/database state after clicking reload.
- Reload completes within 3 seconds for up to 5 projects.

---

### 3.12 Scale (P1)

#### REQ-mission-control-022 — Handle 20 concurrent projects

**Priority:** P1
**Description:** The interface remains responsive with up to 20 projects and approximately 800+ database rows per table. No UI freezes during navigation or data loading.
**Eval Trace:** [EVL-CASE-mission-control-027]
**Acceptance Criteria:**
- Project list loads 20 projects within 3 seconds.
- Switching between any two projects completes within 2 seconds.
- Database explorer loads any table within 2 seconds.
- No UI freezes or unresponsive frames.

---

### 3.13 Agent Roster (P2)

#### REQ-mission-control-023 — View agent listing with activity summary

**Priority:** P2
**Description:** The interface provides a view of all agents showing name, role, status, and per-agent activity summaries (task count, report count, last activity date).
**Eval Trace:** [EVL-CASE-mission-control-014] (agents table browsable), [EVL-CASE-mission-control-016] (agent filtering)
**Acceptance Criteria:**
- All agents from the agents table are listed with their metadata.
- Activity summary counts match the data in tasks and reports tables.

---

### 3.14 Settings (P2)

#### REQ-mission-control-024 — Configurable database and project paths

**Priority:** P2
**Description:** The interface allows the Pack Owner to configure the database file path, project root path, and artifacts directory path. Settings persist across sessions.
**Eval Trace:** [EVL-CASE-mission-control-001] (persistence covers settings), [EVL-CASE-mission-control-021] (DB path must point to correct file)
**Acceptance Criteria:**
- Settings are editable and persist across close/reopen.
- Changing the database path causes the interface to load the specified database.

---

## 4. Non-Functional Requirements

#### NFR-mission-control-001 — Response time for navigation

**Description:** All user-initiated navigation actions (project switch, view change, artifact open) complete within 2 seconds.
**Eval Trace:** [EVL-CASE-mission-control-018], [EVL-CASE-mission-control-027]
**Acceptance Criteria:** <= 2000ms from click to data fully rendered.

#### NFR-mission-control-002 — Data refresh latency

**Description:** File system watcher detects changes within 5 seconds. Manual reload completes within 3 seconds for up to 20 projects.
**Eval Trace:** [EVL-CASE-mission-control-025], [EVL-CASE-mission-control-026], [EVL-CASE-mission-control-027]
**Acceptance Criteria:** File watcher <= 5s. Manual reload <= 3s.

#### NFR-mission-control-003 — Database integrity

**Description:** The interface never modifies the wolfpack.db schema. Read operations use WAL mode to avoid blocking agent writes. The database file schema is identical before and after any interface session.
**Eval Trace:** [EVL-CASE-mission-control-021], [EVL-CASE-mission-control-022]
**Acceptance Criteria:** Schema unchanged. No ALTER TABLE or CREATE TABLE statements executed against wolfpack.db.

#### NFR-mission-control-004 — Platform compatibility

**Description:** Runs on Windows 11 with standard user permissions, no WSL, no admin elevation. All dependencies install via standard package managers.
**Eval Trace:** [EVL-CASE-mission-control-023], [EVL-CASE-mission-control-024]
**Acceptance Criteria:** Launches and operates fully under standard user on clean Windows 11.

#### NFR-mission-control-005 — Scale ceiling

**Description:** Designed for up to 20 concurrent projects and up to 1000 rows per wolfpack.db table. Beyond this, performance degradation is acceptable.
**Eval Trace:** [EVL-CASE-mission-control-027]
**Acceptance Criteria:** All performance thresholds met at 20 projects / 800+ rows.

---

## 5. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| `manifest.json` schema | Data contract | Project state is read from `artifacts/{project}/manifest.json`. Schema defined in `squad/planning-ux.md` Section 4.1. |
| `wolfpack.db` schema | Data contract | Audit trail is read from SQLite database with tables: reports, tasks, session_logs, agents. Schema defined by `squad/init_db.py`. |
| Artifact directory structure | File system convention | Artifacts follow the `artifacts/{project}/` layout with standard filenames (problem.md, eval-spec.md, prd.md, build-plan.md, diagrams/). |
| `squad/planning-ux.md` Section 1.1 | Input format | Intake form output schema (intake.json) must conform to the intake summary format that Alpha consumes. |
| Tauri v2 + SolidJS + Tailwind CSS v4 | Technology stack | Architecture defined in `squad/app-architecture.md`. Forge implements in this stack. |
| Node.js LTS + Rust toolchain | Build dependencies | Required for building the Tauri application. Must be installable without admin privileges on Windows 11. |
| `squad/registry.json` | Agent data | Agent roster data source for the Agent Roster view. |

---

## 6. Traceability Matrix

| Requirement ID | Eval Case ID(s) | Priority |
|----------------|------------------|----------|
| REQ-mission-control-001 | EVL-CASE-mission-control-001, EVL-CASE-mission-control-002 | P0 |
| REQ-mission-control-002 | EVL-CASE-mission-control-003, EVL-CASE-mission-control-004 | P0 |
| REQ-mission-control-003 | EVL-CASE-mission-control-005, EVL-CASE-mission-control-006, EVL-CASE-mission-control-007 | P0 |
| REQ-mission-control-004 | EVL-CASE-mission-control-008, EVL-CASE-mission-control-009 | P0 |
| REQ-mission-control-005 | EVL-CASE-mission-control-010 | P0 |
| REQ-mission-control-006 | EVL-CASE-mission-control-008 | P0 |
| REQ-mission-control-007 | EVL-CASE-mission-control-011 | P0 |
| REQ-mission-control-008 | EVL-CASE-mission-control-012 | P0 |
| REQ-mission-control-009 | EVL-CASE-mission-control-013 | P0 |
| REQ-mission-control-010 | EVL-CASE-mission-control-014 | P0 |
| REQ-mission-control-011 | EVL-CASE-mission-control-015, EVL-CASE-mission-control-016 | P0 |
| REQ-mission-control-012 | EVL-CASE-mission-control-017 | P0 |
| REQ-mission-control-013 | EVL-CASE-mission-control-018 | P0 |
| REQ-mission-control-014 | EVL-CASE-mission-control-019 | P0 |
| REQ-mission-control-015 | EVL-CASE-mission-control-020 | P0 |
| REQ-mission-control-016 | EVL-CASE-mission-control-021 | P0 |
| REQ-mission-control-017 | EVL-CASE-mission-control-022 | P0 |
| REQ-mission-control-018 | EVL-CASE-mission-control-023 | P0 |
| REQ-mission-control-019 | EVL-CASE-mission-control-024 | P0 |
| REQ-mission-control-020 | EVL-CASE-mission-control-025 | P1 |
| REQ-mission-control-021 | EVL-CASE-mission-control-026 | P1 |
| REQ-mission-control-022 | EVL-CASE-mission-control-027 | P1 |
| REQ-mission-control-023 | EVL-CASE-mission-control-014, EVL-CASE-mission-control-016 | P2 |
| REQ-mission-control-024 | EVL-CASE-mission-control-001, EVL-CASE-mission-control-021 | P2 |

**Coverage check:** All 27 eval cases are traced to at least one requirement. All 24 requirements trace to at least one eval case. Zero orphan requirements. Zero orphan eval cases.

---

## 7. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| OQ-PRD-01 | Should the intake form include a "Ready Check" panel providing live validation feedback (solution language detection, testable criteria check), or is basic required-field validation sufficient for V1? | Affects REQ-005 scope and implementation complexity. | Open — recommend basic validation for V1, defer ready-check to V2. |
| OQ-PRD-02 | Should the Agent Roster view (REQ-023) pull agent metadata from `squad/registry.json`, from the `agents` table in wolfpack.db, or merge both? | Affects data source design for the agent view. | Open — recommend registry.json as primary, DB for activity counts. |
| OQ-PRD-03 | What is the exact intake.json schema that Alpha will consume? The eval spec references `{problem: string, users: string[], scope_in: string[], scope_out: string[], constraints: string[], success_criteria: string[], prior_art: string[]}` but this needs formal confirmation. | Affects REQ-004 output format. | Open — needs Alpha confirmation of intake.json contract. |
