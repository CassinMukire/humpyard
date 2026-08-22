# Environment Variables

## The one-line dev path

```bash
cp .env.example .env   # fill in the values
docker compose up      # builds the image, starts Postgres + the app
# Open http://localhost:8080
```

That's it. The Dockerfile is multi-stage (deps → builder → runner).
The compose file wires up Postgres + the api-server. The api-server
serves both the API at `/api/*` and the built frontend at `/*`.

## All env vars

| Var | Required? | What | Default |
|---|---|---|---|
| `DATABASE_URL` | **yes (v1)** | Postgres connection string. The api-server's lazy DB client throws on first query if not set. | — |
| `EXA_API_KEY` | yes (for `/api/search/country`) | Exa search API. The scanner UI breaks without it. | — |
| `OPENAI_API_KEY` | yes (for `/api/search/outreach`) | OpenAI. Outreach generation breaks without it. | — |
| `AUTH_USER` | yes (v1, prod) | Basic auth username. Single user in v1. | — |
| `AUTH_PASS` | yes (v1, prod) | Basic auth password. | — |
| `DISABLE_AUTH` | dev only | Set to `"true"` to skip basic auth. NEVER in production. | `"false"` |
| `MONDAY_API_TOKEN` | yes (for monday sync) | monday.com API token. People push is `skipped_no_token` without it. | — |
| `MONDAY_BOARD_PEOPLE_ID` | yes (for monday sync) | Numeric ID of the Monday People board. | `PENDING_BOARD_ID` |
| `SNAPSHOTS_DIR` | no | Where raw source snapshots are cached. | `data/snapshots` |
| `SNAPSHOT_STORE_URL` | no | TBD — local FS in v1, swappable to S3/R2/GCS later. | — |
| `PORT` | no | API server port. | `5000` |
| `BASE_PATH` | no | Vite base path for the frontend. | `/` |
| `FRONTEND_DIST` | no | Override the frontend static-files location. The api-server auto-discovers it if not set. | auto |
| `HOST_PORT` | no (compose) | The host port mapped to the api-server's internal 5000. | `8080` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes (compose) | Postgres credentials. | `decel` / `decel` / `decel` |
| `POSTGRES_PORT` | no (compose) | The host port mapped to Postgres's internal 5432. | `5432` |
| `NODE_ENV` | no | `production` disables `resetAllStores()`. | `development` |

## Local dev WITHOUT Docker (advanced)

```bash
# 1. Start a local Postgres (any way you like — docker, brew, system pkg)
docker run -d --name decel-pg -p 5432:5432 \
  -e POSTGRES_USER=decel -e POSTGRES_PASSWORD=decel -e POSTGRES_DB=decel \
  postgres:16-alpine

# 2. Install + push schema
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push

# 3. Run the api + frontend in two terminals
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/hump-yard-intel run dev
```

In this mode the api-server runs on port 5000 and the Vite dev server runs
on 8080. The api-server's auto-discovery of the frontend dist won't find
anything in dev (the dist isn't built), so you'll use the Vite dev server
in the browser at `http://localhost:8080` and the Vite proxy forwards
`/api/*` to the api-server.

## Prod deploy (Docker on a VPS)

The recommended v1 prod target: Hetzner Cloud CX22 (Frankfurt, EU/EEA),
~€4/month. Steps:

```bash
# On the server
git clone <repo>
cd Hump-Yard-Insight
cp .env.example .env
nano .env   # fill in real EXA_API_KEY, OPENAI_API_KEY, AUTH_PASS, MONDAY_*

docker compose up -d

# Behind a Caddy reverse proxy for TLS:
# /etc/caddy/Caddyfile:
#   decel.example.com {
#     reverse_proxy localhost:8080
#   }
```

The Postgres volume (`decel-db-data`) and snapshots volume
(`decel-snapshots`) persist across container restarts. Back up both
offsite (§12.6 — Cassin owns this).

## EU/EEA hosting (§12.5)

The Postgres instance must be in an EU/EEA region. The snapshot storage
(when wired beyond local FS) must also be in EU/EEA. Some good options:

- **Hetzner Cloud** (Falkenstein, Germany) — cheapest
- **OVHcloud** (Strasbourg, France)
- **AWS Frankfurt** (`eu-central-1`)
- **GCP Belgium** (`europe-west1`)
- **Azure Netherlands West** (`eu-nw-3`)

Avoid US-east for v1 — the Poland dossier contains personal contact data.

## A note on secrets

`.env` is gitignored. Never commit it. The compose file reads it via the
`environment:` block which interpolates `${VAR}` from the host shell's env
when `docker compose up` runs.

For prod, use the host's secret manager (Hetzner Volumes, AWS SSM, GCP
Secret Manager, etc.) and inject env vars via your container orchestrator
or systemd unit. Do NOT bake secrets into the image.
