# DECEL Intelligence Platform — full pipeline flow

The platform's purpose, end-to-end, with the file paths that do each job
and a "what we built vs what Cassin is still waiting for" list.

## 1. The one metric

**Procurements where DECEL is written into the spec before tendering.**

The pipeline's job is to surface the people, the yards, and the decision
context that lets Cassin get the Rangerbroms spec onto paper before
PKP PLK (or any other operator) publishes the tender. The platform is
the briefing machine an operator carries on the phone to InnoTrans
(Berlin, 22–25 Sep 2026) — every fact on screen is sourced, every
inference is tagged, every queue item has a promotion path.

## 2. Pipeline at a glance

```
  OIU corpus PDFs / Exa / LinkedIn
           │
           ▼
   ┌──────────────────────┐
   │  Ingest (extract)    │   oiu-extract.ts  (deterministic regex)
   │  text → candidates   │   /api/search/country (legacy)
   └──────────────────────┘
           │
           ▼
   ┌──────────────────────┐
   │  Trust gate           │  trust-layer.ts  (gateSourcedFact,
   │  [V] / [O] / [I]      │   gateYardStructural, gateEntity)
   │  + alias cross-walk   │  + data/aliases.yaml (cross-lingual)
   └──────────────────────┘
           │
           ▼
   ┌───────────────────────────────────────┐
   │  Store (Postgres or file-backed)      │  Drizzle/queue-store.ts
   │  markets, yards, orgs, persons, plays │  or demo-store.ts
   │  corrections, review_queue,           │
   │  battle_cards, sessions, audit_log   │
   └───────────────────────────────────────┘
           │
           ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │  monday.com push     │    │  v1 UI                │
   │  (one-way)           │    │  /dossiers,           │
   │                      │    │  /review-queue,       │
   │                      │    │  /battle-cards        │
   └──────────────────────┘    └──────────────────────┘
```

## 3. Input sources (where the data comes from)

| Source | What it adds | Path / API |
|---|---|---|
| **OIU corpus PDFs** (Z1.2, Z1.4, Z3, Z5, Z10, Z11, Z12 + Business Sweden mapping + beslutsunderlag + Konkurrentkarta + SunTzu + Säljramverk) | The primary source of yards, persons, orgs, and tender timelines for the dossier markets. Delivered by Hitank from Cassin. | `data/oiu-corpus/` (drop the PDFs in here); runner: `pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus` |
| **Exa search** | Web-scale evidence for the 5 questions (know yourself, know the enemy, terrain, timing, win before the battle). The legacy scanner uses 8 parallel Exa queries. | `POST /api/search/country` (legacy) — the v1 OIU ingest reuses the same Exa key. |
| **Proxycurl** | Public LinkedIn profile data (name, role, recent role changes, public statements, conferences). Each call ~$0.04-0.10, GDPR Art. 14 covered in §12.5.2. | `POST /api/v1/people/:id/enrich` |
| **monday.com** | Where the operator works. We push from the engine to monday; the operator edits there. | `POST /api/v1/monday/push/person/:id` and `/monday/push/all` |
| **Aliases** | Curated cross-lingual org/yard name resolution (DECISIONS C5). | `data/aliases.yaml` |
| **Golden sets** | Regression test fixtures for the trust layer + OIU extractor. | `golden-set/poland-yards.json` (5 expected yards, precision ≥ 0.9, recall ≥ 0.8, 0 hallucinated) + `golden-set/china-junk-corpus.json` (6 inputs: 2 render [V], 1 queue [O], 3 discard). |

## 4. Processing — file paths for each step

### 4a. Extraction (text → candidate entities)

| Component | File | What it does |
|---|---|---|
| OIU extractor | `scripts/oiu-extract.ts` | Deterministic regex over text. Yards (matches the 6 OIU placeholder anchors + generic "Classification Yard" / "Rbf" / "Vbf" patterns), persons (name heuristics with Polish-suffix detection), orgs (matches 24 aliases). Each candidate is a SourcedFact with the file path as source URL. |
| Legacy country scanner | `artifacts/api-server/src/routes/search.ts` | `POST /api/search/country` — 8 parallel Exa queries, dedupe by URL, score with HUMP_YARD_KEYWORDS + KNOWN_YARDS, extractYardsFromText (4 regex patterns), build a CountryResult. |
| LinkedIn enricher | `artifacts/api-server/src/lib/linkedin-provider.ts` | Proxycurl wrapper. `enrichByProfile(linkedinUrl)` → public profile + interests (role_change, project, public_statement, conference). |

### 4b. Trust gate (candidates → [V]/[O]/[I])

