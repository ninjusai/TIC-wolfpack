---
id: "DES-interview-intake-001"
title: "Interview-Style Project Intake System Design"
version: "1.0.0"
status: "draft"
author: "architect"
last-updated: "2026-04-01"
traces-to:
  planning-ux: "PLAN-UX-001"
  operating-model: "OPS-MODEL-001"
---

# Interview-Style Project Intake System Design

This document specifies the design for an AI-powered interview system that replaces the current manual intake process with a structured, multi-turn conversation that extracts project requirements through adaptive questioning.

---

## 1. Executive Summary

### 1.1 What This Is

An **Interviewer agent** powered by Claude Agent SDK conducts structured interviews with the Pack Owner to gather project requirements. The interview produces a standardized **Intake Brief** document that enters the existing Wolf Pack pipeline at Stage 1 (Problem Framing).

### 1.2 Why It Matters

The current intake process (Section 1.1 of `planning-ux.md`) requires Alpha to manually run a conversational intake protocol, asking up to six questions and extracting structured fields. This is:
- **Brittle** — Alpha must remember the protocol and execute it consistently
- **Interruptible** — If a session ends mid-intake, context is lost
- **Untracked** — Partial intake progress is not persisted

The interview system solves all three problems by:
- Encoding the intake protocol into a specialized agent with adaptive question logic
- Persisting interview sessions via Claude Agent SDK's session management
- Storing interview responses and progress in `wolfpack.db`

### 1.3 Technical Constraints

Per Anthropic policy (2026), **OAuth authentication is not allowed**. This system uses **API key authentication** only. All Claude Agent SDK interactions authenticate via API key stored in environment variables or secure configuration.

---

## 2. Interview Flow Design

### 2.1 Interview Stages

The interview proceeds through five sequential stages. Each stage has required fields and optional follow-ups. The Interviewer advances when the stage's exit criteria are met.

```
STAGE 1: Problem Discovery
    |
    v
STAGE 2: User & Stakeholder Identification
    |
    v
STAGE 3: Scope Definition
    |
    v
STAGE 4: Constraints & Dependencies
    |
    v
STAGE 5: Success Criteria & Validation
    |
    v
OUTPUT: Intake Brief
```

### 2.2 Stage Specifications

#### Stage 1: Problem Discovery

| Field | Description |
|-------|-------------|
| **Goal** | Understand what is broken or missing |
| **Required Output** | `problem_statement` — one paragraph, no solution language |
| **Entry Question** | "What problem are you trying to solve? Tell me what's broken, missing, or painful today." |
| **Follow-up Triggers** | If response contains solution language ("we should build...", "I want a system that..."), probe for the underlying problem |
| **Exit Criteria** | `problem_statement` captures a clear pain point with affected parties identified; zero solution language |
| **Max Questions** | 3 |

**Adaptive Follow-ups:**

| Trigger | Follow-up Question |
|---------|-------------------|
| Solution language detected | "That sounds like a solution. What problem would that solve? What's painful today without it?" |
| Affected users unclear | "Who specifically experiences this problem? What are they trying to do when they hit this?" |
| Problem too vague | "Can you give me a concrete example of when this problem happened recently?" |

#### Stage 2: User & Stakeholder Identification

| Field | Description |
|-------|-------------|
| **Goal** | Identify concrete users with specific needs |
| **Required Output** | `users[]` — at least one user with role, goal, and context |
| **Entry Question** | "Who will use this? What specific role or job function, and what will they need to accomplish?" |
| **Follow-up Triggers** | If response is abstract ("users", "customers", "people"), probe for specificity |
| **Exit Criteria** | At least one concrete user identified with role + goal |
| **Max Questions** | 3 |

**Adaptive Follow-ups:**

| Trigger | Follow-up Question |
|---------|-------------------|
| Abstract user reference | "Let's get specific. Can you name one concrete role — like 'senior developer on the platform team' — and what they need to do?" |
| Single user mentioned | "Are there other types of users who would interact with this? Any secondary stakeholders?" |
| Goals unclear | "When [role] uses this, what task are they trying to complete? What does success look like for them?" |

