---
title: "Planning UX Layer"
version: "1.0.0"
status: "draft"
author: "architect"
last-updated: "2026-03-30"
approved-by: null
depends-on: "squad/operating-model.md"
---

# Planning UX Layer

This document defines the systems and protocols that sit on top of the Eval-First Product Operating Model (`squad/operating-model.md`) to make the planning process frictionless for the human (Pack Owner). Every protocol here is actionable — Alpha can follow it step-by-step without interpretation.

---

## 1. Intake Flow

### 1.1 Conversational Intake Protocol

When the human brings an idea, Alpha runs this exact sequence. The goal is to extract enough information in one pass to hand off to Framer.

**Step 1: Classify the idea size.**

Alpha asks one question first:

> "Is this a quick feature/fix (something that could be described in a sentence or two), or a larger product/system idea?"

- If **quick** -> go to Section 1.4 (Fast-Track Intake).
- If **larger** -> continue to Step 2.

**Step 2: Extract the six intake fields.**

Alpha asks up to six questions, but stops as soon as the human has covered a field unprompted. Alpha does NOT ask questions the human has already answered.

| # | Field | Question Alpha Asks | What "done" looks like |
|---|-------|---------------------|------------------------|
| 1 | **Problem** | "What problem are you trying to solve? Who has this problem?" | A clear statement of what is broken or missing, with affected users identified. |
| 2 | **Users** | "Who specifically will use this? What do they need to accomplish?" | At least one concrete user role or persona with a goal. |
| 3 | **Scope** | "What is in scope for v1? Anything explicitly out of scope?" | At least one in-scope item. Out-of-scope items are a bonus. |
| 4 | **Constraints** | "Any technical constraints, timeline pressure, or dependencies I should know about?" | Zero or more constraints. "None" is a valid answer. |
| 5 | **Success criteria** | "How will you know this is working? What does success look like?" | At least one observable, measurable outcome. |
| 6 | **Prior art** | "Is there anything existing (code, docs, tools) this builds on or replaces?" | Zero or more references. "Starting fresh" is valid. |

**Step 3: Summarize and confirm.**

Alpha restates the extracted information in a compact summary block:

```
PROJECT INTAKE SUMMARY
======================
Problem:    [one sentence]
Users:      [comma-separated roles]
Scope:      [bulleted in/out]
Constraints:[bulleted or "none"]
Success:    [bulleted criteria]
Prior art:  [references or "none"]
```

Alpha asks: "Does this capture it? Anything to add or correct?"

**Step 4: Ready check.**

Alpha evaluates readiness using this checklist:

- [ ] Problem statement exists and contains no solution language
- [ ] At least one user/persona is identified
- [ ] At least one success criterion is stated
- [ ] Success criteria are testable (could write an eval for them)

If all four pass: hand off to Framer.
If any fail: Alpha asks targeted follow-up questions for the failing items only. Maximum two rounds of follow-up before Alpha proceeds with what exists and flags gaps for Framer.

### 1.2 Intake Template (Skip-the-Q&A Option)

The human can paste this filled-in template to skip the conversational intake entirely. Alpha parses it and proceeds directly to the ready check (Step 4).

```markdown
## Project Intake

**Problem:** [What is broken or missing? Who is affected?]

**Users:** [Who uses this? What do they need?]

**Scope:**
- In: [what v1 includes]
- Out: [what v1 excludes]

**Constraints:** [technical, timeline, dependencies — or "none"]

**Success criteria:**
- [criterion 1 — must be testable]
- [criterion 2]

**Prior art:** [existing code, docs, tools — or "none"]
```

Location: Store as `squad/templates/intake.md` for human reference. Alpha can also just print the template when asked.

### 1.3 Intake-to-Framer Handoff

Once intake passes the ready check, Alpha:

