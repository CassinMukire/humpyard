# Database Schema

PostgreSQL via Drizzle ORM. Source of truth for storage: `lib/db/src/schema/`.
Wire-format schemas (validated by Zod at the API boundary): `lib/api-zod/src/manual/schemas.ts`.

**Why both?** The Zod schemas are what clients send/receive. The Drizzle
schemas are how Postgres stores it. A drift between the two is a bug —
they're kept in sync manually in v1; an automated check runs in W36.

---

## Tables

### `markets` — country-level dossier

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `"pl"`, `"de"`, `"kz"` |
| `country_iso` | varchar(2) UNIQUE | ISO 3166-1 alpha-2 |
| `country_name` | text | Display name |
| `tier` | tier_enum | `A` · `B` · `C` · `ANTI` |
| `posture` | posture_enum | `IGNORE` · `WATCH` · `WARMUP` · `ENGAGE` · `WAR` (human-set) |
| `verdict` | jsonb | SourcedFact |
| `five_questions` | jsonb | 5 SourcedFacts (Sun Tzu block) |
| `window_opens` | timestamptz | |
| `window_closes` | timestamptz | |
| `sources` | jsonb | array of V1SourceLink |
| `posture_history` | jsonb | array of posture-change entries |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

Indexes: `tier`, `posture`.

### `yards` — physical classification yard

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `"yard_idzikowice"` |
| `market_id` | text FK → markets.id | ON DELETE CASCADE |
| `name` | text | e.g. `"Idzikowice"` |
| `geo` | jsonb | `{lat, lon}` or `null` |
| `operator_org_id` | text | (no FK in DB; lazy link to orgs) |
| `status` | yard_status_enum | `active` · `dormant` · `modernizing` · `planned` · `unknown` |
| `brake_tech` | jsonb | SourcedFact or `null` |
| `last_modernized` | jsonb | SourcedFact or `null` |
| `sources` | jsonb | array of V1SourceLink |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `market_id`, `operator_org_id`, `name`.

**US-1.2 hard rule** (enforced in `lib/trust-layer.ts:gateYardStructural`):
name + market_id required. Plus geo OR operator_org_id for render-eligible.
Text fragments (no name, no market) → discard.

### `orgs` — organizations

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `name` | text | Original spelling, diacritics preserved |
| `match_key` | varchar UNIQUE | ASCII-normalized dedupe key (§11.2, §12.3) |
| `type` | org_type_enum | `authority` · `operator` · `epc` · `consultant` · `financier` · `competitor` · `agent` |
| `market_ids` | jsonb | array of market.id |
| `monday_item_id` | text | set when pushed to Monday |
| `innotrans_target` | bool | one of the ~30 InnoTrans targets |
| `risk_facts` | jsonb | SourcedFact array (corruption etc., per §12.5 GDPR scope) |
| `sources` | jsonb | |
| `created_at` / `updated_at` | timestamptz | |

Indexes: unique `match_key`, `type`, `innotrans_target`.

### `persons` — people

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `name` | text | |
| `org_id` | text | (no FK; lazy link) |
| `role` | text | current title |
| `role_history` | jsonb | array of past roles |
| `relationship_owner` | text | Cassin / "engine" / null |
| `relationship_status` | relationship_status_enum | `none` · `identified` · `contacted` · `active` · `strong` |
| `import_meta` | jsonb | `{method, source_ref, imported_by, imported_at}` |
| `monday_item_id` | text | |
| `sources` | jsonb | |
| `created_at` / `updated_at` | timestamptz | |

**§12.5 GDPR scope**: business contact data only. NO criminal/corruption facts
attached to Person entities — those live at Market/Org level, unnamed.

### `plays` — sales action items

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `market_id` | text | |
| `action` | text | |
| `owner` | text | Cassin / null |
| `due` | timestamptz | |
| `status` | play_status_enum | `open` · `in_progress` · `done` · `abandoned` |
| `origin` | text | `engine` · `human` |
| `doctrine_ref` | text | pointer to doctrine doc / battle card |
| `monday_item_id` | text | |
| `created_at` | timestamptz | |

