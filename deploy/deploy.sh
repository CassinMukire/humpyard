#!/usr/bin/env bash
# =============================================================================
# deploy.sh — deploy the DECEL app on a Hetzner CX22 (or any Docker host)
#
# Run as the `decel` user, in the project root (~/decel/).
# What it does:
#   1. Make sure .env exists (copy from .env.example if missing)
#   2. Build + start the containers (docker compose up -d --build)
#   3. Wait for the app to come up (curl /api/healthz)
#   4. Tail the logs (last 30 lines) for a sanity check
#
# Idempotent: safe to run again after code changes. docker compose up will
# rebuild only what changed.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# 1. .env
if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
  echo "ERROR: no .env in $PROJECT_ROOT" >&2
  echo "  cp .env.example .env  # then fill in the values" >&2
  exit 1
fi

# 2. Build + start
echo "=== docker compose up -d --build ==="
docker compose up -d --build

# 3. Wait for healthz (up to 90s)
echo "=== waiting for /api/healthz ==="
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:5000/api/healthz >/dev/null; then
    echo "  ✓ healthy after ${i} attempts"
    break
  fi
  sleep 3
done

# 4. Sanity check
echo
echo "=== api-server status ==="
curl -s http://127.0.0.1:5000/api/healthz || echo "(unhealthy — check logs)"
echo
echo
echo "=== last 30 lines of app logs ==="
docker compose logs --tail=30 app
