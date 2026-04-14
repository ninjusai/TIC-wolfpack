# Wolf Pack Memory Architecture

Version: 1.0.0
Author: Architect
Created: 2026-03-31

## Overview

The Wolf Pack Memory System is a three-layer persistent knowledge store that maintains context across sessions without bloating context windows. Each layer serves a distinct purpose with clear ownership, update rules, and compression strategies.

---

## Layer Model

```
+----------------------------------------------------------+
|  L1: Session Context (Ephemeral)                         |
|  - Lives in conversation only                            |
|  - Not persisted to disk                                 |
|  - Rebuilt from L2/L3 at session start                   |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
|  L2: Project Memory (Per-Project)                        |
|  - Location: artifacts/{project}/memory/                 |
|  - Scope: Single project knowledge                       |
|  - Files: CONTEXT.md, DECISIONS.md, CHANGELOG.md         |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
|  L3: Pack Memory (Cross-Project)                         |
|  - Location: squad/memory/                               |
|  - Scope: Reusable patterns, solutions, pack state       |
|  - Files: PACK_STATE.md, PATTERNS.md, SOLUTIONS.md       |
+----------------------------------------------------------+
```

---

## L1: Session Context (Ephemeral)

**Purpose:** Working memory for the current conversation.

**Characteristics:**
- Not persisted to files
- Reconstructed at session start from L2 + L3
- Contains active task context, current decisions in flight, referenced artifacts

**What Goes Here:**
- Current task objective and constraints
- Files being actively worked on
- Decisions made this session (not yet committed to L2/L3)
- Agent communication state

**Lifecycle:**
- Created when Alpha reads startup context
- Updated throughout conversation
- Flushed to L2/L3 at session end
- Discarded when session ends

---

## L2: Project Memory (Per-Project)

**Location:** `artifacts/{project}/memory/`

**Purpose:** Persistent knowledge about a specific project.

### Files

| File | Purpose | Updated By | Frequency |
|------|---------|------------|-----------|
| `CONTEXT.md` | Project state, active work, blockers | Alpha | Every session |
| `DECISIONS.md` | Technical and product decisions with rationale | Any agent (via Alpha) | When decisions made |
| `CHANGELOG.md` | Chronological record of work done | Any agent (via Alpha) | After each task |

### Ownership

- **Alpha** is responsible for ensuring project memory is read at session start and updated at session end
- **Specialist agents** report changes; Alpha commits them to memory files
- **Scribe** (if deployed) can assist Alpha with memory maintenance

### Update Triggers

| Trigger | Action | Who |
|---------|--------|-----|
| Session starts | Read CONTEXT.md | Alpha |
| Decision made | Append to DECISIONS.md | Alpha (from agent report) |
| Task completed | Append to CHANGELOG.md | Alpha (from agent report) |
| Session ends | Update CONTEXT.md | Alpha |
| Major milestone | Archive old entries | Alpha or automation |

---

## L3: Pack Memory (Cross-Project)

**Location:** `squad/memory/`

**Purpose:** Reusable knowledge that applies across all projects.

### Files

| File | Purpose | Updated By | Frequency |
|------|---------|------------|-----------|
| `PACK_STATE.md` | Current pack status, active projects, agent availability | Alpha | Session start/end |
| `PATTERNS.md` | Reusable patterns discovered across projects | Any agent (via Alpha) | When pattern identified |
| `SOLUTIONS.md` | Solutions to problems that may recur | Any agent (via Alpha) | When solution found |

### Ownership

- **Alpha** owns `PACK_STATE.md` exclusively
- **Specialist agents** propose additions to PATTERNS.md and SOLUTIONS.md
- **Alpha** reviews and commits pattern/solution additions

### Update Triggers

| Trigger | Action | Who |
|---------|--------|-----|
| Session starts | Read PACK_STATE.md | Alpha |
| New project added | Update PACK_STATE.md | Alpha |
| Reusable pattern found | Propose to PATTERNS.md | Agent (via report) |
| Problem solved (reusable) | Propose to SOLUTIONS.md | Agent (via report) |
| Session ends | Update PACK_STATE.md | Alpha |
| Monthly review | Compress/archive old entries | Alpha or automation |

---

## File Schemas

### CONTEXT.md (L2)

```markdown
# Project Context: {project_name}

Last updated: {YYYY-MM-DD HH:MM}
Updated by: {agent_name}

## Current State
{One paragraph summary of where the project stands}

## Active Work
- [ ] {Task currently in progress}
- [ ] {Next planned task}

## Blockers
- {Blocker description} (since: YYYY-MM-DD)

## Key Files
- `{path}` - {description}

## Notes for Next Session
- {Important context to remember}
```

### DECISIONS.md (L2)

```markdown
# Decisions: {project_name}

## {YYYY-MM-DD}: {Decision Title}
**Context:** {Why this decision was needed}
**Decision:** {What was decided}
**Rationale:** {Why this choice}
**Alternatives Considered:** {Other options and why rejected}
**Decided By:** {agent_name}
**Status:** {active|superseded|deprecated}

---
```

### CHANGELOG.md (L2)

```markdown
# Changelog: {project_name}

## {YYYY-MM-DD}

### {HH:MM} - {agent_name}
**Task:** {task_id or description}
**Done:**
- {What was accomplished}
**Files:**
- `{path}` - {created|modified|deleted}
**Notes:** {Optional context}

---
```

### PACK_STATE.md (L3)

