# DECEL Intelligence Platform

A sales-intelligence tool for DECEL (Swedish railway deceleration systems).
The full product brief is in [AGENTS.md](./AGENTS.md). The reference docs
are in [docs/](./docs/README.md).

## TL;DR

| What | Where | Doc |
|---|---|---|
| API endpoints | `artifacts/api-server/src/routes/v1/` | [docs/API.md](./docs/API.md) |
| Database tables | `lib/db/src/schema/` | [docs/DATABASE.md](./docs/DATABASE.md) |
| Architecture overview | — | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Environment variables | `.env.example` | [docs/ENV.md](./docs/ENV.md) |
| Sprint plan + open gaps | — | [docs/SPRINT.md](./docs/SPRINT.md) · [docs/DECISIONS.md](./docs/DECISIONS.md) |

## Quick start

```bash
# 1. Install
pnpm install --frozen-lockfile

# 2. Set up env
cp .env.example .env
# fill in DATABASE_URL, EXA_API_KEY, OPENAI_API_KEY, etc.

# 3. Push the DB schema (one-time, dev only)
pnpm --filter @workspace/db run push

# 4. Run the API + frontend in two terminals
pnpm --filter @workspace/api-server run dev        # port 5000
pnpm --filter @workspace/hump-yard-intel run dev   # port 8080

# 5. Run the eval gate (21/21 green)
node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
```

## What this is (one paragraph)

A briefing machine an operator can bet a meeting on. Every fact is sourced
and confidence-tagged ([V]erified, [O]bserved, [I]nferred). Deep dossiers
for **Poland** in v1. Germany + Kazakhstan + Uzbekistan ship as hand-curated
"watchlist+" — automated depth comes in October.

## Deadline

- Code freeze: **Fri Sep 18, 2026**
- InnoTrans Berlin: **Sep 22–25, 2026**
- Slip call: **Sep 8** (the date we say "we can't make it" if we can't)

## Tech

- pnpm workspaces · Node 24 · TypeScript 5.9
- Express 5 + Drizzle/Postgres
- Vite + React 19
- OpenAI (gpt-4.1 for extraction, gpt-4.1-mini for re-classification)
- No LLM in battle mode — battle cards are pre-rendered + PWA-cached

## Deployment

Cloud-agnostic. Runs on any host that supports Node 24 + Postgres. A
Dockerfile-based deploy is recommended (see [docs/ENV.md](./docs/ENV.md)
for the outline). The Postgres instance must be in an EU/EEA region per
GDPR §12.5.

## License

Internal — DECEL / Avora Agency.
