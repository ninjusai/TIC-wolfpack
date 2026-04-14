#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Bookingtimes Content Emulator — Deployment Script
# =============================================================================
# Deploys the SvelteKit app to Cloudflare Pages and runs D1 migrations.
#
# Usage:
#   ./scripts/deploy.sh
#
# Prerequisites:
#   - wrangler CLI installed and authenticated (`wrangler login`)
#   - D1 database created on Cloudflare (`bookingtimes-emulator-db`)
#   - R2 bucket created (`bookingtimes-emulator-storage`)
#   - KV namespace created (`bookingtimes-emulator-cache`)
#   - Update wrangler.toml with real database_id and KV id before deploying
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "========================================="
echo "  Bookingtimes Content Emulator Deploy"
echo "========================================="
echo ""

# Step 1: Install dependencies (if needed)
echo "[1/4] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  -> Installing dependencies..."
  npm install
else
  echo "  -> node_modules found, skipping install."
fi
echo ""

# Step 2: Build the SvelteKit application
# This compiles the app using @sveltejs/adapter-cloudflare,
# producing output in .svelte-kit/cloudflare/ which is the
# pages_build_output_dir configured in wrangler.toml.
echo "[2/4] Building SvelteKit app..."
npm run build
echo "  -> Build complete."
echo ""

# Step 3: Apply D1 migrations to production
# Runs all pending migrations against the remote D1 database.
# Migrations are in the migrations/ directory and applied in order.
echo "[3/4] Applying D1 migrations to production..."
npx wrangler d1 migrations apply BCE_DB --remote
echo "  -> Migrations applied."
echo ""

# Step 4: Deploy to Cloudflare Pages
# Uses wrangler pages deploy to push the built output.
# The project name matches the name in wrangler.toml.
echo "[4/4] Deploying to Cloudflare Pages..."
npx wrangler pages deploy .svelte-kit/cloudflare --project-name bookingtimes-emulator
echo ""

echo "========================================="
echo "  Deployment complete!"
echo "========================================="
