# Wolf Pack Protocol

The rules of engagement for all pack members. Every agent must follow these rules without exception.

## Chain of Command

```
Human (Pack Owner)
  |
  v
Alpha (Orchestrator)
  |
  ├── Peter (Recruitment Lead)
  |     |
  |     └── Scout (Talent Research)
  |
  └── [Specialist Agents] (created as needed)
```

- The **Human** only communicates with **Alpha**
- **Alpha** delegates to all agents and orchestrates handoffs between them
- **Peter** defines roles and creates new agents
- **Scout** researches skills/tools needed for new roles, reports to Peter via Alpha
- **Specialist agents** report directly to Alpha

## Alpha Delegation Rules

Alpha is an orchestrator, not an implementer. These rules are non-negotiable:

### Immediate Delegation Mandate

**Alpha MUST spawn an agent within 2 tool calls of receiving a human request.** No direct research, no file reading beyond protocol files (`PROTOCOL.md`, `registry.json`, agent files, memory files). Delegate immediately.

Allowed actions before delegation:
- Reading protocol files to understand the request
- Checking `squad/registry.json` to identify the right agent
- Reading memory files (`PACK_STATE.md`, `CONTEXT.md`) for context

Prohibited actions:
- Reading source code files directly
- Researching implementation details
- Writing any code or documentation
- Any substantive work that belongs to a specialist

### Execution Mode

When the human says **"proceed"**, **"continue"**, **"don't stop"**, **"finish it"**, or similar directives, Alpha enters **Execution Mode**:

- **No clarifying questions.** Push through until blocked or complete.
- **Cascade delegations.** Spawn agents in sequence as needed without pausing for confirmation.
- **Only ask questions when genuinely blocked** — not for confirmation, not for preferences.
- **Report progress at milestones** rather than asking for permission to continue.

Exit Execution Mode when:
- The work is complete
- A genuine blocker requires human input (missing credentials, ambiguous requirements that cannot be inferred, etc.)
- The human explicitly asks to pause or review

## How Work Flows

### Standard Task (agent exists)
1. Human describes what they need to Alpha
2. Alpha checks `squad/registry.json` for a suitable agent
3. Alpha creates a task manifest in `squad/tasks/`
4. Alpha spawns the agent via the Agent tool, passing the task + relevant context
5. Agent does the work, writes a report to `squad/inbox/`
6. Alpha reads the report, updates the task manifest, reports back to human

### New Capability Needed (no suitable agent)
1. Alpha identifies a skill gap — no agent in the registry can handle the task
2. Alpha spawns **Peter** with the requirement description
3. Peter defines the role (title, responsibilities, scope), writes to `squad/inbox/`
4. Alpha reads Peter's role definition, then spawns **Scout** with it
5. Scout researches skills, tools, best practices needed — writes findings to `squad/inbox/`
6. Alpha reads Scout's research, then spawns **Peter** again with Scout's findings
7. Peter creates the agent file in `squad/agents/` using `_template.md` as the base
8. Peter updates `squad/registry.json` with the new agent
9. Peter writes a completion report to `squad/inbox/`
10. Alpha confirms the new agent is ready, then delegates the original task to them

## Logging & Reporting

All logging goes to SQLite via `squad/log.py`. The database file is `squad/wolfpack.db`.
To initialize the database (first time only): `python squad/init_db.py`

### Every Agent Must:
Log a report before completing ANY task:
```bash
python squad/log.py report --agent [name] --subject "[subject]" --status [complete|in_progress|blocked] --summary "[what was done]" --decisions "[choices made]" --deliverables "[files created/modified]" --issues "[problems]" --next-steps "[what's next]"
```

### Alpha Must:
Log every event to the session log:
```bash
python squad/log.py session --event [request|delegation|report|decision] --agent [name] --content "[description]"
```

Manage tasks:
```bash
python squad/log.py task --action create --title "[title]" --assigned-to [agent] --objective "[what needs doing]"
python squad/log.py task --action update --task-id [id] --status [pending|in_progress|complete|blocked]
python squad/log.py task --action list
```

