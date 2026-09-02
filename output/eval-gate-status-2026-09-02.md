# Eval gate status — 2026-09-02

## Result: **RED** (expected, not a regression)

**Command:** `pnpm run eval` (against live Postgres at `localhost:55432`)
**Total:** 22 pass, 6 fail
**Decision per v1.6 brief §F7:** "Eval status in writing. Golden sets A/B built? green? If not green, extracted facts do not render (§12.3)"

## What passed (22 assertions)

| Test | Status | Note |
|---|---|---|
| Test 1: China junk corpus (US-1.2 regression) | ✅ GREEN | All 6 inputs gate correctly (no hallucinations) |
| Test 2: Confidence assignment (§11.3) | ✅ GREEN | All 6 mechanical rules (primary domain → V, 3 non-primary → V, etc.) |
| Test 3: No resolvable source = no render (§11.3) | ✅ GREEN | Empty / malformed source_url → discard / queue |

## What failed (6 assertions) — **expected**

All 6 failures are in **Test 0: Poland yards golden set**, and they are caused by the v1.6 brief cleanup, not a regression:

| # | Failure | Cause |
|---|---|---|
| 1-5 | `pl-yard-{1..5} (Idzikowice, Karsznice, Warszawa Praga, Gliwice, Łódź Olechów) — expected yard missing from live data` | v1.6 F1 cleanup removed the 5 placeholder yards (per Cassin's brief: "no fake data") |
| 6 | `recall ≥ yard_extraction_recall_min — recall 0 < target 0.8` | Same — 0 / 5 expected yards present |

The live data is **0 yards** because per v1.6 F1, the 5 placeholder yards with unverified `brake_tech` (sources were just operator homepages) were removed. Idzikowice is in the review queue (F5 unsourced).

## What this means

The gate is doing its job. The Poland yards golden set describes the **target** (what the data should look like after OIU corpus / F6 import). The gate says: "data doesn't match the target." That's correct.

**When does this go green?**
- When Cassin delivers the F6 markdown / OIU corpus, the import adds real yards with real primary sources
- The same gate will run against the imported data
- The gate flips green when the imported data matches the golden set's expected yards

**Production action per §12.3:** "extracted facts do not render." The platform currently has 0 yard facts rendering — which is the correct v1.6 state.

## Next eval gate run

- **After F6 import:** same command, expect to flip green
- **Owner:** Builder (run on demand after Cassin provides content)
- **Frequency:** Before each deploy + before each Friday demo

## How to re-run

```bash
# Local (against the live VPS Postgres via pg-forward):
cd /opt/decel
DATABASE_URL='postgres://decel:$POSTGRES_PASSWORD@localhost:55432/decel' \
  NODE_ENV=production pnpm run eval
```

Or, after a code change:
```bash
pnpm run eval
# in the api-server workspace against the test in-memory store
```

## Bottom line

✅ Eval gate is **functional and correctly RED** for the v1.6 cleanup
✅ All 3 regression tests (junk corpus, confidence rules, unsourced hard rule) are GREEN
⏳ The Poland yards portion goes green when F6 import delivers real data
📋 Documented in `golden-set/poland-yards.json` (unchanged — describes the target)
