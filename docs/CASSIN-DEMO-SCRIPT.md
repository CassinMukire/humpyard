# Cassin W35 Demo — Click-by-Click Script

**Audience:** Cassin (DECEL product owner, Sweden)
**Length:** ~10 minutes, 5 sections
**What Cassin walks away with:** proof the platform works end-to-end on real APIs, with provenance on every fact.

## Before the call

1. Open `http://localhost:5000` (api-server serves both API + built frontend in production mode).
2. Have the login screen visible.
3. **Login:** `cassin` / `cassin-demo-2026` (scrypt hash, stored in `.env`).
4. You'll land on the home page. Click the **"V1 Briefing"** links in the header to start.

> The page top-right shows two status badges: **Demo** (file-backed dev store, survives restarts) and **No Auth** is **off** (real auth is on). The Poland dossier is the only one in v1.

---

## 1. Dossiers list — `/dossiers` (60 sec)

**What to show:** "This is the list of dossier markets. Right now there's one — Poland. Tier A, posture WARMUP, tender window Sep 2026 – Jun 2027."

| What to click | What to point at |
|---|---|
| Poland card | Tier A + WARMUP badges, source count (3), posture changes (2) |
| "Open dossier" | Goes to detail |

**Key line:** *"Every fact you'll see carries a [V]/[O]/[I] confidence badge. V = primary source, O = secondary, I = model inference. No fact renders without a resolvable source."*

---

## 2. Dossier detail — `/dossiers/pl` (3 min)

**What to show:** "This is the full Poland intelligence brief. The 5 questions, yards, people, posture history, sources."

### a. The 5 questions
Scroll to the 5-question block. Each question has a [V] badge and a source link.

| What to point at | What it means |
|---|---|
| **Know yourself** | "DECEL is the only European vendor with Rangerbroms in production. Hallsberg (Sweden) and Almaty (Kazakhstan) are reference sites." — [V] primary source |
| **Know the enemy** | "Axtone is the incumbent supplier — 6 of top 10 yards. We win on safety + retrofit speed." — [V] |
| **Terrain** | "-30°C to +40°C, heavy snow. DECEL Rangerbroms rated for this." — [V] |
| **Timing** | "Q4 2026 tender for Idzikowice modernization. Window Sep 2026 – Jun 2027." — [V] |
| **Win before the battle** | "Get DECEL's specs written into PKP PLK's Hump Yard Modernization Technical Reference (Q1 2027) via a position paper to PLK's technical directorate." — [O] (from your internal SunTzu analysis) |

### b. Yards
The yards table. Each row has brake tech, last modernized, [V] badges.

**Key line:** *"Idzikowice is the active one — 2008-vintage Axtone retarder, declared end-of-life 2024, 2027 modernization planned with Q4 2026 tender. That's our first EU tender."*

### c. Actor network
3 orgs: PKP PLK (authority), Axtone (competitor), SYSTRA (consultant).

**For each PKP PLK person, click "Enrich (Proxycurl)":**
- Anna Kowalska — Director of Infrastructure Investment. Pulls fresh public profile + adds a [O]-tagged interest to the "Topics to talk about" list.
- Tomasz Nowak — Head of Procurement for Idzikowice.
- Marta Wójcik — Chief Engineer, Marshalling Yard Systems.

**Then click "Push to monday" on one person:**
- This will return `error: PENDING_BOARD_ID` until you create the People board. That's expected and the right thing — the wiring is live, just the board id is missing.

**Key line:** *"Enrich uses Proxycurl — public profile data only, ~$0.04-0.10/profile, GDPR Art. 14 covered in §12.5.2. The person is not contacted automatically; you write the message."*

### d. Posture history + sources
Two columns at the bottom. Posture went WATCH → WARMUP. Sources are the 3 PKP PLK URLs.

---

## 3. Review queue — `/review-queue` (1 min)

**What to show:** "This is the trust queue. Items the engine couldn't verify land here for your call."

2 seeded items:
- A "yard" item with the snippet "Code for Design on Hump and Marshalling Yards (PKP PLK, 2019) — section 4.2"
- A "tender" item — "Modernization of retarder systems at selected marshalling yards. Award Q2 2027."

For each: read the snippet, the source URL, the timestamp. Note the **age badge** if any (14-day auto-archive).

**Click "Discard" on one** — opens a dialog asking why. Type a reason, hit Discard. The rejection hash is recorded in the corrections log (§1.3), so the engine won't re-surface it.

**Key line:** *"Discarding teaches the engine. We never lose a fact silently — it's either rendered with a source, queued for your review, or explicitly rejected with a reason."*

---

## 4. Battle cards — `/battle-cards` (1 min)

**What to show:** "These are the pre-rendered briefing cards you carry on the phone at InnoTrans. No LLM in battle mode — they work offline."

2 cards:
- **PKP PLK** (Relationship) — "Owner of the Idzikowice modernization tender (Q4 2026) — DECEL's first major EU tender. Spec-writer SYSTRA is open to European alternatives." Trap: "PKP S.A. is the holding company — PLK owns the yards. Ask who opens PLK, not PKP S.A."
- **Axtone** (Recon) — competitor. "What to observe" checklist: pricing in recent Polish tenders, retrofit lead time, safety record, presence at TRAKO 2025 + InnoTrans 2026.

**Click "Copy"** on a card — clipboard has the whole card as plain text. Useful for pasting into a notes app or message.

**Key line:** *"The cards are doctrine-versioned. When you (Cassin) update the doctrine, the previous version stays in the audit log. The platform records who edited what."*

---

## 5. Login (10 sec, optional)

If you have a free minute, navigate to `/login` to show the form. The page is built; it just short-circuits when `DISABLE_AUTH=true`. The flow is real and tested (we use it locally with the dev password).

---

## After the call — what's blocking production

| Item | Owner | Status |
|---|---|---|
| `MONDAY_BOARD_PEOPLE_ID` | Cassin (creates the People board) | empty — push will return PENDING_BOARD_ID error until set |
| OIU corpus PDFs (Z1.2, Z1.4, Z3, Z5, Z10, Z11, Z12 + Business Sweden mapping + beslutsunderlag + Konkurrentkarta + SunTzu + Säljramverk) | Hitank → Cassin | not received — current data is placeholder names |
| monday.com DPA | Hitank | in flight |
| Real Postgres (vs the file-backed demo store) | Hitank / anyone | optional — current store persists to `artifacts/api-server/data/demo-store.json` (23KB) |

**W36 work** (Sep 7–13): PWA offline bundle so the phone has the cards at InnoTrans without Wi-Fi.

**Sep 8 slip-call gate** — if anything is sliding, we surface it then, not later.

**Sep 18 code freeze** — done or slipped by then. W38 is bug fixes only.

---

## If something breaks during the demo

- Restart api-server: `cd artifacts\api-server && node --env-file=../../.env --enable-source-maps ./dist/index.mjs` in a real terminal (not the background task — the runtime kills it after 30 min).
- Reset the demo data: stop the server, delete `artifacts/api-server/data/demo-store.json`, restart. The seed will re-populate.
- Eval gate: `node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts` — must stay 21/21 green.
