# Project Context: scribe-heartbeat

Last updated: 2026-04-01
Updated by: scribe

## Current State

Scribe Heartbeat System is **COMPLETE AND OPERATIONAL**. This is a passive memory staleness detection system that reminds Alpha (and the human) when memory files have not been updated recently.

**Problem Solved:** Alpha frequently forgets to spawn Scribe at session end, causing memory files to go stale. The pack relies on memory continuity between sessions, but there was no automated mechanism to surface this.

**Solution:** Two-pronged notification system:
1. **CLI Warning** - `squad/log.py` now warns on session/report commands when PACK_STATE.md is stale
2. **UI Indicator** - Mission Control header shows green/yellow/red memory status indicator

## Components Built

| Component | File | Agent | Description |
|-----------|------|-------|-------------|
| Design Doc | `artifacts/scribe-heartbeat/DESIGN.md` | architect | Full spec with architecture, edge cases, testing plan |
| CLI Warning | `squad/log.py` | sigma | `check_memory_staleness()` function, warns on session/report |
| Tauri Command | `mission-control/src-tauri/src/memory.rs` | anvil | `get_memory_status` command returns staleness info |
| UI Indicator | `mission-control/src/components/MemoryStatusIndicator.tsx` | forge | Header component with 3 visual states |

## Configuration

- **Staleness Threshold:** 15 minutes (default)
- **CLI Override:** Environment variable `WOLFPACK_MEMORY_STALE_MINUTES`
- **UI Polling:** Every 60 seconds + on `data-refreshed` event

## Visual States (UI)

| State | Indicator | Color | Animation |
|-------|-----------|-------|-----------|
| Fresh (< 15 min) | Solid dot + "Memory OK" | Green | None |
| Stale (> 15 min) | Dot + "Memory Stale (Xm ago)" | Yellow | Pulse |
| Missing | Dot + "Memory Stale (missing)" | Red | Pulse |
| No project root | Hidden | - | - |

## Tasks Completed

- 2026-04-01-013: Design Scribe heartbeat system (architect) - COMPLETE
- 2026-04-01-014: Add memory staleness check to log.py (sigma) - COMPLETE
- 2026-04-01-015: Add get_memory_status Tauri command (anvil) - COMPLETE
- 2026-04-01-016: Add MemoryStatusIndicator to Mission Control (forge) - COMPLETE

## Future Enhancements (Out of Scope)

- Session activity tracking (only warn if there's been recent activity)
- Per-project staleness (check project-specific CONTEXT.md files)
- Configurable threshold in Mission Control settings UI
- Notification toast instead of passive indicator
- Auto-spawn Scribe at threshold (requires significant infra)

## Notes for Next Session

- System is fully operational, no pending work
- Manual testing can be done by backdating PACK_STATE.md mtime
- CLI warning goes to stderr, actual output to stdout
- UI indicator hidden when project root not configured

## Quick Stats

| Metric | Value |
|--------|-------|
| Started | 2026-04-01 |
| Completed | 2026-04-01 |
| Tasks | 4 |
| Agents Involved | architect, sigma, anvil, forge |
| Status | **COMPLETE** |