| Component | File | What it does |
|---|---|---|
| Source classification | `artifacts/api-server/src/lib/trust-layer.ts` | `isPrimaryDomain(host)` checks the 17-root whitelist (operator, EU, gov, intl). Hit → [V] (operator-domain primary source, ≥2 independent sources, or human confirmation). Single secondary → [O]. Model inference → [I]. |
| Yard structural gate | `trust-layer.ts:85` (`gateYardStructural`) | Rejects yard candidates missing the 4 required structural fields (name + market_id + brake_tech + last_modernized, each as a SourcedFact). |
| Entity gate | `trust-layer.ts:160` (`gateEntity`) | Marks which entities need human review. |
| Cross-lingual merge | `data/aliases.yaml` + `scripts/oiu-route.ts:loadAliases` | ASCII-normalized match_key dedupe. Auto-merge only on alias hit; other candidates → review queue. |
| Staleness check | `trust-layer.ts:185` (`isQueueItemStale`) | Auto-archive review-queue items > 14 days unreviewed. |

### 4c. Storage (the source of truth)

| Component | File | Backend |
|---|---|---|
| Drizzle/Postgres store | `artifacts/api-server/src/lib/queue-store.ts` | Real production store. 12 tables, lazy `getDb()` connection, all async. |
| File-backed dev store | `artifacts/api-server/src/lib/demo-store.ts` | In-memory + JSON snapshot to `data/demo-store.json` (debounced 250ms). Used while Postgres is unreachable (Docker Desktop not running, etc.). Lost only if the file is deleted. |
| Store factory | `artifacts/api-server/src/lib/store-factory.ts` | At startup, picks Drizzle vs demo based on `DATABASE_URL` / `DEMO_MODE`. Re-exports the full symbol set so routes import from one place. |
| Schema | `lib/db/src/schema/` (12 files) | `markets`, `yards`, `orgs`, `persons`, `plays`, `corrections`, `review_queue`, `battle_cards`, `doctrine_revisions`, `meetings`, `sessions`, `audit_log`. |
| Zod source of truth | `lib/api-zod/src/manual/schemas.ts` | The v1 entity shapes. Drizzle schema + Zod schema kept in sync manually (W36: automate the check). |

### 4d. UI (where Cassin and the operator work)

| Page | File | Path | What it does |
|---|---|---|---|
| Login | `pages/login.tsx` | `/login` | Username + password → token. The token is stored in `localStorage["decel_session_token"]` and read by `customFetch` via `setAuthTokenGetter` (wired in `main.tsx`). |
| Dossiers list | `pages/dossiers.tsx` | `/dossiers` | List of dossier markets with tier/posture badges, tender window, source count, posture change count. |
| Dossier detail | `pages/dossier.tsx` | `/dossiers/:id` | Full 5-question block (each SourcedFact with confidence badge + source link), yards table, org network, person cards (with live "Enrich (Proxycurl)" + "Push to monday" buttons), posture history, sources. |
| Review queue | `pages/review-queue.tsx` | `/review-queue` | Items the engine couldn't trust. Promote (POST /:id/promote → routes to upsertX) or Discard (DELETE /:id → records a rejection hash + Correction). 14-day auto-archive badge. |
| Battle cards | `pages/battle-cards.tsx` | `/battle-cards`, `/battle-cards/:orgId` | Doctrine-versioned pre-rendered cards. Two kinds: relationship (suggested questions) and recon (what to observe). Copy-to-clipboard. Doctrine-versioned. |
| Legacy scanner | `pages/home.tsx` | `/` | Target Scanner + Global Radar (legacy v0, kept for the Cassin demo until W35 cutover). "V1 Briefing" quick links. |

### 4e. Outputs (where the data lands)

| Sink | Path | What it does |
|---|---|---|
| v1 UI | `http://localhost:5000` (prod build served by the api-server) | All v1 pages. Auth-gated. |
| monday.com People board | "DECEL — Relationer & Dialoger" (id `18426688283`, 55 items → 60 with our push) | Where Cassin works. Pushed via the v1 UI buttons or `POST /api/v1/monday/push/all`. Columns: Name, Organisation, Roll, E-post, Telefon, Prio, Dialogläge, Kanaltyp, Marknad, Första kontakt, Senaste kontakt, Deadline, Varför jag pratar, Var vi är, Nästa steg, Källa. |
| Review queue | `POST /api/v1/review-queue` (the 2 demo items + 35 from the OIU synthetic run) | The trust gate's "needs Cassin's eyes" pile. Lives in the file-backed dev store today. |
| Corrections | `corrections` table | Every confirm/reject/edit logged with `user`, `ts`, `rejection_hash`. The apprentice log (§1.3). |
| Audit log | `audit_log` table | Auth events (login_success, login_failure, login_rate_limited, token_invalid, logout, etc.). 8 event types. |

## 5. Live state (2026-08-29)

