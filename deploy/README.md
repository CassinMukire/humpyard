# DECEL Intelligence Platform — production deploy

**One command from a fresh Hetzner CX22 to a live, https-served, Postgres-backed
api-server.** Re-deploys are equally one command.

## TL;DR

```bash
# Once, on a fresh Hetzner CX22 (Ubuntu 24.04, Frankfurt region):
scp deploy/setup-host.sh root@<host>:~/
ssh root@<host>
chmod +x setup-host.sh && ./setup-host.sh

# Then in ~/decel on the host:
cp .env.production.example .env
# ... edit .env (DATABASE_URL, AUTH_PASS_HASH, integration keys) ...
bash deploy.sh
```

The host is now serving `https://<your-domain>/` with the v1 baseline seeded
into Postgres, the api-server listening on :5000 behind Caddy, and Let's
Encrypt TLS auto-renewed.

## What lives here

| File | Purpose |
|------|---------|
| `setup-host.sh` | One-shot host bootstrap: installs Docker + Caddy, clones the repo, writes a Caddyfile, prints next steps. |
| `deploy.sh` | Per-release: pulls code, builds, applies schema, seeds (idempotent), restarts the api-server, health-checks. |
| `Caddyfile` | Reverse proxy with automatic HTTPS + Caddy-managed Let's Encrypt. Streams real client IPs from Cloudflare's `CF-Connecting-IP` header. |
| `README.md` | This file. |

## Architecture

```
Internet ─── HTTPS (Caddy :443) ───> Caddy ───> api-server (:5000, localhost-only)
                                                       │
                                                       ├── Postgres (:5432, localhost-only)
                                                       └── Snapshots to data/ (mounted volume)
```

Both the api-server and Postgres run in Docker. Caddy runs on the host (so it
can bind :443 and :80 directly without Docker-in-Docker complications).

## Why Caddy on the host instead of in Docker

- It needs to bind :80 and :443 to acquire Let's Encrypt certs. Running it
  outside Docker avoids the CAP_NET_BIND_SERVICE dance.
- Caddy auto-renews TLS with no operator action.
- It streams real client IPs (via CF-Connecting-IP) which the api-server
  needs for spam forensics.

## What is on the operator's desk after `setup-host.sh`

The script deliberately does NOT auto-create `.env`. Reason: secrets should
not live in shell history. After the script finishes, the operator:

1. `cd ~/decel`
2. `cp .env.production.example .env`
3. Edit `.env`:
   - `AUTH_PASS_HASH` — generate with `pnpm --filter @workspace/api-server run hash-password "your-password"`
   - `DATABASE_URL` — leave as `postgres://decel:decel@db:5432/decel` if using the bundled compose, OR set your managed Postgres URL
   - `EXA_API_KEY`, `OPENAI_API_KEY`, `MONDAY_API_TOKEN`, `MONDAY_BOARD_PEOPLE_ID`, `PROXYCURL_API_KEY`
4. `bash deploy.sh`

## Health check

```bash
curl -u cassin https://<your-domain>/api/v1/system/info | jq
```

Expected output:
```json
{
  "in_memory_store": false,
  "auth_disabled": false,
  "monday_configured": true,
  "node_env": "production",
  ...
}
```

If `in_memory_store: true` or `node_env != "production"`, the deploy is
broken — stop and check the logs: `docker logs decel-app`.

## Rolling back

```bash
cd ~/decel
git checkout v1.0  # or any prior tag
bash deploy.sh
```

## GDPR + EU/EEA

- Hetzner Frankfurt region (FSN1) — EU/EEA.
- Postgres TZ is `Europe/Stockholm` (operator's timezone).
- All v1 routes gated by single-user basic auth; no anonymous endpoints
  expose PII.
- Snapshot data (PII under §12.5) lives on a local named volume. Offsite
  backup is the operator's responsibility per §12.6.