Register new agents (Peter does this):
```bash
python squad/log.py agent --action register --name [name] --role "[role]" --file "squad/agents/[name].md" --description "[description]"
```

### Viewing Logs
Open `squad/viewer.html` in a browser and load `squad/wolfpack.db` to search, filter, and browse all reports, tasks, session logs, and agents.

## Cross-Layer Interface Contracts

When work spans multiple technology layers (e.g., Python ↔ Rust ↔ TypeScript), miscommunication between layers is a common source of bugs. Follow these rules to prevent integration failures.

### Interface Contract Requirement

**When work spans multiple layers, the FIRST task must be "Define Interface Contract."**

Before any implementation begins:
1. **Identify all layers involved** — Which languages/runtimes will communicate?
2. **Define the contract** — Create a document specifying:
   - Exact JSON field names
   - Data types (including nullability)
   - Casing conventions per layer
   - Serialization/deserialization rules
3. **All implementing agents must reference this contract** — Include the contract path in every task manifest for cross-layer work.

### Casing Convention Standard

Unless project-specific conventions override, use this pattern:

| Layer | Convention | Example |
|-------|------------|---------|
| Python | snake_case | `user_id`, `created_at` |
| Rust | snake_case internally, serde aliases for interop | `#[serde(alias = "userId")]` |
| TypeScript/JS | camelCase | `userId`, `createdAt` |
| JSON wire format | camelCase (JS convention dominates APIs) | `{"userId": 123}` |

### Frontend Type Contract Rule

**Every frontend work item that consumes a backend API MUST read the backend route file FIRST.**

This is a systemic issue. Frontend type misalignment caused 6 CRITICAL issues in Mission Control and 5 CRITICAL issues in PeakProtocol Phase 2. The pattern is always the same: frontend agent writes types based on assumptions instead of reading the actual backend code.

#### Requirements

1. **Before writing any frontend types or API calls**, the frontend agent MUST read the actual backend route/handler file
2. **The agent's report MUST reference the exact backend file** they read (e.g., "Read `src/routes/api/auth.ts` before writing `AuthResponse` type")
3. **Auditor MUST verify** this step was taken during audit passes — reject any frontend work that doesn't reference the backend source
4. **If the backend doesn't exist yet**, the interface contract document (see above) serves as the source of truth

#### Why This Matters

Frontend agents that write types from memory or assumptions produce mismatched interfaces that compile fine but fail at runtime. This has been the single most common source of CRITICAL bugs across two consecutive projects.

### Contract Document Template

Interface contracts should be stored in `docs/contracts/` and include:

```yaml
contract: [name]
version: [semver]
layers: [list of languages/services involved]
fields:
  - name: [field_name]
    type: [type]
    python: [python_name]
    rust: [rust_name]
    typescript: [ts_name]
    nullable: [true/false]
    description: [what this field represents]
```

## Integration Verification Gate

Cross-layer features introduce integration risk. A component may work in isolation but fail when connected. This gate prevents premature "done" declarations.

### Sentry Verification Requirement

**For any cross-layer feature, Sentry MUST run integration tests before any agent reports "complete."**

The workflow:
1. Implementing agent(s) complete their layer-specific work
2. Implementing agent reports status as `in_progress` (not `complete`)
3. Alpha spawns **Sentry** to run integration tests across all affected layers
4. Sentry verifies all layers communicate correctly
5. If Sentry passes → implementing agents can report `complete`
6. If Sentry fails → implementing agents receive the failure report and must fix

**The build is not done until Sentry verifies all layers communicate correctly.**

## Local Verification Gate

Cross-layer integration tests are necessary but not sufficient. The application must actually run locally before any project is declared complete.

### Sentry Local Verification Requirement

**Before ANY build is declared complete, Sentry MUST verify the app runs locally.** This is mandatory and non-negotiable.

#### Local Verification Checklist

1. **Frontend starts** — Dev server boots without errors, serves the app
2. **Backend starts** — API/server process starts, health check endpoint responds
3. **Frontend-backend communication** — Frontend can reach the backend, API calls succeed
4. **Auth works** — Login/logout flow completes successfully (if applicable)
5. **Core workflows work** — Primary user journeys execute end-to-end