#### Stage 3: Scope Definition

| Field | Description |
|-------|-------------|
| **Goal** | Define clear boundaries for v1 |
| **Required Output** | `scope_in[]` — at least one item; `scope_out[]` — at least one item (or explicit "none identified") |
| **Entry Question** | "What must be included in the first version? And what should we explicitly exclude for now?" |
| **Follow-up Triggers** | If in-scope is vague or unbounded; if out-of-scope is empty |
| **Exit Criteria** | At least one concrete in-scope item and out-of-scope is addressed |
| **Max Questions** | 3 |

**Adaptive Follow-ups:**

| Trigger | Follow-up Question |
|---------|-------------------|
| Scope too broad | "That's a lot. If you could only ship one capability in v1, what would it be?" |
| No out-of-scope items | "What's something related that we should definitely NOT try to include? Any obvious 'not yet' items?" |
| Ambiguous boundaries | "Is [specific item] in or out for v1? Let's be explicit." |

#### Stage 4: Constraints & Dependencies

| Field | Description |
|-------|-------------|
| **Goal** | Surface technical, timeline, and resource constraints |
| **Required Output** | `constraints[]` — may be empty if explicitly "none" |
| **Entry Question** | "Are there any technical constraints, timeline pressures, or dependencies I should know about? Things like specific technologies, deadlines, or systems this must integrate with." |
| **Follow-up Triggers** | If "none" is stated, confirm; if response hints at constraints without specifics |
| **Exit Criteria** | Constraints array populated or explicitly confirmed as empty |
| **Max Questions** | 2 |

**Adaptive Follow-ups:**

| Trigger | Follow-up Question |
|---------|-------------------|
| Vague constraint mentioned | "You mentioned [X]. Can you be specific about what that means for this project?" |
| "None" stated | "Just to confirm — no deadline pressure, no required tech stack, no dependencies on other teams or systems?" |

#### Stage 5: Success Criteria & Validation

| Field | Description |
|-------|-------------|
| **Goal** | Define measurable success criteria that can become eval cases |
| **Required Output** | `success_criteria[]` — at least one testable criterion |
| **Entry Question** | "How will you know this is working? What's a measurable outcome that proves the problem is solved?" |
| **Follow-up Triggers** | If criteria are vague or untestable |
| **Exit Criteria** | At least one success criterion that passes the testability check |
| **Max Questions** | 4 |

**Testability Check:**
For each proposed criterion, the Interviewer internally asks: "Could an eval case be written for this?" If not, probe for specificity.

**Adaptive Follow-ups:**

| Trigger | Follow-up Question |
|---------|-------------------|
| Vague criterion ("it should be fast") | "How would we measure that? What specific number or observable behavior would tell us it's fast enough?" |
| Binary criterion unclear | "Let's make that testable. If I built this, what would I check to know it's working?" |
| Only one criterion | "Any other ways you'd validate success? Think about different user scenarios or edge cases." |

### 2.3 Interview Gate Logic

The Interviewer evaluates readiness using the same checklist as the current intake protocol:

| Check | Required |
|-------|----------|
| Problem statement exists and contains no solution language | Yes |
| At least one user/persona is identified | Yes |
| At least one in-scope item is defined | Yes |
| At least one success criterion is testable | Yes |
| Out-of-scope is addressed (items listed OR explicit "none identified") | Yes |
| Constraints are addressed (items listed OR explicit "none") | Yes |

**If all checks pass:** Interview complete. Generate Intake Brief.

**If checks fail:** The Interviewer identifies which fields are missing or deficient and returns to the relevant stage for targeted follow-up. Maximum of 2 full re-attempts at any stage before proceeding with gaps flagged.

### 2.4 Prior Art Collection

After the five stages, the Interviewer asks one optional question:

