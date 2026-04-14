# Wolf Pack - Decision Log

This file tracks key protocol and process decisions that affect the entire pack.

---

## [2026-04-01] Pack Retrospective Protocol Improvements

**Context:** A pack retrospective revealed systemic issues affecting work quality and efficiency. Alpha was doing direct implementation work instead of delegating to specialists. Cross-layer interface mismatches (e.g., snake_case vs camelCase naming conventions) weren't caught until integration tests failed, causing rework.

**Decisions Made:**

### 1. Alpha Immediate Delegation Mandate
- **File:** `squad/PROTOCOL.md`
- **Change:** Added 2 tool call limit before Alpha must delegate
- **Rationale:** Alpha's role is orchestration, not implementation. Direct work slows the pack and bypasses specialist expertise.

### 2. Execution Mode Protocol
- **File:** `squad/PROTOCOL.md`
- **Change:** When human says "proceed" or similar, agents execute without clarifying questions
- **Rationale:** Reduces back-and-forth friction. Human has already signaled intent to move forward.

### 3. Cross-Layer Interface Contract Requirement
- **File:** `squad/PROTOCOL.md`
- **Change:** All cross-layer work must define interface contracts before implementation
- **Rationale:** The snake_case/camelCase mismatch incident showed that frontend and backend teams need explicit agreements on data shapes, naming, and types.

### 4. Sentry Integration Verification Gate
- **File:** `squad/agents/sentry.md`
- **Change:** Sentry formalized as mandatory verification gate for cross-layer work. No cross-layer task can be marked "complete" without Sentry approval.
- **Duties Added:**
  - Interface contract validation
  - Cross-layer type consistency checks
  - Integration test verification
- **Rationale:** Catching mismatches at integration time is expensive. Sentry's QA role now explicitly includes preventing these issues.

### 5. Registry Skill Domains
- **File:** `squad/registry.json`
- **Change:** All 16 agents now have `domains` array for skill matching
- **Rationale:** Enables Alpha to match tasks to agents based on required skills, not just name recognition. Supports future automated agent selection.

**Alternatives Considered:**
- Manual code review gates (rejected: too slow, doesn't scale)
- Automated linting for naming conventions (partial: helps but doesn't catch semantic mismatches)
- Interface-first development mandate (incorporated into contract requirement)

**Impact:**
- Alpha behavior change (delegation-first)
- Sentry scope expansion (integration gate)
- All agents now have skill metadata
- Clearer handoff protocols for multi-layer work

---