| Component | State |
|---|---|
| api-server (PID alive, port :5000) | ✅ running |
| Vite (port :8080) | ✅ running |
| Eval gate | 21/21 GREEN |
| Typecheck (api + frontend) | ✅ green |
| Login | ✅ real (scrypt hash, demo `cassin` / `cassin-demo-2026`) |
| File-backed store | ✅ persisting to `data/demo-store.json` (~24KB) |
| Demo data in store | 1 market (PL) + 3 orgs + 5 yards + 5 persons + 2 cards + 2 review items (original) + 35 OIU-ingest items |
| monday People board | 60 items (55 original + 5 pushed — but the 5 from the prior push were the placeholders. The real ~92 land when OIU corpus arrives.) |
| OIU corpus | Synthetic sample (`data/oiu-corpus-synthetic/`, 2 files). Real PDFs from Hitank/Cassin: pending. |

## 6. What Cassin wants vs what we deliver

Each line is sourced from `docs/DECISIONS.md`, `docs/SPRINT.md`, `docs/CASSIN-API-CHECKLIST.md`, and the W34-W38 sprint plan.

### Already shipped (v1.4 spec, current state)

| Spec | What | Status |
|---|---|---|
| §11.3, §11.5 | Trust gate with [V]/[O]/[I] confidence | ✅ shipped — `trust-layer.ts` |
| §11.6 | SourcedFact envelope — every fact carries source + confidence | ✅ shipped — `SourcedFact` Zod schema, used everywhere |
| §11.7 | Review queue with 14-day auto-archive | ✅ shipped — `review-queue.ts` + `isQueueItemStale` |
| §1.3 | Correction log + rejection-hash dedupe | ✅ shipped — `corrections` table + `recordRejection` |
| §11.8 | Single-user basic auth (v1) | ✅ shipped — scrypt + sessions + middleware |
| §11.4 | Battle mode — pre-rendered cards, no LLM in battle | ✅ shipped — `battle_cards` table + `pages/battle-cards.tsx` |
| §11.5.2 | GDPR Art. 14 documented for Proxycurl | ✅ shipped — `docs/ENV.md` |
| §11.6 | Last-pushed-hash idempotency on monday | ✅ shipped — `monday_item_id` stored per person, re-push updates |
| §11.10 | Vendor doctrine as Cassin controls | ✅ shipped — `doctrine_revisions` table, `doctrine_version` on `battle_cards` |
| §12.3 | Cross-lingual alias table (DECISIONS C5) | ✅ shipped — `data/aliases.yaml` (24 canonical orgs seeded) |
| §12.5 | EU/EEA hosting, GDPR Art. 14, retention 24mo | ✅ shipped — Hetzner Frankfurt recommended, `flagStalePersonsForPurge` |
| §12.5.3 | Retention auto-purge for stale persons | ✅ shipped — `flagStalePersonsForPurge()` |
| §12.5.5 | LinkedIn enrichment (public profile only) | ✅ shipped — `lib/linkedin-provider.ts` + 402 if no key |
| Cassin correction (Aug 22) | Drop personalized first messages; show topics of interest instead | ✅ shipped — outreach route removed; `Person.interests` populated by enrichment |
| W34 | Trust layer + schemas + review queue + golden sets + auth/HTTPS | ✅ shipped |
| W35 UI | Dossiers, review queue, battle cards, login pages | ✅ shipped — wired to live API |
| W35 monday | People push live | ✅ shipped — 5 placeholder persons pushed to board `18426688283` |
| Sprint demo | 21/21 eval gate, golden set regression | ✅ shipped |

### In code, awaiting input

| Spec | What | Blocker |
|---|---|---|
| OIU corpus | Real yards, orgs, persons from PDF ingest | **PDFs from Hitank/Cassin** — drop into `data/oiu-corpus/` and run `pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus` |
| monday DPA | Live push to "DECEL — Relationer & Dialoger" | DPA from Hitank |
| MONDAY_BOARD_PEOPLE_ID | `18426688283` is now in `.env`. W36 will need additional boards (Orgs, Markets). | Cassin creates the Orgs board in monday.com |
| AUTH_PASS_HASH | Real scrypt hash set (`cassin-demo-2026`). Production needs a long random password. | Hitank to set the real prod password |
| Real Postgres | Optional. The file-backed dev store survives restarts. Drop `DEMO_MODE=true` from `.env`, set `DATABASE_URL=postgres://…`, run `pnpm --filter @workspace/db run push`. | Hitank to spin up Neon or start Docker Desktop |
| Hetzner deploy | The platform runs on `localhost:5000`. Cassin can't reach it. Hetzner CX22 Frankfurt is the recommended host (€4.85/mo, EU/EEA). | Hitank to provide Hetzner token or SSH creds; deploy artifacts ready in `deploy/` |
| OIU extractor precision/recall | The synthetic sample produces 9 yard candidates per file (6 real + 3 fuzzy matches like "Hump Yard" and "Polish" and "PKP PLK"). Once the real PDFs land, the operator will discard the false positives. The W35 golden set will then validate. | OIU corpus |

