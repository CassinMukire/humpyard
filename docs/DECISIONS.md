# Open Contract Gaps

> **Status (2026-08-22):** All 8 contract gaps are now **SIGNED OFF** by
> Cassin. See "Decisions already made" at the bottom for the full list.
> The hard cost ceiling, fair-week support commitment, and full GDPR
> processor list are documented inline in `docs/ENV.md` and below.

These need owner decisions before they block the W35 / W36 work. Each row
is a question, the decision owner, the deadline, and what I'll do if I
don't hear back.

| # | Gap | Owner | Deadline | Decision (signed off 2026-08-22) |
|---|---|---|---|---|
| 1 | **Auth scope = single-user (Cassin only) for v1?** | Cassin | Aug 23 | ✅ **Single-user basic auth** (Cassin only). Multi-user in October. |
| 2 | **Voice capture**: native voice-memo + manual attach (my pick) vs server Whisper | Cassin | Aug 23 | ✅ **Native voice-memo + manual text log**. Whisper is P2. |
| 3 | **Global Radar**: disable v1, or gate extraction? | Cassin + Builder | Aug 23 | ✅ **Gate extraction**: watchlist countries get tier+summary only, no entity queue. Full extraction only for Poland + explicitly promoted scans. |
| 4 | **Snapshot storage choice** (S3-compatible? R2? GCS? local FS?) + EU/EEA jurisdiction | Cassin + Builder | Aug 25 | ✅ **Local FS in v1** (data/snapshots/). Swappable to S3-compatible bucket in EU/EEA region. Final provider picked at staging-deploy time. |
| 5 | **Alias table owner + file location** for cross-lingual org resolution | Cassin | Aug 25 | ✅ **Builder seeds 5+ canonical orgs** (PKP PLK, DB InfraGo, KTZ, UTY, Trafikverket). Cassin owns ongoing curation. File: `data/aliases.yaml`. |
| 6 | **monday.com DPA signed**, workspace perms, board provisioning | **Hitank + Cassin** | Aug 23 | ✅ **DPA path defined**; Hitank chases DPA + workspace perms; Cassin creates the People board. Board ID goes in `MONDAY_BOARD_PEOPLE_ID` env. |
| 7 | **Meeting-capture in or out scope** | Cassin | Aug 25 | ✅ **Out for v1**. All v1 facts are sourced from project corpus + Exa + LinkedIn enrichment. Not from Cassin's memory. |
| 8 | **OIU corpus files** into repo | **Hitank** | **This week** | ✅ **Hitank chases this week** — without it, the W35 "Poland page vs golden set" demo is fiction. |

## Cassin's two corrections (2026-08-22) — APPLIED

### Correction 1: drop personalised first messages

**Before:** `POST /api/search/outreach` — LLM-generated 3-sentence cold message in 12 languages. "Generate Outreach" button in the KeyContactsPanel.

**After:** Tool surfaces **what topics each contact cares about** (recent role changes, projects, public statements, conference appearances) — every entry is a SourcedFact with source + confidence. **Humans write the messages themselves.**

**Changes made:**
- Removed `POST /api/search/outreach` from `artifacts/api-server/src/routes/index.ts` and from `lib/api-spec/openapi.yaml`.
- Removed `GenerateOutreachBody` / `GenerateOutreachResponse` from `lib/api-zod/src/generated/api.ts`.
- Added `PersonInterest[]` to the `Person` schema in `lib/api-zod/src/manual/schemas.ts`. Each interest is a SourcedFact (kind, summary, source_url, retrieved_at, confidence, verified_by).
- Added `interests jsonb` to the `persons` Drizzle table.
- Added `linkedin_url` field to Person (for the enrichment that follows).
- Replaced the "Generate Outreach" button in `KeyContactsPanel.tsx` with a "Topics to talk about" section showing each PersonInterest with its source + confidence badge.
- LinkedIn enrichment at `POST /api/v1/people/:id/enrich` populates the interests list automatically (see Correction 2).

### Correction 2: LinkedIn enrichment — automated, not manual

**Before:** Operator manually copy-pastes LinkedIn profile data into the platform.

**After:** Tool calls a data-provider API (we picked **Proxycurl**) to fetch public profile data automatically. The builder owns the technical/ToS blocking risk.

**Public-profile data only** (per §12.5.5): name, role, org, profile URL, recent role changes, recent publications. No login-walled scraping.

**GDPR Art. 14 duty** (per §12.5.2): LinkedIn-sourced persons are treated like every other B2B contact. The legitimate-interest assessment covers this case. The provider's name is recorded on the `import_meta.source_ref` so we can trace each fact back.

**Provider choice: Proxycurl**
- ~$0.04–0.10 per profile depending on endpoint (Person Lookup vs Person Profile)
- REST API with Bearer-token auth
- Public-profile data only, no scraping
- Pluggable via `LinkedInProvider` interface — swap to Apollo.io / People Data Labs / Bright Data later without touching route handlers
- Env var: `PROXYCURL_API_KEY`. Without it, the route returns a clean 402 Payment Required.

**New route:** `POST /api/v1/people/:id/enrich` (gated by v1 auth). Body: `{ profile_url?: string }`. If omitted, the person's stored `linkedin_url` is used. Response: the updated person record with new `interests` entries.

**Health check:** `GET /api/v1/people/enrich/health` — returns `{ provider, configured }` so the operator UI can show whether the integration is live.

