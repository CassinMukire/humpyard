# DECEL Intelligence Platform

> Sales-intelligence tool for DECEL (Swedish railway deceleration systems). Built on top of the existing Hump Yard Intel scanner. Ready for **InnoTrans Berlin, Sep 22–25, 2026**. Code freeze **Fri Sep 18, 2026**.

## What this is

A briefing machine an operator (Cassin) can bet a meeting on. Every fact on screen is sourced and confidence-tagged. Deep dossiers for **Poland** in v1. Germany and the Middle Corridor (Kazakhstan + Uzbekistan) ship as hand-curated "watchlist+" — automated depth comes in October.

## The one metric

**Procurements where DECEL is written into the spec before tendering.** V1 proxy: Cassin walks into every InnoTrans meeting knowing more about the buyer than the buyer knows about him.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend: Vite + React 19 (`artifacts/hump-yard-intel`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- API contracts: OpenAPI + orval → Zod + React Query hooks
- LLM: OpenAI (gpt-4.1 for extraction, gpt-4.1-mini for re-classification, no LLM in battle mode)

## Where things live

```
artifacts/
├── api-server/          # Express API
│   ├── src/routes/      # search, outreach, dossiers, review-queue, monday-sync
│   ├── src/lib/         # trust-layer, storage, monday-client
│   └── src/middlewares/ # auth (single-user basic)
├── hump-yard-intel/     # React app
│   ├── src/pages/       # home, review-queue, dossier, battle-card
│   └── src/components/  # ResultCard, KeyContactsPanel, BattleCard
└── mockup-sandbox/      # (unused in v1)

lib/
├── api-spec/openapi.yaml    # source of truth for all API contracts
├── api-zod/                 # Zod schemas (generated + manual)
├── api-client-react/        # React Query hooks (generated)
├── db/                      # Drizzle schema (SourcedFact + entities)
└── integrations-openai-ai-server/

data/
└── aliases.yaml             # curated cross-lingual org name table

golden-set/                  # eval fixtures (CI gate)
├── poland-yards.json        # 5 OIU vallar + 92 PLK contacts
└── china-junk-corpus.json   # regression: 0 entities render
```

## The trust contract (no exceptions)

Every fact a user sees carries a **SourcedFact envelope**:

```ts
{ value, source_url, retrieved_at, confidence: "V"|"O"|"I", verified_by: ... }
```

- **[V]** = primary source (operator domain, tender portal, signed doc) OR ≥2 independent non-primary sources OR human confirmation.
- **[O]** = single secondary source (press, aggregator).
- **[I]** = model inference — always labeled with inputs.

A fact with no resolvable source **cannot render** in a dossier. Hard rule.

## Sprint plan (W34–W38)

| Week | Deliverable | Demo proof |
|---|---|---|
| W34 (Aug 17–23) | Trust layer + schemas + review queue + golden sets + auth/HTTPS + 2 spikes | Junk corpus → 0 entities render; spike results in writing |
| W35 (Aug 24–30) | Poland dossier v1 (evals green) + monday People push live + retention/deletion | Poland page vs golden set; person pushed to monday with source |
| W36 (Aug 31–Sep 6) | Battle mode + PWA cache + alias table + watchlist+ blocks DE/Middle Corridor | Phone demo: org → card <5s, airplane mode |
| W37 (Sep 7–13) | Remaining cards + static offline bundle + monitoring + hardening | Full dry run + bundle on phone |
| W38 (Sep 14–18) | Bug fixes only. Freeze Sep 18. | §DoD passes |
| Fair week | Sep 21 smoke test, Sep 22–25 on-call | — |

**Slip rule**: if core cannot make Sep 18, we say so on **Sep 8**. Not later.

## Scope cut order (if W36 slips)

1. US-4.3 meeting capture → manual notes
2. monday push → CSV export (same columns)
3. Middle Corridor → watchlist+ (hand-curated only)
4. Germany → watchlist+
5. map view → table only

**Never cut**: data-trust layer, Poland dossier, pre-rendered battle cards, security baseline.

## What we're NOT building in v1

- Signal radar (P2) — no automated country scans beyond dossier markets
- EPC module (P3)
- Coaching layer (P3)
- 50-year history (P4)
- monday → Engine backflow (P2) — one-way push only
- Autonomous outreach — humans always send
- Multi-user accounts — Cassin only in v1

## Open contract gaps (need owner)

| # | Gap | Owner |
|---|---|---|
| 1 | Auth scope = single-user (Cassin only) for v1? | Cassin |
| 2 | Voice capture: native voice-memo + manual attach (my pick) vs server Whisper | Cassin |
| 3 | Global Radar: disable v1, or gate extraction? | Builder + Cassin |
| 4 | Snapshot storage choice (Replit Object Storage? R2?) + EU/EEA jurisdiction | Cassin + Builder |
| 5 | Alias table owner + file location | Cassin |
| 6 | monday.com DPA signed, workspace perms, boards provisioned | Hitank + Cassin |
| 7 | Meeting-capture in or out scope | Cassin |
| 8 | OIU corpus files (Z1.2/Z1.4/Z3/Z5/Z10/Z11/Z12 + Business Sweden mapping + beslutsunderlag + Konkurrentkarta + SunTzu + Säljramverk) into repo | **Hitank — chase this week** |

## How to run

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run dev   # port 5000
pnpm --filter @workspace/hump-yard-intel run dev  # port 8080
pnpm run typecheck
pnpm run build
```

Required env:

- `EXA_API_KEY` — search
- `OPENAI_API_KEY` — outreach + extraction
- `AUTH_USER`, `AUTH_PASS` — basic auth (set both or set `DISABLE_AUTH=true` for dev)
- `MONDAY_API_TOKEN` — monday.com sync
- `SNAPSHOT_STORE_URL` etc. — TBD per gap #4

## Pointers

- Spec source of truth: the v1.4 Implementation Spec in the team repo (Cassin owns)
- Demo recordings: TBD
- monday.com: People board (Organizations + Plays in P2)
- Repo: `C:\Users\hitan\Downloads\Hump-Yard-Insight (1)\Hump-Yard-Insight`