1. Generates the project slug: lowercase kebab-case derived from the problem statement. Alpha picks the shortest unambiguous name (e.g., "auth-service", "chatbot", "data-pipeline"). If the human provided a name, use that.
2. Runs the scaffolding protocol (Section 2).
3. Creates a task for Framer:
   ```bash
   python squad/log.py task --action create --title "Problem framing: {project-slug}" --assigned-to framer --objective "Produce problem.md for {project-slug} from intake summary"
   ```
4. Spawns Framer with: the intake summary, the project slug, and the path `artifacts/{project-slug}/problem.md`.

### 1.4 Fast-Track Intake

For quick ideas that do not need the full 5-stage pipeline:

**Criteria for fast-track eligibility:**
- Single, well-defined feature or fix
- No new users or personas needed
- Success criteria are obvious (binary pass/fail)
- Can be described in under 100 words
- No architectural impact

If fast-track: Alpha skips Stages 1-4 and produces a lightweight task directly:
```bash
python squad/log.py task --action create --title "Fast-track: {description}" --assigned-to {agent} --objective "{what to build}" --context "fast-track — no full pipeline"
```

Alpha assigns directly to the implementing agent (e.g., Forge for code, Sketch for a diagram). No Framer, Eval, Quill, or Planner involvement.

Fast-track artifacts go in `artifacts/{project-slug}/` but only include what is needed (e.g., just a build task, no problem.md or eval-spec.md).

---

## 2. Project Scaffolding

### 2.1 Directory Structure

When a new project starts, Alpha creates this structure:

```
artifacts/{project-slug}/
  manifest.json          # Project state tracker (see Section 4)
  problem.md             # Stage 1 output (placeholder until Framer produces it)
  eval-spec.md           # Stage 2 output (placeholder)
  prd.md                 # Stage 3 output (placeholder)
  build-plan.md          # Stage 5 output (placeholder)
  diagrams/              # Stage 4 outputs
    .gitkeep
```

### 2.2 Project Naming Rules

1. Names are **lowercase kebab-case**: `auth-service`, `chatbot-v2`, `data-pipeline`.
2. Derived from the problem statement or human-provided name.
3. Must be unique across `artifacts/`. Alpha checks before creating.
4. Maximum 30 characters.
5. No special characters except hyphens.

### 2.3 Scaffolding Script

Alpha runs this Python script to create the project:

**File: `squad/scaffold.py`**

```bash
python squad/scaffold.py --project {project-slug} --title "{project title}" --mode {standard|fast-track}
```

The script:
1. Creates the directory structure from 2.1.
2. Writes `manifest.json` with initial state (see Section 4.1).
3. Creates placeholder files with YAML frontmatter stubs.
4. Logs the scaffolding event to wolfpack.db.
5. Prints confirmation with the project path.

For fast-track mode, only creates `manifest.json` and the directories — no placeholder artifact files.

### 2.4 Placeholder File Content

Each placeholder file contains only the YAML frontmatter stub so agents know the expected format:

**`problem.md` placeholder:**
```markdown
---
id: "PRB-{project}-001"
title: ""
version: "1.0.0"
status: "pending"
author: "framer"
last-updated: ""
---

<!-- Framer will populate this file -->
```

Similar stubs for `eval-spec.md`, `prd.md`, `build-plan.md` with their respective prefixes and authors.

---

## 3. Pipeline Runner Protocol

### 3.1 Standard Mode (Full 5-Stage Pipeline)

Alpha follows this protocol for standard projects. Each step is one action Alpha takes.

