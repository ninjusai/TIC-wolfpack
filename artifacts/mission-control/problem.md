---
id: "PRB-mission-control-001"
title: "Wolf Pack Mission Control"
version: "1.0.0"
status: "draft"
author: "framer"
last-updated: "2026-03-30"
---

# Problem Definition: Wolf Pack Mission Control

## 1. Problem Statement

The Pack Owner manages a team of 13 AI specialist agents through a five-stage eval-first product development pipeline, but has no persistent, integrated interface for doing so. Today, all interaction happens through the CLI (Claude Code terminal), project state is lost between sessions, pipeline progress is invisible, there is no structured way to start new projects, and the only data viewer (`squad/viewer.html`) requires manual file loading and cannot maintain state across refreshes. As a result, the Pack Owner must reconstruct context from scratch at every session, cannot see at a glance where any project stands, and has no way to navigate between multiple concurrent projects or their artifacts without issuing ad-hoc CLI commands.

## 2. Scope

### In Scope (V1)

- Persistent display of all in-flight projects and their current pipeline stage (Problem, Eval, PRD, Diagrams, Build Plan)
- Per-project detail view showing gate statuses (pending, passed, rejected), gate attempt counts, assigned agents, and links to artifact files
- Visual representation of the five-stage pipeline with approval gates, indicating which stages are complete, in-progress, or pending for a given project
- Structured project intake: a guided flow or form that captures the six intake fields (Problem, Users, Scope, Constraints, Success Criteria, Prior Art) defined in the planning UX layer
- Multi-project navigation: ability to switch between projects, see status summaries, and view priority ordering
- Database exploration: browsing the contents of `wolfpack.db` tables (reports, tasks, session_logs, agents) without manual file loading or drag-and-drop
- Artifact browsing: viewing the contents of artifact files (`problem.md`, `eval-spec.md`, `prd.md`, `build-plan.md`, diagram files) organized by project
- Session persistence: the interface retains project state and context between sessions without requiring the Pack Owner to re-ask what is happening
- Reading and displaying data from `manifest.json` files in `artifacts/{project}/` directories

### Out of Scope (V1)

- Agent spawning or execution: the interface does not start, stop, or communicate with agents; agents continue to operate exclusively through Claude Code CLI
- Artifact editing: the interface is read-only for artifacts; agents produce and modify artifacts, not the Pack Owner through this interface
- Gate approval workflow: Alpha continues to run gates through the CLI; the interface displays gate results but does not execute them
- Database schema migration: the interface reads the existing `wolfpack.db` schema as-is
- Real-time streaming of agent activity or live CLI output
- User authentication or multi-user access control (single Pack Owner)
- Mobile or tablet form factors
- Automated pipeline triggering (starting the next stage automatically when a gate passes)
- Notification system (email, push, etc.)
- Historical analytics or trend reporting across projects

## 3. Users

### Pack Owner

**Role:** The human who brings product ideas to the Wolf Pack, reviews pipeline artifacts at each gate, and makes strategic decisions about project priority and direction.

**Context:** Operates on Windows 11. Technical enough to understand pipeline stages, eval concepts, and artifact content. Non-technical enough that a CLI-only workflow creates friction: reconstructing state from memory or ad-hoc queries is slow and error-prone. Manages multiple concurrent projects at different pipeline stages.

**Goals:**
- Return to the pack after time away and immediately see where everything stands
- Start a new project without remembering the intake field structure or required format
- See which projects need attention (pending gate reviews, stalled stages, high-priority items)
- Navigate to any artifact for any project within a few interactions
- Browse the Wolf Pack database to review agent reports, task history, and session logs
- Understand pipeline progress visually rather than parsing CLI output or JSON files

## 4. Success Criteria

Each criterion is written so that a pass/fail eval can be constructed for it.

1. **SC-01: Session continuity.** When the Pack Owner closes the interface and reopens it, all project statuses, pipeline stages, and gate results are displayed without requiring any manual action (no file loading, no re-querying, no "what's happening?" prompts). Pass: state persists across close/reopen cycles. Fail: any project data is missing or requires manual recovery after reopen.

2. **SC-02: Project status at a glance.** The interface displays a list of all projects with, for each project: name, current pipeline stage (1-5), stage status (pending/in-progress/approved), and priority. Pass: every project in `artifacts/*/manifest.json` appears in the list with correct stage and status. Fail: any project is missing or shows incorrect stage/status.

3. **SC-03: Pipeline stage visibility.** For a selected project, the interface displays all five pipeline stages with their gate status (pending, passed, failed), attempt count, assigned agent, and whether the artifact file exists. Pass: all five stages are shown with data matching `manifest.json`. Fail: any stage is missing or shows incorrect gate data.

4. **SC-04: Structured project intake.** The interface provides a structured intake flow that captures all six intake fields (Problem, Users, Scope, Constraints, Success Criteria, Prior Art). The output is a formatted intake summary that Alpha can consume without reformatting. Pass: all six fields are captured and the output matches the intake summary format defined in `squad/planning-ux.md` Section 1.1. Fail: any field is missing or the output requires Alpha to reformat before use.

5. **SC-05: Artifact browsing.** For a selected project, the interface lists all artifact files in `artifacts/{project}/` and allows viewing their contents (rendered Markdown). Pass: every file in the project's artifact directory is listed and viewable. Fail: any artifact file is missing from the list or its content cannot be viewed.

