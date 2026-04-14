# Interview Intake System - Current Context

*Last updated: 2026-04-01 by Scribe*

## Current State

The Interview Intake System is now **fully integrated** into Mission Control. This feature provides an AI-powered structured interview experience that replaces manual intake protocols with an adaptive multi-turn conversation. The system extracts project requirements through a 5-stage flow and produces validated Intake Briefs that feed directly into the Framer agent.

All core components are built and tested. The Rust backend has 5 Tauri commands with all tests passing. The React frontend includes a chat-style UI with mode toggle between Manual Intake and Interview Intake.

## Active Work

- None currently in progress. Feature is complete and ready for use.

## Blockers

- None. All integration work is complete.

## Next Steps

- [ ] Implement interview eval harness (`tests/test_interview_eval.py`) to automate the 8 eval cases
- [ ] Integrate interview metrics/analytics into Mission Control dashboard
- [ ] Human user testing to validate conversation quality
- [ ] Consider adding interview history view to Mission Control

## Key Files

### Agent Definition
- `squad/agents/interviewer.md` - Agent #16, conducts 5-stage structured interviews

### Database Layer
- `squad/interview.py` - CLI for interview management (`--json` flag for structured output)
- `squad/tools/interview_tools.py` - MCP tools for Claude Agent SDK integration
- Database tables: `interviews`, `interview_responses` in `squad/wolfpack.db`

### Mission Control Integration
- `mission-control/src-tauri/src/interview.rs` - 5 Tauri commands for interview IPC
- `mission-control/src/components/InterviewIntake.tsx` - Chat-style interview UI
- `mission-control/src/views/IntakeView.tsx` - Mode toggle (Manual/Interview)
- `mission-control/src/types/interview.ts` - TypeScript type definitions

### Design Artifacts
- `artifacts/interview-intake/DESIGN.md` - Full system design document
- `artifacts/interview-intake/eval-spec.md` - 8 eval cases for quality validation

## Architecture Overview

```
User Input -> InterviewIntake.tsx -> Tauri IPC -> interview.rs
           -> Python CLI (subprocess) -> SQLite DB
           -> Interviewer Agent (Claude SDK)
           -> Intake Brief JSON -> Framer Agent -> problem.md
```

## Interview Flow Stages

1. **Problem Discovery** - What problem are you trying to solve?
2. **User Identification** - Who are the users and stakeholders?
3. **Scope Definition** - What's in scope and out of scope?
4. **Constraints** - Technical, budget, timeline constraints?
5. **Success Criteria** - How will success be measured?

Output: `artifacts/{project-slug}/intake-brief.json`