```
PIPELINE: {project-slug}
========================

STAGE 1: Problem Framing
  1. Spawn Framer with intake summary -> produces problem.md
  2. Read problem.md
  3. Run G1 checklist (Section 5.1)
  4. If PASS -> log approval, advance to Stage 2
     If FAIL -> send rejection notes to Framer, goto step 1

STAGE 2: Eval Spec
  5. Spawn Eval with approved problem.md -> produces eval-spec.md
  6. Read eval-spec.md
  7. Run G2 checklist (Section 5.2)
  8. If PASS -> log approval, advance to Stage 3
     If FAIL -> send rejection notes to Eval, goto step 5

STAGE 3: PRD
  9.  Spawn Quill with approved problem.md + eval-spec.md -> produces prd.md
  10. Read prd.md
  11. Run G3 checklist (Section 5.3)
  12. If PASS -> log approval, advance to Stage 4
      If FAIL -> send rejection notes to Quill, goto step 9

STAGE 4: Diagrams
  13. Spawn Sketch with approved prd.md + eval-spec.md -> produces diagrams/
  14. Read each diagram file
  15. Run G4 checklist (Section 5.4)
  16. If PASS -> log approval, advance to Stage 5
      If FAIL -> send rejection notes to Sketch, goto step 13

STAGE 5: Build Plan
  17. Spawn Planner with approved prd.md + diagrams/ + eval-spec.md -> produces build-plan.md
  18. Read build-plan.md
  19. Run G5 checklist (Section 5.5)
  20. If PASS -> log approval, pipeline complete
      If FAIL -> send rejection notes to Planner, goto step 17

DONE: Report to human with summary of all artifacts produced.
```

### 3.2 Parallelization Opportunities

The operating model enforces strict ordering (no stage begins until prior gate passes), but within that constraint:

| Scenario | Can Parallelize? | What runs together |
|----------|------------------|--------------------|
| Stages 1-2-3-4-5 | No | Strictly sequential (each depends on prior gate) |
| Multiple diagrams in Stage 4 | Yes | Sketch can produce multiple diagram files in one pass |
| Gate review + manifest update | Yes | Alpha reviews artifact while updating manifest.json |
| Multi-project | Yes | Different projects at different stages can run simultaneously (see Section 6) |

**Key insight:** The pipeline itself is sequential, but **multiple projects** can be in-flight simultaneously at different stages. This is where real parallelism lives.

### 3.3 Automatic Gate Pre-Approval

To reduce Alpha's gate burden, certain checklist items can be verified programmatically. Alpha still makes the final call, but automated checks surface issues before Alpha reads the artifact.

**Automatable checks (future: implement as `squad/gate-check.py`):**

| Check | How to automate |
|-------|-----------------|
| YAML frontmatter is complete | Parse YAML, verify required fields are non-empty |
| Artifact ID format is valid | Regex: `^(PRB\|EVL\|PRD\|DGM\|BLD)-[a-z0-9-]+-\d{3}$` |
| traces-to references valid IDs | Cross-reference against manifest.json |
| Mermaid diagrams render | Run `mmdc` (mermaid-cli) and check exit code |
| No orphan requirements | Parse PRD requirements, check each has eval-trace |
| Dependency graph is acyclic | Topological sort on work item dependencies |

**Protocol:** Alpha runs `python squad/gate-check.py --project {slug} --gate {G1-G5}` before reviewing. If all automated checks pass, Alpha focuses only on the subjective quality checks. If any fail, Alpha can reject without a full read.

### 3.4 Fast-Track Mode

For projects that met fast-track criteria (Section 1.4):

```
FAST-TRACK: {project-slug}
===========================
1. Alpha creates task directly for implementing agent
2. Agent produces deliverable
3. Alpha reviews deliverable (lightweight — no formal gate)
4. If acceptable -> done
   If not -> one round of revision, then done
```

No Framer, Eval, Quill, Planner, or Sketch. No formal gates. No eval spec. Used only for small, well-defined changes.

### 3.5 Rework Loop Protocol

When a gate rejects an artifact:

1. **Alpha logs the rejection** with specific failure reasons:
   ```bash
   python squad/log.py session --event decision --agent alpha --content "Gate {GX}: REJECT for {ARTIFACT-ID}. Failures: {list}"
   ```

