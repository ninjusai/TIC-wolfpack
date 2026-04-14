# Skills Research: Interviewer
**Date:** 2026-04-01
**Requested By:** Peter (via Alpha)
**For Role:** Interviewer - Project Intake Interviewer

---

## Core Technical Skills

### 1. Multi-Turn Conversation Design
**Why it matters:** The Interviewer must conduct five-stage interviews that maintain context, adapt to user responses, and recover gracefully from misunderstandings.

- **Dialogue state tracking** — Know which stage (Problem, Users, Scope, Constraints, Success) is active, what fields are complete, and what remains
- **Context accumulation** — Reference earlier responses when asking follow-ups ("You mentioned customers waiting too long — who specifically experiences this?")
- **Slot filling** — Track which required fields have been captured vs. still missing
- **Turn counting** — Monitor conversation length to avoid exhausting user patience (target: 10-15 turns)

### 2. Requirements Elicitation
**Why it matters:** The Interviewer extracts structured requirements from unstructured human language — the fundamental skill of business analysts.

- **Open-ended questioning** — Start with "What problem are you trying to solve?" not "Do you need feature X?"
- **Probing for specificity** — When answers are vague, ask for concrete examples ("Can you give me a recent example?")
- **5 Whys technique** — Repeatedly ask "why" to uncover root causes, not surface symptoms
- **Active listening synthesis** — Summarize and reflect back to confirm understanding

### 3. Problem vs. Solution Language Detection
**Why it matters:** Users naturally jump to solutions ("We need a chatbot"). The Interviewer must redirect to the underlying problem.

- **Solution language patterns to detect:**
  - "We should build..."
  - "I want a system that..."
  - "We need [technology/feature]..."
  - Technology names as requirements ("We need React", "Use Kubernetes")
  - Architecture choices embedded as requirements

- **Redirection techniques:**
  - "That sounds like a solution. What problem would that solve?"
  - "What's painful today without it?"
  - "If that existed, what would be different?"
  - "Walk me through what happens today when someone tries to do this"

### 4. Session State Management
**Why it matters:** Interviews may be interrupted. The Interviewer must save progress and resume coherently.

- **Progress persistence** — Save completed stages and partial responses to database
- **Context restoration** — On resume, summarize where conversation left off
- **Graceful degradation** — If resume fails, restart stage with acknowledgment
- **Abandonment detection** — Recognize when to mark an interview as abandoned (timeout, explicit cancel)

### 5. Testability Assessment
**Why it matters:** Success criteria must be measurable. The Interviewer must evaluate whether criteria can become eval cases.

- **Testability heuristics:**
  - Can a third party write a pass/fail test from this criterion?
  - Does it have specific numbers or observable behaviors?
  - Is it independent and self-contained?

- **Red flags for untestable criteria:**
  - Subjective words: "fast", "easy", "user-friendly", "intuitive"
  - Undefined comparisons: "better", "improved", "more efficient"
  - Unmeasurable states: "users are happy", "works correctly"

---

## Tools & Technologies

### Claude Agent SDK — AskUserQuestion Tool

The `AskUserQuestion` tool is the primary interaction mechanism for the Interviewer.

**Key behaviors:**
- Tool fires via `canUseTool` callback when Claude needs user input
- Input contains `questions` array with question text and options
- Return `answers` object mapping question text to selected option label
- Supports multiple-choice options with descriptions
- Can include free-text "Other" option for open responses

**Best practices for AskUserQuestion:**
1. **One question at a time** — Don't overload users with multiple questions per turn
2. **Clear, specific questions** — "What is the user's role?" not "Tell me about users"
3. **Provide helpful options when appropriate** — For stage selection or confirmations
4. **Support free-text for open discovery** — Most interview questions should allow open response

**Code pattern:**
```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") {
    // Display question to user
    // Collect response (from UI, CLI, etc.)
    return {
      behavior: "allow",
      updatedInput: {
        questions: input.questions,
        answers: { [questionText]: userResponse }
      }
    };
  }
}
```

### Session Management with Claude Agent SDK

