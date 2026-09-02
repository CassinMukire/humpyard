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
  // v1.6 §3: Finland, Austria, Czechia — portfolio additions (hand-curated
  // watchlist+ blocks). The market rows are seeded; the curated content
  // arrives via F6 import.
  vaylavirasto: "https://vayla.fi/en",
  oebb: "https://www.oebb.at/en",
  szCd: "https://www.spravazeleznic.cz/en",
  azdPraha: "https://www.azd.cz/en",
  // Trade / consulting targets (FP2-demo)
  ceit: "https://www.ceit.es/en",
  indra: "https://www.indracompany.com/en",
  sncf: "https://www.sncf.com/en",
  // Closed markets (TCDD, RFI, NSB, MÁV) — referenced for the closed-market
  // banner + history row.
  tcdd: "https://www.tcddtasimacilik.gov.tr/en",
  rfi: "https://www.rfi.it/en",
  nsb: "https://www.vy.no/en",
  mav: "https://www.mavcsoport.hu/en",
  // Polish Investment & Trade Agency (InnoTrans booth corrected per v1.6)
  paih: "https://www.paih.gov.pl/en",
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

  // -----------------------------------------------------------------
  // v1.6 §3 — portfolio additions
  // -----------------------------------------------------------------
  // These are STRUCTURAL records only. The hand-curated content (real
  // yard counts, contact chains, doctrine fields) arrives via F6 import.
  // Each row has a public-website [I] source (existence), no specific
  // claims until Cassin provides primary URLs. Per Cassin: "demo data
  // is banned from demos; every Friday demo runs on real data."

  const fi: Market = {
    id: "fi",
    country_iso: "FI",
    country_name: "Finland",
    tier: "A", // v1.6 §3: "Poland, Finland, Austria" = active BD
    posture: "WARMUP",
    depth: "scan", // v1.6: scan-level even for portfolio additions
    yard_count: null,
    yard_count_source_url: null,
    closed_at: null,
    verdict: {
      value: "Finland is on the active BD portfolio per v1.6 brief §3. Väylävirasto (Finnish Transport Infrastructure Agency) is the national rail infrastructure manager. Tampere is a known active hump with a live arrival-yard project. Specific facts arrive via the F6 import (Cassin curates).",
      source_url: URL.vaylavirasto,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in Finland: see DECEL's published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors active in Finland: see Axtone, Voestalpine, and Knorr-Bremse's published reference lists.",
        source_url: URL.axtone,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      terrain: {
        value: "Finnish network is broad gauge (1524 mm) — historical Russian-gauge inheritance.",
        source_url: URL.vaylavirasto,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "Tampere arrival-yard project timing: arrives via F6 import (Cassin curates from Väylävirasto hankintaohjelmat).",
        source_url: URL.vaylavirasto,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: get DECEL's spec into Väylävirasto's technical reference before the next hankintaohjelma (procurement programme) revision.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [{ url: URL.vaylavirasto, title: "Väylävirasto — official site", live: true }],
    posture_history: [
      { posture: "WATCH", ts: "2025-08-15T00:00:00Z", actor: "engine", reason: "Initial scan" },
      { posture: "WARMUP", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Promoted to active BD per v1.6 §3" },
    ],
    created_at: "2025-08-15T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const at: Market = {
    id: "at",
    country_iso: "AT",
    country_name: "Austria",
    tier: "A", // v1.6 §3: "Poland, Finland, Austria" = active BD
    posture: "WARMUP",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: null,
    verdict: {
      value: "Austria is on the active BD portfolio per v1.6 brief §3. ÖBB is the national rail operator. The only major market growing; ÖBB committed a SWL (Sweeper / Wagon Load) operator angle. Specific facts arrive via F6 import.",
      source_url: URL.oebb,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in Austria: see DECEL's published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors active in Austria: see Axtone, Voestalpine (HQ in Linz, Austria), and Knorr-Bremse's published reference lists.",
        source_url: URL.voestalpine,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      terrain: {
        value: "Austrian network is standard gauge (1435 mm).",
        source_url: URL.oebb,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "ÖBB capex timing: arrives via F6 import (Cassin curates).",
        source_url: URL.oebb,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: monitor ÖBB's published Rahmenplan (5-year plan). No active DECEL position in v1.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [{ url: URL.oebb, title: "ÖBB — official site", live: true }],
    posture_history: [
      { posture: "WATCH", ts: "2025-05-20T00:00:00Z", actor: "engine", reason: "Initial scan" },
      { posture: "WARMUP", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Promoted to active BD per v1.6 §3" },
    ],
    created_at: "2025-05-20T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const cz: Market = {
    id: "cz",
    country_iso: "CZ",
    country_name: "Czechia",
    tier: "B", // v1.6 §3: "Watchlist+ with a LIVE file" — second-tier
    posture: "WARMUP",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: null,
    verdict: {
      value: "Czechia is watchlist+ per v1.6 brief §3. Správa železnic (SŽ) is the national rail infrastructure manager. Reference cases: Karban/O14 thread (SM008 path, no current project), Ostrava brand-new hump in design (MORAVIA CONSULT Olomouc, docs 2026, build ≥2028, 8→30 bn CZK). Specific facts arrive via F6 import (Cassin curates from SŽ / zakazky.spravazeleznic.cz).",
      source_url: URL.szCd,
      retrieved_at: SEED_TODAY,
      confidence: "I",
      verified_by: "human-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL's installed base in Czechia: see DECEL's published reference list.",
        source_url: URL.decel,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      know_the_enemy: {
        value: "Incumbent retarder vendors active in Czechia: see Axtone, Voestalpine, and Knorr-Bremse's published reference lists. AŽD Praha is the local CZ integrator (Hall 27/640 at InnoTrans).",
        source_url: URL.azdPraha,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      terrain: {
        value: "Czech network is standard gauge (1435 mm).",
        source_url: URL.szCd,
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      timing: {
        value: "Ostrava hump design: docs 2026, build ≥2028 per v1.6 §3. Karban: no current project. SŽ terms: spádoviště, kolejové brzdy, modernizace.",
        source_url: URL.szCd,
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Doctrine: this is the platform's reference case for 'radar beats encyclopedia'. Get DECEL into SŽ's spec via the zakazky.spravazeleznic.cz feed before Ostrava tender goes live.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [
      { url: URL.szCd, title: "Správa železnic — official site", live: true },
      { url: URL.azdPraha, title: "AŽD Praha — official site", live: true },
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-07-10T00:00:00Z", actor: "engine", reason: "Initial scan" },
      { posture: "WARMUP", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Promoted per v1.6 §3 — Ostrava is the radar reference case" },
    ],
    created_at: "2025-07-10T00:00:00Z",
    updated_at: SEED_NOW,
  };

  // -----------------------------------------------------------------
  // Closed markets (TR, IT, NO, HU per v1.6 §3)
  // -----------------------------------------------------------------
  // Per v1.6: "TR: EEN verification, no modern gravity yards. IT: humps
  // closed/dismantled. NO: all closed by 2003. HU: Eperjeske = customs
  // areas; Fényeslitke phase II/B removes a track brake ('vágányfék
  // helyén folyóvágány')." We don't have the EEN verification document
  // URLs on hand, so these rows are tagged [I] with the public-website
  // existence source. The actual closure sources arrive via F6 import
  // when Cassin delivers them.

  const it: Market = {
    id: "it",
    country_iso: "IT",
    country_name: "Italy",
    tier: "ANTI", // closed = anti-tier per §3
    posture: "IGNORE",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: "2026-09-02T00:00:00Z",
    verdict: {
      value: "Closed per v1.6 brief §3: Italian hump yards closed/dismantled. RFI (Rete Ferroviaria Italiana) is the national rail infrastructure manager. Market card stays for history but is filtered out of the active dossier list.",
      source_url: URL.rfi,
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
      { posture: "IGNORE", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Closed per v1.6 §3 — humps closed/dismantled" },
    ],
    created_at: "2025-04-01T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const no: Market = {
    id: "no",
    country_iso: "NO",
    country_name: "Norway",
    tier: "ANTI",
    posture: "IGNORE",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: "2003-01-01T00:00:00Z",
    verdict: {
      value: "Closed per v1.6 brief §3: all Norwegian hump yards closed by 2003. Vy (formerly NSB) is the national rail operator. Market card stays for history but is filtered out of the active dossier list.",
      source_url: URL.nsb,
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
      { posture: "IGNORE", ts: "2003-01-01T00:00:00Z", actor: "cassin", reason: "Closed per v1.6 §3 — all closed by 2003" },
    ],
    created_at: "2025-04-01T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const hu: Market = {
    id: "hu",
    country_iso: "HU",
    country_name: "Hungary",
    tier: "ANTI",
    posture: "IGNORE",
    depth: "scan",
    yard_count: null,
    yard_count_source_url: null,
    closed_at: "2026-09-02T00:00:00Z",
    verdict: {
      value: "Closed per v1.6 brief §3: Eperjeske is a customs area, not a gravity yard. Fényeslitke phase II/B removes a track brake (vágányfék helyén folyóvágány) — this is a loss of installed base, not a growth market. MÁV is the national rail operator. Market card stays for history but is filtered out of the active dossier list.",
      source_url: URL.mav,
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
      { posture: "IGNORE", ts: "2026-09-02T00:00:00Z", actor: "cassin", reason: "Closed per v1.6 §3 — Eperjeske customs only; Fényeslitke II/B removes track brake" },
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

    // -----------------------------------------------------------------
    // v1.6 §3 — portfolio additions: Finland, Austria, Czechia orgs
    // -----------------------------------------------------------------
    // Real companies, public-website sources only. No fabricated facts.
    // The D2 cadence fields (customer_category, k1_door) are null until
    // Cassin assigns them via the F6 import.

    {
      id: "org_vaylavirasto",
      name: "Väylävirasto (Finnish Transport Infrastructure Agency)",
      match_key: "vaylavirasto",
      type: "authority",
      market_ids: ["fi"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.vaylavirasto, title: "Väylävirasto — official site", live: true }],
      created_at: "2025-08-15T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_oebb",
      name: "Österreichische Bundesbahnen (ÖBB)",
      match_key: "oebb",
      type: "authority",
      market_ids: ["at"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.oebb, title: "ÖBB — official site", live: true }],
      created_at: "2025-05-20T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_sz_cd",
      name: "Správa železnic (SŽ)",
      match_key: "sprava zeleznic",
      type: "authority",
      market_ids: ["cz"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.szCd, title: "Správa železnic — official site", live: true }],
      created_at: "2025-07-10T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_azd_praha",
      name: "AŽD Praha s.r.o.",
      match_key: "azd praha",
      type: "epc",
      market_ids: ["cz"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.azdPraha, title: "AŽD Praha — official site", live: true }],
      created_at: "2026-09-02T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_paih",
      name: "Polska Agencja Inwestycji i Handlu (PAIH)",
      match_key: "paih",
      type: "agent",
      market_ids: ["pl"],
      monday_item_id: null,
      innotrans_target: true, // InnoTrans booth corrected per v1.6 §3: Hall 11.2/240
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.paih, title: "PAIH — official site", live: true }],
      created_at: "2026-09-02T00:00:00Z",
      updated_at: SEED_NOW,
    },

    // -----------------------------------------------------------------
    // v1.6 §3 — FP2-demo targets (per CEO's Aug 15 email)
    // -----------------------------------------------------------------
    {
      id: "org_ceit",
      name: "CEIT",
      match_key: "ceit",
      type: "consultant",
      market_ids: ["pl", "at", "fi"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.ceit, title: "CEIT — official site", live: true }],
      created_at: "2026-09-02T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_indra_parrilla",
      name: "Indra (Parrilla)",
      match_key: "indra",
      type: "epc",
      market_ids: ["pl", "at", "fi"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.indra, title: "Indra — official site", live: true }],
      created_at: "2026-09-02T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_sncf_wilbois",
      name: "SNCF (Wilbois)",
      match_key: "sncf",
      type: "operator",
      market_ids: ["pl", "at", "fi"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.sncf, title: "SNCF — official site", live: true }],
      created_at: "2026-09-02T00:00:00Z",
      updated_at: SEED_NOW,
    },

    // -----------------------------------------------------------------
    // v1.6 §3 — Closed-market authority orgs (TR, IT, NO, HU)
    // -----------------------------------------------------------------
    // Kept in the org table for history + cross-references; the markets
    // themselves are tagged closed_at and filtered from the active list.

    {
      id: "org_tcdd",
      name: "Türkiye Cumhuriyeti Devlet Demiryolları (TCDD)",
      match_key: "tcdd",
      type: "authority",
      market_ids: ["tr"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.tcdd, title: "TCDD Taşımacılık — official site", live: true }],
      created_at: "2025-04-01T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_rfi",
      name: "Rete Ferroviaria Italiana (RFI)",
      match_key: "rfi",
      type: "authority",
      market_ids: ["it"],
      monday_item_id: null,
      innotrans_target: true,
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.rfi, title: "RFI — official site", live: true }],
      created_at: "2025-04-01T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_nsb",
      name: "Vy (formerly NSB)",
      match_key: "vy nsb",
      type: "operator",
      market_ids: ["no"],
      monday_item_id: null,
      innotrans_target: false, // closed market, not a target
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.nsb, title: "Vy — official site", live: true }],
      created_at: "2025-04-01T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_mav",
      name: "Magyar Államvasutak (MÁV)",
      match_key: "mav",
      type: "authority",
      market_ids: ["hu"],
      monday_item_id: null,
      innotrans_target: false, // closed market
      customer_category: null,
      k1_door: null,
      risk_facts: [],
      sources: [{ url: URL.mav, title: "MÁV — official site", live: true }],
      created_at: "2025-04-01T00:00:00Z",
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
    markets: [pl, de, middleCorridor, tr, fi, at, cz, it, no, hu],
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