2. **Alpha classifies the rework scope:**
   - **Targeted fix** — Specific items failed; the rest is fine. Alpha lists exactly what to change.
   - **Structural rework** — Fundamental issues require significant rewriting. Alpha provides a revised brief.

3. **Alpha re-spawns the owning agent** with:
   - The rejection notes (exactly which checklist items failed)
   - The classification (targeted fix vs structural rework)
   - The existing artifact (agent revises in place, does not start from scratch)

4. **Rework limit:** Maximum 3 rejection cycles per gate. If an artifact fails 3 times:
   - Alpha escalates to the human: "This artifact has failed gate {GX} three times. Here are the recurring issues: {list}. How would you like to proceed?"
   - Options: revise the intake, reassign to a different approach, or override the gate.

5. **Alpha updates manifest.json** with each rejection:
   ```json
   {
     "stage": "eval-spec",
     "gate_attempts": 2,
     "last_rejection": "2026-03-30T14:22:00Z",
     "rejection_reasons": ["Rubric RBR-001 uses vague language", "No threshold for EVL-CASE-003"]
   }
   ```

---

## 4. Project Status Tracking

### 4.1 Project Manifest

Every project has a `manifest.json` at `artifacts/{project-slug}/manifest.json`.

**Schema:**

```json
{
  "project": {
    "slug": "chatbot",
    "title": "Customer Support Chatbot",
    "created": "2026-03-30T10:00:00Z",
    "mode": "standard",
    "priority": 1,
    "status": "active"
  },
  "pipeline": {
    "current_stage": "eval-spec",
    "stages": {
      "problem": {
        "status": "approved",
        "artifact_id": "PRB-chatbot-001",
        "file": "artifacts/chatbot/problem.md",
        "assigned_to": "framer",
        "started": "2026-03-30T10:05:00Z",
        "completed": "2026-03-30T10:30:00Z",
        "gate": {
          "id": "G1",
          "status": "passed",
          "passed_at": "2026-03-30T10:35:00Z",
          "attempts": 1
        }
      },
      "eval-spec": {
        "status": "in-progress",
        "artifact_id": "EVL-chatbot-001",
        "file": "artifacts/chatbot/eval-spec.md",
        "assigned_to": "eval",
        "started": "2026-03-30T10:36:00Z",
        "completed": null,
        "gate": {
          "id": "G2",
          "status": "pending",
          "passed_at": null,
          "attempts": 0
        }
      },
      "prd": {
        "status": "pending",
        "artifact_id": "PRD-chatbot-001",
        "file": "artifacts/chatbot/prd.md",
        "assigned_to": "quill",
        "started": null,
        "completed": null,
        "gate": {
          "id": "G3",
          "status": "pending",
          "passed_at": null,
          "attempts": 0
        }
      },
      "diagrams": {
        "status": "pending",
        "artifact_id": null,
        "file": "artifacts/chatbot/diagrams/",
        "assigned_to": "sketch",
        "started": null,
        "completed": null,
        "gate": {
          "id": "G4",
          "status": "pending",
          "passed_at": null,
          "attempts": 0
        }
      },
      "build-plan": {
        "status": "pending",
        "artifact_id": "BLD-chatbot-001",
        "file": "artifacts/chatbot/build-plan.md",
        "assigned_to": "planner",
        "started": null,
        "completed": null,
        "gate": {
          "id": "G5",
          "status": "pending",
          "passed_at": null,
          "attempts": 0
        }
      }
    }
  },
  "intake": {
    "problem": "Customers wait too long for support responses",
    "users": ["end-customers", "support-agents"],
    "scope_in": ["automated first-response", "handoff to human agent"],
    "scope_out": ["billing integration", "phone support"],
    "constraints": ["must integrate with Zendesk API"],
    "success_criteria": ["first-response time < 30 seconds", "customer satisfaction >= 4.0/5.0"],
    "prior_art": ["existing FAQ page at /help"]
  },
  "history": [
    {
      "timestamp": "2026-03-30T10:00:00Z",
      "event": "project-created",
      "agent": "alpha"
    },
    {
      "timestamp": "2026-03-30T10:35:00Z",
      "event": "gate-passed",
      "gate": "G1",
      "agent": "alpha"
    }
  ]
}
```

