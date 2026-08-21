# Architecture

## High-level data flow

```
┌─────────────────┐
│  React (Vite)   │  hump-yard-intel
│  port 8080      │
└────────┬────────┘
         │ /api/v1/* (auth)
         │ /api/* (public, scanner)
         ▼
┌─────────────────┐
│  Express 5 API  │  api-server
│  port 5000      │
│                 │
│  ┌───────────┐  │
│  │ Trust    │  │  ← trust-layer.ts: every fact gated
│  │ Layer    │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │  ← queue-store.ts: Drizzle queries
│  │ Drizzle  │  │
│  │ ORM      │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │ pg
         ▼
┌─────────────────┐
│  PostgreSQL     │  lib/db (any EU/EEA-hosted instance)
└─────────────────┘
```

## Package layout

| Path | What it does |
|---|---|
| `artifacts/api-server/` | Express API. All `/api/*` and `/api/v1/*` routes live here. |
| `artifacts/hump-yard-intel/` | React 19 + Vite frontend. The tool UI. |
| `artifacts/mockup-sandbox/` | Empty playground. Unused in v1. |
| `lib/api-spec/openapi.yaml` | OpenAPI spec — source of truth for existing scanner contracts. |
| `lib/api-zod/src/manual/schemas.ts` | v1 entity Zod schemas (SourcedFact, Market, Yard, Org, Person, Play, etc.). |
| `lib/api-zod/src/generated/` | Orval-generated Zod for the OpenAPI spec (existing scanner endpoints). |
| `lib/api-client-react/` | Orval-generated React Query hooks for the scanner. |
| `lib/db/src/schema/` | Drizzle schema — every table. |
| `lib/integrations-openai-ai-server/` | OpenAI SDK wrapper (used by `/api/search/outreach`). |
| `scripts/eval-gate.ts` | Eval runner — 21/21 green. Blocks deploy on regression. |
| `golden-set/` | Eval fixtures (China junk corpus, Poland OIU vallar). |
| `data/README.md` | Alias table format docs. |
| `docs/` | This folder. API · DB · Architecture · Env · Sprint · Decisions. |
| `AGENTS.md` | Project brief — first thing anyone reads. |

## The trust contract (most important)

Every fact that reaches a user goes through this gate:

```
extraction
   ↓
SourcedFact { value, source_url, retrieved_at, confidence, verified_by }
   ↓
trust-layer gate
   ├─ render  →  UI
   ├─ queue   →  review_queue table (human decides)
   └─ discard →  gone
```

**Hard rules** (lib/trust-layer.ts):
- Empty `source_url` → discard
- `[I]` confidence → queue, never auto-`[V]`
- Text fragments → discard (cannot become Yard entities)
- Watchlist countries' extraction does NOT feed the entity queue in v1
- Rejected facts never re-render from the same source (dedupe on `rejection_hash`)

## v1 routing split

| Path prefix | Auth | Used by |
|---|---|---|
| `/api/healthz` | public | Health probe |
| `/api/search/*` | public (W35 cutover to gated) | Existing scanner (Target Scanner + Global Radar tabs) |
| `/api/v1/*` | basic auth (Cassin only) | New dossier system, battle cards, review queue, monday sync |

The split exists so we can refactor the existing scanner UI into the new
system without breaking the dev loop. W35 the public routes get gated.

## Cache strategy (no runtime LLM in battle mode — §11.4)

Battle mode is the highest-stakes surface — Cassin on the messe floor with
LTE that may or may not work. The <5s briefing-card requirement dies the
day a card waits on an LLM.

So:

1. **Ingestion time**: LLM (gpt-4.1) extracts facts. SourcedFact gate runs.
2. **Curation time**: Cassin authors battle card doctrine.
3. **Bundle time**: CI / cron generates a static HTML+JSON bundle of every
   battle card.
4. **Battle time**: PWA-cached JSON, no LLM call. <5s guarantee.

## Build + dev

```bash
# Install
pnpm install --frozen-lockfile

# Typecheck everything
pnpm run typecheck

# Run the API (port 5000)
pnpm --filter @workspace/api-server run dev

# Run the frontend (port 8080)
pnpm --filter @workspace/hump-yard-intel run dev

# Push DB schema (dev only)
pnpm --filter @workspace/db run push

# Run the eval gate
node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
```

## What v1 is NOT

These are deliberately NOT in this codebase (P2/P3 work):

- Automated signal radar (P2) — no nightly country scans beyond dossier markets
- EPC module (P3)
- Coaching layer (P3)
- 50-year history (P4)
- monday → Engine backflow (P2) — one-way push only
- Autonomous outreach — humans always send
- Multi-user accounts — Cassin only in v1

See `AGENTS.md` for the full non-goals list.