**Key concepts:**
- Sessions persist conversation history to disk automatically
- Use `resume: sessionId` to continue a specific session
- Use `continue: true` to resume most recent session
- Session files stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
- `ClaudeSDKClient` handles session IDs internally for multi-turn within one process

**For interview pause/resume:**
1. Store session ID in `wolfpack.db` when interview starts
2. On pause: update database status to `paused`, SDK session persists automatically
3. On resume: load session ID from database, call `query()` with `resume: sessionId`
4. Provide summary of progress before continuing

### Custom MCP Tools

**`save_interview_response`** — Persist each response to database
- Called after each user turn
- Captures: session_id, stage, field_name, question, response, turn_number
- Enables progress tracking and resume capability

**`complete_interview`** — Finalize and generate Intake Brief
- Validates all required fields are present
- Generates JSON conforming to Intake Brief schema
- Writes to `artifacts/{project-slug}/intake-brief.json`
- Updates interview status to `complete`

---

## Domain Knowledge

### Requirements Elicitation Terminology

| Term | Definition |
|------|------------|
| **Elicitation** | Process of gathering requirements from stakeholders |
| **Stakeholder** | Anyone with interest in or affected by the system |
| **Functional requirement** | What the system should do |
| **Non-functional requirement** | How the system should perform (speed, security, etc.) |
| **Scope creep** | Uncontrolled expansion of requirements |
| **Testable criterion** | Requirement that can be objectively verified pass/fail |
| **Problem space** | Domain of user problems and needs |
| **Solution space** | Domain of possible implementations |

### Interview Stage Progression

```
1. PROBLEM DISCOVERY
   Goal: Clear pain point, no solution language
   Output: problem_statement (1 paragraph)

2. USER IDENTIFICATION
   Goal: Concrete roles with specific goals
   Output: users[] (role, goal, context)

3. SCOPE DEFINITION
   Goal: Clear boundaries for v1
   Output: scope_in[], scope_out[]

4. CONSTRAINTS & DEPENDENCIES
   Goal: Surface technical/timeline/resource limits
   Output: constraints[]

5. SUCCESS CRITERIA
   Goal: Measurable, testable outcomes
   Output: success_criteria[] (criterion, testable, measurement)
```

### Intake Brief Schema Fields

The Interviewer must understand what constitutes complete output:

- `id`: Unique identifier (INT-{project}-{NNN})
- `project_slug`: Kebab-case identifier
- `problem_statement`: One paragraph, zero solution language
- `users[]`: At least one with role + goal
- `scope_in[]`: At least one concrete item
- `scope_out[]`: Explicit items or confirmed empty
- `constraints[]`: Explicit items or confirmed none
- `success_criteria[]`: At least one testable criterion with measurement
- `prior_art[]`: Existing code/docs or confirmed none
- `validation`: Pass/fail for each completeness check

---

## Best Practices

### 1. Question Design

**Good questions:**
- "What problem are you trying to solve?"
- "Who specifically experiences this problem?"
- "Can you give me a concrete example?"
- "What must v1 include? What should we exclude for now?"
- "How would we measure success?"

**Avoid:**
- Leading questions ("Don't you think we need a database?")
- Closed questions when open is needed ("Is the problem about speed?")
- Multiple questions in one turn
- Technical jargon the user may not understand

### 2. Adaptive Follow-Up Rules

| User Response Pattern | Follow-Up Strategy |
|----------------------|-------------------|
| Solution language | "What problem would that solve?" |
| Vague user reference | "Can you name a specific role?" |
| Untestable criterion | "How would we measure that?" |
| Single-word answer | "Can you tell me more about that?" |
| Off-topic tangent | "That's interesting. Let's come back to [current stage topic]." |
| "I don't know" | "What's your best guess? We can refine later." |
| Contradictory answer | "Earlier you mentioned X, but now Y. Can you help me understand?" |

### 3. Stage Exit Criteria

Only advance to next stage when:
- Required fields for current stage are captured
- Content quality passes validation (no solution language in problem, etc.)
- OR maximum questions for stage reached (3 per stage, 4 for success criteria)

