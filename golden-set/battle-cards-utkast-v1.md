<!--
F6 import template — MARKDOWN form.
Copy this file, fill in your 30 cards (or top-10 for battle mode), and run:
    pnpm run import:cards <path-to-your-file>
The importer parses sections starting with `## Card N:` and upserts the
org / persons / battle card into the live Postgres DB. Existing rows
(matching by org_id) are updated in place; new rows are created.

Required fields per card:
  - **Org ID:** org_xxx
  - **Who they are:** <text>
  - **Why this matters:** <text>
  - **Trap to avoid:** <text>

Optional fields (leave the line out if you don't have it):
  - **D2 / Way in:**   <text>
  - **D2 / Opening:**  <text>
  - **D2 / Receipt:**  <text>
  - **Suggested questions:** (numbered 1., 2., 3. — max 3)
  - **Sources:**       - <url> — <title>
  - **Known people:**  - <person_id> — <role> — <relationship_status>
  - **Notes:**         <free text>

Kind values: relationship | recon | watchlist_plus
Relationship status values: none | identified | contacted | active | strong

For the org_id, use one of the seeded orgs (org_pkp_plk, org_axtone, org_systra,
org_db_netz, org_ktz, org_uty, org_vaylavirasto, org_oebb, org_sz_cd, org_azd_praha,
org_paih, org_ceit, org_indra_parrilla, org_sncf_wilbois, org_tcdd, org_rfi,
org_nsb, org_mav) or invent a new one in the same pattern.
-->

## Card 1: PKP Polskie Linie Kolejowe — Polish national rail infrastructure manager

**Org ID:** org_pkp_plk
**Kind:** relationship
**Who they are:** PKP Polskie Linie Kolejowe — Polish national rail infrastructure manager. Owns the network + yards.
**Why this matters:** Poland is the platform's primary dossier. PLK is the buyer of record for every hump-yard modernization on the Polish network.
**Trap to avoid:** PKP S.A. is the holding company — PLK owns the yards. Ask who opens PLK, not PKP S.A.
**D2 / Way in:** Doctrine: get DECEL's specs written into PLK's 'Code for Design on Hump and Marshalling Yards' technical reference before any tender goes live.
**D2 / Opening:** Open with: 'We are aware PLK is reviewing its track-brake specifications for Idzikowice and would value a technical exchange on modern alternatives.'
**D2 / Receipt:** Cassin: 'Yes, we'll loop in our PLK liaison and get a meeting on the Q4 2026 calendar.' → monday Play with date.
**Suggested questions:**
1. Where is the 'Code for Design on Hump and Marshalling Yards' in its current revision cycle?
2. Which yards are on the 2027 capex list?
3. Is PLK open to a technical exchange before the Idzikowice tender brief is finalised?
**Sources:**
- https://www.plk-sa.pl — PKP Polskie Linie Kolejowe — official site
**Known people:**
**Notes:**

## Card 2: AŽD Praha s.r.o. — Czech rail systems integrator (Ostrava radar case)

**Org ID:** org_azd_praha
**Kind:** watchlist_plus
**Who they are:** AŽD Praha — Czech rail systems integrator. Hall 27/640 at InnoTrans Berlin 2026.
**Why this matters:** AŽD is the local CZ integrator for the Ostrava brand-new hump in design (MORAVIA CONSULT Olomouc, docs 2026, build ≥2028, 8→30 bn CZK). Get DECEL into AŽD's spec pull for the Ostrava tender.
**Trap to avoid:** AŽD integrates — they don't decide retarder spec alone. The decision is at SŽ (Správa železnic). Position AŽD as the spec carrier, not the decision-maker.
**D2 / Way in:** Doctrine: meet AŽD at InnoTrans Hall 27/640, walk through the Ostrava timeline, ask for a 1:1 in October at hannover messe or directly at AŽD's Praha HQ.
**D2 / Opening:** Open with: 'We're tracking the Ostrava hump design and want to make sure the retarder spec aligns with modern practice before MORAVIA CONSULT finalises the brief.'
**D2 / Receipt:** Cassin: 'Yes, set up the AŽD meeting for late October, I'll bring the Ostrava timeline PDF.'
**Suggested questions:**
1. Where is the Ostrava retarder spec in MORAVIA CONSULT's design pack?
2. Is AŽD the integrator on Ostrava or only on the signalling?
3. Does AŽD have a relationship with SŽ's procurement team?
**Sources:**
- https://www.azd.cz/en — AŽD Praha — official site
**Known people:**
**Notes:**

## Card 3: Väylävirasto — Finnish Transport Infrastructure Agency (Tampere live)

**Org ID:** org_vaylavirasto
**Kind:** relationship
**Who they are:** Väylävirasto — Finnish Transport Infrastructure Agency. National rail infrastructure manager.
**Why this matters:** Finland is on the active BD portfolio. Tampere is a known active hump with a live arrival-yard project. Väylävirasto publishes hankintaohjelmat monthly.
**Trap to avoid:** Broad-gauge (1524 mm). Don't pitch standard-gauge retarder references.
**D2 / Way in:** Doctrine: ride the Tampere arrival-yard timeline. Get DECEL into Väylävirasto's hankintaohjelmat before the next revision.
**D2 / Opening:** Open with: 'We're tracking the Tampere arrival-yard project and want to make sure modern track-brake practice is in the spec before tender.'
**D2 / Receipt:** Cassin: 'Yes, I'll set up the Tampere review for November.'
**Suggested questions:**
1. Where is the Tampere arrival-yard project in the hankintaohjelma cycle?
2. Does Väylävirasto use a design integrator or run it in-house?
3. Is there a published technical reference for retarder selection?
**Sources:**
- https://vayla.fi/en — Väylävirasto — official site
**Known people:**
**Notes:**

## Card 4: ÖBB — Austrian Federal Railways (SWL operator angle)

**Org ID:** org_oebb
**Kind:** relationship
**Who they are:** ÖBB — Austrian Federal Railways. National rail operator.
**Why this matters:** Austria is the only major market growing. ÖBB has committed a SWL (Sweeper / Wagon Load) operator angle. No active DECEL position in v1.
**Trap to avoid:** Voestalpine is HQ'd in Linz, Austria — local incumbent. Don't pitch at ÖBB without checking what Voestalpine has on the ground first.
**D2 / Way in:** Doctrine: monitor ÖBB's Rahmenplan (5-year plan). Position DECEL on the SWL operator angle as the differentiator.
**D2 / Opening:** Open with: 'We're tracking ÖBB's SWL operator angle and want to make sure modern track-brake practice is in the spec.'
**D2 / Receipt:** Cassin: 'Yes, I'll loop in our Voestalpine-recon contact first.'
**Suggested questions:**
1. Where is ÖBB's Rahmenplan revision this year?
2. Is the SWL operator angle a published procurement line?
3. Does ÖBB publish a technical reference for retarder selection?
**Sources:**
- https://www.oebb.at/en — ÖBB — official site
**Known people:**
**Notes:**

## Card 5: SŽ (Správa železnic) — Czech rail infrastructure manager

**Org ID:** org_sz_cd
**Kind:** relationship
**Who they are:** Správa železnic — Czech rail infrastructure manager. Owns the network + yards. Publishes on zakazky.spravazeleznic.cz.
**Why this matters:** SŽ is the decision-maker for the Ostrava brand-new hump (docs 2026, build ≥2028, 8→30 bn CZK). The reference case for 'radar beats encyclopedia'.
**Trap to avoid:** SŽ uses Czech terms: spádoviště, kolejové brzdy, modernizace. Don't pitch in English — bring a CZ-speaking counterpart.
**D2 / Way in:** Doctrine: get DECEL into the SŽ spec before Ostrava tender goes live. Use the zakazky.spravazeleznic.cz feed as the radar source.
**D2 / Opening:** Open with: 'Sledujeme projekt Ostrava a chtěli bychom probrat moderní praxi pro kolejové brzdy před dokončením zadání.' (in CZ, or with a CZ-speaking counterpart)
**D2 / Receipt:** Cassin: 'Yes, set up the SŽ meeting in Praha for late November.'
**Suggested questions:**
1. Where is the Ostrava zadání in its revision cycle?
2. Does SŽ use MORAVIA CONSULT as the design integrator?
3. Is there a published technický předpis for retarder selection?
**Sources:**
- https://www.spravazeleznic.cz/en — Správa železnic — official site
**Known people:**
**Notes:**

<!--
ADDITIONAL CARDS (29 more to go for the 30-card brief — copy any of the
sections above, change the fields, and the importer will pick them up.

Quick reference for picking org_ids:
  Authority orgs (Poland / portfolio): org_pkp_plk, org_vaylavirasto, org_oebb,
                                        org_sz_cd, org_db_netz, org_ktz, org_uty
  Integrator / EPC:                   org_azd_praha, org_indra_parrilla
  Trade / consulting:                 org_paih, org_ceit
  Competitor (recon only, do NOT contact): org_axtone
  Closed-market history (do NOT pitch): org_tcdd, org_rfi, org_nsb, org_mav

After you save this file, run from the repo root:
    pnpm run import:cards golden-set/battle-cards-utkast-v1.md
And the platform's battle-cards page will show the new content.
-->
