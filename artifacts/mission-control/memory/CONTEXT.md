# Project Context: mission-control

Last updated: 2026-04-01 (Dashboard Progress FIXED)
Updated by: scribe

## Current State

Wolf Pack Mission Control is **V1 COMPLETE + ALL CONTRACTS FIXED + DASHBOARD PROGRESS FIXED**. The desktop application is built using Tauri v2 (Rust backend) + SolidJS (TypeScript frontend) + Tailwind CSS v4. QA validation completed by Sentry (QA Specialist): **8/8 tests PASSED**, 1 test BLOCKED (visual inspection requires human verification).

**Key fix this session (2026-04-01):**

### Dashboard Pipeline Progress Fix (Task 2026-04-01-033)

- Added `architecture-decisions` stage — pipeline now has 6 stages matching the Rust backend
- Added `complete` state handling for `currentStage`
- Dashboard now correctly shows pipeline progress for all projects (no more "?/5 unknown")

**Previous session fixes (still in effect):**

### Artifact Browser Path Fix - VERIFIED WORKING

- Added `artifactsDir` prop to ArtifactBrowser component
- Used `resolvedArtifactsDir` from SettingsContext to construct full absolute path
- Files modified: `ArtifactBrowser.tsx`, `ProjectView.tsx`, `DbContext.tsx`
- User verified: "ok thats better I can see artifacts"

### Full Codebase Contract Audit

Anvil audited backend, Sentry verified all contracts between Rust and TypeScript. Root cause of many issues: **TypeScript interfaces didn't match Rust structs after serde `rename_all = "camelCase"` transformation**.

### 6 CRITICAL Contract Mismatches Fixed

1. **SummaryStats** - Complete rewrite (completely different field names)
2. **ArtifactInfo** - `size` -> `sizeBytes`, added `exists`, `frontmatter`, `modified`
3. **ArtifactEntry** - `type` -> `isDir`, added `lastModified`
4. **SessionEvent** - `id` number not string, `agent` nullable
5. **SlugValidation** - Field name alignment with Rust contract
6. **IntakeData/Project** - Added missing optional fields

### Other Bug Fixes

- `Dashboard.tsx`: `eventType` null handling (was crashing on undefined.replace)
- `App.tsx`: FileWatcher path error fix, SolidJS cleanup warning fixed
- `queries.rs`: `event` -> `event_type` field name alignment
- `DbContext.tsx`: `validate_slug` -> `validate_slug_with_suggestion`

### Earlier Fixes (Still in Effect)

1. **IPC Fix** - Added `withGlobalTauri: true` to tauri.conf.json
2. **Settings Persistence Fix** - Tauri v2 uses APPDATA (Roaming), not LOCALAPPDATA
3. **Database Connection Fixes** - DbState wraps `Option<Connection>` for graceful handling
4. **DevTools Enabled** - `devtools` feature in Cargo.toml for debugging
5. **Project Manifest** - `artifacts/mission-control/manifest.json` created
6. **Path Doubling Fix** - squad/squad path issue resolved
7. **Memory Status Indicator** - Header shows memory staleness

The application is fully functional: **V1 + Heartbeat + Contracts Fixed + Dashboard Fixed**.

## Active Work

- [x] All 27 eval test cases passing
- [x] Windows installer built
- [x] IPC communication working (withGlobalTauri fix)
- [x] Settings persistence working
- [x] Database connections working reliably
- [x] Memory system integration
- [x] QA validation by Sentry: 8/8 tests PASSED, 1 BLOCKED (visual inspection)
- [x] All 19 agents verified in registry and database
- [x] Path doubling bug fixed
- [x] Memory status indicator added to header
- [x] Full codebase contract audit completed (6 CRITICAL issues found and fixed)
- [x] All TypeScript interfaces aligned with Rust structs
- [x] Interview intake end-to-end tested successfully
- [x] Dashboard pipeline progress display fixed (6 stages)
- [ ] Potential V2 features planning (not started)

## Blockers

None. All known issues resolved.

## Key Files

| File | Purpose |
|------|---------|
| `artifacts/mission-control/problem.md` | Problem definition (PRB-mission-control-001) |
| `artifacts/mission-control/eval-spec.md` | Eval spec with 27 test cases (EVL-mission-control-001) |
| `artifacts/mission-control/prd.md` | Product requirements document (PRD-mission-control-001) |
| `artifacts/mission-control/build-plan.md` | Build plan with 23 work items (BLD-mission-control-001) |
| `artifacts/mission-control/diagrams/` | 6 Mermaid diagrams (system context, container, data flow, etc.) |
| `mission-control/src-tauri/` | Rust backend with SQLite, file system commands |
| `mission-control/src/` | SolidJS frontend with views and components |

## Dependencies

- **Upstream:** squad/wolfpack.db (read-only), squad/registry.json, artifacts/*/manifest.json
- **Downstream:** Pack Owner (user), Wolf Pack agents (visibility into their work)

## Notes for Next Session

- **V1 + ALL FIXES COMPLETE - STABLE AND IN USER TESTING**
- Dashboard pipeline progress now correctly shows 6 stages
- All known bugs resolved (no active blockers)
- QA validation: 8/8 tests PASSED, 1 BLOCKED (visual inspection needs human)
- Memory system is operational (Scribe agent active) with UI indicator
- Eval harness can be extended for V2 features
- File watcher is P1, so monitor for reliability issues in real use
- Pack now has 19 agents (added Cloud #18, Pixel #19 this session)
- **Key learning:** Tauri v2 requires `withGlobalTauri: true` in capabilities for IPC to work
- **Key learning:** Path construction must handle trailing "squad" in project_root to avoid path doubling
- **Key learning:** TypeScript interfaces MUST match Rust structs EXACTLY after serde camelCase transformation
- **Key learning:** Frontend must pass absolute paths to Rust backend; relative paths will fail silently
- **Key learning:** Claude Code bash shell on Windows doesn't have pnpm in PATH - use `npm run tauri dev`

## Quick Stats

| Metric | Value |
|--------|-------|
| Started | 2026-03-30 |
| V1 Complete | 2026-03-31 (All 27 evals passing) |
| QA Validated | 2026-03-31 (Sentry: 8/8 PASSED, 1 BLOCKED) |
| Heartbeat Feature | 2026-04-01 (Memory status indicator) |
| Path Fix | 2026-04-01 (squad/squad doubling resolved) |
| Contract Audit | 2026-04-01 (6 CRITICAL mismatches fixed) |
| Artifact Browser Fix | 2026-04-01 (relative -> absolute path) |
| Dashboard Progress Fix | 2026-04-01 (6 stages, complete state) |
| Total Agents | 19 (includes Cloud, Pixel) |
| Status | **V1 STABLE + USER TESTING** |
