#!/bin/bash
# Alpha Edit Guard — counts direct edits to peakprotocol/ source files
# Warns after 2 edits that Alpha should delegate instead

COUNTER_FILE="/tmp/alpha-edit-counter"
INPUT=$(cat)

# Extract file path from the Edit tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# Only count edits to peakprotocol source files (not config, not .claude, not squad)
if echo "$FILE_PATH" | grep -q "peakprotocol/packages/"; then
  # Increment counter
  COUNT=0
  if [ -f "$COUNTER_FILE" ]; then
    COUNT=$(cat "$COUNTER_FILE")
  fi
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$COUNTER_FILE"

  if [ "$COUNT" -ge 2 ]; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":\"PROTOCOL VIOLATION: Alpha has made $COUNT direct edits to peakprotocol source files this session. The Two-Strike Debugging Rule requires you to STOP editing and DELEGATE to a specialist (Forge, Pixel, or Cloud). Spawn an agent NOW with full context of what you were trying to do.\"}}"
    exit 0
  fi
fi

echo "{}"
