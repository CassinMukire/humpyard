#!/usr/bin/env bash
# =============================================================================
# Hetzner CX22 (Frankfurt) one-shot setup — runs ONCE per host.
#
# Does:
#   1. Installs Docker + Compose plugin if absent
#   2. Installs Caddy (reverse proxy + automatic HTTPS via Let's Encrypt)
#   3. Clones the repo to ~/decel
#   4. Writes a Caddyfile from this script's template
#   5. Prints next steps for the operator (set env, run deploy.sh)
#
# Re-runs are idempotent — safe to run twice.
#
# Usage (on a fresh Hetzner CX22, Ubuntu 24.04 LTS):
#   scp deploy/setup-host.sh root@<host>:~/
#   ssh root@<host>
#   chmod +x setup-host.sh && ./setup-host.sh
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/decel/hump-yard-insight.git"
APP_DIR="$HOME/decel"
HOST_PORT="${HOST_PORT:-443}"
CADDY_DOMAIN="${CADDY_DOMAIN:-decel.example.com}"
CADDY_EMAIL="${CADDY_EMAIL:-ops@example.com}"

log() { echo "[setup-host] $*"; }

# ---- 1. Docker + Compose ----
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$USER" || true
  log "Docker installed. Re-login required for group change to take effect."
fi
docker --version
docker compose version

# ---- 2. Caddy ----
if ! command -v caddy >/dev/null 2>&1; then
  log "Installing Caddy..."
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/deb.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update && sudo apt install -y caddy
fi
caddy version

# ---- 3. Clone the repo ----
if [ ! -d "$APP_DIR" ]; then
  log "Cloning repo to $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
else
  log "$APP_DIR already exists, skipping clone"
fi

# ---- 4. Caddyfile ----
if [ ! -f /etc/caddy/Caddyfile ]; then
  log "Writing Caddyfile..."
  sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$CADDY_DOMAIN {
  encode zstd gzip
  reverse_proxy 127.0.0.1:5000 {
    header_up X-Real-IP {http.request.header.CF-Connecting-IP}
    header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
  }
}
EOF
  sudo systemctl reload caddy
fi

log ""
log "=========================================================="
log "  Hetzner host setup complete."
log "=========================================================="
log ""
log "Next steps (operator runs these manually):"
log "  1. cd $APP_DIR"
log "  2. cp .env.production.example .env"
log "  3. Edit .env:"
log "       - AUTH_PASS_HASH (generate: pnpm --filter @workspace/api-server run hash-password)"
log "       - DATABASE_URL (will be the docker-compose service name)"
log "       - EXA_API_KEY, OPENAI_API_KEY, MONDAY_API_TOKEN, MONDAY_BOARD_PEOPLE_ID, PROXYCURL_API_KEY"
log "  4. Run the deploy: bash deploy.sh"
log "  5. Verify: curl https://$CADDY_DOMAIN/api/v1/system/info -u cassin:<pwd>"
log ""
log "If behind Cloudflare, set DNS to proxied + add firewall rules for the Hetzner IP."