```markdown
# Wolf Pack State

Last updated: {YYYY-MM-DD HH:MM}

## Active Projects
| Project | Status | Last Activity | Priority |
|---------|--------|---------------|----------|
| {name} | {status} | {YYYY-MM-DD} | {P0-P3} |

## Pack Roster
| Agent | Status | Current Assignment |
|-------|--------|-------------------|
| {name} | {active|busy|inactive} | {task or "available"} |

## Recent Activity
- {YYYY-MM-DD}: {Summary of what happened}

## Open Items
- [ ] {Item requiring attention}
```

### PATTERNS.md (L3)

```markdown
# Wolf Pack Patterns

## {Pattern Name}

**ID:** PAT-{NNN}
**Added:** {YYYY-MM-DD}
**Added By:** {agent_name}
**Projects Used:** {list of projects}

### Problem
{What problem does this pattern solve}

### Pattern
{How to apply this pattern}

### Example
```{language}
{Code or structure example}
```

### When to Use
- {Condition when applicable}

### When NOT to Use
- {Condition when to avoid}

---
```

### SOLUTIONS.md (L3)

```markdown
# Wolf Pack Solutions

## {Problem Title}

**ID:** SOL-{NNN}
**Added:** {YYYY-MM-DD}
**Added By:** {agent_name}
**Frequency:** {one-time|recurring|common}

### Problem
{Description of the problem}

### Symptoms
- {How to recognize this problem}

### Solution
{Step-by-step solution}

### Root Cause
{Why the problem occurs}

### Prevention
{How to avoid in future}

---
```

---

## Compression and Archival Rules

### Project Memory (L2)

| File | Compression Trigger | Action |
|------|---------------------|--------|
| CONTEXT.md | Never | Keep current (overwrite) |
| DECISIONS.md | >50 entries OR >6 months old | Move old entries to DECISIONS_ARCHIVE.md |
| CHANGELOG.md | >100 entries OR >30 days old | Move old entries to CHANGELOG_ARCHIVE.md |

### Pack Memory (L3)

| File | Compression Trigger | Action |
|------|---------------------|--------|
| PACK_STATE.md | Never | Keep current (overwrite) |
| PATTERNS.md | >30 patterns | Review for obsolete, archive to PATTERNS_ARCHIVE.md |
| SOLUTIONS.md | >50 solutions | Review for obsolete, archive to SOLUTIONS_ARCHIVE.md |

### Archive Format

Archived files go to `{memory_dir}/archive/` with naming:
- `DECISIONS_ARCHIVE_2026Q1.md`
- `CHANGELOG_ARCHIVE_2026-03.md`
- `PATTERNS_ARCHIVE_v1.md`

---

## Interaction Model

### Session Start (Alpha)

```
1. Read squad/memory/PACK_STATE.md
2. If working on project:
   - Read artifacts/{project}/memory/CONTEXT.md
   - Optionally scan DECISIONS.md for recent entries
3. Load into L1 (conversation context)
4. Greet human with current state summary
```

### During Session (All Agents)

```
1. Agent completes task
2. Agent logs report via squad/log.py
3. Agent notes any patterns or solutions in report
4. Alpha reads report
5. Alpha decides what goes to L2 vs L3:
   - Project-specific decisions -> L2/DECISIONS.md
   - Reusable patterns -> L3/PATTERNS.md
   - Work completed -> L2/CHANGELOG.md
```

### Session End (Alpha)

```
1. Update artifacts/{project}/memory/CONTEXT.md with current state
2. Update squad/memory/PACK_STATE.md
3. Flush any pending DECISIONS.md or CHANGELOG.md entries
4. Check compression triggers
```

### Automation Scripts (Future)

| Script | Purpose | Trigger |
|--------|---------|---------|
| `compress_memory.py` | Archive old entries | Weekly cron or manual |
| `validate_memory.py` | Check file integrity | CI pipeline |
| `sync_state.py` | Sync PACK_STATE from db | After db changes |

---

## Token Efficiency Guidelines

1. **Keep CONTEXT.md under 500 words** - It's read every session
2. **Use tables over prose** - Scannable, dense
3. **Archive aggressively** - Old entries move to archive files
4. **Link, don't duplicate** - Reference files by path, don't copy content
5. **Date everything** - Enables automated archival
6. **Use IDs** - PAT-001, SOL-001 enable referencing without copying

---

## Implementation Notes

### File Creation

When creating memory directories for a new project:
```bash
mkdir -p artifacts/{project}/memory
touch artifacts/{project}/memory/CONTEXT.md
touch artifacts/{project}/memory/DECISIONS.md
touch artifacts/{project}/memory/CHANGELOG.md
```

### Reading at Scale

For large memory files, agents should:
1. Read CONTEXT.md fully (always small)
2. Read only recent entries from DECISIONS.md and CHANGELOG.md
3. Search PATTERNS.md and SOLUTIONS.md by keyword, not full read

### Concurrency

- Only Alpha writes to PACK_STATE.md
- Only Alpha writes to L2 files
- Agents propose changes via reports; Alpha commits them
- No concurrent writes to same file

---

## Migration Path

For existing projects without memory:

1. Create `artifacts/{project}/memory/` directory
2. Initialize files from templates
3. Alpha populates CONTEXT.md from current knowledge
4. Going forward, follow the update protocols

---

## Summary

| Layer | Location | Scope | Persistence | Owner |
|-------|----------|-------|-------------|-------|
| L1 | Conversation | Current session | None | Active agent |
| L2 | artifacts/{project}/memory/ | Single project | Files | Alpha |
| L3 | squad/memory/ | All projects | Files | Alpha |

The memory system keeps knowledge persistent without bloating context. Alpha reads L2+L3 at session start, agents propose updates via reports, and Alpha commits changes to the appropriate layer.
