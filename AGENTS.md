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
- Deployment: cloud-agnostic. Runs on any host that supports Node 24 + Postgres (local, Docker, Render, Fly, Railway, ECS, GKE, etc.)

## Where things live

```
artifacts/
├── api-server/          # Express API
│   ├── src/routes/      # search, outreach, dossiers, review-queue, monday-sync
│   ├── src/lib/         # trust-layer, storage, monday-client
│   └── src/middlewares/ # auth (single-user basic), validate (Zod)
├── hump-yard-intel/     # React app
│   ├── src/pages/       # home, review-queue, dossier, battle-card
│   └── src/components/  # ResultCard, KeyContactsPanel, BattleCard
└── mockup-sandbox/      # (unused in v1)

lib/
├── api-spec/openapi.yaml    # source of truth for existing scanner API contracts
├── api-zod/                 # Zod schemas (generated + manual v1 entities)
├── api-client-react/        # React Query hooks (generated)
├── db/                      # Drizzle schema (SourcedFact + entities)
└── integrations-openai-ai-server/

data/
└── aliases.yaml             # curated cross-lingual org name table

golden-set/                  # eval fixtures (CI gate)
├── poland-yards.json        # 5 OIU vallar + 92 PLK contacts
└── china-junk-corpus.json   # regression: 0 entities render

docs/                        # API, DB, architecture, env, sprint, decisions
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

**All 8 signed off 2026-08-22.** Full decisions in [`docs/DECISIONS.md`](./docs/DECISIONS.md#open-contract-gaps).

| # | Gap | Decision (Aug 22) |
|---|---|---|
| 1 | Auth scope | Single-user basic auth (Cassin only). Multi-user in October. |
| 2 | Voice capture | Native voice-memo + manual text log. Whisper is P2. |
| 3 | Global Radar | Gate extraction: tier+summary only for watchlist countries. Full extraction only for Poland + explicitly promoted scans. |
| 4 | Snapshot storage | Local FS in v1 (`data/snapshots/`). S3-compatible bucket in EU/EEA swapped in at staging-deploy time. |
| 5 | Alias table | Builder seeds 5+ canonical orgs. Cassin owns ongoing curation. `data/aliases.yaml`. |
| 6 | monday.com DPA | Hitank chases; Cassin creates the People board. |
| 7 | Meeting-capture | Out for v1. Facts come from corpus + Exa + LinkedIn enrichment, not from Cassin's memory. |
| 8 | OIU corpus | Hitank chases this week — W35 Poland demo depends on it. |

## Cassin's corrections (2026-08-22) — APPLIED

1. **Removed: personalised first messages.** The tool no longer generates cold outreach. Instead, `/api/v1/people/:id/enrich` (LinkedIn) populates each contact's `interests: PersonInterest[]` — role changes, projects, public statements, conference appearances. **The operator writes the message.**
2. **Approved: automated LinkedIn enrichment.** Public-profile data only, via a data-provider API (we picked **Proxycurl** — ~$0.04–0.10/profile). Pluggable via `LinkedInProvider` interface. GDPR Art. 14 duties per §12.5.2 apply.

## Hard cost ceiling (signed off)

**$200/month total** (LLM + hosting + LinkedIn provider). Alert at 80% = $160. See `docs/DECISIONS.md` for the line-item estimate.

## Fair-week support (signed off)

- **Sep 18**: static offline bundle on Cassin's phone.
- **Sep 21**: smoke test on messe/roaming network.
- **Sep 21–25**: builder on-call per agreed response SLA.

## W34 answers (Cassin asked for these in writing)

| # | Question | Answer |
|---|---|---|
| 1 | Stack summary — reuse vs rebuild | Reuse: api-server (search, dossiers, review-queue, battle-cards, monday-sync, linkedin), hump-yard-intel UI, all Drizzle schemas. Rebuild: nothing in W34. Net new: trust-layer, linkedin-provider, review queue, eval harness, golden sets, PWA spike. |
| 2 | LLM choice + cost | **gpt-4.1** ($2.50/M in, $10/M out) for extraction + **gpt-4.1-mini** ($0.40/M in, $1.60/M out) for re-classification. **No LLM in battle mode** (§11.4 — pre-rendered cards only). v1 cost estimate: **$5–15/month** for LLM at weekly scan cadence across 3 dossier markets. Hard cap = $200/month total. |
| 3 | Snapshot + correction storage | Local FS in v1 (`data/snapshots/`, mounted as a named volume in `docker-compose.yml`). Offsite backup is Hitank's job per §12.6. Correction log lives in the `corrections` Postgres table — same DB as the rest, same backup story. |
| 4 | Hosting/security | **Hetzner Cloud CX22, Frankfurt region** (EU/EEA per §12.5). Single-user basic auth in v1 (Cassin only). HTTPS terminated by a Caddy reverse proxy in front. All v1 routes (gated). API tokens server-side via env vars. DB password required at first query, not at import. |
| 5 | LinkedIn enrichment provider | **Proxycurl** (now part of NimbleWay) — public-profile data only, ~$0.04–0.10/profile. Pluggable via `LinkedInProvider` interface so we can swap to Apollo.io / People Data Labs later. Env var: `PROXYCURL_API_KEY`. Without it: clean 402 Payment Required, no crash. Provider name recorded on `import_meta.source_ref` for each fact. GDPR Art. 14 covered by §12.5.2. |

## How to run

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push           # one-time, dev only
pnpm --filter @workspace/api-server run dev    # port 5000
pnpm --filter @workspace/hump-yard-intel run dev   # port 8080
pnpm run typecheck
pnpm run build
```

Required env (see `docs/ENV.md`):

- `DATABASE_URL` — Postgres connection string
- `EXA_API_KEY` — search
- `OPENAI_API_KEY` — outreach + extraction
- `AUTH_USER`, `AUTH_PASS` — basic auth (set both or set `DISABLE_AUTH=true` for dev)
- `MONDAY_API_TOKEN` — monday.com sync

## Pointers

- Spec source of truth: the v1.4 Implementation Spec in the team repo (Cassin owns)
- Demo recordings: TBD
- monday.com: People board (Organizations + Plays in P2)
- Repo: `C:\Users\hitan\Downloads\Hump-Yard-Insight (1)\Hump-Yard-Insight`
- Full docs: `docs/README.md` (entry point)