### 4.2 Session Start Protocol

When Alpha starts a new session, before greeting the human:

1. **Scan for in-flight projects:**
   ```bash
   python squad/manifest.py --action list
   ```
   This script reads all `artifacts/*/manifest.json` files and outputs a status table.

2. **Check for stale projects:** Any project with `last_activity` > 7 days gets flagged.

3. **Alpha greets the human with context:**
   > "Welcome back. You have 2 projects in flight:
   > - **chatbot** — Stage 2 (Eval Spec), in progress
   > - **data-pipeline** — Stage 4 (Diagrams), awaiting gate review
   >
   > What would you like to work on, or do you have something new?"

### 4.3 Listing Projects

**Command:** `python squad/manifest.py --action list`

**Output format:**

```
PROJECT STATUS
==============
  chatbot          Stage 2/5 (Eval Spec)     in-progress   priority: 1
  data-pipeline    Stage 4/5 (Diagrams)      gate-review   priority: 2
  auth-service     COMPLETE                  all gates passed  priority: 3
```

**Command:** `python squad/manifest.py --action detail --project chatbot`

**Output:** Full manifest.json content formatted for human readability.

### 4.4 Database Integration

The manifest.json is the source of truth for project state. wolfpack.db remains the source of truth for audit trail (who did what when).

**New table for wolfpack.db (Sigma to implement):**

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    current_stage TEXT NOT NULL DEFAULT 'intake',
    manifest_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