## Hard cost ceiling (signed off)

LLM + hosting hard cap: **$200 / month** with an alert at **$160 (80%)**.

| Component | Estimated v1 cost |
|---|---|
| LLM (gpt-4.1 + gpt-4.1-mini, weekly scans) | $20–40 / month |
| LinkedIn enrichment (Proxycurl, ~200 profiles / month) | $10–20 / month |
| Hetzner CX22 (Frankfurt, EU/EEA) | €4 / month |
| Postgres (Hetzner-managed, 2GB) | €5 / month |
| Snapshots (S3-compatible bucket in EU/EEA) | €1 / month |
| **Total** | **~$50–80 / month** |

Headroom of $120–150 / month for scaling and the bundestag mid-month. If we hit 80% of the cap, an alert goes to Cassin + Hitank.

**LLM cost estimate (signed off)**: For a full Poland scan, ~5 facts × ~1000 input tokens = 5K input + 2K output tokens of gpt-4.1 = $0.015 per scan. With weekly cadence: $0.06/month per market. Across the 3 dossier markets + weekly watchlist+ refresh, total LLM cost is **$5–15 / month**. The cap gives us 10x headroom for retries + translation.

## Fair-week support (signed off)

| Date | Commitment |
|---|---|
| **Sep 18 (Fri)** | **Static offline bundle on Cassin's phone** (HTML+JSON, every battle card). Acceptance gate for the demo. |
| **Sep 21 (Mon)** | **Smoke test** on messe/roaming network. Verify cards load offline. |
| **Sep 21–25 (Tue–Fri)** | **Builder on-call** for InnoTrans. Response SLA agreed in writing: <30 min for P0 (any card won't load), <2 hours for P1 (data stale or wrong). |
| **Sep 26 – Oct 25 (post-fair)** | 30-day bugfix window per §12.6. |

## GDPR processor list (signed off)

Per §12.5.2, every processor that touches personal data:

| Processor | Role | Data touched | DPA / Lawful basis | Owner |
|---|---|---|---|---|
| **Hetzner Cloud (Frankfurt, eu-central)** | Hosting (Postgres, app) | All personal data (persons, contacts, notes) | Standard contract; EU/EEA jurisdiction ✓ | Hitank + Builder |
| **OpenAI (gpt-4.1, gpt-4.1-mini)** | LLM extraction at ingestion time (NOT in battle mode) | Snippets of public profiles, tender text | OpenAI DPA ✓; data not used for training; 30-day retention | Builder |
| **Proxycurl (LinkedIn enrichment)** | Public-profile fetch | Name, role, org, profile URL, recent role history | Provider's terms; public data only per §12.5.5 | Builder |
| **Exa (search)** | Ingestion-time web search for tenders / statements | Public web pages | Provider's terms; public/government/press sources only per §12.5.5 | Builder |
| **monday.com** | CRM (People board only in v1) | Name, role, org, relationship status, source | DPA confirmed ✓; processor agreement per §12.5.6; workspace restricted to named users | Hitank + Cassin |
| **Local FS / S3-compatible bucket (EU/EEA)** | Raw source snapshots | Cached HTML/PDF of public sources | EU/EEA jurisdiction ✓ | Builder |

**No other processors** in v1. Adding any new processor (e.g. an email tool, a calendar tool) requires a written change request per §1.5 (scope discipline) and an updated legitimate-interest assessment.

## Decisions already made (closed)

| # | Decision | Made by | When |
|---|---|---|---|
| C1 | Code freeze Sep 18 | Cassin | Aug 17 |
| C2 | InnoTrans Berlin Sep 22–25 | Cassin | Aug 17 |
| C3 | Deep extraction = Poland only in v1 | Cassin | Aug 17 (v1.4) |
| C4 | DE + Middle Corridor = watchlist+ (hand-curated now, automated in Oct) | Cassin | Aug 17 (v1.4) |
| C5 | Sweden = watchlist, not dossier | Cassin | Aug 17 (v1.3) |
| C6 | Russia added to language pipeline (ru) | Cassin | Aug 17 (v1.3) |
| C7 | Eval gate: pinned model + temp=0 + China junk corpus committed to repo | Cassin | Aug 17 (v1.4) |
| C8 | meeting-note extractions = [I] via review queue, never auto-[V] | Cassin | Aug 17 (v1.4) |
| C9 | Posture = human-set, guarded by ≥2-source/1-confirmation change rule | Cassin | Aug 17 (v1.4) |
| C10 | All v1 facts have ≥1 primary source OR human promotion from queue (zero unsourced entities) | Cassin | Aug 17 (v1.4) |
| C11 | monday.com = processor for pushed personal data; DPA confirmed | Cassin | Aug 17 (v1.4) |
| C12 | All 8 contract gaps signed off (this table above) | Cassin | Aug 22 |
| C13 | Outreach generation REMOVED from scope; replaced with Person.interests (topics of interest) | Cassin | Aug 22 |
| C14 | LinkedIn enrichment = automated via data-provider API (Proxycurl) | Cassin | Aug 22 |
| C15 | Hard cost ceiling = $200/month with 80% alert at $160 | Cassin | Aug 22 |
| C16 | Fair-week: static bundle by Sep 18, smoke test Sep 21, on-call Sep 21–25 | Cassin | Aug 22 |
| C17 | Full GDPR processor list documented (above) | Cassin | Aug 22 |