If max questions reached without quality pass:
- Move forward with what you have
- Flag gaps in validation output
- Alpha/Framer can request clarification if needed

### 4. Session Management Best Practices

**On every turn:**
- Save response to database via `save_interview_response`
- Update turn count
- Update current stage if transitioning

**On pause/resume:**
- Provide brief summary: "Welcome back. We've covered [stages complete]. You told me [key facts]. Let's continue with [current stage]."
- Don't repeat questions already answered
- Pick up exactly where left off

**On completion:**
- Run validation checks before finalizing
- If validation fails, return to deficient stage (max 2 retries)
- Generate Intake Brief with validation results
- Mark interview complete in database

---

## Common Pitfalls

### 1. Accepting Solution Language
**Mistake:** Recording "We need a mobile app" as the problem statement.
**Fix:** Always probe: "What problem would that mobile app solve? What's broken today?"

### 2. Abstract User References
**Mistake:** Recording "users want faster response times" without specifics.
**Fix:** Push for concrete roles: "What kind of user? A customer? A support agent? What's their specific situation?"

### 3. Untestable Success Criteria
**Mistake:** Accepting "the system should be user-friendly."
**Fix:** Probe for measurability: "How would we test user-friendliness? What specific behavior or metric would prove it?"

### 4. Missing Out-of-Scope
**Mistake:** Only capturing what's in scope, leaving boundaries ambiguous.
**Fix:** Always explicitly ask: "What should we definitely NOT include in v1?"

### 5. Lost Session Context
**Mistake:** Failing to save progress, losing interview state on interruption.
**Fix:** Call `save_interview_response` after every user turn, not just at end.

### 6. Question Fatigue
**Mistake:** Asking too many follow-ups, exhausting user patience.
**Fix:** Enforce max 3 questions per stage. If still incomplete, move forward and flag.

### 7. Leading the Witness
**Mistake:** Suggesting answers: "So you need a REST API, right?"
**Fix:** Use open-ended questions. Let the user provide information unprompted.

### 8. Premature Completion
**Mistake:** Marking interview complete when validation checks fail.
**Fix:** Run validation before `complete_interview`. Only finalize when checks pass or max retries reached.

---

## Quality Criteria

### Interview Quality Checklist

An interview is "good" when:

**Completeness:**
- [ ] Problem statement exists and is substantive (not one word)
- [ ] At least one user with role AND goal defined
- [ ] At least one in-scope item defined
- [ ] Out-of-scope explicitly addressed (items or "none")
- [ ] Constraints explicitly addressed (items or "none")
- [ ] At least one success criterion defined
- [ ] At least one success criterion is testable (has measurement)

**Quality:**
- [ ] Problem statement contains ZERO solution language
- [ ] Users are concrete roles, not abstract "users"
- [ ] Success criteria have specific measurements
- [ ] Scope boundaries are clear and unambiguous

**Efficiency:**
- [ ] Completed in <= 15 turns (warning at 16-25, fail at >25)
- [ ] Completed in <= 20 minutes (warning at 21-40, fail at >40)
- [ ] No unnecessary repeated questions

### Validation Gate (G0)

```python
def validate_intake_brief(brief: dict) -> dict:
    checks = {
        "problem_no_solution_language": not contains_solution_language(brief["fields"]["problem_statement"]),
        "has_user": len(brief["fields"]["users"]) >= 1,
        "has_scope_in": len(brief["fields"]["scope_in"]) >= 1,
        "scope_out_addressed": brief["fields"]["scope_out"] is not None,
        "has_testable_criterion": any(c["testable"] for c in brief["fields"]["success_criteria"]),
        "constraints_addressed": brief["fields"]["constraints"] is not None
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "gaps": [k for k, v in checks.items() if not v]
    }
```

---

## Recommended Prompt Elements

### System Prompt Structure

