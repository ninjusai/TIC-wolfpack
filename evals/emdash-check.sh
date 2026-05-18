#!/bin/bash
# Emdash Eradication Check - EVL-P2-001
# Verifies zero emdash characters (U+2014) in built HTML.
# CONSTRAINTS.md CR-1 enforces this hard rule for ALL rendered content.
#
# Usage:
#   bash evals/emdash-check.sh           # scan _site/**/*.html only
#   bash evals/emdash-check.sh --strict  # also scan src/ (.njk, .md, _data JSON)
#
# Exit codes:
#   0 = no violations
#   1 = one or more violations found
#   2 = configuration / environment error

set -u

# The forbidden character is U+2014. We build it from its UTF-8 byte
# sequence (0xE2 0x80 0x94) via printf, so this script source contains
# zero literal occurrence of the character (per CR-1 and the task spec).
# Using byte escapes works across bash versions and on Cygwin.
EMDASH=$(printf '\xe2\x80\x94')
LABEL='U+2014'

SITE_DIR="_site"
SRC_DIR="src"
STRICT=0
MATCHES=0
FILES_WITH_HITS=0

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --strict)
      STRICT=1
      ;;
    -h|--help)
      echo "Usage: $0 [--strict]"
      echo "  scans _site/**/*.html for the $LABEL character (forbidden by CR-1)"
      echo "  --strict also scans src/**/*.njk, src/**/*.md, src/_data/**/*.json"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Try: $0 --help"
      exit 2
      ;;
  esac
done

if [ ! -d "$SITE_DIR" ]; then
  echo "ERROR: Build directory not found at $SITE_DIR. Run 'npx eleventy' first."
  exit 2
fi

echo "=== Emdash Check (EVL-P2-001) ==="
echo "Forbidden character: $LABEL"
echo "Scanning $SITE_DIR for $LABEL ..."
echo ""

# Step 1: scan built HTML.
# grep -rn prints file:line:content. We capture and count.
html_hits=$(grep -rn --include="*.html" -F "$EMDASH" "$SITE_DIR" 2>/dev/null || true)

if [ -n "$html_hits" ]; then
  hit_count=$(printf '%s\n' "$html_hits" | wc -l)
  file_count=$(printf '%s\n' "$html_hits" | cut -d: -f1 | sort -u | wc -l)
  echo "FAIL: Found $LABEL in built HTML:"
  printf '%s\n' "$html_hits" | while IFS= read -r line; do
    echo "  $line"
  done
  echo ""
  MATCHES=$((MATCHES + hit_count))
  FILES_WITH_HITS=$((FILES_WITH_HITS + file_count))
fi

# Step 2: optional source-level scan.
if [ "$STRICT" -eq 1 ]; then
  echo "--- Strict mode: scanning $SRC_DIR ---"
  if [ ! -d "$SRC_DIR" ]; then
    echo "ERROR: Source directory not found at $SRC_DIR."
    exit 2
  fi

  src_hits=$(grep -rn \
    --include="*.njk" \
    --include="*.md" \
    -F "$EMDASH" "$SRC_DIR" 2>/dev/null || true)

  # _data JSON scan (separate so we can filter to that subtree only)
  data_hits=""
  if [ -d "$SRC_DIR/_data" ]; then
    data_hits=$(grep -rn --include="*.json" -F "$EMDASH" "$SRC_DIR/_data" 2>/dev/null || true)
  fi

  combined_src=""
  if [ -n "$src_hits" ]; then combined_src="$src_hits"; fi
  if [ -n "$data_hits" ]; then
    if [ -n "$combined_src" ]; then
      combined_src=$(printf '%s\n%s' "$combined_src" "$data_hits")
    else
      combined_src="$data_hits"
    fi
  fi

  if [ -n "$combined_src" ]; then
    src_count=$(printf '%s\n' "$combined_src" | wc -l)
    src_file_count=$(printf '%s\n' "$combined_src" | cut -d: -f1 | sort -u | wc -l)
    echo "FAIL: Found $LABEL in source files:"
    printf '%s\n' "$combined_src" | while IFS= read -r line; do
      echo "  $line"
    done
    echo ""
    MATCHES=$((MATCHES + src_count))
    FILES_WITH_HITS=$((FILES_WITH_HITS + src_file_count))
  fi
fi

echo "=== Summary ==="
if [ "$MATCHES" -eq 0 ]; then
  echo "PASS: Zero $LABEL occurrences found."
  exit 0
else
  echo "FAIL: $MATCHES $LABEL occurrence(s) across $FILES_WITH_HITS file(s)."
  echo "Replace with hyphen, comma, colon, semicolon, or sentence break."
  exit 1
fi
