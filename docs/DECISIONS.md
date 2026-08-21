# Open Contract Gaps

These need owner decisions before they block the W35 / W36 work. Each row
is a question, the decision owner, the deadline, and what I'll do if I
don't hear back.

| # | Gap | Owner | Deadline | Default if no answer |
|---|---|---|---|---|
| 1 | **Auth scope = single-user (Cassin only) for v1?** | Cassin | Aug 23 | I build single-user basic auth. Multi-user in October. |
| 2 | **Voice capture**: native voice-memo + manual attach (my pick) vs server Whisper | Cassin | Aug 23 | I build native voice-memo + manual text log. Whisper is P2. |
| 3 | **Global Radar**: disable v1, or gate extraction? | Cassin + Builder | Aug 23 | I disable Global Radar's entity extraction — tier + summary only. The 50-country scan doesn't feed the entity queue. |
| 4 | **Snapshot storage choice** (Replit Object Storage? R2?) + EU/EEA jurisdiction | Cassin + Builder | Aug 25 | I keep the local-FS placeholder; Replit Object Storage (Frankfurt) is the most likely final answer. |
| 5 | **Alias table owner + file location** for cross-lingual org resolution | Cassin | Aug 25 | I seed the first 5 canonical orgs (PKP PLK, DB InfraGo, KTZ, UTY, Trafikverket). Cassin owns ongoing curation. |
| 6 | **monday.com DPA signed**, workspace perms, board provisioning | **Hitank + Cassin** | Aug 23 | Without the DPA, the W35 monday push demo uses a sandbox board. |
| 7 | **Meeting-capture in or out scope** | Cassin | Aug 25 | Out. All v1 facts are sourced from project corpus + Exa, not from Cassin's memory. |
| 8 | **OIU corpus files** (Z1.2/Z1.4/Z3/Z5/Z10/Z11/Z12 + Business Sweden mapping + beslutsunderlag + Konkurrentkarta + SunTzu + Säljramverk) into repo | **Hitank** | **This week** | Without these, golden set A is a stub and Poland work is blocked. |

## Why these matter

**Gap #1 (auth scope)**: If I build multi-user with roles, I burn W34. If
single-user, I rebuild in October. Decide now.

**Gap #6 (monday DPA)**: The W35 demo is "person pushed to monday with
source." If the DPA isn't signed, the demo can't push real data without
legal risk. Hitank + Cassin own this.

**Gap #8 (corpus)**: This is the real blocker. The Poland dossier is
hand-curated from these documents. Without them, the W35 deliverable
"Poland page vs golden set" cannot be evaluated.

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
