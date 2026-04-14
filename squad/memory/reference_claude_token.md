---
name: Claude Auth Token Location
description: Dedicated Claude OAuth token for internal projects stored at squad/claude_token.md
type: reference
---

Dedicated Claude OAuth token (from `claude setup-token`) is stored at `squad/claude_token.md` in the project_development repo.

**How to use:** Set as `ANTHROPIC_AUTH_TOKEN` env var when running internal projects. This gives the app its own rate limit bucket, separate from Claude Code CLI.

**Location:** `C:\Users\zzz\Documents\GitHub\project_development\squad\claude_token.md`
