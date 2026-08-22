# Cassin — what we need from you to ship by Sep 18

> **TL;DR:** Two things block the W35 demo (Aug 30) — the monday.com
> workspace + API token, and the OIU corpus. Three more APIs (Exa,
> Proxycurl, OpenAI) we can do without for the Aug 24 demo but want
> before Sep 18. Below is exactly what we need, where to get it, and
> what we do once we have it.

**Project context:** the DECEL Intelligence Platform ships Sep 18 (code freeze) so Cassin has a working briefing tool on his phone for InnoTrans Berlin (Sep 22–25). Every API on this list is a single env var paste for Hitank to wire in. None of these are paid subscriptions to set up — all have free tiers large enough for the demo.

---

## 🔴 Blocking W35 (Aug 30) — Poland dossier + monday push

### 1. **monday.com board ID + API token**

This is the single most important thing. We push our Person records into the monday People board so Cassin can track relationships there. One-way sync (Engine → Monday), idempotent.

**What we need:**
- **`MONDAY_API_TOKEN`** — a monday API token with `boards:read` and `boards:write` scopes
- **`MONDAY_BOARD_PEOPLE_ID`** — the numeric ID of the People board (looks like `1234567890`)

**Where to get it:**
1. monday.com → click your profile picture → **Developers** → **API**
2. Click **Generate** under "Personal API token" (v2 token is fine)
3. Copy the token (long hex string) — **save it now, you only see it once**
4. For the board ID: open the People board in monday → the URL contains `boards/1234567890` — copy the digits

**What we also need (§12.5.6 — required by GDPR):**
- A signed **Data Processing Agreement (DPA)** between DECEL and monday.com
- Workspace permissions restricted to named users (you, plus me as a viewer)

**What we do once we have it:** Hitank pastes both into `.env`. The `POST /api/v1/monday/push/person/:id` route starts working. The Aug 30 demo includes "watch me push a person to monday with source attached."

**Deadline:** Aug 30 latest. Earlier if you can.

---

### 2. **OIU corpus PDFs** (Poland dossier)

The Poland dossier is the v1 headline feature. The 5 OIU vallar, 92 PLK contacts, and brake-system annexes are the seed data. Without them, the dossier is empty.

**What we need (any way you can get them into the repo):**
- Z1.2, Z1.4, Z3, Z5, Z10, Z11, Z12 (the OIU annexes)
- Business Sweden mapping (Johannes, Hannah, Bautan Kutlu, Robin Roy)
- InnoTrans_Berlin_2026_beslutsunderlag.pdf
- Decel_Konkurrentkarta.md
- Decel_SunTzu_branschanalys.md
- Decel_Saljramverk.md

**How to share:** drop them in a folder in the repo, or DM Hitank a zip. We push the PDFs (not commit) — they go in the snapshots volume, not git.

**Deadline:** Aug 25 latest.

---

## 🟡 Need by Sep 18 (InnoTrans ship) — but not blocking Aug 24

### 3. **Exa API key** — for the live scanner

Powers the Target Scanner + Global Radar. We use it to search the web for Polish / German / Central-Asian railway / hump yard / retarder content when Cassin runs a country scan.

**Where to get it:** https://exa.ai → sign up → dashboard → **API Keys** → copy the key. Free trial = 1,000 queries, more than enough for the demo.

**Env var:** `EXA_API_KEY=...`

**Deadline:** Aug 24 (before the demo).

### 4. **Proxycurl API key** — for LinkedIn enrichment

When Cassin has a person record, this fetches their public LinkedIn profile (name, role, org, recent role changes, recent publications). The result populates the "Topics to talk about" section in the Key Contacts panel.

**Where to get it:** https://nubela.co/proxycurl → sign up → dashboard → **API Key**. Free trial = 50 credits.

**Env var:** `PROXYCURL_API_KEY=...`

**Deadline:** Aug 30.

### 5. **OpenAI API key** — for ingestion-time extraction

We use it at batch ingestion (NOT in the demo runtime) to extract facts from raw text. Battle mode is pre-rendered, so the demo doesn't need this. We use it later when we ingest the OIU corpus into seed data.

**Where to get it:** https://platform.openai.com → sign up → API keys → **Create new secret key**. $5 free credit on signup.

**Env var:** `OPENAI_API_KEY=...`

**Deadline:** Sep 18 (when we ingest the OIU corpus).

---

## 🟢 Optional / can be skipped

### 6. **S3-compatible bucket** (snapshots)

For raw source caching. We use local filesystem in v1; this is only needed if you want snapshots to survive container restarts. R2, S3, or GCS all work.

**Env var:** `SNAPSHOT_STORE_URL=...`

**Deadline:** whenever you want it. Skip for the demo.

---

## Quick copy-paste block for `.env`

```env
# Monday.com (blocking W35 demo)
MONDAY_API_TOKEN=your-token-here
MONDAY_BOARD_PEOPLE_ID=1234567890

# Exa (need before Aug 24 demo)
EXA_API_KEY=your-exa-key-here

# Proxycurl (need by Aug 30)
PROXYCURL_API_KEY=your-proxycurl-key-here

# OpenAI (need by Sep 18)
OPENAI_API_KEY=sk-your-openai-key-here
```

Hitank pastes these into `.env` and the api-server picks them up on next restart.

---

## The metric Cassin actually cares about

> Procurements where DECEL is written into the spec **before** tendering.

Each of the 5 APIs above is the only thing standing between "we built the tool" and "Cassin walks into InnoTrans with the briefing card that gets us into the spec." Three of them have free tiers large enough to demo with. Two of them (monday, OIU corpus) require a human-side action that I cannot do for you.

**If only one thing happens this week:** get the monday DPA signed and the API token issued. Everything else is in our control.

— Mavis (the builder)
