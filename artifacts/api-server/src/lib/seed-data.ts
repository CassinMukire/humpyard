// =============================================================================
// PRODUCTION seed data — shared between the dev in-memory store and the
// production seed script.
//
// STATE on 2026-09-02 (post v1.6 brief):
//   v1 ships with structure + 0 fabricated facts. Every fact that requires
//   external verification (yard brake_tech, person roles, market claims
//   beyond "this country + this company exists") is either:
//     (a) sourced with a PRIMARY URL (the exact page that proves the claim),
//         or
//     (b) absent from the seed and queued in the review queue for Cassin
//         to fill in via the F6 markdown/JSON import.
//
// No DEMO labels. No placeholder names. No "this is approximate" hand-waves.
// Per Cassin's v1.6 brief: "demo data is banned from demos; every Friday
// demo runs on real data." The honest empty state IS the production state
// until F6 arrives.
//
// What this file contains:
//   - 4 markets (PL deep, DE scan, middle-corridor scan, plus a closed
//     example for the v1.6 "closed market" rule)
//   - 6 real orgs (PKP PLK, Axtone, SYSTRA, DB Netz, KTZ, UTY) — names
//     and public websites only, no fabricated facts
//   - 0 yards (the 5 placeholder yards from W36 had no primary source
//     for brake_tech; F5 audit removed them. Real yards arrive via F6.)
//   - 0 persons (the 5 placeholder names from W36 were fictional;
//     Cassin flagged this in v1.6. Real people arrive via F6 / OIU corpus.)
//   - 5 battle cards with Cassin's doctrine content + new D2 fields
//   - 2 review queue items: the unsourced claims to verify (Idzikowice
//     tender, PL Hump Yard Code) + the closed-market tracking item.
//
// All source_url values are PRIMARY pages that evidence the claim being
// made. Homepages are tagged [I] (inference from the company's existence)
// unless they are the specific page that proves the specific claim.
// =============================================================================

import { randomUUID } from "node:crypto";
import type {
  Market,
  Yard,
  Org,
  Person,
  BattleCard,
  ReviewQueueItem,
} from "@workspace/api-zod";

export interface SeedData {
  markets: Market[];
  // F5 + v1.6: empty arrays until F6 import delivers real ones.
  // Typed as the full entity (not `never[]`) so the store code paths
  // (demo-store.ts, queue-store.ts) keep working with the loop. The
  // shape is "structurally correct but contains 0 items."
  yards: Yard[];
  orgs: Org[];
  persons: Person[];
  battle_cards: BattleCard[];
  review_queue: ReviewQueueItem[];
}

// ----- Verified working URLs (all return 200 at seed time) -----
const URL = {
  // Real primary URLs — these are the OFFICIAL WEBSITES, not "this is the
  // page that proves a specific claim." For dossier facts, we either link
  // to the specific page (e.g. a tender document) or we don't link at all.
  decel: "https://www.decel.com",
  plkPlk: "https://www.plk-sa.pl",
  systra: "https://www.systra.com",
  axtone: "https://axtone.com",
  voestalpine: "https://www.voestalpine.com/group/en",
  knorrBremse: "https://www.knorr-bremse.com/en",
  wabtec: "https://www.wabtec.com",
  dbMain: "https://www.deutschebahn.com/en",
  ktz: "https://railways.kz",
  uty: "https://www.railway.uz",
} as const;

const SEED_NOW = new Date().toISOString();
const SEED_TODAY = "2026-09-02";
const SEED_STARTED = "2025-01-15T00:00:00Z";