> "Is there anything existing — code, documentation, tools, or prior attempts — that this builds on or replaces?"

This populates `prior_art[]`. Response of "starting fresh" or "nothing" is valid and recorded as empty array.

---

## 3. Output Artifact Specification

### 3.1 Intake Brief Document

The interview produces an **Intake Brief** stored at `artifacts/{project-slug}/intake-brief.json`.

**Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "project_slug", "version", "status", "interview", "fields", "validation"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^INT-[a-z0-9-]+-[0-9]{3}$",
      "description": "Unique intake ID, e.g., INT-chatbot-001"
    },
    "project_slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "maxLength": 30,
      "description": "Kebab-case project identifier"
    },
    "project_title": {
      "type": "string",
      "description": "Human-readable project title"
    },
    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
      "description": "Semantic version of the intake brief"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "complete", "approved", "superseded"],
      "description": "Intake status"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    },
    "interview": {
      "type": "object",
      "required": ["session_id", "started_at", "completed_at", "turn_count"],
      "properties": {
        "session_id": {
          "type": "string",
          "description": "Claude Agent SDK session ID for this interview"
        },
        "started_at": {
          "type": "string",
          "format": "date-time"
        },
        "completed_at": {
          "type": ["string", "null"],
          "format": "date-time"
        },
        "turn_count": {
          "type": "integer",
          "minimum": 0,
          "description": "Total conversation turns in the interview"
        },
        "abandoned": {
          "type": "boolean",
          "default": false
        }
      }
    },
    "fields": {
      "type": "object",
      "required": ["problem_statement", "users", "scope_in", "scope_out", "constraints", "success_criteria", "prior_art"],
      "properties": {
        "problem_statement": {
          "type": "string",
          "minLength": 1,
          "description": "One paragraph describing the problem"
        },
        "users": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["role", "goal"],
            "properties": {
              "role": { "type": "string" },
              "goal": { "type": "string" },
              "context": { "type": "string" }
            }
          }
        },
        "scope_in": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string" }
        },
        "scope_out": {
          "type": "array",
          "items": { "type": "string" },
          "description": "May be empty if explicitly none identified"
        },
        "constraints": {
          "type": "array",
          "items": { "type": "string" },
          "description": "May be empty if explicitly none"
        },
        "success_criteria": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["criterion", "testable"],
            "properties": {
              "criterion": { "type": "string" },
              "testable": { "type": "boolean" },
              "measurement": { "type": "string" }
            }
          }
        },
        "prior_art": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "validation": {
      "type": "object",
      "required": ["passed", "checks"],
      "properties": {
        "passed": {
          "type": "boolean",
          "description": "Whether all intake checks passed"
        },
        "checks": {
          "type": "object",
          "properties": {
            "problem_no_solution_language": { "type": "boolean" },
            "has_user": { "type": "boolean" },
            "has_scope_in": { "type": "boolean" },
            "scope_out_addressed": { "type": "boolean" },
            "has_testable_criterion": { "type": "boolean" },
            "constraints_addressed": { "type": "boolean" }
          }
        },
        "gaps": {
          "type": "array",
          "items": { "type": "string" },
          "description": "List of validation gaps if any checks failed"
        }
      }
    }
  }
}
```

### 3.2 Example Intake Brief

```json
{
  "id": "INT-chatbot-001",
  "project_slug": "chatbot",
  "project_title": "Customer Support Chatbot",
  "version": "1.0.0",
  "status": "complete",
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-01T10:25:00Z",
  "interview": {
    "session_id": "sess_abc123def456",
    "started_at": "2026-04-01T10:00:00Z",
    "completed_at": "2026-04-01T10:25:00Z",
    "turn_count": 12,
    "abandoned": false
  },
  "fields": {
    "problem_statement": "Customers wait too long for support responses. Average first-response time is 4 hours. Customers abandon support tickets before getting help, leading to churn and negative reviews.",
    "users": [
      {
        "role": "End customer",
        "goal": "Get quick answers to product questions",
        "context": "Contacting support via web chat during business hours"
      },
      {
        "role": "Support agent",
        "goal": "Handle complex escalations efficiently",
        "context": "Receives handoffs from automated system for issues requiring human judgment"
      }
    ],
    "scope_in": [
      "Automated first-response for common questions",
      "Handoff to human agent when needed",
      "Integration with existing Zendesk ticketing system"
    ],
    "scope_out": [
      "Billing integration",
      "Phone support",
      "Multilingual support"
    ],
    "constraints": [
      "Must integrate with Zendesk API",
      "Response latency must be under 5 seconds",
      "Cannot store customer PII beyond session"
    ],
    "success_criteria": [
      {
        "criterion": "First-response time under 30 seconds",
        "testable": true,
        "measurement": "Median time from ticket creation to first bot response"
      },
      {
        "criterion": "Customer satisfaction score >= 4.0/5.0",
        "testable": true,
        "measurement": "Post-interaction CSAT survey average"
      },
      {
        "criterion": "50% of tickets resolved without human intervention",
        "testable": true,
        "measurement": "Tickets closed by bot / total tickets"
      }
    ],
    "prior_art": [
      "Existing FAQ page at /help",
      "Previous rule-based chatbot attempt (deprecated 2025)"
    ]
  },
  "validation": {
    "passed": true,
    "checks": {
      "problem_no_solution_language": true,
      "has_user": true,
      "has_scope_in": true,
      "scope_out_addressed": true,
      "has_testable_criterion": true,
      "constraints_addressed": true
    },
    "gaps": []
  }
}
```

### 3.3 Mapping to Downstream Pipeline

The Intake Brief maps to existing pipeline artifacts as follows:

| Intake Brief Field | Problem Definition (`problem.md`) Section |
|--------------------|-------------------------------------------|
| `fields.problem_statement` | Section 1: Problem Statement |
| `fields.users[]` | Section 3: Users |
| `fields.scope_in[]` | Section 2: Scope (In Scope) |
| `fields.scope_out[]` | Section 2: Scope (Out of Scope) |
| `fields.constraints[]` | Section 5: Constraints |
| `fields.success_criteria[]` | Section 4: Success Criteria |
| `fields.prior_art[]` | (Referenced in Open Questions or Assumptions) |
| `validation.gaps[]` | Section 7: Open Questions |

**Handoff Process:**
1. Interview completes → Intake Brief written to `artifacts/{project-slug}/intake-brief.json`
2. Alpha receives notification of interview completion
3. Alpha spawns Framer with:
   - Path to `intake-brief.json`
   - Project slug
   - Target output path `artifacts/{project-slug}/problem.md`
4. Framer reads Intake Brief and produces Problem Definition Document
5. Normal pipeline continues (G1 gate → Eval → G2 → etc.)

---

## 4. Integration Points

### 4.1 Data Storage

Interview data is stored in two locations:

#### 4.1.1 File System

| Artifact | Location |
|----------|----------|
| Completed Intake Brief | `artifacts/{project-slug}/intake-brief.json` |
| Interview Transcript | `artifacts/{project-slug}/interview-transcript.md` (optional, for audit) |

#### 4.1.2 Database (`wolfpack.db`)

**New Table: `interviews`**

```sql
CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    project_slug TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    turn_count INTEGER DEFAULT 0,
    current_stage TEXT DEFAULT 'problem_discovery',
    intake_brief_path TEXT,
    abandoned INTEGER DEFAULT 0,
    abandon_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_session ON interviews(session_id);
