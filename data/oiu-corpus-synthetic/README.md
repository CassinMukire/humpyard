# Synthetic OIU corpus — for pipeline testing

This directory mimics the structure of the real OIU corpus PDFs that Hitank
will deliver (Z1.2, Z1.4, Z3, Z5, Z10, Z11, Z12 + Business Sweden mapping +
beslutsunderlag + Konkurrentkarta + SunTzu + Säljramverk). The files are
plain-text rather than PDF so the extractor can be run end-to-end without
the real corpus being available.

## Files

| File | What it is | When it lands as a real PDF |
|---|---|---|
| `Z1.2-oiu-pl-yards-2025.txt` | OIU Polish yard inventory (the 5+1 priority yards + Axtone/Knorr-Bremse/Voestalpine brake tech + tender context) | Z1.2 |
| `Z1.4-oiu-pl-contacts-2025.txt` | OIU Polish contact map (3 PKP PLK + 1 Axtone + 1 SYSTRA) | Z1.4 |

## Run the pipeline against this sample

```bash
pnpm tsx scripts/oiu-ingest.ts ./data/oiu-corpus-synthetic/ --write
```

Expected output (today's demo store):

```
TOTAL
  yards:    written=0  queued=6  (OIU docs are [O] until operator confirms)
  orgs:     written=0  queued=3  (PKP PLK, Axtone, SYSTRA)
  persons:  queued=5
```

The OIU docs are all secondary sources (oiu://...), so the trust layer
correctly routes them to the review queue. Cassin promotes them to the
live store from the UI.

## When the real corpus lands

1. Drop the PDFs into `./data/oiu-corpus/`
2. Re-run the same command (the script accepts .pdf and .txt)
3. The trust layer re-evaluates each source URL — operator-domain pages
   (e.g. `plk-sa.pl`) will get [V] and write directly

## Future work

- `pdf-parse` integration: the script currently has a minimal PDF→text
  fallback. Once we have the corpus, swap to `pdf-parse` for cleaner text.
- Multi-market batch mode: the current runner is one market per run.
  For W36, add `--market pl,de,kz` to ingest in parallel.
- Schema upgrade: the `Tender` and `Market.five_questions` ingest paths
  ship Sep 8 (per DECISIONS C3).