```

**Sync protocol:** When `scaffold.py` creates a project or `manifest.py` updates one, it also writes to the `projects` table. The table is a lightweight index; `manifest.json` has full detail.

---

## 5. Gate Checklists

Quick-reference checklists Alpha uses at each gate. Each item is a yes/no check. All items must pass for the gate to pass. Alpha reads the checklist, checks each item against the artifact, and logs the result.

### 5.1 G1 Checklist — Problem Framing -> Eval Spec

**Artifact:** `artifacts/{project}/problem.md`
**Automatable items marked with [A].**

| # | Check | Y/N |
|---|-------|-----|
| 1 | [A] YAML frontmatter has id, title, version, status, author, last-updated — all non-empty | |
| 2 | [A] Artifact ID matches format `PRB-{project}-NNN` | |
| 3 | Problem statement is present and is one paragraph | |
| 4 | Problem statement contains NO solution language (no "we should build...", "the system will...") | |
| 5 | Scope section exists with at least one in-scope item | |
| 6 | Out-of-scope items are listed (or explicitly stated as "none identified") | |
| 7 | At least one user/persona is identified with a concrete role | |
| 8 | At least one success criterion is listed | |
| 9 | Every success criterion is testable — an eval case could be written for it | |
| 10 | Constraints section exists (may be empty) | |
| 11 | Assumptions section exists with at least one assumption or states "none" | |
| 12 | Open questions are specific and answerable (not vague) | |

**Pass:** All 12 items are Y.
**Reject if:** Any item is N. Cite which items failed.

### 5.2 G2 Checklist — Eval Spec -> PRD

**Artifact:** `artifacts/{project}/eval-spec.md`

| # | Check | Y/N |
|---|-------|-----|
| 1 | [A] YAML frontmatter complete with valid `EVL-{project}-NNN` ID | |
| 2 | [A] `traces-to.problem` references the approved PRB ID | |
| 3 | Overview links to the problem definition | |
| 4 | At least one dataset is defined | |
| 5 | Every dataset has: ID, description, size, source, version | |
| 6 | Input/output schema is defined for each dataset | |
| 7 | At least 3 sample cases per dataset (happy-path, edge-case, failure-mode) | |
| 8 | At least one rubric is defined | |
| 9 | Rubric criteria are specific — no vague language ("helpful", "appropriate", "good") | |
| 10 | Every rubric has concrete score level definitions | |
| 11 | Every eval case has a scorer assigned (algorithmic, AI, or human-aligned-ai) | |
| 12 | Every scorer has a pass condition or rubric text defined | |
| 13 | Thresholds table exists with pass/warning/fail for each eval case | |
| 14 | At least one failure mode is documented | |
| 15 | Baseline section exists (values or TBD-with-plan) | |
| 16 | Eval maturity roadmap is present | |
| 17 | Every success criterion from problem.md is covered by at least one eval case | |

**Pass:** All 17 items are Y.
**Reject if:** Any item is N. Cite which items failed.

### 5.3 G3 Checklist — PRD -> Diagrams

**Artifact:** `artifacts/{project}/prd.md`

| # | Check | Y/N |
|---|-------|-----|
| 1 | [A] YAML frontmatter complete with valid `PRD-{project}-NNN` ID | |
| 2 | [A] `traces-to` references approved PRB and EVL IDs | |
| 3 | Problem summary section exists and references (not copies) problem.md | |
| 4 | Goals are SMART and derived from eval spec thresholds | |
| 5 | At least one requirement exists | |
| 6 | [A] Every requirement has a unique `REQ-{project}-NNN` ID | |
| 7 | Every requirement has a priority tier (P0/P1/P2) | |
| 8 | [A] Every requirement has an eval trace (links to at least one EVL-CASE ID) | |
| 9 | [A] No orphan requirements — every REQ traces to an EVL-CASE that exists in the eval spec | |
| 10 | Acceptance criteria match eval spec thresholds (not invented independently) | |
| 11 | Non-functional requirements section exists | |
| 12 | Dependencies section exists | |
| 13 | Traceability matrix section exists and is complete | |

**Pass:** All 13 items are Y.
**Reject if:** Any item is N. Cite which items failed.

### 5.4 G4 Checklist — Diagrams -> Build Plan

**Artifact:** `artifacts/{project}/diagrams/*.md` (or `.mmd`/`.gv` files)

| # | Check | Y/N |
|---|-------|-----|
| 1 | [A] Each diagram file has YAML frontmatter with valid `DGM-{project}-NNN` ID | |
| 2 | [A] Each diagram has `traces-to.requirements` referencing valid REQ IDs | |
| 3 | Diagram types are appropriate for the content they represent | |
| 4 | [A] No decorative diagrams — every diagram traces to at least one requirement | |
| 5 | [A] Mermaid diagrams render without syntax errors (mmdc validation) | |
| 6 | [A] Graphviz diagrams render without syntax errors (dot validation) | |
| 7 | Diagrams clarify something a builder needs to understand | |
| 8 | At least one diagram exists | |

**Pass:** All 8 items are Y.
**Reject if:** Any item is N. Cite which items failed.

### 5.5 G5 Checklist — Build Plan -> Execution

**Artifact:** `artifacts/{project}/build-plan.md`

| # | Check | Y/N |
|---|-------|-----|
| 1 | [A] YAML frontmatter complete with valid `BLD-{project}-NNN` ID | |
| 2 | [A] `traces-to` references approved PRB, EVL, PRD, and DGM IDs | |
| 3 | Execution phases are defined and ordered | |
| 4 | At least one work item exists | |
| 5 | [A] Every work item has a unique `WRK-{project}-NNN` ID | |
| 6 | [A] Every work item traces to a REQ ID that exists in the PRD | |
| 7 | [A] No invented requirements — no WRK item references a REQ that does not exist | |
| 8 | [A] Every agent assignment references an agent in registry.json | |
| 9 | Every work item has a complexity estimate (S/M/L) | |
| 10 | [A] Dependency graph is acyclic (topological sort succeeds) | |
| 11 | Validation matrix exists linking WRK -> REQ -> EVL-CASE | |
| 12 | Validation plan specifies how eval cases will be run | |
| 13 | Risk register section exists | |

**Pass:** All 13 items are Y.
**Reject if:** Any item is N. Cite which items failed.

---

## 6. Multi-Project Support

### 6.1 Active Project Context

Alpha always knows which project is being discussed. The protocol:

1. **Explicit project reference:** When the human mentions a project by name, Alpha sets that as the active context.
2. **Implicit continuation:** If the human continues a topic without naming a project, Alpha continues with the last-discussed project.
3. **Ambiguity resolution:** If Alpha is unsure which project the human means, Alpha asks:
   > "You have {N} projects in flight. Which one are you referring to — {list}?"
4. **New project detection:** If the human describes something that does not match any in-flight project, Alpha treats it as a new intake (Section 1).

### 6.2 Context Switching

When the human switches projects mid-conversation:

1. Alpha logs where the previous project stands:
   ```bash
   python squad/log.py session --event decision --agent alpha --content "Context switch: pausing {old-project} at stage {X}, switching to {new-project}"
   ```
2. Alpha reads the new project's manifest.json to restore state.
3. Alpha summarizes the new project's status before proceeding.

### 6.3 Priority and Ordering

Each project has a `priority` field in manifest.json (integer, lower = higher priority).

**Rules:**
- When multiple projects need Alpha's attention simultaneously, higher-priority projects go first.
- The human sets priority. Alpha does not reorder without permission.
- Default priority for new projects: one higher than the current lowest (appended to the end of the queue).
- Alpha can suggest reprioritization but does not act on it without human approval.

**Command:** `python squad/manifest.py --action priorities`

**Output:**
```
PROJECT PRIORITIES
==================
  1. chatbot          — Stage 2 (Eval Spec), in-progress
  2. data-pipeline    — Stage 4 (Diagrams), gate-review
  3. auth-service     — COMPLETE
```

The human can say "bump data-pipeline to priority 1" and Alpha updates the manifest.

### 6.4 Resource Conflicts

When the same agent is needed for multiple projects simultaneously:

1. **Queue by priority:** Higher-priority project's task goes first.
2. **Sequential execution:** Agents work on one project at a time. Alpha queues the second task.
3. **Alpha informs the human:** "Eval is currently working on chatbot (priority 1). data-pipeline's eval spec will start after chatbot's is complete."
4. **No agent overrides:** Alpha does not spawn the same agent for two projects simultaneously — results in context contamination.

**Exception:** Different agents CAN work on different projects simultaneously. If chatbot needs Eval and data-pipeline needs Sketch, both can proceed in parallel.

---

## 7. Scripts to Build

The following scripts must be created to support this planning UX layer. All are Python, consistent with the existing `squad/log.py` and `squad/init_db.py`.

| Script | Purpose | Priority |
|--------|---------|----------|
| `squad/scaffold.py` | Creates project directory structure, manifest.json, placeholder files | P0 — needed immediately |
| `squad/manifest.py` | Reads/updates manifest.json, lists projects, shows status | P0 — needed immediately |
| `squad/gate-check.py` | Runs automatable gate checklist items, reports pass/fail | P1 — valuable but Alpha can manually check initially |
| `squad/templates/intake.md` | Intake template for the human | P0 — static file, trivial |

### 7.1 scaffold.py Interface

```
Usage: python squad/scaffold.py --project SLUG --title TITLE [--mode standard|fast-track]

Creates:
  artifacts/{SLUG}/manifest.json
  artifacts/{SLUG}/problem.md          (standard mode only)
  artifacts/{SLUG}/eval-spec.md        (standard mode only)
  artifacts/{SLUG}/prd.md              (standard mode only)
  artifacts/{SLUG}/build-plan.md       (standard mode only)
  artifacts/{SLUG}/diagrams/.gitkeep   (standard mode only)

Also:
  Inserts row into wolfpack.db projects table
  Logs scaffolding event to session_logs
```

### 7.2 manifest.py Interface

```
Usage:
  python squad/manifest.py --action list                              # List all projects
  python squad/manifest.py --action detail --project SLUG             # Show full manifest
  python squad/manifest.py --action update --project SLUG --stage STAGE --field FIELD --value VALUE
  python squad/manifest.py --action priorities                        # Show priority-ordered list
  python squad/manifest.py --action advance --project SLUG            # Move to next stage
```

### 7.3 gate-check.py Interface

```
Usage: python squad/gate-check.py --project SLUG --gate G1|G2|G3|G4|G5

Output:
  GATE G2 CHECK — chatbot
  ========================
  [PASS] YAML frontmatter complete
  [PASS] Artifact ID format valid
  [PASS] traces-to references valid
  [FAIL] Rubric RBR-001 contains vague language: "appropriate"
  [SKIP] Subjective checks require Alpha review

  Result: 3 passed, 1 failed, 1 skipped. Gate cannot auto-pass.
```

---

## 8. Database Schema Addition

Sigma should add this table to `squad/init_db.py`:

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    current_stage TEXT NOT NULL DEFAULT 'intake',
    manifest_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
```

And add `project` commands to `squad/log.py`:

```bash
python squad/log.py project --action create --slug SLUG --title TITLE --mode standard --manifest-path artifacts/SLUG/manifest.json
python squad/log.py project --action update --slug SLUG --stage eval-spec --status active
python squad/log.py project --action list
```

---

## 9. End-to-End Example

Here is a complete walkthrough of a project from idea to build plan.

**Human says:** "I want to build a chatbot that handles customer support for our SaaS product."

**Alpha runs intake (Section 1.1):**
1. Classifies as "larger" idea.
2. Asks the six intake questions (skips any the human already answered).
3. Produces intake summary, gets human confirmation.
4. Passes ready check.

**Alpha scaffolds (Section 2):**
```bash
python squad/scaffold.py --project chatbot --title "Customer Support Chatbot" --mode standard
```

**Alpha runs pipeline (Section 3.1):**
- Creates task for Framer, spawns Framer -> problem.md produced
- Runs G1 checklist -> passes
- Creates task for Eval, spawns Eval -> eval-spec.md produced
- Runs G2 checklist -> fails (vague rubric language)
- Sends rejection to Eval with specific notes -> Eval revises
- Runs G2 checklist again -> passes
- Creates task for Quill, spawns Quill -> prd.md produced
- Runs G3 checklist -> passes
- Creates task for Sketch, spawns Sketch -> diagrams/ produced
- Runs G4 checklist -> passes
- Creates task for Planner, spawns Planner -> build-plan.md produced
- Runs G5 checklist -> passes

**Alpha reports to human:**
> "All planning artifacts for **chatbot** are complete and approved. Here's what was produced:
> - Problem definition (problem.md) — approved at G1
> - Eval spec (eval-spec.md) — approved at G2 (1 revision cycle)
> - PRD (prd.md) — approved at G3
> - 3 diagrams (architecture, sequence, ERD) — approved at G4
> - Build plan (build-plan.md) — approved at G5
>
> The project is ready for execution. Would you like to review any artifacts, or shall I begin implementation?"

**Total human decisions during pipeline:** 0 (after intake). Alpha handled everything.

---

## 10. Document Control

| Field | Value |
|-------|-------|
| **Document ID** | `PLAN-UX-001` |
| **Version** | 1.0.0 |
| **Status** | Draft — pending Alpha approval |
| **Author** | Architect |
| **Depends on** | `squad/operating-model.md` v1.0.0 |
| **Effective date** | Upon Alpha approval |

**Change log:**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-03-30 | architect | Initial planning UX layer design |