CREATE INDEX IF NOT EXISTS idx_interviews_project ON interviews(project_slug);
```

**New Table: `interview_responses`**

```sql
CREATE TABLE IF NOT EXISTS interview_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL,
    stage TEXT NOT NULL,
    field_name TEXT NOT NULL,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (interview_id) REFERENCES interviews(id)
);

CREATE INDEX IF NOT EXISTS idx_responses_interview ON interview_responses(interview_id);
CREATE INDEX IF NOT EXISTS idx_responses_stage ON interview_responses(stage);
```

### 4.2 Alpha Notification

Alpha knows an interview is complete via two mechanisms:

#### 4.2.1 Database Query

```sql
SELECT * FROM interviews
WHERE status = 'complete'
AND project_slug NOT IN (
    SELECT DISTINCT project FROM tasks WHERE title LIKE 'Problem framing:%'
)
ORDER BY completed_at DESC;
```

This returns completed interviews that have not yet been handed off to Framer.

#### 4.2.2 Session Start Protocol Addition

Add to Alpha's session start protocol (`planning-ux.md` Section 4.2):

```
4. **Check for completed interviews:**
   python squad/interview.py --action list --status complete --pending-handoff

   For each completed interview without a corresponding Framer task:
   - Report to human: "Interview for {project} is complete and ready for Problem Framing."