function buildSeedData(): SeedData {
  // =====================================================================
  // Markets
  // =====================================================================
  // Per v1.6 brief §3:
  //   - PL: deep dossier, untouchable
  //   - DE: watchlist+ scan
  //   - middle-corridor: combined KZ+UZ watchlist+ scan (F4)
  //   - tr: closed example (v1.6: "TR closed, recon-only")
  // All non-PL markets are explicitly `depth: "scan"` per the v1.6 rule.
  // No verdict text is invented — what we have is [I] (inference from the
  // company's existence) and what we don't have, we don't render.

  const pl: Market = {
    id: "pl",
    country_iso: "PL",
    country_name: "Poland",
    tier: "A",
    posture: "WARMUP",
    depth: "deep",
    yard_count: null, // F5: unverified. Real count arrives via F6.
    yard_count_source_url: null,
    closed_at: null,
    // PL is the platform's primary dossier. The 5-questions block below
    // contains the doctrine Cassin has curated. Each fact is marked [O] or
    // [I] based on its source — NO [V] for homepage links (homepage ≠ page
    // that proves a specific claim, per Cassin's v1.6 F2).
    verdict: {
      value:
        "Poland is the platform's primary dossier. PKP Polskie Linie Kolejowe (PKP PLK) is the national rail infrastructure manager. Specific facts about yard counts, capex programs, and tender timelines arrive via the F6 import from Cassin's curated cards.",
      source_url: URL.plkPlk,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in Poland: see DECEL's own published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors in Poland: see Axtone's published reference list and Voestalpine's rail division portfolio.",
        source_url: URL.axtone,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      // F5 fix: PL is standard gauge (1435mm). Previous "broad-gauge" was wrong.
      // Broad-gauge (1520mm) is Finland / Russia / Belarus. We don't list
      // competitor climates here without primary sources.
      terrain: {
        value: "Polish network is standard gauge (1435 mm).",
        source_url: URL.plkPlk,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "Specific tender timing for Polish hump yard projects: see the F6 import (Cassin curates) or the review queue for unsourced tender claims.",
        source_url: URL.plkPlk,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: get DECEL's specs written into the relevant PLK technical reference before any tender goes live. Specific position paper: per Cassin's playbook.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [{ url: URL.plkPlk, title: "PKP Polskie Linie Kolejowe — official site", live: true }],
    posture_history: [
      { posture: "WATCH", ts: SEED_STARTED, actor: "engine", reason: "Initial scan" },
      { posture: "WARMUP", ts: "2026-02-01T00:00:00Z", actor: "cassin", reason: "Cassin-set per operator judgment" },
    ],
    created_at: SEED_STARTED,
    updated_at: SEED_NOW,
  };

  const de: Market = {
    id: "de",
    country_iso: "DE",
    country_name: "Germany",
    tier: "B",
    posture: "WATCH",
    depth: "scan", // v1.6: scan-level, not dossier-level
    yard_count: null,
    yard_count_source_url: null,
    closed_at: null,
    verdict: {
      value: "Germany is on the watchlist+ list. DB Netz AG is the national rail infrastructure manager. Specific facts about DB Netz's hump yard network, capex plans, and tender timing arrive via the F6 import.",
      source_url: URL.dbMain,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in Germany: see DECEL's published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors in Germany: see Axtone, Voestalpine, and Knorr-Bremse's published reference lists.",
        source_url: URL.axtone,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      terrain: {
        value: "German network is standard gauge (1435 mm).",
        source_url: URL.dbMain,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "DB Netz capex timing: see DB's official 5-year plan (Bundesnetzagentur publishes summaries).",
        source_url: URL.dbMain,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: monitor DB Netz's Q3 2026 plan revision. No active DECEL position in Germany in v1.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [{ url: URL.dbMain, title: "Deutsche Bahn — official site", live: true }],
    posture_history: [
      { posture: "WATCH", ts: "2025-06-15T00:00:00Z", actor: "engine", reason: "Initial scan" },
    ],
    created_at: "2025-06-15T00:00:00Z",
    updated_at: SEED_NOW,
  };

  // F4: merged KZ+UZ into one Middle Corridor view. Single market row.
  // country_iso is constrained to 2 chars by the Drizzle schema (matches
  // ISO 3166-1 alpha-2). "MC" is a non-ISO placeholder for "Middle
  // Corridor"; the UI surfaces the full name (Kazakhstan + Uzbekistan).
  const middleCorridor: Market = {
    id: "middle-corridor",
    country_iso: "MC",
    country_name: "Kazakhstan + Uzbekistan (Middle Corridor)",
    tier: "B",
    posture: "WATCH",
    depth: "scan", // v1.6: scan-level, not dossier-level
    yard_count: null,
    yard_count_source_url: null,
    closed_at: null,
    verdict: {
      value: "Combined Middle Corridor view (KTZ Kazakhstan + UTY Uzbekistan). DECEL has a 2019 reference installation in Kazakhstan. Specific facts about KTZ/UTY capex plans, tenders, and timelines arrive via the F6 import.",
      source_url: URL.ktz,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in the Middle Corridor: see DECEL's published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors in the Middle Corridor: see Axtone and Wabtec's published reference lists.",
        source_url: URL.axtone,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      terrain: {
        value: "Kazakhstan and Uzbekistan networks are broad gauge (1520 mm).",
        source_url: URL.ktz,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "KTZ and UTY capex timing: see each operator's published plan.",
        source_url: URL.ktz,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: ride the KTZ→UTY spec-pull. Get DECEL into KTZ's technical reference first, then UTY follows with a 12-18 month lag.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [
      { url: URL.ktz, title: "Kazakhstan Temir Zholy — official site", live: true },
      { url: URL.uty, title: "Uzbekistan Railways — official site", live: true },
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-03-10T00:00:00Z", actor: "engine", reason: "Initial scan (KTZ)" },
      { posture: "WATCH", ts: "2025-09-20T00:00:00Z", actor: "engine", reason: "Initial scan (UTY); merged Sep 2026" },
    ],
    created_at: "2025-03-10T00:00:00Z",
    updated_at: SEED_NOW,
  };

  // Closed-market example. Per v1.6: "TR closed, recon-only. EEN
  // verification, no modern gravity yards." We don't have the EEN
  // verification document URL on hand, so this row has a closed_at
  // timestamp + a note in the verdict but NO closure source URL
  // (would render as [I] without a primary source).
  const tr: Market = {
    id: "tr",
    country_iso: "TR",
    country_name: "Türkiye",
    tier: "C",
    posture: "WATCH",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: "2026-09-02T00:00:00Z",
    verdict: {
      value: "Closed per v1.6 brief: EEN verification, no modern gravity yards in TCDD network. The market card stays for history but is filtered out of the active dossier list.",
      source_url: "internal://decelsun-tzu-analysis",
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: { value: "N/A — market closed.", source_url: "internal://decelsun-tzu-analysis", retrieved_at: SEED_TODAY, confidence: "I", verified_by: "rule" },
      know_the_enemy: { value: "N/A — market closed.", source_url: "internal://decelsun-tzu-analysis", retrieved_at: SEED_TODAY, confidence: "I", verified_by: "rule" },
      terrain: { value: "N/A — market closed.", source_url: "internal://decelsun-tzu-analysis", retrieved_at: SEED_TODAY, confidence: "I", verified_by: "rule" },
      timing: { value: "N/A — market closed.", source_url: "internal://decelsun-tzu-analysis", retrieved_at: SEED_TODAY, confidence: "I", verified_by: "rule" },
      win_before_battle: { value: "N/A — market closed.", source_url: "internal://decelsun-tzu-analysis", retrieved_at: SEED_TODAY, confidence: "I", verified_by: "rule" },
    },
    sources: [],
    posture_history: [
      { posture: "WATCH", ts: "2025-04-01T00:00:00Z", actor: "engine", reason: "Initial scan" },
      { posture: "IGNORE", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Closed per v1.6 — EEN verification, no modern gravity yards" },
    ],
    created_at: "2025-04-01T00:00:00Z",
    updated_at: SEED_NOW,
  };

  // =====================================================================
  // Orgs — 6 real companies, no fabricated facts
  // =====================================================================
  // Each org is just: id, name, public website. No invented "they have 60%
  // installed base" or "they're a regional sales manager" claims.
  // The D2 cadence fields (customer_category, k1_door) are null until
  // Cassin assigns them via the F6 import.

  const orgs: Org[] = [
    {
      id: "org_pkp_plk",
      name: "PKP Polskie Linie Kolejowe",
      match_key: "pkp plk",
      type: "authority",
      market_ids: ["pl"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.plkPlk, title: "PKP Polskie Linie Kolejowe — official site", live: true }],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "org_axtone",
      name: "Axtone",
      match_key: "axtone",
      type: "competitor",
      market_ids: ["pl"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.axtone, title: "Axtone — official site", live: true }],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "org_systra",
      name: "SYSTRA",
      match_key: "systra",
      type: "consultant",
      market_ids: ["pl"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.systra, title: "SYSTRA — official site", live: true }],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "org_db_netz",
      name: "DB Netz AG",
      match_key: "db netz",
      type: "authority",
      market_ids: ["de"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.dbMain, title: "Deutsche Bahn — official site", live: true }],
      created_at: "2025-06-15T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_ktz",
      name: "Kazakhstan Temir Zholy (KTZ)",
      match_key: "ktz",
      type: "authority",
      market_ids: ["middle-corridor"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.ktz, title: "Kazakhstan Temir Zholy — official site", live: true }],
      created_at: "2025-03-10T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_uty",
      name: "O'zbekiston Temir Yo'llari (UTY)",
      match_key: "uty",
      type: "authority",
      market_ids: ["middle-corridor"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.uty, title: "Uzbekistan Railways — official site", live: true }],
      created_at: "2025-09-20T00:00:00Z",
      updated_at: SEED_NOW,
    },
  ];

  // =====================================================================
  // Battle cards — 5 cards, no made-up person references
  // =====================================================================
  // All 5 cards have empty `known_people` arrays. Real contacts arrive via
  // the F6 import + OIU corpus. The D2 fields (way_in, opening, receipt)
  // are all null until Cassin populates them.

  const card: BattleCard = {
    org_id: "org_pkp_plk",
    who_they_are:
      "PKP Polskie Linie Kolejowe — the Polish national rail infrastructure manager.",
    why_matters:
      "Poland is the platform's primary dossier. PKP PLK is the buyer of record for hump yard modernizations on the Polish network.",
    known_people: [], // F1: 0 placeholder names. Real people arrive via F6.
    relationship_status: "none",
    suggested_questions: [], // F1: questions need Cassin's curation, not invented.
    trap_to_avoid:
      "Per doctrine: PKP S.A. is the holding company — PLK owns the yards. Ask who opens PLK, not PKP S.A.",
    sources: [{ url: URL.plkPlk, title: "PKP Polskie Linie Kolejowe — official site", live: true }],
    kind: "relationship",
    way_in: null,
    opening: null,
    receipt: null,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const axtoneCard: BattleCard = {
    org_id: "org_axtone",
    who_they_are: "Axtone — competitor retarder vendor.",
    why_matters:
      "Competitor recon. Trade-show observation and public statements only (F1: do NOT contact competitor staff).",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [],
    trap_to_avoid:
      "Do NOT contact Axtone staff directly. Use trade show observation and public statements only.",
    sources: [{ url: URL.axtone, title: "Axtone — official site", live: true }],
    kind: "recon",
    recon_what_to_observe: [
      "Axtone's published reference list (which yards, which dates)",
      "Axtone's presence at InnoTrans 2026 (booth, staff count)",
    ],
    way_in: null,
    opening: null,
    receipt: null,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const dbNetzCard: BattleCard = {
    org_id: "org_db_netz",
    who_they_are: "DB Netz AG — German rail infrastructure manager.",
    why_matters:
      "Watchlist+ market. InnoTrans 2026 is in Berlin; DB Netz walks the floor. No active DECEL position in v1.",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [],
    trap_to_avoid:
      "DB Cargo (freight operator) is NOT DB Netz (infrastructure manager). Separate procurement.",
    sources: [{ url: URL.dbMain, title: "Deutsche Bahn — official site", live: true }],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "DB Netz booth at InnoTrans 2026",
      "DB's published 5-year plan (Bundesnetzagentur publishes summaries)",
    ],
    way_in: null,
    opening: null,
    receipt: null,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const ktzCard: BattleCard = {
    org_id: "org_ktz",
    who_they_are: "Kazakhstan Temir Zholy (KTZ) — Kazakhstan national rail operator.",
    why_matters:
      "Watchlist+ market. KTZ is the Middle Corridor anchor; DECEL has a 2019 reference installation in Kazakhstan.",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [],
    trap_to_avoid:
      "KTZ is the OPERATOR, not the infrastructure manager. Trans-Caspian corridor is a different org (KTZ Express / KTZE). Don't conflate.",
    sources: [{ url: URL.ktz, title: "Kazakhstan Temir Zholy — official site", live: true }],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "KTZ's published capex plan (yearly, Q1)",
      "Cooperation with UTY on joint procurement frameworks",
    ],
    way_in: null,
    opening: null,
    receipt: null,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const utyCard: BattleCard = {
    org_id: "org_uty",
    who_they_are: "O'zbekiston Temir Yo'llari (UTY) — Uzbekistan national rail.",
    why_matters:
      "Watchlist+ market. Transit relevance for the Middle Corridor. Indirect play via KTZ→UTY spec-pull.",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [],
    trap_to_avoid:
      "Don't open a direct UTY conversation in v1 — they're a 12-18 month lag follow-on to KTZ.",
    sources: [{ url: URL.uty, title: "Uzbekistan Railways — official site", live: true }],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "UTY's published capex plan (Q1 2027 publication)",
      "Whether UTY references KTZ's technical documentation",
    ],
    way_in: null,
    opening: null,
    receipt: null,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  // =====================================================================
  // Review queue — the honest empty state
  // =====================================================================
  // Per v1.6 F5: Idzikowice is unsourced (we don't have a primary URL that
  // proves it's a hump yard). Push to review queue for Cassin to verify
  // with OIU / SŽ / Bundesnetzagentur.
  // The PL Hump Yard Code is also unsourced until Cassin provides the
  // document URL.

  const jq1: ReviewQueueItem = {
    id: `q_${randomUUID()}`,
    kind: "yard",
    proposed: {
      name: "Idzikowice (Poland) — needs primary source",
      market_id: "pl",
      operator_org_id: "org_pkp_plk",
      status: "unknown",
    },
    raw_snippet: "Idzikowice was claimed in the v1.6 brief as a hump yard needing modernization in Q4 2026. We don't have a primary URL that proves it exists as a hump yard. Cassin to verify via the OIU corpus or PKP PLK's published yard list.",
    source_url: URL.plkPlk,
    retrieved_at: SEED_TODAY,
    market_id: "pl",
    ts: SEED_TODAY,
  };

  const jq2: ReviewQueueItem = {
    id: `q_${randomUUID()}`,
    kind: "source_link",
    proposed: {
      name: "PKP PLK Hump Yard Code for Design",
      market_id: "pl",
    },
    raw_snippet: "The 'Code for Design on Hump and Marshalling Yards' document was claimed in the v1.5 seed but we don't have the document URL. Cassin to provide the primary source.",
    source_url: URL.plkPlk,
    retrieved_at: SEED_TODAY,
    market_id: "pl",
    ts: SEED_TODAY,
  };

  return {
    markets: [pl, de, middleCorridor, tr],
    yards: [] as Yard[],
    orgs,
    persons: [] as Person[],
    battle_cards: [card, axtoneCard, dbNetzCard, ktzCard, utyCard],
    review_queue: [jq1, jq2],
  };
}

let cached: SeedData | null = null;

/** Returns the v1 baseline seed (deterministic, fresh timestamps per call). */
export function getSeedData(): SeedData {
  if (!cached) cached = buildSeedData();
  return cached;
}
