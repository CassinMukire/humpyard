# Sprint Plan

From `AGENTS.md` "Sprint plan (W34–W38)" — restated here as the working
checklist. Updated after each demo.

## Current week: W34 (Aug 17–23) — TRUST LAYER + FOUNDATION

| Day | Plan | Demo-able? |
|---|---|---|
| Mon (Aug 17) | Spec v1.4 review. Adversarial scope cuts accepted. | — |
| Tue (Aug 18) | Schema + trust-layer scaffolding. | — |
| Wed (Aug 19) | Queue + entities + review queue API. Golden set A scaffold. | — |
| Thu (Aug 20) | Eval gate runner. China junk corpus. Test against trust layer. | — |
| **Fri (Aug 21) — TODAY** | **W34 foundation complete**. Eval gate **21/21 GREEN**. Drizzle schema for 8 entities. v1 API routes mounted and async. Documentation in `docs/`. | **Yes — China junk corpus → 0 entities render. Typecheck clean.** |
| Sat (Aug 22) | Buffer / OIU corpus integration. UI review queue page. | — |
| Sun (Aug 23) | **Demo #1 to Cassin.** Friday demo protocol. Slip-call gate for the team. | **Yes — Demo #1.** |

## W35 (Aug 24–30) — POLAND DOSSIER + MONDAY

| Day | Plan | Demo-able? |
|---|---|---|
| Mon | OIU corpus ingested into golden set A. PLK contact xlsx → 92 persons seeded. | — |
| Tue | Trust-layer integration with existing scanner search route (production data path). | — |
| Wed | monday.com People board provisioned. Push a real person end-to-end. | — |
| Thu | Poland dossier page UI. Render the 5 OIU vallar with sources. | — |
| **Fri** | **Demo #2**: Poland page vs golden set; person pushed to monday with source. | **Yes — Demo #2.** |

## W36 (Aug 31–Sep 6) — BATTLE MODE

| Day | Plan | Demo-able? |
|---|---|---|
| Mon | Battle card template. Doctrine schema. | — |
| Tue | PWA offline cache. Cassin's phone tested (his device/OS). | — |
| Wed | Alias table seeded with 5+ canonical orgs. Cross-lingual dedupe live. | — |
| Thu | Top 10 battle cards curated by Cassin (deadline Sep 4). | — |
| **Fri** | **Demo #3**: Phone demo: org → card <5s, airplane mode. | **Yes — Demo #3.** |

## W37 (Sep 7–13) — REMAINING CARDS + OFFLINE BUNDLE

| Day | Plan | Demo-able? |
|---|---|---|
| Mon | Remaining 20 cards curated by Cassin (deadline Sep 11). | — |
| Tue | Static offline bundle generator. CI artifact. | — |
| Wed | Monitoring + hardening (rate limits, error boundaries, request IDs). | — |
| Thu | Buffer. | — |
| **Fri** | **Demo #4**: Full dry run + bundle on phone. | **Yes — Demo #4.** |

## W38 (Sep 14–18) — FREEZE

| Day | Plan | Demo-able? |
|---|---|---|
| Mon–Thu | Bug fixes only. | — |
| **Fri Sep 18** | **CODE FREEZE.** All W34–W38 DoD criteria must pass. | **Yes — Freeze.** |

## Sep 8 — SLIP CALL

If the core cannot make Sep 18, we say so on **Sep 8** — not Sep 17.

The slip-call gate:
- Is the data-trust layer solid? (yes/no)
- Is the Poland dossier working? (yes/no)
- Are the pre-rendered battle cards shipping? (yes/no)
- Is the security baseline in place? (yes/no)

If any of these is "no" by Sep 8, the team makes a written decision on
what to cut per the pre-agreed scope-cut order (see `AGENTS.md`).

## Fair week (Sep 21–25)

| Day | Plan |
|---|---|
| Mon Sep 21 | Smoke test on messe/roaming network. |
| Tue–Fri Sep 22–25 | InnoTrans. Cassin on the floor. Builder on-call per agreed SLA. |

## Scope cut order (pre-agreed)

If W36 slips, cuts happen in this order:

1. US-4.3 meeting capture → manual notes
2. monday push → CSV export (same columns)
3. Middle Corridor → watchlist+ (hand-curated only)
4. Germany → watchlist+
5. map view → table only

**Never cut**: data-trust layer, Poland dossier, pre-rendered battle cards, security baseline.