```

### 4.3 Downstream Agent Consumption

**Framer** receives the Intake Brief and produces `problem.md`:

```bash
# Alpha creates task
python squad/log.py task --action create \
  --title "Problem framing: chatbot" \
  --assigned-to framer \
  --objective "Produce problem.md from intake-brief.json" \
  --context "artifacts/chatbot/intake-brief.json"

# Alpha spawns Framer
Agent spawn: framer
Task: Produce artifacts/chatbot/problem.md from artifacts/chatbot/intake-brief.json
```

**Framer's workflow:**
1. Read `intake-brief.json`
2. Validate all required fields are present
3. Transform fields into Problem Definition Document format
4. Add YAML frontmatter with `PRB-{project}-001` ID
5. Write `problem.md`
6. Log report

---

## 5. Session Management

### 5.1 Session Persistence with Claude Agent SDK

The Interviewer uses Claude Agent SDK's built-in session management:

```python
from anthropic import Anthropic

client = Anthropic()  # API key from environment

# Start new interview
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8096,
    system=INTERVIEWER_SYSTEM_PROMPT,
    messages=[{"role": "user", "content": "I want to start a new project."}],
    tools=[ask_user_question_tool, save_response_tool],
    metadata={"session_id": generate_session_id()}
)

# Resume existing interview
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8096,
    system=INTERVIEWER_SYSTEM_PROMPT,
    messages=load_conversation_history(session_id),
    tools=[ask_user_question_tool, save_response_tool],
    resume=session_id  # SDK session persistence
)
```

### 5.2 Session States

| State | Description | Transitions |
|-------|-------------|-------------|
| `in_progress` | Interview is active, user is responding | → `complete`, → `paused`, → `abandoned` |
| `paused` | User left mid-interview; can be resumed | → `in_progress`, → `abandoned` |
| `complete` | All stages passed; Intake Brief generated | → `approved` (after Framer handoff) |
| `approved` | Intake Brief consumed by Framer | Terminal state |
| `abandoned` | User explicitly abandoned or timeout | Terminal state |

### 5.3 Pause and Resume Protocol

**When user leaves mid-interview:**
1. After 5 minutes of inactivity, session state changes to `paused`
2. Current progress (completed stages, partial responses) is persisted to `wolfpack.db`
3. Session can be resumed within 7 days

**Resume flow:**
1. User returns and says "resume interview" or Alpha detects paused interview
2. Interviewer loads conversation history from database
3. Interviewer summarizes progress: "Welcome back. We were discussing [project]. You've completed Problem Discovery and User Identification. Let's continue with Scope Definition."
4. Interview continues from the interrupted stage

**Implementation:**

```python
# Save progress on pause
def pause_interview(session_id: str):
    db.execute("""
        UPDATE interviews
        SET status = 'paused',
            updated_at = datetime('now')
        WHERE session_id = ?
    """, (session_id,))

