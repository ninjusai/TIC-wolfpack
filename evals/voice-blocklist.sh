#!/bin/bash
# Voice & Phrase Blocklist Check - EVL-P2-002
# Verifies that forbidden phrases from Proposal section 12 do not appear
# in built HTML (and, with --strict, source files). Reads phrases from
# evals/voice-blocklist.txt. Matching is case-insensitive with word
# boundaries on either side.
#
# Usage:
#   bash evals/voice-blocklist.sh           # scan _site/**/*.html only
#   bash evals/voice-blocklist.sh --strict  # also scan src/**/*.{njk,md}, src/_data/**/*.json
#
# Exit codes:
#   0 = no hard-block matches found (soft warnings allowed)
#   1 = one or more hard-block matches found
#   2 = configuration / environment error
#
# Inline whitelist (source files only):
#   A comment of the form:
#     <!-- voice-allow: word -->
#   (or {# voice-allow: word #} for Nunjucks) placed on the line directly
#   above a matched line suppresses that single match.
#
# Blocklist file format:
#   - One phrase per line, lowercase.
#   - Lines starting with '#' are comments.
#   - Lines starting with '!' are SOFT-watch terms: reported as WARN, do
#     not fail the build. Inline annotations also suppress these warnings.

set -u

BLOCKLIST="evals/voice-blocklist.txt"
SITE_DIR="_site"
SRC_DIR="src"
STRICT=0

for arg in "$@"; do
  case "$arg" in
    --strict)
      STRICT=1
      ;;
    -h|--help)
      echo "Usage: $0 [--strict]"
      echo "  scans _site/**/*.html for phrases in $BLOCKLIST (case-insensitive,"
      echo "  word-boundary aware)"
      echo "  --strict also scans src/**/*.{njk,md} and src/_data/**/*.json"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Try: $0 --help"
      exit 2
      ;;
  esac
done

if [ ! -f "$BLOCKLIST" ]; then
  echo "ERROR: Blocklist not found at $BLOCKLIST"
  exit 2
fi

if [ ! -d "$SITE_DIR" ]; then
  echo "ERROR: Build directory not found at $SITE_DIR. Run 'npx eleventy' first."
  exit 2
fi

echo "=== Voice & Phrase Blocklist Check (EVL-P2-002) ==="
echo ""

# Read blocklist into HARD and SOFT phrase lists (lowercase).
HARD_PHRASES=()
SOFT_PHRASES=()
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  [ -z "$line" ] && continue
  case "$line" in
    \#*) continue ;;
    !*) SOFT_PHRASES+=("${line:1}") ;;
    *)  HARD_PHRASES+=("$line") ;;
  esac
done < "$BLOCKLIST"

# Helper: escape regex metacharacters in a phrase for grep -E.
escape_re() {
  printf '%s' "$1" | sed -e 's/[.*+?(){}^$|\\/[]/\\&/g'
}

