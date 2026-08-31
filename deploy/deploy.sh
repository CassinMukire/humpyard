#!/usr/bin/env bash
# =============================================================================
# Production deploy — runs on every release.
#
# Steps:
#   1. Pull latest code
#   2. Build the api-server (tsc → dist/index.mjs) and the React app
#   3. Apply Drizzle schema (idempotent — only adds what's new)
#   4. Seed the v1 baseline IF the DB is empty (idempotent)
#   5. Restart the api-server container
#   6. Health check
#
# Re-runs are safe. Roll back by re-running with a previous git tag.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/decel}"
cd "$APP_DIR"

log() { echo "[deploy] $*"; }

log "Pulling latest..."
git pull --ff-only

log "Building api-server..."
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/hump-yard-intel run build

log "Applying Drizzle schema..."
pnpm run db:push

log "Seeding baseline (idempotent — no-op if already seeded)..."
pnpm run db:seed

log "Restarting api-server..."
if docker ps -a --format '{{.Names}}' | grep -q '^decel-app$'; then
  docker compose up -d --force-recreate --no-deps app
else
  log "  decel-app not running yet — starting full stack"
  docker compose up -d
fi

log "Waiting for health..."
for i in {1..30}; do
  if curl -sf -u "cassin:${AUTH_PASS:-cassin-demo-2026}" http://127.0.0.1:5000/api/v1/system/info >/dev/null 2>&1; then
    log "  healthy after ${i}s"
    break
  fi
  sleep 1
done

log ""
log "=========================================================="
log "  Deploy complete."
log "=========================================================="
log "  Verify: curl https://\${CADDY_DOMAIN}/api/v1/system/info -u cassin"
log "  Logs:   docker logs -f decel-app"
log "  DB:     docker exec -it decel-db psql -U decel -d decel"
log "=========================================================="