# Resume interview
def resume_interview(session_id: str) -> dict:
    interview = db.execute("""
        SELECT * FROM interviews WHERE session_id = ?
    """, (session_id,)).fetchone()

    responses = db.execute("""
        SELECT * FROM interview_responses
        WHERE interview_id = ?
        ORDER BY turn_number
    """, (interview['id'],)).fetchall()

    return {
        "interview": interview,
        "responses": responses,
        "current_stage": interview['current_stage'],
        "conversation_history": reconstruct_history(responses)
    }
```

### 5.4 Abandoned Interview Handling

**Abandonment triggers:**
1. User explicitly says "cancel" or "never mind"
2. Session not resumed within 7 days
3. User starts a new interview for the same project

**Abandonment process:**
1. Mark interview as `abandoned` with reason
2. Retain data for 30 days (audit trail)
3. Clean up session data after 30 days
4. Project slug becomes available for new interview

```sql
UPDATE interviews
SET status = 'abandoned',
    abandon_reason = 'timeout_7_days',
    updated_at = datetime('now')
WHERE session_id = ? AND status = 'paused';
```

### 5.5 Cost Control

Claude Agent SDK provides cost control via `max_turns` and `max_budget_usd`:

```python
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8096,
    system=INTERVIEWER_SYSTEM_PROMPT,
    messages=messages,
    tools=tools,
    max_turns=30,           # Maximum conversation turns
    max_budget_usd=1.00     # Maximum cost per interview session
)
```

**Recommended limits:**
- `max_turns`: 30 (typical interview is 10-15 turns)
- `max_budget_usd`: $1.00 (safety limit; typical interview costs ~$0.10-0.20)

---

## 6. Eval Criteria for Interviews

### 6.1 What Makes a "Good" Interview

An interview is evaluated on three dimensions:

#### 6.1.1 Completeness

All required fields are populated with substantive content.

| Metric | Pass | Warning | Fail |
|--------|------|---------|------|
| `problem_statement` present | Yes | — | No |
| `users[]` has >= 1 entry | Yes | — | No |
| `scope_in[]` has >= 1 entry | Yes | — | No |
| `scope_out[]` addressed | Explicit items or "none" | — | Empty and unaddressed |
| `success_criteria[]` has >= 1 testable entry | Yes | — | No |
| `constraints[]` addressed | Explicit items or "none" | — | Empty and unaddressed |

#### 6.1.2 Quality

Fields contain high-quality, actionable content.

| Metric | Pass | Warning | Fail |
|--------|------|---------|------|
| Problem contains no solution language | Zero instances | — | Any solution language |
| Users are concrete (not abstract) | Specific roles with goals | Generic "users" | No users defined |
| Success criteria are testable | All criteria have measurement | Some criteria vague | All criteria vague |
| Scope boundaries are clear | In/out clearly delineated | Ambiguous boundaries | No boundaries |

#### 6.1.3 Efficiency

Interview was completed in reasonable time/turns.

| Metric | Pass | Warning | Fail |
|--------|------|---------|------|
| Turn count | <= 15 turns | 16-25 turns | > 25 turns |
| Total duration | <= 20 minutes | 21-40 minutes | > 40 minutes |
| Abandonment rate | < 10% | 10-25% | > 25% |

### 6.2 Quality Gates

**Gate: Interview Validation (G0)**

Before the Intake Brief is marked `complete`, the Interviewer runs validation:

```python
def validate_intake_brief(brief: dict) -> dict:
    checks = {
        "problem_no_solution_language": not contains_solution_language(brief["fields"]["problem_statement"]),
        "has_user": len(brief["fields"]["users"]) >= 1,
        "has_scope_in": len(brief["fields"]["scope_in"]) >= 1,
        "scope_out_addressed": brief["fields"]["scope_out"] is not None,  # Empty list is valid
        "has_testable_criterion": any(c["testable"] for c in brief["fields"]["success_criteria"]),
        "constraints_addressed": brief["fields"]["constraints"] is not None
    }

    return {
        "passed": all(checks.values()),
        "checks": checks,
        "gaps": [k for k, v in checks.items() if not v]
    }
