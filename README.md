# Wolf Pack - Agent Orchestration Template

A reusable template for self-building AI agent teams in Claude Code.

## How It Works

You talk to **Alpha** (the orchestrator). Alpha delegates to specialist agents. When a new skill is needed, the pack recruits its own specialists through the Peter + Scout pipeline.

```
You ──> Alpha ──> Specialist Agents
                  |
                  ├── Peter (creates agents)
                  |     └── Scout (researches skills)
                  |
                  ├── [Auto-created specialists]
                  └── [Auto-created specialists]
```

## Quick Start

1. **Copy this folder** to your new project root
2. **Edit `CLAUDE.md`** — fill in the "Project Context" section at the bottom with your project details
3. **Open in Claude Code** — start a conversation
4. **Talk to Alpha** — describe what you need built

Alpha will:
- Break your request into tasks
- Check if the pack has the right specialists
- If not, trigger Peter + Scout to recruit one
- Delegate the work
- Report back to you with results

## File Structure

```
CLAUDE.md                        <- Forces Alpha persona (edit project context here)
squad/
  PROTOCOL.md                    <- Rules of engagement (don't edit)
  registry.json                  <- Available agents (auto-managed by Peter)
  agents/
    alpha.md                     <- Alpha's operating instructions
    peter.md                     <- Recruitment Lead prompt
    scout.md                     <- Talent Research prompt
    _template.md                 <- Template for new agents (used by Peter)
  inbox/                         <- Agent reports (auto-populated)
  tasks/                         <- Task manifests (managed by Alpha)
  logs/                          <- Session logs (written by Alpha)
```

## What Gets Recorded

- **Every delegation** — logged by Alpha in `squad/logs/`
- **Every piece of work** — reported by agents in `squad/inbox/`
- **Every task** — tracked in `squad/tasks/`
- **Every new agent** — registered in `squad/registry.json`

## Customization

The only file you need to edit is `CLAUDE.md` — specifically the "Project Context" section at the bottom. Everything else is the framework.

If you want to pre-seed the pack with specialists (e.g., you always need a frontend dev), you can:
1. Create their agent file in `squad/agents/`
2. Add them to `squad/registry.json`
3. They'll be available immediately without the Peter + Scout recruitment flow
