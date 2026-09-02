# Phase 7 — Post-fair radar

**When this matters:** Oct 1+ (per Cassin's v1.6 brief §4 + §5 90-day contract).
**MVP target:** Oct 15, 2026 — ≥1 real tender/award/cert item from a live
feed, promoted through the queue into a Monday Play.
**Value test:** Dec 1, 2026 — ≥3 radar signals acted on (or documented
prep-time savings) AND Morning Queue opened ≥15/20 working days.

---

## What this is

A normalised signals table that the post-fair radar (live feeds) writes
into, the operator reviews on `/signals`, and promotes into Plays
(POSTs to monday). Per Cassin's brief: "a dossier rots from day one;
a feed never lies about its date."

## Architecture

```
[feeds: TED EU / EXA / CUPT-FEnIKS / ERADIS / UTK / SŽ zakázky / Väylävirasto / manual paste]
                       │
                       ▼
       scripts/radar-fetch.ts  (CLI; runs on cron from Oct 1)
                       │
                       ▼
            POST /api/v1/signals  (ingest endpoint)
                       │
                       ▼
            signals table (Postgres)  (idempotent on source+external_id)
                       │
                       ▼
            GET  /api/v1/signals       ─── /signals page (operator review)
                       │
                       ▼
   POST /api/v1/signals/:id/promote  ─── create Play
                       │
                       ▼
            plays table  ─── push to monday
```

## Feeds (current + planned)

| Source | Status (v1.1.0) | Oct 15 MVP | Notes |
|---|---|---|---|
| `ted_eu` | ⚪ skeleton, fetcher returns `[]` | ✅ wire it | Multilingual: górka rozrządowa, spádoviště, Rangierbahnhof, Gleisbremse, kolejové brzdy, spádoviště |
| `cupt_feniks` | ⚪ not started | post-MVP | Polish FEnIKS award announcements (12-24 months ahead of tenders) |
| `eradis` | ⚪ not started | post-MVP | ERA ERADIS portal, INF/ENE/Shunting safety certs |
| `utk` | ⚪ not started | post-MVP | Polish UTK stacje rozrządowe registry |
| `zakazky_sz` | ⚪ skeleton, fetcher returns `[]` | ✅ wire it | RSS at zakazky.spravazeleznic.cz (handed to us by SŽ) |
| `vaylavirasto` | ⚪ gated on EXA | post-MVP | hankintaohjelmat monthly programme |
| `exa` | ✅ wired (dry-run) | ✅ real fetch | EXA web search (post-fair primary feed per v1.6 §4) |
| `manual` | ✅ | ✅ | Operator paste — POST /api/v1/signals with body |

## Operator workflow

### 1. Run the radar

```bash
# Dry run (shows feed status, no writes):
pnpm run radar:fetch

# Real fetch (Oct 15+):
pnpm run radar:fetch --feed=ted_eu --query="hump yard"
pnpm run radar:fetch --feed=exa --query="Ostrava kolejové brzdy"

# JSON import (one-off bulk ingest):
pnpm run radar:fetch --feed=manual --json-input=path/to/signals.json
```

Each signal is upserted by `(source, external_id)`, so re-running is safe.

### 2. Review on /signals

Open `https://decel.cassinai.tech/signals`. The page lists every signal
with its status badge ([V]/[O]/[I] confidence) and source. For `new`
signals, the operator can:

- **Promote → Play** — write the action ("Reach out to confirm spec
  status") and a Play is created. The Play is what gets pushed to
  monday (per the v1.6 brief §4 step 1).
- **Dismiss** — write a reason ("wrong operator", "duplicate", "out of
  scope"). The signal flips to `dismissed` and won't reappear in the
  default filter.

### 3. Morning Queue (Oct 1+, not in v1.0.0)

The Morning Queue is the operator's first-screen view per the v1.6
brief §4 step 1. It surfaces today's 3 new contacts (K1-K7 weekly
quota), overdue follow-ups (max 5), and yesterday's register
entries. **It is a separate feature from the radar** — radar
ingests signals, Morning Queue surfaces actionable work.

The radar skeleton (v1.1.0) is the data layer; the Morning Queue UI
ships in October per the spec canon decision (Oct 1).

## Schema

```sql
-- migration 0002 (hand-rolled additive)
CREATE TABLE signals (
  id                  text PRIMARY KEY,
  source              text NOT NULL,         -- ted_eu | cupt_feniks | eradis | utk | zakazky_sz | vaylavirasto | exa | manual
  external_id         text NOT NULL,
  url                 text NOT NULL,
  title               text NOT NULL,
  summary             jsonb NOT NULL,        -- SourcedFact envelope
  market_id           text,                  -- nullable: undated radar hits
  posted_at           timestamptz,           -- when the feed item was published
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'new',  -- new | promoted | dismissed | acted
  promoted_to_play_id text,
  dismissed_reason    text,
  notes               text,
  UNIQUE (source, external_id)               -- dedupe on re-runs
);
```

Apply the migration:
```bash
cat lib/db/drizzle/0002_add_signals.sql | docker exec -i decel-db psql -U decel -d decel
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/v1/signals?status=new&market_id=pl&limit=50` | — | `{ items, count }` |
| GET | `/api/v1/signals/:id` | — | `Signal` |
| POST | `/api/v1/signals` | `Signal` minus `id`/`status`/`fetched_at`/`promoted_to_play_id` | `Signal` (201) |
| POST | `/api/v1/signals/:id/promote` | `{ action, owner?, due?, doctrine_ref? }` | `{ signal, play }` (201) |
| POST | `/api/v1/signals/:id/dismiss` | `{ reason }` | `Signal` |
| PATCH | `/api/v1/signals/:id` | `{ notes?, status? }` | `Signal` |

All gated by `requireAuth` (single-user in v1; multi-user in October).

## What's not in v1.1.0

- The actual TED EU / EXA / SŽ feed HTTP calls (Oct 15 wiring).
- The Morning Queue UI (Oct 1 cadence doc).
- The "yesterday's register" nag (D3 deferred — operator-discipline
  dependency, per v1.6 §2.D3).
- Push-to-monday from the radar page (the route exists; the button
  comes with the Morning Queue UI in October).

## Why no LLM in the radar path

Per v1.6 §3: "radar beats encyclopedia." A feed is the source of truth
for its own items; an LLM that paraphrases a TED notice is one
more place hallucinations can hide. The fetcher returns the
verbatim feed text in `summary.value`; confidence defaults to [O]
(secondary source — the feed is a curated source, not a primary
tender page). A human promotes [O]→[V] on the radar page when
they verify the feed page IS the primary tender document.

## Cost

EXA is the only paid feed in v1.1.0. At ~$0.04-0.10/query and a
weekly cadence per the v1.6 brief §2 D1, the radar costs ~$2-5/month
stays under the $200/month hard cap. The actual fetcher calls are
behind env-var gates (no key, no fetch) so a misconfigured deploy
costs nothing.

---

**Owner:** Builder (Mavis) for the skeleton + schema + UI; Cassin for
the feed-config and the promote/dismiss workflow; Hitank for the cron
wiring on the VPS (Oct 1+).
**Last updated:** 2026-09-02 (Phase 7, v1.1.0).