```

**If validation fails:**
- Interview continues with targeted follow-up for failing checks
- Maximum 2 retry rounds
- If still failing after retries: mark Intake Brief with `validation.passed = false` and `validation.gaps` listing failures; Alpha decides whether to proceed or request human clarification

### 6.3 Eval Cases for Interview System

| Case ID | Test | Pass Condition |
|---------|------|----------------|
| EVL-INT-001 | Complete happy-path interview | All fields populated, validation passes, <= 15 turns |
| EVL-INT-002 | Solution language detection | Interviewer asks follow-up when user says "we should build X" |
| EVL-INT-003 | Vague user recovery | Interviewer probes when user says "users want..." |
| EVL-INT-004 | Session pause/resume | Interview resumes from correct stage after pause |
| EVL-INT-005 | Abandonment handling | Abandoned interview is marked correctly, no orphan data |
| EVL-INT-006 | Cost limit enforcement | Interview stops at `max_turns` or `max_budget_usd` |
| EVL-INT-007 | Intake Brief schema conformance | Output JSON validates against schema |
| EVL-INT-008 | Framer handoff | Framer successfully produces `problem.md` from Intake Brief |

---

## 7. Interviewer Agent Specification

### 7.1 Agent Definition

| Field | Value |
|-------|-------|
| **Name** | `interviewer` |
| **Role Title** | Project Intake Interviewer |
| **Reports to** | Alpha |
| **File** | `squad/agents/interviewer.md` |

### 7.2 Mission

Interviewer conducts structured, adaptive interviews with the Pack Owner to gather project requirements. The interview produces a validated Intake Brief that feeds the Wolf Pack pipeline. Interviewer is the first touchpoint for new projects and ensures that downstream agents (Framer, Eval, Quill) receive high-quality, complete input.

### 7.3 Responsibilities

1. **Conduct multi-turn interviews** — Guide the Pack Owner through five interview stages using adaptive questioning
2. **Detect and recover from quality issues** — Identify solution language, vague users, and untestable criteria; probe for specificity
3. **Manage session state** — Track progress, handle pause/resume, mark abandonment
4. **Produce Intake Brief** — Generate structured JSON output conforming to schema
5. **Validate completeness** — Run validation checks before marking interview complete

### 7.4 Tools (Claude Agent SDK)

The Interviewer uses two custom MCP tools:

#### 7.4.1 `ask_user_question`

Built-in Claude Agent SDK tool for prompting user input.

```python
{
    "name": "ask_user_question",
    "description": "Ask the user a question and wait for their response",
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The question to ask the user"
            }
        },
        "required": ["question"]
    }
}
```

#### 7.4.2 `save_interview_response`

Custom MCP tool for persisting interview progress.

```python
{
    "name": "save_interview_response",
    "description": "Save an interview response to the database",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {"type": "string"},
            "stage": {"type": "string", "enum": ["problem_discovery", "user_identification", "scope_definition", "constraints", "success_criteria", "prior_art"]},
            "field_name": {"type": "string"},
            "question": {"type": "string"},
            "response": {"type": "string"},
            "turn_number": {"type": "integer"}
        },
        "required": ["session_id", "stage", "field_name", "question", "response", "turn_number"]
    }
}
```

#### 7.4.3 `complete_interview`

Custom MCP tool for finalizing interview and generating Intake Brief.

```python
{
    "name": "complete_interview",
    "description": "Mark interview complete and generate Intake Brief",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {"type": "string"},
            "project_slug": {"type": "string"},
            "project_title": {"type": "string"},
            "intake_brief": {"type": "object"}
        },
        "required": ["session_id", "project_slug", "project_title", "intake_brief"]
    }
}
```

### 7.5 System Prompt Structure

```markdown
You are Interviewer, the Project Intake Interviewer of the Wolf Pack.