### `corrections` — apprentice log (§1.3)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `fact_id` | text | the entity the correction targets |
| `fact_kind` | fact_kind_enum | which table |
| `action` | correction_action_enum | `confirm` · `reject` · `edit` |
| `corrected_value` | jsonb | only for `edit` |
| `user` | text | who did it |
| `ts` | timestamptz | |
| `rejection_hash` | text | dedupe key for `reject` actions (§US-1.3) |

This is the apprentice loop. Tomorrow's training set. Cheap to log now,
impossible to reconstruct later.

### `review_queue` — items that didn't pass the trust gate

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `kind` | review_kind_enum | |
| `proposed` | jsonb | parsed entity shape (user can edit before promote) |
| `raw_snippet` | text | what the extractor saw |
| `source_url` | text | |
| `retrieved_at` | timestamptz | |
| `market_id` | text | optional |
| `ts` | timestamptz | |
| `archived` | bool | soft-archive flag (§11.7) |
| `archived_at` | timestamptz | when it was archived |

**Auto-archive**: items older than 14 days unreviewed are soft-archived by
`POST /api/v1/review-queue/archive-stale`. Recoverable (just unset `archived`).

### `battle_cards` — pre-rendered offline target briefings

| Column | Type | Notes |
|---|---|---|
| `org_id` | text PK | one card per org |
| `who_they_are` | text | |
| `why_matters` | text | Cassin's doctrine line |
| `known_people` | jsonb | |
| `relationship_status` | relationship_status_enum | |
| `suggested_questions` | jsonb | array of 3 strings |
| `trap_to_avoid` | text | |
| `sources` | jsonb | |
| `kind` | battle_card_kind_enum | `relationship` · `recon` (for competitors) |
| `recon_what_to_observe` | jsonb | only for `recon` cards |
| `doctrine_version` | int | bumped on every edit |
| `doctrine_updated_at` | timestamptz | |
| `doctrine_updated_by` | text | |
| `created_at` | timestamptz | |

### `doctrine_revisions` — edit history for curated content (§11.11)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `content_kind` | doctrine_content_kind_enum | `five_questions` · `battle_card` · `play` |
| `content_id` | text | the entity id |
| `version` | int | |
| `diff` | text | human-readable or JSON diff |
| `author` | text | |
| `ts` | timestamptz | |

### `meetings` — post-meeting capture (US-4.3, conditional scope)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `org_id` | text | |
| `person_ids` | jsonb | array |
| `raw_note` | text | operator's own dictation |
| `audio_ref` | text | pointer to native voice-memo file |
| `extracted_facts` | jsonb | array of fact_ids |
| `play_id` | text | linked Play |
| `ts` | timestamptz | |

**§12.5 GDPR**: this is the operator's own dictation AFTER the meeting.
Recording non-public speech without consent is a criminal offence in
Germany (§201 StGB). Voice notes are pointers to on-device files; they
never leave the device until the user explicitly syncs.

---

## The SourcedFact envelope

Every fact in this system is wrapped:

```json
{
  "value": "some claim",
  "source_url": "https://www.plk-sa.pl/registry",
  "retrieved_at": "2026-08-21",
  "confidence": "V",
  "verified_by": "rule",
  "snapshot_url": "https://...",
  "inference_inputs": ["from T1", "from T2"]
}
```

**Confidence rules (§11.3, mechanical)**:

- `[V]` = primary source (operator domain, tender portal) **OR** ≥2 independent
  non-primary sources **OR** human confirmation
- `[O]` = single secondary source (press, aggregator)
- `[I]` = model inference (always labeled with `inference_inputs`)

**Verified by**:

- `rule` — automatic via primary-domain or ≥2-source logic
- `human` — Cassin confirmed
- `human-import` — Cassin eyeballed a curated import
- `doc-import` — machine-parsed from a trusted xlsx/PDF (e.g. the 92 PLK contacts)

**No source → no render**. Hard rule. (lib/trust-layer.ts:gateSourcedFact)

---

## Migrations

```bash
# Dev: push schema directly (no migration files)
pnpm --filter @workspace/db run push

# Dev force (if push complains about destructive changes)
pnpm --filter @workspace/db run push-force

# Prod: generate + apply
pnpm --filter @workspace/db exec drizzle-kit generate
pnpm --filter @workspace/db exec drizzle-kit migrate
```

The `push` script is fine for v1 because there's only one environment and
Cassin is the only user. October (P2) we add a migration history.
