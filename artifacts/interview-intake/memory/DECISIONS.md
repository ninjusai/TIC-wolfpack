# Interview Intake System - Decision Log

## [2026-04-01] OAuth Authentication Allowed for Internal Tool

**Context:** Anthropic's 2026 policy restricts OAuth authentication in certain contexts. We needed to determine if the Interviewer agent could use OAuth for Claude Agent SDK.

**Decision:** OAuth is allowed because this is an internal tool, not a user-facing application.

**Rationale:** The restriction applies to user-facing applications that would require end-users to authenticate. The Interviewer is a developer tool used within the Wolf Pack system by the Pack Owner (human operator), not external users.

**Alternatives Considered:**
- API key only: Would work but less flexible for future expansion
- Skip SDK entirely: Would lose session management benefits

**Impact:** Enables use of full Claude Agent SDK capabilities including session persistence.

---

## [2026-04-01] JSON Output Format (Not Markdown)

**Context:** The interview output needs to be consumed by Framer and potentially validated by automated tools.

**Decision:** Intake Brief is JSON (`intake-brief.json`), not Markdown.

**Rationale:**
- JSON enables programmatic validation (schema conformance)
- Structured data supports validation gates
- Fields map cleanly to downstream artifacts
- Framer can reliably parse and transform
- Markdown would require parsing prose, which is error-prone

**Alternatives Considered:**
- Markdown: Human-readable but hard to validate
- YAML: Similar benefits to JSON but less tooling support
- Hybrid (JSON + Markdown summary): Added complexity

**Impact:** Framer updated to consume JSON. Schema defined in DESIGN.md Section 3.1.

---

## [2026-04-01] 5-Stage Interview Flow

**Context:** The interview needs structure to ensure completeness without being burdensome.

**Decision:** Five sequential stages:
1. Problem Discovery
2. User & Stakeholder Identification
3. Scope Definition
4. Constraints & Dependencies
5. Success Criteria & Validation

**Rationale:**
- Covers all fields needed for problem.md
- Logical progression from problem to success criteria
- Max 3 questions per stage prevents fatigue
- Aligns with existing intake protocol questions
- Each stage has clear exit criteria

**Alternatives Considered:**
- Fewer stages (3): Would conflate concerns
- More stages (7+): Too granular, interview fatigue
- Unstructured conversation: No guarantees of completeness

**Impact:** Interviewer agent file documents each stage with entry questions, exit criteria, and adaptive follow-ups.

---

## [2026-04-01] Framer Maintains Pipeline Position

**Context:** With Intake Brief as a new artifact, we needed to decide where it fits in the pipeline.

**Decision:** Framer consumes Intake Brief and produces problem.md. Pipeline remains: Intake Brief -> Framer -> problem.md -> G1 gate -> ...

**Rationale:**
- Maintains existing pipeline stages
- Framer is already designed for problem definition
- No disruption to downstream artifacts (eval-spec, PRD, etc.)
- Single clear transformation: JSON -> Markdown

**Alternatives Considered:**
- Skip Framer, use Intake Brief directly: Would require rewriting all downstream consumers
- Merge Framer into Interviewer: Violates single-responsibility

**Impact:** Framer agent file updated with new section on Intake Brief consumption.

---

## [2026-04-01] Validation Gate (G0) Before Interview Completion

**Context:** Bad input corrupts the entire pipeline. Need to catch quality issues early.

**Decision:** Run validation checks (G0 gate) before marking interview complete:
- Problem statement has no solution language
- At least one user with role + goal
- At least one in-scope item
- Out-of-scope addressed
- At least one testable success criterion
- Constraints addressed

**Rationale:**
- Catches issues at source, not downstream
- Interviewer can probe for missing information
- Max 2 retry rounds prevent infinite loops
- Validation failures flagged in `validation.gaps[]` for human review

**Alternatives Considered:**
- No validation (trust user): Quality problems propagate
- Strict validation (must pass): Could block legitimate edge cases
- Human-only validation: Slower, inconsistent

**Impact:** Validation logic in interview_tools.py. Eval cases EVL-INT-001 through EVL-INT-007 test validation scenarios.

---

## [2026-04-01] Database Version 2 with Interview Tables

**Context:** Interview sessions and responses need persistent storage for pause/resume and audit.

**Decision:** Add two new tables to wolfpack.db:
- `interviews`: Session metadata (status, stage, turn count, timestamps)
- `interview_responses`: Per-turn storage (stage, field, question, response)

**Rationale:**
- Enables session pause/resume
- Provides audit trail
- Supports abandonment handling
- Allows querying for pending handoffs
- Foreign key constraint ensures data integrity

**Alternatives Considered:**
- File-based storage: No query capability
- Separate database: Adds complexity
- SDK-only session storage: No visibility into progress

**Impact:** Sigma created migration. Backup stored in `squad/backups/`. DB version incremented to 2.