6. **SC-06: Database exploration.** The interface allows browsing all four `wolfpack.db` tables (reports, tasks, session_logs, agents) with the ability to filter by project or agent. Pass: all four tables are browsable and filtering returns correct subsets. Fail: any table is inaccessible or filtering returns incorrect results.

7. **SC-07: Multi-project navigation.** The Pack Owner can switch between projects and each project's detail view loads correctly within 2 seconds. Pass: switching between any two projects loads the correct project data within 2 seconds. Fail: wrong project data is shown or load time exceeds 2 seconds.

8. **SC-08: Data accuracy.** Every piece of data displayed in the interface matches the source of truth (`wolfpack.db` for audit trail, `manifest.json` for project state, artifact files for content). Pass: zero discrepancies between displayed data and source files/database when spot-checked across all projects. Fail: any discrepancy found.

9. **SC-09: Existing database compatibility.** The interface reads `wolfpack.db` in its current schema (tables: reports, tasks, session_logs, agents) without requiring any schema migration or data transformation external to the application. Pass: the interface loads and displays data from an unmodified `wolfpack.db`. Fail: any schema change to `wolfpack.db` is required before the interface works.

10. **SC-10: Windows 11 operation.** The interface launches and operates on Windows 11 without requiring administrator privileges, WSL, or non-standard system dependencies. Pass: a clean launch on Windows 11 with standard user permissions succeeds. Fail: elevated permissions or uncommon system dependencies are required.

## 5. Constraints

- **Platform:** Must run on Windows 11 with standard user permissions.
- **Database compatibility:** Must read the existing `wolfpack.db` SQLite database without requiring schema migration. The tables are: `reports`, `tasks`, `session_logs`, `agents`.
- **Artifact directory structure:** Must read the existing `artifacts/{project}/` directory layout and `manifest.json` schema as defined in `squad/planning-ux.md` Section 4.1.
- **Read-only for agent operations:** The interface is a viewer and manager for human use. It does not spawn agents, execute pipeline stages, or modify artifacts. Agents continue to operate through Claude Code CLI.
- **Concurrent projects:** Must handle multiple projects at different pipeline stages simultaneously.
- **No external services:** The Pack Owner operates locally; the interface must not depend on cloud services, external APIs, or network connectivity for core functionality.

## 6. Assumptions

1. **The `manifest.json` schema is stable.** The schema defined in `squad/planning-ux.md` Section 4.1 will not change significantly before V1 is built. *Impact if wrong:* the interface would display stale or malformed project data; a manifest schema migration layer would be needed.

2. **The `wolfpack.db` schema is stable.** The four existing tables (reports, tasks, session_logs, agents) will not be restructured before V1. *Impact if wrong:* database queries would fail or return incorrect data; query layer would need updating.

3. **Project manifests exist for all active projects.** Every project that should appear in the interface has a valid `manifest.json` in its `artifacts/{project}/` directory. *Impact if wrong:* projects without manifests would be invisible; the interface would need a fallback discovery mechanism.

4. **The Pack Owner is the sole user.** No concurrent users, no access control, no multi-tenancy. *Impact if wrong:* data conflicts, missing auth layer, potential data corruption from concurrent writes.

5. **Artifact files are valid Markdown.** All `.md` files in artifact directories are well-formed Markdown with valid YAML frontmatter. *Impact if wrong:* rendering errors or crashes when displaying malformed files; defensive parsing would be needed.

6. **The intake summary format in `planning-ux.md` is the contract.** The structured intake output produced by the interface will be consumed by Alpha in the format defined in Section 1.1 of `planning-ux.md`. *Impact if wrong:* Alpha would need to re-parse or reformat intake data, defeating the purpose of structured intake.

## 7. Open Questions

1. **How does intake data flow from the interface to Alpha?** The interface captures structured intake, but Alpha operates in the CLI. What is the handoff mechanism? Does the interface write to a file that Alpha reads? Does it write to `wolfpack.db`? Or does the Pack Owner copy-paste the output into the CLI?

2. **Should the interface display the `projects` table from `wolfpack.db`?** The planning UX layer (Section 4.4, Section 8) specifies a `projects` table that does not yet exist in the current database schema. Does V1 depend on this table being created first, or should the interface derive project data solely from `manifest.json` files?

3. **What happens when `manifest.json` and `wolfpack.db` disagree?** The planning UX layer states that `manifest.json` is source of truth for project state and `wolfpack.db` is source of truth for audit trail. If they contain conflicting information (e.g., manifest says stage 2 but last DB entry says stage 3), which does the interface display? Should it flag the conflict?

4. **What is the refresh model?** Does the interface poll for changes to `wolfpack.db` and `manifest.json` on an interval, refresh on demand (manual reload), or detect file system changes? This affects how current the displayed data is when agents are actively working.

5. **Does the intake form support the fast-track path?** The planning UX layer defines a fast-track intake for small tasks (Section 1.4). Should the interface support this as a separate flow, or is fast-track exclusively a CLI interaction?

6. **How are diagram files displayed?** Artifact diagrams may be Mermaid (`.mmd`) or Graphviz (`.gv`) source files. Should the interface render them visually, or display the source text? Rendering adds complexity; source display is simpler but less useful.

7. **What is the expected data volume?** How many concurrent projects, artifacts per project, and database rows should the interface handle performantly? This affects whether simple file reads suffice or whether indexing and pagination are needed.