## Your Mission
Conduct structured interviews with the Pack Owner to gather project requirements.
Your output is an Intake Brief that feeds the Wolf Pack development pipeline.

## Interview Protocol
You will guide the user through five stages:
1. Problem Discovery — What is broken or missing?
2. User Identification — Who has this problem?
3. Scope Definition — What is in/out for v1?
4. Constraints — Technical, timeline, or dependency constraints?
5. Success Criteria — How will we know it's working?

## Quality Rules
- NEVER accept solution language in the problem statement. If the user says "we should build X", ask: "What problem would X solve?"
- NEVER accept vague users. "Users" must become "Senior developer on platform team who needs to..."
- EVERY success criterion must be testable. If you cannot imagine writing a test for it, probe for specificity.

## Adaptive Follow-ups
When responses are insufficient, use targeted follow-up questions. Do not repeat the same question.
Maximum 3 questions per stage before moving on with what you have.

## Session Management
- Save responses after each user turn using save_interview_response
- If the user leaves, the session can be resumed later
- Track turn count and current stage

## Output
When all stages are complete and validation passes, use complete_interview to generate the Intake Brief.
```

---

## 8. Implementation Roadmap

### 8.1 Phase 1: Core Interview Engine (P0)

| Task | Assigned To | Deliverable |
|------|-------------|-------------|
| Create Interviewer agent file | Peter + Scout | `squad/agents/interviewer.md` |
| Implement interview database schema | Sigma | Tables in `wolfpack.db` |
| Build interview CLI tool | Forge | `squad/interview.py` |
| Build MCP tool implementations | Forge | `squad/tools/interview_tools.py` |
| Define Intake Brief JSON schema | Architect | Schema in this document (done) |

### 8.2 Phase 2: Integration (P1)

| Task | Assigned To | Deliverable |
|------|-------------|-------------|
| Update Alpha session start protocol | Architect | `planning-ux.md` Section 4.2 update |
| Update Framer to consume Intake Brief | Peter | `squad/agents/framer.md` update |
| Implement session pause/resume | Forge | Logic in `squad/interview.py` |
| Build validation logic | Eval | `squad/interview_validation.py` |

### 8.3 Phase 3: Eval & Polish (P2)

| Task | Assigned To | Deliverable |
|------|-------------|-------------|
| Write eval cases for interview system | Eval | `artifacts/interview-intake/eval-spec.md` |
| Implement eval harness | Eval | `tests/test_interview.py` |
| Add interview metrics to log viewer | Forge/Anvil | `squad/viewer.html` update |
| Performance tuning and cost optimization | Forge | Config updates |

---

## 9. Scripts to Build

### 9.1 `squad/interview.py`

```
Usage:
  python squad/interview.py --action start --project-slug SLUG --title TITLE
  python squad/interview.py --action resume --session-id SESSION_ID
  python squad/interview.py --action list [--status STATUS] [--pending-handoff]
  python squad/interview.py --action status --session-id SESSION_ID
  python squad/interview.py --action abandon --session-id SESSION_ID --reason REASON

Output:
  start   → Starts new interview, returns session_id
  resume  → Resumes paused interview, prints progress summary
  list    → Lists interviews with optional filters
  status  → Shows detailed status for one interview
  abandon → Marks interview as abandoned
```

### 9.2 `squad/tools/interview_tools.py`

MCP server implementing:
- `save_interview_response`
- `complete_interview`
- `get_interview_progress`
- `validate_intake_brief`

---

## 10. Document Control

| Field | Value |
|-------|-------|
| **Document ID** | `DES-interview-intake-001` |
| **Version** | 1.0.0 |
| **Status** | Draft — pending Alpha approval |
| **Author** | Architect |
| **Depends on** | `PLAN-UX-001`, `OPS-MODEL-001` |
| **Effective date** | Upon Alpha approval |

**Change log:**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-04-01 | architect | Initial interview intake system design |
