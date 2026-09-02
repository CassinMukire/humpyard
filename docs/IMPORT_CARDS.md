# F6 import — how to load Cassin's curated cards

**What this is:** the import path for the ~30 battle cards Cassin is curating
for the InnoTrans Berlin 2026 fair (per the v1.6 brief §1.F6, deadline
"top-10 live in battle mode" by Fri Sep 4 demo).

**One-line summary:** fill in a JSON or markdown file, run one command,
cards land in the live DB. Re-running the same file is safe (idempotent upsert).

---

## 1. Pick a format

| Format | File | When to use |
|---|---|---|
| **Markdown** | `golden-set/battle-cards-utkast-v1.md` (template) | Cassin writes free-form, copy/paste from existing notes |
| **JSON** | `golden-set/cards-template.json` (template) | Programmatic input, easier to diff in git, can be generated from Cassin's existing card system |

Both produce the same DB rows. Markdown is friendlier for prose; JSON is
friendlier for tooling. **Pick one and stick with it** for the round.

## 2. Fill in the template

The templates are in this repo at:

```
golden-set/battle-cards-utkast-v1.md    # markdown form (5 sample cards)
golden-set/cards-template.json          # JSON form (2 sample cards)
```

Required fields per card (the importer refuses anything missing these):

| Field | Meaning | Example |
|---|---|---|
| `org_id` | The org's id (must match an existing one OR follow the `org_xxx` pattern for a new one) | `org_pkp_plk` |
| `name` | Org's display name | `PKP Polskie Linie Kolejowe` |
| `kind` | One of `relationship` / `recon` / `watchlist_plus` | `relationship` |
| `who_they_are` | 1-2 sentence description | "Polish national rail infrastructure manager…" |
| `why_matters` | Why DECEL cares | "Poland is the platform's primary dossier…" |
| `trap_to_avoid` | One specific trap (not a list) | "PKP S.A. is the holding company…" |

Optional fields (the importer accepts these but doesn't require them):

| Field | Meaning | v1.6 brief |
|---|---|---|
| `D2 / Way in` (md) or `way_in` (json) | The doctrine angle | D2 — "must be buildable in October without a schema migration" |
| `D2 / Opening` or `opening` | What Cassin actually says when the door opens | D2 |
| `D2 / Receipt` or `receipt` | What success looks like | D2 |
| `Suggested questions` (max 3) or `suggested_questions` | Questions the operator can ask | — |
| `Sources` (list) or `sources` (list) | Primary URLs that back the claims | F2 — homepage ≠ [V] |
| `Known people` (list) or `known_people` (list) | Person references on the card | F1 — only real names |
| `Notes` (md only) or `notes` | Free-form operator note | — |

## 3. Run the import

```bash
# Markdown:
pnpm run import:cards golden-set/battle-cards-utkast-v1.md

# JSON:
pnpm run import:cards golden-set/cards-template.json
```

The script will:

1. Parse the file
2. For each card, upsert the org (creating new or updating existing by `org_id`)
3. Insert any referenced persons (if you provided a `persons` block)
4. Upsert the battle card (creating new or updating existing)
5. Print a summary: `orgs created / updated, persons created, cards created / updated`

## 4. Verify

After the import, log in to the platform and open the dossier for one of
the orgs you added. The card should render with the new content. SourcedFacts
default to `[I]` confidence (inference) — Cassin can promote specific facts
to `[O]` or `[V]` via `PUT /api/v1/battle-cards/:org_id`.

## 5. Idempotency

The importer is idempotent on `org_id` and person `id`. Re-running the
same file is safe — it updates the same rows in place. The `doctrine_version`
field increments on every card upsert, so you can see how many times a
card has been edited.

## 6. What the importer refuses

- Cards missing any of the 6 required fields → **skipped** (with a warning)
- Cards with a `kind` value other than `relationship` / `recon` / `watchlist_plus` → **skipped**
- org_id values that don't match the `org_xxx` pattern → **refused** (the pattern is a sanity check, not a hard constraint — let Cassin know if you need a different one)
- Running against the in-memory demo store → **FATAL** (the script writes to real Postgres; the `DATABASE_URL` env var must point at the live DB)

## 7. Common pitfalls

- **Don't fabricate source URLs.** Per v1.6 F2, homepage URLs are not [V] — they're [I] (or rejected entirely by the trust layer if you mark them as [V]). Only list URLs that evidence the specific claim being made.
- **Don't invent person names.** If the card needs a person reference but you don't have a real name + LinkedIn URL, leave the `Known people` block empty and the platform will surface a "needs source" flag in the review queue.
- **Don't include D2 fields you don't have.** The D2 fields (`way_in` / `opening` / `receipt`) are nullable per the v1.6 brief. An empty/null value is fine; a guessed value is not.
- **Don't include a card you can't source.** If you can't list at least one source URL for a card, the card shouldn't be in the import file.

## 8. Need a CSV-style bulk import?

The JSON form can be generated from a spreadsheet. One row per card, columns
matching the field names (`org_id`, `name`, `kind`, etc.), exported to JSON
with any spreadsheet tool. The JSON form accepts either:

```json
{ "cards": [ { ... }, { ... } ] }
```

or just a flat array:

```json
[ { ... }, { ... } ]
```

---

**Owner:** Cassin (curation), Hitank (ops), Builder (script + schema).
**Last updated:** 2026-09-02 (Phase 2 finish, v1.0.0 → v1.1.0 line).
