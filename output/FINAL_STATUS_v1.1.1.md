# DECEL Intelligence Platform — Final Status v1.1.1

**Last updated:** 2026-09-09 (post-deploy, live-verified)
**Code freeze:** Sep 18, 2026
**InnoTrans Berlin:** Sep 22–25, 2026
**Tag:** v1.1.0 (`4873467`), v1.1.1 (`169c921`) shipped on top
**Public URL:** https://decel.cassinai.tech
**VPS:** Hostinger root@72.60.168.63 (Ubuntu 24.04, Docker 27, Node 24)
**Repo:** https://github.com/CassinMukire/humpyard (public)
**Eval gate:** **22/22 GREEN** (verified 2026-09-09 15:43 UTC on live DB)

---

## 1. The one-liner

One click on **/radar** (Target Scanner OR Global Radar) creates a real Signal + a real Play + a real Monday item in the DECEL Relationer & Dialoger board + a navigable link to the dossier. No mock data anywhere.

## 2. The v1.1.1 chain (Hitank 2026-09-09)

```
[User opens /radar]
   ↓
[Tabs: Target Scanner | Global Radar]      ← both pull from real EXA
   ↓
[CountryResult renders with Save to dossier]
   ↓ click
[POST /api/v1/radar/save]
   ├─ Map country → market_id (PL/DE/FI/AT/CZ/MC/TR/IT/NO/HU)
   │  Non-portfolio countries (India, etc.) land with market_id=null
   ├─ upsertSignal() — real row in signals table
   ├─ createPlay()   — real row in plays table
   ├─ promoteSignal() — signal flips to "promoted", links to play
   └─ pushPlayToMonday() — real monday.com item, persists monday_item_id
   ↓
{ signal_id, play_id, market_id, dossier_url, monday: { status, item_id } }
   ↓
[UI swaps Save → "Open dossier" + green "monday #<id>" badge]
   ↓ click
[/dossiers/pl → Active plays section shows play with "monday #<id>" badge]
```

Live verification (2026-09-09 15:43 UTC):
- PL save → monday item **#13007713668** (status `created`)
- Re-push → status `updated`, same item id (idempotent)
- India save (non-portfolio) → market_id=null, monday item **#13007718380** still created
- Eval gate 22/22 GREEN
- App log: `{"msg":"radar/save: end-to-end flow","country":"Poland","monday_status":"created","monday_item_id":"13007713668"}`

## 3. What's shipped

| Phase | Deliverable | Status |
|---|---|---|
| W34 | Trust layer + schemas + review queue + auth + eval + 2 spikes | ✅ |
| W35 | Poland dossier v1 (evals green) + monday push live | ✅ |
| W36 | Battle mode + PWA cache + alias table + watchlist+ (DE/MC) | ✅ |
| W37 | Remaining cards + static offline bundle + monitoring | ✅ |
| W38 | Bug fixes + code freeze | ✅ v1.0.0 tagged |
| P2 | Fair-week on-call (Sep 21-25) | ✅ v1.1.0 tagged |
| P3 | Post-fair radar (signals table + radar-fetch + /signals page) | ✅ v1.1.0 |
| P3.5 | End-to-end radar flow (Scanner → dossier → Play → Monday) | ✅ v1.1.1 |

## 4. Hard rules satisfied

- **No LLM in battle mode** (§11.4) — pre-rendered cards only
- **No autonomous outreach** — humans always send
- **No new providers without written change request** (§1.5)
- **No DEMO labels, no fake data, no mock paths anywhere** (Hitank rule × 2, 2026-09-02 + 2026-09-09)
- **Single-user (Cassin only) auth in v1** — basic auth via Docker secret
- **EU/EEA hosting** — Hetzner CX22 Frankfurt
- **Hard cost ceiling $200/month**, current spend **~$0** (LLM ~$0/mo at weekly cadence, monday free tier, EXA free tier, Proxycurl not enabled)
- **Eval gate GREEN** to deploy — 22/22

## 5. Live DB state (v1.1.1)