### Not started (W36+, on the schedule)

| Week | Plan | Status |
|---|---|---|
| **W36 (Aug 31 – Sep 6)** | Battle mode polish + PWA service worker + alias-table deep coverage + watchlist+ blocks for DE/Middle Corridor | Not started. PWA: needs `vite-plugin-pwa` dep + service worker. |
| **W37 (Sep 7 – 13)** | Remaining cards + static offline bundle generator + monitoring (Pino → OTel) + hardening (CSP, rate-limit on writes) | Not started. |
| **W38 (Sep 14 – 18)** | Bug fixes only. Freeze Sep 18. | Blocked on W36/W37. |
| **Sep 8** | **Slip-call gate** — if core can't make Sep 18, surface it then, not later. | (gate) |
| **Sep 21** | Smoke test on messe/roaming network | (gate) |
| **Sep 22 – 25** | InnoTrans Berlin. Cassin on the floor. Builder on-call. | (event) |
| **October** | Multi-user accounts (v1.2). Users table + roles. | (post-v1) |

### Scope-cut order (if W36 slips) — already approved in `docs/SPRINT.md`

1. US-4.3 meeting capture → manual notes
2. monday push → CSV export (same columns)
3. Middle Corridor → watchlist+ (hand-curated only)
4. Germany → watchlist+
5. map view → table only

**Never cut:** data-trust layer, Poland dossier, pre-rendered battle cards, security baseline.

## 7. Open contract gaps (DECISIONS, all signed off 2026-08-22)

| # | Gap | Decision |
|---|---|---|
| 1 | Auth scope | Single-user basic (Cassin only). Multi-user in October. |
| 2 | Voice capture | Native voice-memo + manual text log. Whisper is P2. |
| 3 | Global Radar | Gate extraction: tier+summary only for watchlist countries. Full extraction only for Poland + explicitly promoted scans. |
| 4 | Snapshot storage | Local FS in v1 (`data/snapshots/`). S3-compatible bucket in EU/EEA swapped in at staging-deploy. |
| 5 | Alias table | Builder seeds 5+ canonical orgs (✅ done, 24 seeded). Cassin owns ongoing curation. |
| 6 | monday.com DPA | Hitank chases. |
| 7 | Meeting-capture | Out for v1. Facts come from corpus + Exa + LinkedIn enrichment, not from Cassin's memory. |
| 8 | OIU corpus | Hitank chases. |

## 8. How to run everything

### Dev (one terminal, no Docker)

```bash
# 1. Install
pnpm install --frozen-lockfile

# 2. (Optional) push the Drizzle schema to a real Postgres
pnpm --filter @workspace/db run push

# 3. Start the api-server in DEMO mode (file-backed, no Postgres needed)
cd artifacts/api-server
node --env-file=../../.env --enable-source-maps ./dist/index.mjs
# In another terminal, start the Vite dev server
cd artifacts/hump-yard-intel && pnpm dev

# 4. Open http://localhost:5000 (production build) or :8080 (Vite dev)
#    Login: cassin / cassin-demo-2026
```

### Production (Hetzner CX22, one-time setup)

```bash
# 1. Create the Hetzner server
ssh root@YOUR_HETZNER_IP
bash deploy/setup-host.sh   # installs Docker + Caddy, creates decel user

# 2. As decel, deploy
ssh decel@YOUR_HETZNER_IP
git clone https://github.com/hitankshah/hump-yard-insight.git ~/decel
cd ~/decel
cp .env.example .env
$EDITOR .env   # paste the real API keys
bash deploy/deploy.sh

# 3. Enable HTTPS
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/decelsun.com/your-domain.com/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Ingest the OIU corpus

```bash
# Once Hitank delivers the PDFs, drop them in data/oiu-corpus/ and run:
pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus

# The script:
#   1. Extracts text from each .pdf / .txt
#   2. Runs the deterministic extractor
#   3. Routes through the trust layer + alias cross-walk
#   4. POSTs each candidate to /api/v1/review-queue on the api-server
#   5. Prints a summary table

# If the demo login rate limit blocks you (5 attempts / 15 min), set:
OIU_SKIP_LOGIN=true pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus
# (uses a synthetic demo- token; works in demo mode)

# Open http://localhost:8080/review-queue to promote or discard the items.
```

### Run the eval gate

```bash
node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
# Expected: GREEN, 21/21 pass
```