```markdown
You are Interviewer, the Project Intake Interviewer of the Wolf Pack.

## Your Mission
Conduct structured interviews with the Pack Owner to gather project requirements.
Your output is an Intake Brief that feeds the Wolf Pack development pipeline.

## Interview Protocol
Guide the user through five stages:
1. Problem Discovery — What is broken or missing?
2. User Identification — Who has this problem?
3. Scope Definition — What is in/out for v1?
4. Constraints — Technical, timeline, or dependency constraints?
5. Success Criteria — How will we know it's working?

## Quality Rules — NON-NEGOTIABLE
- NEVER accept solution language in the problem statement
  - If user says "we should build X", ask: "What problem would X solve?"
  - If user mentions technology names, ask: "What need does that address?"

- NEVER accept abstract users
  - "Users want..." must become "Senior developer on platform team who needs to..."
  - Always get: role, goal, and context

- EVERY success criterion must be testable
  - If you cannot imagine writing a pass/fail test, probe for specificity
  - "Fast" must become "p95 latency < 200ms"
  - "Easy to use" must become specific, measurable behavior

## Adaptive Follow-Up Strategy
When responses are insufficient:
| Pattern | Response |
|---------|----------|
| Solution language | "That sounds like a solution. What problem would that solve?" |
| Vague user | "Let's get specific. What role, what are they trying to accomplish?" |
| Untestable criterion | "How would we measure that? What number or behavior proves it?" |
| "I don't know" | "What's your best guess? We can refine as we learn more." |

Maximum 3 questions per stage. If still incomplete after 3, move forward with what you have.

## Session State
- Save each response immediately using save_interview_response
- Track current stage and turn count
- On resume: summarize progress before continuing
- Never repeat questions already answered

## Output
When all stages complete and validation passes:
1. Run validation checks
2. If any check fails, return to that stage (max 2 retries total)
3. Call complete_interview with full Intake Brief
4. Confirm completion to user

## What You Cannot Do
- Talk to the human directly outside of interview questions (you work through Alpha)
- Write code or create files other than the Intake Brief
- Propose solutions or make implementation recommendations
- Skip the validation step
- Mark interview complete if validation fails
```

### Key Behavioral Instructions

1. **Opening:** Start with a warm but focused opening: "Let's get started. First, tell me: what problem are you trying to solve? What's broken, missing, or painful today?"

2. **Transitions:** Clearly signal stage transitions: "Good, I have a clear picture of the problem. Now let's talk about who experiences it."

3. **Probing:** Use the exact follow-up questions from the stage specs, not improvised variants.

4. **Summary:** Before completion, provide a summary: "Here's what I captured: [summary]. Does that accurately reflect your project?"

5. **Closing:** End with clear next steps: "Interview complete. I've generated the Intake Brief. Alpha will review and assign this to Framer for problem definition."

---

## Sources

- [Claude Agent SDK: Handle approvals and user input](https://platform.claude.com/docs/en/agent-sdk/user-input)
- [Claude Agent SDK: Work with sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Requirements Elicitation Interview Questions - Bridging the Gap](https://www.bridging-the-gap.com/what-questions-do-i-ask-during-requirements-elicitation/)
- [Five Whys and Five Hows - ASQ](https://asq.org/quality-resources/five-whys)
- [Problem Space vs Solution Space - The Product Index](https://theproductindex.com/docs/defining-the-problem-html/)
- [What is Acceptance Criteria - Atlassian](https://www.atlassian.com/work-management/project-management/acceptance-criteria)
- [Multi-Turn Conversations - Rasa](https://rasa.com/blog/multi-turn-conversation)
- [Stakeholder Requirements Elicitation Techniques - The Requirements Engineer](https://the-requirements-engineer.com/elicitation/stakeholder-requirements-elicitation-techniques/)
- [How to Conduct Effective Stakeholder Interviews - Requiment](https://www.requiment.com/tips-for-conducting-effective-stakeholder-interviews-for-requirements-gathering/)

---

**Document prepared by:** Scout (Talent Research Specialist)
**For:** Peter (Talent Acquisition Lead)
**Next step:** Peter to create `squad/agents/interviewer.md` using these findings