# Build single alternation pattern per severity, with word boundaries.
# Sort phrases longest-first so the longest match wins (grep -oE returns
# the leftmost-longest in the alternation order, so we ensure long phrases
# are listed before their substrings).
sort_desc() {
  local -n arr=$1
  local i j tmp
  for ((i=0; i<${#arr[@]}; i++)); do
    for ((j=i+1; j<${#arr[@]}; j++)); do
      if [ ${#arr[j]} -gt ${#arr[i]} ]; then
        tmp="${arr[i]}"; arr[i]="${arr[j]}"; arr[j]="$tmp"
      fi
    done
  done
}

[ ${#HARD_PHRASES[@]} -gt 0 ] && sort_desc HARD_PHRASES
[ ${#SOFT_PHRASES[@]} -gt 0 ] && sort_desc SOFT_PHRASES

build_alt() {
  local arr=("$@")
  [ ${#arr[@]} -eq 0 ] && return 0
  local parts=()
  local p esc
  for p in "${arr[@]}"; do
    esc=$(escape_re "$p")
    parts+=("$esc")
  done
  local joined
  joined=$(printf '%s|' "${parts[@]}")
  joined="${joined%|}"
  printf '\\b(%s)\\b' "$joined"
}

HARD_RE=$(build_alt "${HARD_PHRASES[@]:-}")
SOFT_RE=$(build_alt "${SOFT_PHRASES[@]:-}")

# Helper: check if an annotation line allows a given phrase.
is_allow_annotation() {
  local annotation="$1"
  local phrase="$2"
  [ -z "$annotation" ] && return 1
  local annot_re
  annot_re="voice-allow:[[:space:]]*$(escape_re "$phrase")"
  if printf '%s' "$annotation" | grep -qiE "$annot_re"; then
    return 0
  fi
  return 1
}

# Scan one tree against one severity regex. Uses grep -rnoEHi to get
# file:line:matched-phrase, then a second grep -rnHEi to recover the
# full line content. Streams pipe-rows to stdout:
#   SEVERITY|file:line|phrase|content
# Args: $1=tree  $2=severity  $3=regex  $4..n=--include globs
scan_tree_one_severity() {
  local tree="$1"
  local severity="$2"
  local regex="$3"
  shift 3
  local includes=("$@")
  [ -z "$regex" ] && return 0

  # Build --include args.
  local inc_args=()
  local inc
  for inc in "${includes[@]}"; do
    inc_args+=( --include="$inc" )
  done

  # First pass: file:line:matched. lowercase the matched phrase via tr.
  local raw_matched
  raw_matched=$(grep -rnoEHi "${inc_args[@]}" "$regex" "$tree" 2>/dev/null \
    | awk -F: 'BEGIN{OFS=":"} { f=$1; ln=$2; $1=""; $2=""; sub(/^::/, ""); print f, ln, tolower($0) }' || true)

  [ -z "$raw_matched" ] && return 0

  # Build a per-file cache of line content so we do not re-read N times.
  # We will emit rows as: SEVERITY|file:line|phrase|content
  # and look up content + previous line with sed -n.
  # For performance: group matches by file, read each file once into awk.
  local current_file=""
  declare -a file_lines=()

  # Sort by file then by line number numerically.
  local sorted
  sorted=$(printf '%s\n' "$raw_matched" | LC_ALL=C sort -t: -k1,1 -k2,2n)

  while IFS=: read -r file ln phrase; do
    [ -z "$file" ] && continue
    if [ "$file" != "$current_file" ]; then
      # Load this file's lines into array.
      current_file="$file"
      mapfile -t file_lines < "$file"
    fi
    local idx=$((ln - 1))
    local content="${file_lines[$idx]:-}"
    local prev_line=""
    if [ "$idx" -gt 0 ]; then
      prev_line="${file_lines[$((idx - 1))]:-}"
    fi

    # Skip lines that ARE allow-annotation comments. The annotation
    # naturally contains the phrase being allowed, which would otherwise
    # be flagged as a violation of itself.
    if printf '%s' "$content" | grep -qiE 'voice-allow:'; then
      continue
    fi
    if is_allow_annotation "$prev_line" "$phrase"; then
      continue
    fi
    # Replace any pipe in content with '?' to keep the separator unambiguous.
    local safe_content="${content//|/?}"
    printf '%s|%s:%s|%s|%s\n' "$severity" "$file" "$ln" "$phrase" "$safe_content"
  done <<< "$sorted"
}

scan_tree_all() {
  local tree="$1"
  shift
  if [ -n "$HARD_RE" ]; then
    scan_tree_one_severity "$tree" "HARD" "$HARD_RE" "$@"
  fi
  if [ -n "$SOFT_RE" ]; then
    scan_tree_one_severity "$tree" "SOFT" "$SOFT_RE" "$@"
  fi
}

echo "--- Scanning $SITE_DIR for hard-block and soft-watch phrases ---"
site_results=$(scan_tree_all "$SITE_DIR" "*.html")
src_results=""
if [ "$STRICT" -eq 1 ]; then
  if [ ! -d "$SRC_DIR" ]; then
    echo "ERROR: Source directory not found at $SRC_DIR."
    exit 2
  fi
  echo "--- Strict mode: scanning $SRC_DIR ---"
  src_results=$(scan_tree_all "$SRC_DIR" "*.njk" "*.md" "*.json")
fi

all_results=$(printf '%s\n%s' "$site_results" "$src_results" | grep -v '^$' || true)

HARD_HITS=0
SOFT_HITS=0
if [ -z "$all_results" ]; then
  echo ""
  echo "=== Summary ==="
  echo "PASS: Zero blocklist matches found."
  exit 0
fi

echo ""
while IFS='|' read -r sev where phrase content; do
  [ -z "$sev" ] && continue
  if [ "$sev" = "HARD" ]; then
    echo "FAIL [$phrase] $where"
    echo "  $content"
    HARD_HITS=$((HARD_HITS + 1))
  else
    echo "WARN [$phrase] $where"
    echo "  $content"
    SOFT_HITS=$((SOFT_HITS + 1))
  fi
done <<< "$all_results"

echo ""
echo "=== Summary ==="
if [ "$HARD_HITS" -eq 0 ]; then
  echo "PASS: Zero hard-block matches found. ($SOFT_HITS soft-watch hit(s) for review.)"
  exit 0
else
  echo "FAIL: $HARD_HITS hard-block match(es) found. ($SOFT_HITS soft-watch hit(s).)"
  echo "Rewrite copy to avoid forbidden phrases. See Proposal section 12."
  exit 1
fi
