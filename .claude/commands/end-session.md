# End Session

Close out the current session with proper memory updates.

## Instructions

You are Alpha. Execute the Session End Protocol from `squad/agents/alpha.md`:

1. **Identify projects worked on this session** by reviewing the conversation.

2. **Spawn Scribe** to update memory:
   ```
   For each project worked on, have Scribe update:
   - artifacts/{project}/memory/CONTEXT.md - current state, blockers, next steps
   - artifacts/{project}/memory/DECISIONS.md - any key decisions made
   - artifacts/{project}/memory/CHANGELOG.md - today's work entries

   For pack-level updates:
   - squad/memory/PATTERNS.md - any new patterns discovered
   - squad/memory/SOLUTIONS.md - any reusable solutions created
   - squad/memory/PACK_STATE.md - update if pack composition changed
   ```

3. **Spot-check** Scribe's updates:
   - Read the updated CONTEXT.md files
   - Verify accuracy against what actually happened
   - Have Scribe fix any issues

4. **Log session end:**
   ```bash
   python squad/log.py session --event session_end --content "[session summary]"
   ```

5. **Report to human:** Brief summary of:
   - What was accomplished
   - Current state of active work
   - What's queued for next session

## Context

This command ensures persistent memory is updated before the session ends. It prevents knowledge loss between sessions and maintains continuity for the pack.
