# Scribe Heartbeat / Memory Staleness System

**Version:** 1.0
**Author:** Architect
**Date:** 2026-04-01
**Status:** Design Complete

## Problem Statement

Alpha frequently forgets to spawn Scribe at session end, causing memory files to go stale. The pack relies on memory continuity between sessions, but there is no automated mechanism to remind Alpha or the human when memory has not been updated recently.

## Goals

1. **Passive reminder system** - Make stale memory visible without blocking workflows
2. **Minimal infrastructure** - Use existing tools (Python, React/TypeScript)
3. **Two notification points** - CLI (log.py) and GUI (Mission Control)
4. **Configurable threshold** - Default 15 minutes for active sessions

## Non-Goals

- Background processes or scheduled tasks
- Blocking operations (this is a warning, not a gate)
- Automatic Scribe spawning
- Complex state tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Staleness Detection                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────────┐                 │
│   │   log.py     │         │  Mission Control │                 │
│   │  (CLI)       │         │  (Tauri App)     │                 │
│   └──────┬───────┘         └────────┬─────────┘                 │
│          │                          │                            │
│          │ check_memory_staleness() │ get_memory_status          │
│          │                          │ (Tauri command)            │
│          ▼                          ▼                            │
│   ┌──────────────────────────────────────────────┐              │
│   │         File System (mtime check)             │              │
│   │  • squad/memory/PACK_STATE.md (primary)       │              │
│   │  • artifacts/*/memory/CONTEXT.md (secondary)  │              │
│   └──────────────────────────────────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Staleness Detection

### Algorithm

```python
def is_memory_stale(file_path: str, threshold_minutes: int = 15) -> tuple[bool, int]:
    """
    Check if a memory file is stale.

    Returns:
        (is_stale: bool, minutes_since_update: int)
    """
    if not os.path.exists(file_path):
        return (True, -1)  # Missing = stale

    mtime = os.path.getmtime(file_path)
    age_minutes = (time.time() - mtime) / 60

    return (age_minutes > threshold_minutes, int(age_minutes))
```

### Files to Check

| File | Type | Priority | Scope |
|------|------|----------|-------|
| `squad/memory/PACK_STATE.md` | Primary | P0 | Pack-wide state |
| `artifacts/{project}/memory/CONTEXT.md` | Secondary | P1 | Active project context |

**Primary file** (`PACK_STATE.md`) is always checked. **Secondary files** are only checked when a project is active in the current context.

### Threshold Configuration

- **Default:** 15 minutes
- **Rationale:** Typical working session is 30-60 minutes. 15 minutes is half a short session, giving two opportunities to catch staleness.
- **Override:** Environment variable `WOLFPACK_MEMORY_STALE_MINUTES` (for CLI)

---

## Integration 1: log.py (CLI)

### Trigger Points

The staleness warning should appear when:

1. **Session events** - `python squad/log.py session --event ...`
2. **Reports** - `python squad/log.py report --agent ...`

These are the most common CLI operations Alpha runs during a session.

### Implementation Spec

Add a `check_memory_staleness()` function called at the start of `cmd_session()` and `cmd_report()`:

```python
# New constants
PACK_STATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "memory", "PACK_STATE.md")
DEFAULT_STALE_THRESHOLD_MINUTES = 15

def check_memory_staleness():
    """Check if PACK_STATE.md is stale and print warning if so."""
    threshold = int(os.environ.get("WOLFPACK_MEMORY_STALE_MINUTES",
                                    DEFAULT_STALE_THRESHOLD_MINUTES))

    if not os.path.exists(PACK_STATE_PATH):
        print("\n" + "=" * 60, file=sys.stderr)
        print("WARNING: PACK_STATE.md does not exist!", file=sys.stderr)
        print("Run: spawn Scribe to create memory files", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)
        return

    mtime = os.path.getmtime(PACK_STATE_PATH)
    age_minutes = int((time.time() - mtime) / 60)

    if age_minutes > threshold:
        print("\n" + "=" * 60, file=sys.stderr)
        print(f"WARNING: Memory is stale! PACK_STATE.md last updated {age_minutes} minutes ago.",
              file=sys.stderr)
        print("Consider spawning Scribe to update memory before session ends.", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)


def cmd_session(args):
    """Log a session event."""
    check_memory_staleness()  # <-- Add this call
    # ... rest of existing code


def cmd_report(args):
    """Log a report from an agent."""
    check_memory_staleness()  # <-- Add this call
    # ... rest of existing code
```

### Output Example

```
==============================================================
WARNING: Memory is stale! PACK_STATE.md last updated 23 minutes ago.
Consider spawning Scribe to update memory before session ends.
==============================================================

Session log: [delegation] alpha - Delegating task to forge
```

### Edge Cases

| Case | Behavior |
|------|----------|
| File doesn't exist | Warn: "PACK_STATE.md does not exist!" |
| File is fresh (< 15 min) | No warning, silent pass |
| File age exactly 15 min | No warning (threshold is exclusive) |
| File age > 15 min | Show staleness warning |

---

## Integration 2: Mission Control (Tauri App)

### Tauri Command Spec

Add a new command in `mission-control/src-tauri/src/` (new file: `memory.rs`):

```rust
// memory.rs

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MemoryStatus {
    pub pack_state_path: String,
    pub exists: bool,
    pub last_modified: Option<u64>,   // Unix timestamp
    pub age_minutes: Option<i64>,
    pub is_stale: bool,
    pub threshold_minutes: u32,
}

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

    let modified = metadata.modified().ok()
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
```

**Registration in lib.rs:**
```rust
mod memory;

// In invoke_handler:
memory::get_memory_status,
```

### UI Component Spec

Add a `MemoryStatusIndicator` component to the Header:

**Location:** `mission-control/src/components/MemoryStatusIndicator.tsx`

```tsx
import type { Component } from "solid-js";
import { createSignal, createEffect, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "../contexts/SettingsContext";

interface MemoryStatus {
  pack_state_path: string;
  exists: boolean;
  last_modified: number | null;
  age_minutes: number | null;
  is_stale: boolean;
  threshold_minutes: number;
}

const MemoryStatusIndicator: Component = () => {
  const { settings } = useSettings();
  const [status, setStatus] = createSignal<MemoryStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const checkStatus = async () => {
    const projectRoot = settings().projectRoot;
    if (!projectRoot) {
      setStatus(null);
      return;
    }

    try {
      const result = await invoke<MemoryStatus>("get_memory_status", {
        projectRoot,
        thresholdMinutes: 15,
      });
      setStatus(result);
      setError(null);
    } catch (e) {
      setError(String(e));
      setStatus(null);
    }
  };

  // Check on mount and every 60 seconds
  createEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    onCleanup(() => clearInterval(interval));
  });

  // Also refresh when data-refreshed event fires
  createEffect(() => {
    const handler = () => checkStatus();
    window.addEventListener("data-refreshed", handler);
    onCleanup(() => window.removeEventListener("data-refreshed", handler));
  });

  const s = status();
  if (!s) return null;

  // Fresh memory: subtle green indicator
  if (!s.is_stale && s.exists) {
    return (
      <div
        class="flex items-center gap-1.5 text-xs text-green"
        title={`Memory fresh (updated ${s.age_minutes}m ago)`}
      >
        <span class="w-2 h-2 rounded-full bg-green" />
        <span class="text-text-dim">Memory OK</span>
      </div>
    );
  }

  // Stale or missing: amber/red warning
  const ageText = s.exists && s.age_minutes !== null
    ? `${s.age_minutes}m ago`
    : "missing";
  const color = s.exists ? "text-yellow" : "text-red";
  const bgColor = s.exists ? "bg-yellow" : "bg-red";

  return (
    <div
      class={`flex items-center gap-1.5 text-xs ${color} cursor-help`}
      title={`PACK_STATE.md ${s.exists ? `last updated ${s.age_minutes}m ago` : 'does not exist'}. Consider spawning Scribe.`}
    >
      <span class={`w-2 h-2 rounded-full ${bgColor} animate-pulse`} />
      <span>Memory Stale ({ageText})</span>
    </div>
  );
};

export default MemoryStatusIndicator;
```

### Header Integration

Update `Header.tsx` to include the indicator:

```tsx
import MemoryStatusIndicator from "./MemoryStatusIndicator";

// In the return JSX, add to the left section:
<div class="flex items-center gap-3">
  <MemoryStatusIndicator />
  <h2 class="text-sm font-semibold text-text">
    {activeProject() ? activeProject() : "No Project Selected"}
  </h2>
</div>
```

### Visual States

| State | Indicator | Color | Animation |
|-------|-----------|-------|-----------|
| Fresh (< 15 min) | Solid dot + "Memory OK" | Green | None |
| Stale (> 15 min) | Dot + "Memory Stale (Xm ago)" | Yellow/Amber | Pulse |
| Missing | Dot + "Memory Stale (missing)" | Red | Pulse |
| No project root | Hidden | - | - |

---

## Edge Cases

### 1. No Memory File Exists

**CLI:** Warns "PACK_STATE.md does not exist!"
**UI:** Shows red indicator with "missing" text

### 2. First Session of Day

If the pack hasn't been used since yesterday, the file might be 12+ hours old. This is expected and the warning is appropriate - Scribe should update context at session start anyway.

### 3. Project Root Not Configured (Mission Control)

If `settings.projectRoot` is empty, the indicator simply doesn't render. This is intentional - no point warning about memory when the app isn't configured.

### 4. File System Clock Skew

File mtime is compared to current system time. Clock skew between machines could cause false positives/negatives. This is an acceptable limitation for a warning system.

### 5. Scribe Currently Running

No special handling. If Scribe is updating memory, the file mtime will update and the warning will clear on next check (within 60 seconds in UI, immediate in CLI next command).

---

## Implementation Tasks

### Task 1: Sigma - Add staleness check to log.py

**File:** `squad/log.py`

**Changes:**
1. Add `PACK_STATE_PATH` constant
2. Add `DEFAULT_STALE_THRESHOLD_MINUTES` constant
3. Add `check_memory_staleness()` function
4. Call `check_memory_staleness()` at start of `cmd_session()` and `cmd_report()`
5. Import `time` module (if not already imported)

**Acceptance Criteria:**
- Running `python squad/log.py session --event request --content "test"` with a stale PACK_STATE.md shows warning
- Running same command with fresh PACK_STATE.md shows no warning
- Warning goes to stderr, actual output to stdout

**Estimated effort:** 30 minutes

---

### Task 2: Anvil - Add Tauri command for memory status

**Files:**
1. Create `mission-control/src-tauri/src/memory.rs`
2. Update `mission-control/src-tauri/src/lib.rs` to register module and command

**Changes:**
1. Implement `MemoryStatus` struct with serde serialization
2. Implement `get_memory_status` Tauri command
3. Register command in `lib.rs` invoke_handler

**Acceptance Criteria:**
- Command returns correct status for existing fresh file
- Command returns correct status for existing stale file
- Command returns `exists: false` for missing file
- Threshold is configurable (default 15 minutes)

**Estimated effort:** 45 minutes

---

### Task 3: Forge - Add memory status indicator to Mission Control

**Files:**
1. Create `mission-control/src/components/MemoryStatusIndicator.tsx`
2. Update `mission-control/src/components/Header.tsx`

**Changes:**
1. Implement `MemoryStatusIndicator` component with three visual states
2. Add 60-second polling interval
3. Hook into `data-refreshed` event for manual refresh
4. Integrate into Header component

**Acceptance Criteria:**
- Green indicator shown when memory is fresh
- Yellow pulsing indicator when stale (> 15 min)
- Red pulsing indicator when file missing
- Tooltip shows detailed status
- Indicator updates on manual reload (Ctrl+R)
- Indicator hidden when project root not configured

**Estimated effort:** 1 hour

---

## Testing Plan

### Manual Testing (CLI)

```bash
# Test with fresh file
touch squad/memory/PACK_STATE.md
python squad/log.py session --event request --content "test"
# Expected: No warning

# Test with stale file (simulate by backdating - requires PowerShell)
powershell -Command "(Get-Item squad/memory/PACK_STATE.md).LastWriteTime = (Get-Date).AddMinutes(-20)"
python squad/log.py session --event request --content "test"
# Expected: Warning about 20-minute-old file

# Test with missing file
mv squad/memory/PACK_STATE.md squad/memory/PACK_STATE.md.bak
python squad/log.py session --event request --content "test"
# Expected: Warning about missing file
mv squad/memory/PACK_STATE.md.bak squad/memory/PACK_STATE.md
```

### Manual Testing (Mission Control)

1. Launch Mission Control with valid project root
2. Verify green indicator with fresh PACK_STATE.md
3. Wait 15+ minutes (or backdate file) and verify yellow indicator appears
4. Delete PACK_STATE.md and verify red indicator
5. Press Ctrl+R and verify indicator updates

### Integration Test (Sentry)

Add to `tests/test_memory_status.py`:
- Unit tests for `check_memory_staleness()` function
- Mocked file system tests for edge cases

---

## Rollout Plan

1. **Phase 1:** Sigma implements CLI warning (can ship independently)
2. **Phase 2:** Anvil implements Tauri command
3. **Phase 3:** Forge implements UI indicator (requires Phase 2)
4. **Phase 4:** Sentry validates end-to-end

Phases 1-3 can proceed in parallel. Phase 4 is gate review.

---

## Future Enhancements (Out of Scope)

- **Session activity tracking:** Only warn if there's been activity in the last 15 min
- **Per-project staleness:** Check project-specific CONTEXT.md files
- **Configurable threshold in UI:** Add to Settings page
- **Notification toast:** Pop up warning instead of passive indicator
- **Auto-spawn Scribe:** Trigger Scribe automatically at threshold (requires significant infra)

---

## Appendix: File Paths Reference

| File | Purpose |
|------|---------|
| `squad/log.py` | CLI logging - add staleness check |
| `squad/memory/PACK_STATE.md` | Primary memory file to monitor |
| `squad/memory/scripts/memory_status.py` | Existing script (reference, not modified) |
| `mission-control/src-tauri/src/memory.rs` | New Rust module |
| `mission-control/src-tauri/src/lib.rs` | Register new command |
| `mission-control/src/components/MemoryStatusIndicator.tsx` | New UI component |
| `mission-control/src/components/Header.tsx` | Integrate indicator |