#### Workflow

1. Implementing agents complete their work and report `in_progress`
2. Alpha spawns Sentry with explicit instruction to run local verification
3. Sentry starts all services, walks through the checklist above
4. If ALL checks pass → agents can report `complete`
5. If ANY check fails → agents receive the failure report and must fix

**No project is "complete" until local verification passes. A project that builds but doesn't run is not done.**

> **Origin:** PeakProtocol retrospective. Multiple issues were only discovered when attempting to run locally late in the build cycle. Earlier local verification would have caught them sooner.

### What Sentry Verifies

- Data flows correctly across layer boundaries
- Field names match the interface contract
- Type conversions work (especially dates, enums, nested objects)
- Error handling propagates appropriately
- No data loss or corruption in serialization round-trips

## Dev Environment Setup Requirement

**Every project's Phase 1 MUST include a "Dev Environment Setup" work item.**

Discovery of "how to run the project" should not happen mid-build. By the end of Phase 1, the team must know exactly how to start, test, and verify every service.

### Deliverables

1. **Documented startup commands** for all services (frontend, backend, database, workers, etc.)
2. **Verified health checks** — each service has a way to confirm it's running correctly
3. **Environment variables** documented with example values
4. **Prerequisites** listed (runtime versions, tools, accounts needed)

This work item is not optional. It is a prerequisite for all subsequent implementation phases.

> **Origin:** PeakProtocol retrospective. Startup procedures were discovered ad-hoc during debugging, wasting time.

## Deployment Planning Requirement

**Deployment architecture (hosting, CI/CD, staging) must be defined in Phase 1 architecture decisions.**

Deployment is not an afterthought. The following must be decided before implementation begins:

1. **Hosting platform** — Where will each service run?
2. **CI/CD pipeline** — How will code get from commit to production?
3. **Staging environment** — How will changes be tested before production?
4. **Deployment validation** — How will we verify a deploy succeeded?

Deployment validation must also be part of the eval spec so it can be tested systematically.

> **Origin:** PeakProtocol retrospective. Deployment architecture was defined late, causing rework.

## Auth Design Review

**Auth architecture must match the actual user count and device topology of the project.**

Before implementing any auth system, the architecture decision MUST include a **"User & Device Profile"** section that answers:

1. **How many users?** — Single user, small team, public multi-tenant?
2. **What devices?** — Desktop only, mobile, cross-device?
3. **What's the threat model?** — Local network, public internet, offline-capable?

### Rule of Proportionality

- **Single-user apps** should NOT get multi-user auth infrastructure (no WebAuthn, no RBAC, no complex session management)
- **Small-team apps** need simple auth (API keys, basic tokens)
- **Public multi-tenant apps** warrant full auth infrastructure

Over-engineering auth wastes significant build time and adds unnecessary complexity.

> **Origin:** PeakProtocol retrospective. WebAuthn was initially scoped for a single-user climbing app, adding unnecessary complexity.

## Agent Creation Rules

When Peter creates a new agent:
1. The agent file MUST be based on `squad/agents/_template.md`
2. The agent MUST have the `squad/log.py report` logging baked into its prompt
3. The agent MUST know it reports to Alpha
4. The agent MUST know how to use `squad/log.py` for reporting
5. The agent MUST be added to `squad/registry.json` AND registered via `squad/log.py agent --action register`
6. The agent file goes in `squad/agents/[name].md`

## File Locations

| What | Where |
|------|-------|
| Agent prompts | `squad/agents/[name].md` |
| Agent template | `squad/agents/_template.md` |
| Agent registry | `squad/registry.json` |
| Database | `squad/wolfpack.db` (all reports, tasks, logs, agent history) |
| DB initializer | `squad/init_db.py` |
| Logging CLI | `squad/log.py` |
| Log viewer | `squad/viewer.html` (open in browser, load the .db file) |
| Pack rules | `squad/PROTOCOL.md` (this file) |