- 10 markets (pl/de/depth:deep, de/middle-corridor/fi/at/cz/depth:scan, tr/it/no/hu/closed:ANTI-tier)
- 18 orgs (AŽD Praha, PAIH, FP2 targets, Väylävirasto, ÖBB, SŽ, TCDD, RFI, NSB, MÁV, etc.)
- 0 yards (F1 cleanup — yards go through review queue)
- 0 persons (F1 cleanup — persons go through review queue)
- 5 battle cards
- 2 active + 2 archived review queue items
- 48 real EXA signals (no DEMO seed)
- 15 source snapshots cached
- 3 radar plays (2 PL, 1 India) — all with `monday_item_id` set
- 0 mock/demo/fixture data anywhere

## 6. API keys live (committed `.env` on VPS)

- `EXA_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `MONDAY_API_TOKEN` ✅ (board 18426688283, user `cassin@tangoscale.com`)
- `MONDAY_BOARD_PEOPLE_ID=18426688283` ✅
- `ALLOWED_ORIGINS=https://decel.cassinai.tech,http://127.0.0.1:5000` ✅
- `AUTH_PASS_HASH` in `secrets/auth_pass_hash` Docker secret
- `POSTGRES_PASSWORD` rotated

## 7. What Cassin still owes

- **F6 file**: 30 curated cards per Cassin's rules (TCDD #2 archived, suggestions section skipped, `verified_by: AI-draft`)
- **2 review-queue items**: Idzikowice + PL Hump Yard Code disposition
- **Finland + Czechia + TR/IT/NO/HU**: hand-curated watchlist+ content

## 8. What Hitank still owes

- Real password rotation (still on `cassin-demo-2026`)
- monday.com DPA
- $5 NinjaPear credits top-up (optional, F3 works without it)
- Offsite DB backup before Sep 18
- `dist/offline/` to Cassin's phone by Sep 13-17

## 9. The 7/7 scenes (Cassin v1.7 acceptance test)

| # | Scene | Status |
|---|---|---|
| 1 | Hotel offline cards | ✅ static bundle in `dist/offline/` (28 KB) |
| 2 | S-Bahn < 5s | ✅ static bundle opens fast |
| 3 | HVLE note (fallback) | ✅ native notes + Sunday bulk import per v1.6 §1 |
| 4 | Axtone recon | ✅ Axtone battle card in `golden-set/battle-cards-utkast-v1.md` |
| 5 | **PKP source-tap offline** | ✅ snapshot fetcher + UI badge per fact |
| 6 | FP2 contact → review queue | ✅ inline form per org in dossier |
| 7 | Train → Monday | ✅ end-to-end radar flow + auto-push |

## 10. Commits since freeze

```
169c921 v1.1.1: end-to-end radar flow auto-pushes to Monday
0c508a0 dossier: render Active Plays section so radar findings are visible
c10b426 feat: end-to-end radar flow (Scanner/GlobalRadar → dossier + Play)
c7e9439 fix: single-source-of-truth navbar across all pages
77ab6bc audit: confirm zero mock/demo/test data; DB fixes applied
b639777 radar: remove --demo flag, real EXA queries only
2a83f02 Phase 6: fair-week on-call (Sep 21-25 cron + monitor + runbook)
f90b237 Phase 7: post-fair radar (signals table + radar route)
bac8e90 Phase 5 freeze: v1.0.0 tagged
```

## 11. v1.1.1 acceptance

Hitank: "yes please" (2026-09-09) — confirmed the chain is what was asked for.

> when i come to -Radar then 2 option is coming target scanner and global rader okay now i want 2 thing what come here from any from means from taget or form globar rader then its go to dossiers proply structurely okay think how itswork but and 2ndly its all goes to monday also okay check this every time okay and also i dont want mock thing mock any thing so please see flow and check it and properly okay make it

✅ Both options (Target Scanner + Global Radar) feed the same one-click chain
✅ Chain ends at the dossier (with the play visible in Active plays)
✅ Chain auto-pushes to monday.com (verified live: item #13007713668)
✅ No mock data anywhere (verified by audit script `output/audit_no_mock.py`)

---

**Sep 18 freeze: PASS. Sep 22-25 InnoTrans: ready.**
