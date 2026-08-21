# Environment Variables

| Var | Required? | What | Default |
|---|---|---|---|
| `DATABASE_URL` | **yes (v1)** | Postgres connection string. `postgres://user:pass@host:5432/db` | — |
| `EXA_API_KEY` | yes (for `/api/search/country`) | Exa search API. The scanner UI breaks without it. | — |
| `OPENAI_API_KEY` | yes (for `/api/search/outreach`) | OpenAI. Outreach generation breaks without it. | — |
| `AUTH_USER` | yes (v1, prod) | Basic auth username. Single user in v1. | — |
| `AUTH_PASS` | yes (v1, prod) | Basic auth password. | — |
| `DISABLE_AUTH` | dev only | Set to `"true"` to skip basic auth. NEVER in production. | `"false"` |
| `MONDAY_API_TOKEN` | yes (for monday sync) | monday.com API token. People push is `skipped_no_token` without it. | — |
| `MONDAY_BOARD_PEOPLE_ID` | yes (for monday sync) | Numeric ID of the Monday People board. | `PENDING_BOARD_ID` (placeholder) |
| `SNAPSHOTS_DIR` | no | Where raw source snapshots are cached. Default: `data/snapshots/`. | `data/snapshots` |
| `SNAPSHOT_STORE_URL` | no | TBD — local FS in v1, swappable to S3/R2/GCS later. | — |
| `PORT` | no | API server port. | `5000` |
| `BASE_PATH` | no | Vite base path for the frontend (e.g. `/decel/` if behind a reverse proxy). | `/` |
| `NODE_ENV` | no | `production` disables `resetAllStores()`. | `development` |

## Dev setup checklist

```bash
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Fill in real values
DATABASE_URL=postgres://decel:devel@localhost:5432/decel
EXA_API_KEY=...
OPENAI_API_KEY=...
AUTH_USER=cassin
AUTH_PASS=<choose-something-strong>
DISABLE_AUTH=true   # dev only

# 3. Install deps
pnpm install --frozen-lockfile

# 4. Push the schema (dev only)
pnpm --filter @workspace/db run push

# 5. Run the API
pnpm --filter @workspace/api-server run dev

# 6. Run the frontend
pnpm --filter @workspace/hump-yard-intel run dev

# 7. Run the eval gate (should be 21/21 green)
node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
```

## Prod setup (Docker)

A minimal `Dockerfile` is the recommended deploy unit. Pseudocode:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts
RUN corepack enable && pnpm install --frozen-lockfile --prod
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/hump-yard-intel run build
EXPOSE 5000
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.mjs"]
```

Behind a reverse proxy (Caddy, nginx, Cloudflare, AWS ALB) that:
- terminates TLS
- routes `/api/*` to the api-server (port 5000)
- routes `/*` to the static frontend bundle (built once at deploy time)

## EU/EEA hosting (§12.5)

The Postgres instance must be in an EU/EEA region. The snapshot storage
(when wired beyond local FS) must also be in EU/EEA. Pick a region before
the W35 cutover. Some good options:

- Hetzner (Falkenstein, Germany) — cheapest
- OVHcloud (Strasbourg, France)
- AWS Frankfurt (`eu-central-1`)
- GCP Belgium (`europe-west1`)
- Azure Netherlands West (`eu-nw-3`)

Avoid US-east for v1 — the Poland dossier contains personal contact data.
