# Interview Intake System - Decision Log

## [2026-04-01] Five-Stage Interview Flow

**Context:** Needed a structured approach to extract comprehensive project requirements without overwhelming users or missing critical information.

**Decision:** Implement a 5-stage linear flow: Problem Discovery -> User Identification -> Scope Definition -> Constraints -> Success Criteria.

**Rationale:** This mirrors proven discovery interview techniques from product management. Each stage builds on the previous, creating a logical progression that helps users think through their project systematically.

**Alternatives Considered:**
- Free-form conversation (rejected: too unstructured, easy to miss requirements)
- Single-stage comprehensive questionnaire (rejected: overwhelming, poor UX)
- Branching interview based on project type (rejected: added complexity without proportional benefit)

**Impact:** Interview sessions follow predictable structure, making it easier to track progress and ensure completeness.

---

## [2026-04-01] Intake Brief JSON as Output Format

**Context:** Interview output needs to feed into downstream agents (specifically Framer) in a consumable format.

**Decision:** Output is a structured JSON file (`intake-brief.json`) with defined schema for all extracted requirements.

**Rationale:** JSON provides machine-readable structure that Framer and other agents can parse reliably. Schema validation ensures data quality.

**Alternatives Considered:**
- Markdown summary (rejected: harder to parse programmatically)
- Direct agent-to-agent handoff (rejected: loses persistence and auditability)

**Impact:** Creates clear contract between Interviewer and Framer agents. Artifacts are persisted for audit trail.

---

## [2026-04-01] Python CLI via Subprocess from Tauri

**Context:** Mission Control (Tauri/Rust) needs to integrate interview functionality without duplicating Python business logic.

**Decision:** Tauri commands invoke the Python CLI (`squad/interview.py`) via subprocess, using `--json` flag for structured I/O.

**Rationale:** Maintains single source of truth for interview logic in Python. Avoids re-implementing database and agent SDK integration in Rust. Subprocess overhead is acceptable for conversational latency.

**Alternatives Considered:**
- Rewrite interview logic in Rust (rejected: significant effort, duplicates existing code)
- HTTP server wrapper (rejected: adds deployment complexity)
- Direct FFI bindings (rejected: complex, fragile for this use case)

**Impact:** Interview.py is the canonical implementation. Rust layer is thin IPC wrapper.

---

## [2026-04-01] Solution Language Detection

**Context:** Users often jump straight to proposing solutions ("I need a React app") rather than describing problems.

**Decision:** Interviewer agent includes solution language detection that redirects users back to problem-space thinking when premature solution language is detected.

**Rationale:** Better problem definition leads to better solutions. Prevents anchoring on potentially suboptimal approaches before requirements are understood.

**Alternatives Considered:**
- Allow solution proposals freely (rejected: compromises problem discovery quality)
- Hard block on solution language (rejected: too rigid, frustrating UX)

**Impact:** Interview quality improved by keeping focus on "what" and "why" before "how."

---

## [2026-04-01] Chat UI with Mode Toggle

**Context:** Mission Control already has a Manual Intake form. Need to add Interview option without breaking existing workflow.

**Decision:** IntakeView.tsx includes mode toggle allowing users to switch between Manual Intake (form-based) and Interview Intake (chat-based).

**Rationale:** Users have choice based on preference and project complexity. Simple projects may prefer quick form; complex projects benefit from guided interview.

**Alternatives Considered:**
- Replace manual intake entirely (rejected: removes user choice, not always necessary)
- Separate navigation items (rejected: fragments UX, duplicates concept)

**Impact:** Both intake methods coexist. Users can choose appropriate method per project.
