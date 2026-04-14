#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Bookingtimes Content Emulator — Migration Runner
# =============================================================================
# Applies D1 database migrations.
#
# Usage:
#   ./scripts/migrate.sh           # Apply migrations locally (dev)
#   ./scripts/migrate.sh --remote  # Apply migrations to production
#
# Migrations are stored in the migrations/ directory and applied in order
# by wrangler's built-in migration system.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Default to local mode
TARGET="--local"
TARGET_LABEL="local"

# Parse flags
for arg in "$@"; do
  case $arg in
    --remote)
      TARGET="--remote"
      TARGET_LABEL="remote (production)"
      ;;
    --help|-h)
      echo "Usage: ./scripts/migrate.sh [--remote]"
      echo ""
      echo "  --remote    Apply migrations to the production D1 database"
      echo "  (default)   Apply migrations to the local D1 database"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./scripts/migrate.sh [--remote]"
      exit 1
      ;;
  esac
done

echo "========================================="
echo "  D1 Migration Runner"
echo "  Target: $TARGET_LABEL"
echo "========================================="
echo ""

# List current migration status
echo "Migration files:"
ls -1 migrations/*.sql 2>/dev/null || echo "  (no migration files found)"
echo ""

# Apply all pending migrations
echo "Applying migrations ($TARGET_LABEL)..."
npx wrangler d1 migrations apply BCE_DB $TARGET
echo ""

echo "========================================="
echo "  Migrations complete!"
echo "========================================="
