#!/bin/bash
# ASQA Compliance Check — SC-2
# Verifies zero VET/training language in built HTML

BLOCKLIST="evals/compliance-blocklist.txt"
SITE_DIR="_site"
MATCHES=0

if [ ! -f "$BLOCKLIST" ]; then
  echo "ERROR: Blocklist not found at $BLOCKLIST"
  exit 1
fi

if [ ! -d "$SITE_DIR" ]; then
  echo "ERROR: Build directory not found at $SITE_DIR. Run 'npx eleventy' first."
  exit 1
fi

echo "=== ASQA Compliance Check ==="
echo "Scanning $SITE_DIR for blocked terms..."
echo ""

while IFS= read -r pattern || [ -n "$pattern" ]; do
  # Skip empty lines and comments
  [[ -z "$pattern" || "$pattern" =~ ^# ]] && continue

  # Search for pattern (case-insensitive) in all HTML files
  results=$(grep -r -E -i -n "$pattern" "$SITE_DIR" --include="*.html" 2>/dev/null)

  if [ -n "$results" ]; then
    echo "FAIL: Found '$pattern':"
    echo "$results" | while read -r line; do
      echo "  $line"
    done
    echo ""
    MATCHES=$((MATCHES + $(echo "$results" | wc -l)))
  fi
done < "$BLOCKLIST"

echo "=== Summary ==="
if [ "$MATCHES" -eq 0 ]; then
  echo "PASS: Zero blocked terms found. Site is ASQA-compliant."
  exit 0
else
  echo "FAIL: $MATCHES blocked term occurrences found."
  echo "Fix all matches before deploying."
  exit 1
fi
