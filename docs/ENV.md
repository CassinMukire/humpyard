# Environment Variables

| Var | Required? | What | Default |
|---|---|---|---|
| `DATABASE_URL` | **yes (v1)** | Postgres connection string. On Replit this is set automatically. | — |
| `EXA_API_KEY` | yes (for `/api/search/country`) | Exa search API. The scanner UI breaks without it. | — |
| `OPENAI_API_KEY` | yes (for `/api/search/outreach`) | OpenAI. Outreach generation breaks without it. | — |
| `AUTH_USER` | yes (v1, prod) | Basic auth username. Single user in v1. | — |
| `AUTH_PASS` | yes (v1, prod) | Basic auth password. | — |
| `DISABLE_AUTH` | dev only | Set to `"true"` to skip basic auth. NEVER in production. | `"false"` |
| `MONDAY_API_TOKEN` | yes (for monday sync) | monday.com API token. People push is `skipped_no_token` without it. | — |
| `MONDAY_BOARD_PEOPLE_ID` | yes (for monday sync) | Numeric ID of the Monday People board. | `PENDING_BOARD_ID` (placeholder) |
| `SNAPSHOTS_DIR` | no | Where raw source snapshots are cached. Default: `data/snapshots/`. | `data/snapshots` |
| `SNAPSHOT_STORE_URL` | no | TBD — Replit Object Storage vs Cloudflare R2 vs other. v1 uses local FS. | — |
| `NODE_ENV` | no | `production` disables `resetAllStores()`. | `development` |
| `PORT` | no | API server port. | `5000` |

## Dev setup checklist

```bash
# 1. Copy .env.example to .env (or set in Replit secrets)
DATABASE_URL=postgres://...
EXA_API_KEY=...
OPENAI_API_KEY=...
AUTH_USER=cassin
AUTH_PASS=<choose-something-strong>
DISABLE_AUTH=true   # dev only

# 2. Install deps
pnpm install --frozen-lockfile

# 3. Push the schema
pnpm --filter @workspace/db run push

# 4. Run the API
pnpm --filter @workspace/api-server run dev

# 5. Run the frontend
pnpm --filter @workspace/hump-yard-intel run dev

# 6. Run the eval gate (should be 21/21 green)
node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
```

## Prod setup (Replit)

In Replit, set these in **Secrets** (Tools → Secrets). Never commit them.

- `DATABASE_URL` — provisioned Postgres (Replit DB)
- `EXA_API_KEY` — Exa dashboard
- `OPENAI_API_KEY` — OpenAI dashboard
- `AUTH_USER` + `AUTH_PASS` — chosen credentials
- `MONDAY_API_TOKEN` — monday.com API
- `MONDAY_BOARD_PEOPLE_ID` — from the People board URL

DO NOT set `DISABLE_AUTH=true` in production.

## EU/EEA hosting (§12.5)

The Postgres instance must be in an EU/EEA region. Replit Frankfurt works.
Snapshot storage (when wired) must also be in EU/EEA — see gap #4 in
`AGENTS.md`.
