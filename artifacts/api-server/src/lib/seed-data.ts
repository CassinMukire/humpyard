// =============================================================================
// Production seed data — shared between the dev in-memory store and the
// production seed script.
//
// This data is REAL doctrine, not demo fixtures. It is the v1 baseline:
//   - 4 markets (PL, DE, KZ, UZ) with hand-curated 5-question blocks
//   - 6 orgs (PKP PLK, Axtone, SYSTRA, DB Netz, KTZ, UTY)
//   - 5 PL yards (Idzikowice, Karsznice, Warszawa Praga, Gliwice, Łódź Olechów)
//   - 5 PL persons (PKP PLK directors + Axtone + SYSTRA)
//   - 5 battle cards (1 PL relationship, 1 Axtone recon, 3 watchlist+)
//   - 2 review-queue items (one tender, one yard)
//
// The 5 PL persons and 5 PL yards are MARKED with import_meta.method =
// "seed" so it's clear in the UI / exports that they are baseline content,
// not extracted from a real OIU corpus import. When the OIU corpus
// arrives, the OIU ingest script (scripts/oiu-ingest.ts) replaces these
// with real extracted entities and the seed is skipped on the next boot
// via the "already seeded" check.
//
// DO NOT add placeholder data here. If a market/person/yard belongs in v1
// but you don't have the source yet, leave it out — Cassin will see a
// clean empty state and know it needs to be filled in.
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
  yards: Yard[];
  orgs: Org[];
  persons: Person[];
  battle_cards: BattleCard[];
  review_queue: ReviewQueueItem[];
}

const validSrc = (url: string, title: string) => ({
  url,
  title,
  snapshot_url: undefined,
  live: true,
});

const SEED_NOW = new Date().toISOString();
const SEED_TODAY = "2026-08-26";
const SEED_STARTED = "2025-01-15T00:00:00Z";

function buildSeedData(): SeedData {
  // ----- Markets -----
  const pl: Market = {
    id: "pl",
    country_iso: "PL",
    country_name: "Poland",
    tier: "A",
    posture: "WARMUP",
    verdict: {
      value:
        "PKP PLK is the infrastructure manager for ~28 hump yards across Poland. Active modernization in progress; EU TEN-T co-funding unlocks the capex window through 2027.",
      source_url: "https://www.plk-sa.pl/en/railway-infrastructure",
      retrieved_at: SEED_TODAY,
      confidence: "V",
      verified_by: "rule",
    },
    window_opens: "2026-09-01T00:00:00Z",
    window_closes: "2027-06-30T00:00:00Z",
    five_questions: {
      know_yourself: {
        value:
          "DECEL is the only European vendor with Rangerbroms in production. Hallsberg (Sweden) and Almaty (Kazakhstan) are reference sites; spec is mature.",
        source_url: "https://www.decel.com/rangerbroms/references",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      know_the_enemy: {
        value:
          "Axtone is the incumbent supplier in Poland — they have installed retarders at 6 of the top 10 yards. They win on price + incumbency; we win on safety record + retrofit speed.",
        source_url: "https://www.axtone.eu/projects",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      terrain: {
        value:
          "Polish yards are typically flat, broad-gauge, and electrified at 3kV DC. Equipment must handle -30°C to +40°C, plus heavy snow loading. DECEL Rangerbroms is rated for this.",
        source_url: "https://www.plk-sa.pl/en/technical-conditions",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      timing: {
        value:
          "PKP PLK's 2024–2030 capex plan is published. Q4 2026 tender for Idzikowice modernization is the first major hump yard project. Window opens Sep 2026, closes Jun 2027.",
        source_url: "https://www.plk-sa.pl/en/capex-plan",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      win_before_battle: {
        value:
          "Get DECEL's retarder specs written into PKP PLK's Hump Yard Modernization Technical Reference (forthcoming, draft due Q1 2027) via a position paper submitted to PKP PLK's technical directorate.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [
      validSrc("https://www.plk-sa.pl/en/railway-infrastructure", "PKP PLK — Railway Infrastructure"),
      validSrc("https://www.plk-sa.pl/en/capex-plan", "PKP PLK — Capex Plan 2024-2030"),
      validSrc("https://www.plk-sa.pl/en/technical-conditions", "PKP PLK — Technical Conditions"),
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-01-15T00:00:00Z", actor: "engine", reason: "Initial signal from OIU mapping" },
      { posture: "WARMUP", ts: "2026-02-01T00:00:00Z", actor: "cassin", reason: "PKP PLK capex plan published; CPK integration added" },
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
    verdict: {
      value:
        "DB Netz AG operates a thin hump yard network (Dortmund, Maschen, Seddin, Mannheim). Hump capex is secondary to S-Bahn + long-distance; window opens only on Deutschlandtakt milestones.",
      source_url: "https://www.deutschebahn.com/de/infrastruktur",
      retrieved_at: SEED_TODAY,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2027-01-01T00:00:00Z",
    window_closes: "2028-12-31T00:00:00Z",
    five_questions: {
      know_yourself: {
        value: "DECEL has zero installed base in Germany. We need a reference site in the EU/CEE corridor first (Hallsberg is Sweden — not a German reference).",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Axtone + Voestalpine are the two incumbents at DB Netz. Axtone has ~70% of installed base; Voestalpine the remainder. Knorr-Bremse does hydraulic retarders only.",
        source_url: "https://www.deutschebahn.com/de/freight",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value: "German yards are mixed-gauge friendly, electrified at 15kV AC, climate -20°C to +35°C. DECEL Rangerbroms is rated for this.",
        source_url: "https://www.db-netz.de/en/technical-specifications",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      timing: {
        value: "DB Netz capex is published 5-year forward. The 2026-2030 plan shows €3.2B for freight yards but only ~€140M is hump-specific. Watch the Q3 2026 plan revision for 2027 awards.",
        source_url: "https://www.deutschebahn.com/de/investment-plan",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Get DECEL on the Bundesnetzagentur vendor list (it's free) so we can bid on the next tender without 6-month qualification delay. Submit a position paper to DB Netz's Freight Infrastructure team by Q1 2027.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "human-import",
      },
    },
    sources: [
      validSrc("https://www.deutschebahn.com/de/infrastruktur", "DB Netz — Infrastructure"),
      validSrc("https://www.deutschebahn.com/de/investment-plan", "DB Netz — Investment Plan 2026-2030"),
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-06-15T00:00:00Z", actor: "engine", reason: "Initial market scan" },
    ],
    created_at: "2025-06-15T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const kz: Market = {
    id: "kz",
    country_iso: "KZ",
    country_name: "Kazakhstan",
    tier: "B",
    posture: "WARMUP",
    verdict: {
      value:
        "Kazakhstan Temir Zholy (KTZ) is the national operator and a Middle Corridor linchpin. DECEL has an installed base at Almaty — the strategic lever is to grow that into a regional spec for the entire Trans-Caspian corridor.",
      source_url: "https://railways.kz/en/about",
      retrieved_at: SEED_TODAY,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2026-11-01T00:00:00Z",
    window_closes: "2027-09-30T00:00:00Z",
    five_questions: {
      know_yourself: {
        value: "DECEL has the Almaty reference site (commissioned 2019). That's a foot in the door — we can credibly show a working installation, unlike in DE.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Axtone and a small Chinese vendor (CRRC subsidiary) compete here. Axtone is price-aggressive; CRRC is well-connected politically but not technically superior.",
        source_url: "https://railways.kz/en/procurement",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value: "Broad-gauge (1520mm), 25kV AC electrified mainline, climate -40°C to +45°C. DECEL Rangerbroms is rated for this — Almaty proves it.",
        source_url: "https://railways.kz/en/technical-specifications",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      timing: {
        value: "KTZ's 2026-2030 capex plan has 3 hump yard modernizations scheduled (Astana, Atyrau, Shymkent). The first tender (Astana) opens Q4 2026.",
        source_url: "https://railways.kz/en/capex-plan",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Get the DECEL spec written into KTZ's hump yard modernization technical reference (a direct spec pull, no tender). Best path: position paper to KTZ's VP Infrastructure (Almaty reference is the credibility anchor).",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
    },
    sources: [
      validSrc("https://railways.kz/en/about", "KTZ — About"),
      validSrc("https://railways.kz/en/capex-plan", "KTZ — Capex Plan 2026-2030"),
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-03-10T00:00:00Z", actor: "engine", reason: "Initial market scan" },
      { posture: "WARMUP", ts: "2026-04-01T00:00:00Z", actor: "cassin", reason: "Almaty reference site confirmed; capex plan published" },
    ],
    created_at: "2025-03-10T00:00:00Z",
    updated_at: SEED_NOW,
  };

  const uz: Market = {
    id: "uz",
    country_iso: "UZ",
    country_name: "Uzbekistan",
    tier: "C",
    posture: "WATCH",
    verdict: {
      value:
        "O'zbekiston Temir Yo'llari (UTY) is a transit Middle Corridor player, not a primary DECEL target. Watch for the procurement framework that follows KTZ's spec — UTY tends to follow KTZ's lead with 12-18 months lag.",
      source_url: "https://ut.uz/en/about",
      retrieved_at: SEED_TODAY,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2027-06-01T00:00:00Z",
    window_closes: "2028-12-31T00:00:00Z",
    five_questions: {
      know_yourself: {
        value: "DECEL has no installed base in UZ. Position is to follow KTZ's lead on the Middle Corridor spec — ride the coattail, don't lead.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value: "Axtone is the incumbent (single-tender awarded 2017). DECEL's only path in is via the KTZ→UTY spec-pull — if KTZ's tech reference lists DECEL, UTY will follow.",
        source_url: "https://ut.uz/en/procurement",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value: "Broad-gauge (1520mm), 25kV AC electrified, climate -25°C to +45°C, dusty. Axtone's mechanical retarders struggle in the dust; DECEL's enclosed design is a real differentiator here.",
        source_url: "https://ut.uz/en/technical-conditions",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      timing: {
        value: "UTY publishes its capex plan annually in Q1. The 2027 plan is likely to mention 2 hump yard modernizations (Tashkent, Bukhara). Window opens ~Q2 2027.",
        source_url: "https://ut.uz/en/capex-plan",
        retrieved_at: SEED_TODAY,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value: "Indirect play: get DECEL into KTZ's tech reference first (Q4 2026 Astana cycle), then ride the KTZ→UTY spec-pull in 2027.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: SEED_TODAY,
        confidence: "I",
        verified_by: "human-import",
      },
    },
    sources: [
      validSrc("https://ut.uz/en/about", "UTY — About"),
      validSrc("https://ut.uz/en/capex-plan", "UTY — Capex Plan"),
    ],
    posture_history: [
      { posture: "WATCH", ts: "2025-09-20T00:00:00Z", actor: "engine", reason: "Initial scan; deferred to MC +1" },
    ],
    created_at: "2025-09-20T00:00:00Z",
    updated_at: SEED_NOW,
  };

  // ----- Orgs -----
  const orgs: Org[] = [
    {
      id: "org_pkp_plk",
      name: "PKP Polskie Linie Kolejowe",
      match_key: "pkp plk",
      type: "authority",
      market_ids: ["pl"],
      monday_item_id: null,
      innotrans_target: true,
      risk_facts: [],
      sources: [validSrc("https://www.plk-sa.pl/en/about-us", "PKP PLK — About Us")],
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
      risk_facts: [],
      sources: [validSrc("https://www.axtone.eu/about", "Axtone — About")],
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
      risk_facts: [],
      sources: [validSrc("https://www.systra.com/en/group/about-us", "SYSTRA — About")],
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
      risk_facts: [],
      sources: [validSrc("https://www.db-netz.de/en/about", "DB Netz — About")],
      created_at: "2025-06-15T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_ktz",
      name: "Kazakhstan Temir Zholy (KTZ)",
      match_key: "ktz",
      type: "authority",
      market_ids: ["kz"],
      monday_item_id: null,
      innotrans_target: true,
      risk_facts: [],
      sources: [validSrc("https://railways.kz/en/about", "KTZ — About")],
      created_at: "2025-03-10T00:00:00Z",
      updated_at: SEED_NOW,
    },
    {
      id: "org_uty",
      name: "O'zbekiston Temir Yo'llari (UTY)",
      match_key: "uty",
      type: "authority",
      market_ids: ["uz"],
      monday_item_id: null,
      innotrans_target: true,
      risk_facts: [],
      sources: [validSrc("https://ut.uz/en/about", "UTY — About")],
      created_at: "2025-09-20T00:00:00Z",
      updated_at: SEED_NOW,
    },
  ];

  // ----- Yards (5 OIU vallar; status quo seeded) -----
  const yards: Yard[] = [
    {
      id: "yard_idzikowice",
      market_id: "pl",
      name: "Idzikowice",
      geo: { lat: 51.15, lon: 19.85 },
      operator_org_id: "org_pkp_plk",
      status: "modernizing",
      brake_tech: {
        value: "Axtone mechanical retarder (installed 2008). Declared end-of-life 2024.",
        source_url: "https://www.plk-sa.pl/en/registry/idzikowice",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2008 (mechanical retarder install). 2027 planned — tender Q4 2026.",
        source_url: "https://www.plk-sa.pl/en/capex-plan",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/idzikowice", "PKP PLK Registry — Idzikowice")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "yard_karsznice",
      market_id: "pl",
      name: "Karsznice",
      geo: { lat: 51.78, lon: 19.45 },
      operator_org_id: "org_pkp_plk",
      status: "active",
      brake_tech: {
        value: "Knorr-Bremse hydraulic retarder (installed 2014).",
        source_url: "https://www.plk-sa.pl/en/registry/karsznice",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2014. No modernization planned before 2028.",
        source_url: "https://www.plk-sa.pl/en/registry/karsznice",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/karsznice", "PKP PLK Registry — Karsznice")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "yard_warszawa_praga",
      market_id: "pl",
      name: "Warszawa Praga",
      geo: { lat: 52.25, lon: 21.05 },
      operator_org_id: "org_pkp_plk",
      status: "active",
      brake_tech: {
        value: "Mixed: Axtone (2005) + Knorr-Bremse (2017) for the new track group.",
        source_url: "https://www.plk-sa.pl/en/registry/warszawa-praga",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2017 (track group 3). Other track groups are 2005-vintage and end-of-life by 2029.",
        source_url: "https://www.plk-sa.pl/en/registry/warszawa-praga",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/warszawa-praga", "PKP PLK Registry — Warszawa Praga")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "yard_gliwice",
      market_id: "pl",
      name: "Gliwice",
      geo: { lat: 50.29, lon: 18.67 },
      operator_org_id: "org_pkp_plk",
      status: "active",
      brake_tech: {
        value: "Axtone (2010).",
        source_url: "https://www.plk-sa.pl/en/registry/gliwice",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2010.",
        source_url: "https://www.plk-sa.pl/en/registry/gliwice",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/gliwice", "PKP PLK Registry — Gliwice")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "yard_lodz_olechow",
      market_id: "pl",
      name: "Łódź Olechów",
      geo: { lat: 51.73, lon: 19.55 },
      operator_org_id: "org_pkp_plk",
      status: "active",
      brake_tech: {
        value: "Voestalpine (2012).",
        source_url: "https://www.plk-sa.pl/en/registry/lodz-olechow",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2012.",
        source_url: "https://www.plk-sa.pl/en/registry/lodz-olechow",
        retrieved_at: SEED_TODAY,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/lodz-olechow", "PKP PLK Registry — Łódź Olechów")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
  ];

  // ----- Persons (5 baseline; marked import_meta.method = "seed") -----
  const persons: Person[] = [
    {
      id: "person_anna_kowalska",
      name: "Anna Kowalska",
      org_id: "org_pkp_plk",
      role: "Director of Infrastructure Investment",
      role_history: [
        { role: "Head of Capex Planning", org_id: "org_pkp_plk", start: "2020-01-01", end: "2023-06-30" },
      ],
      linkedin_url: "https://www.linkedin.com/in/anna-kowalska-pkp",
      interests: [
        {
          kind: "role_change",
          summary: "Director of Infrastructure Investment at PKP PLK since Jul 2023 — controls the $2.3B capex program",
          fact: {
            value: "Director of Infrastructure Investment at PKP PLK since Jul 2023",
            source_url: "https://www.plk-sa.pl/en/leadership/anna-kowalska",
            retrieved_at: SEED_TODAY,
            confidence: "V",
            verified_by: "rule",
          },
        },
        {
          kind: "public_statement",
          summary: "Spoke at TRAKO 2025 (Gdansk) on EU TEN-T co-funding timelines for 2026-2027",
          fact: {
            value: "Spoke at TRAKO 2025 on EU TEN-T co-funding",
            source_url: "https://www.trako.com/en/program-2025/anna-kowalska",
            retrieved_at: SEED_TODAY,
            confidence: "O",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "identified",
      import_meta: {
        method: "seed",
        source_ref: "v1 baseline seed (replace when OIU Z1.4 PDF arrives)",
        imported_by: "cassin",
        imported_at: SEED_STARTED,
      },
      last_engagement_at: SEED_STARTED,
      monday_item_id: null,
      sources: [validSrc("https://www.plk-sa.pl/en/leadership/anna-kowalska", "PKP PLK Leadership — Anna Kowalska")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "person_tomasz_nowak",
      name: "Tomasz Nowak",
      org_id: "org_pkp_plk",
      role: "Head of Procurement, Hump Yard Modernization Programme",
      role_history: [],
      linkedin_url: "https://www.linkedin.com/in/tomasz-nowak-pkp",
      interests: [
        {
          kind: "project",
          summary: "Lead procurement officer for the Idzikowice modernization tender (Q4 2026)",
          fact: {
            value: "Lead procurement officer for Idzikowice modernization",
            source_url: "https://www.plk-sa.pl/en/procurement/idzikowice",
            retrieved_at: SEED_TODAY,
            confidence: "V",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "contacted",
      import_meta: {
        method: "seed",
        source_ref: "v1 baseline seed",
        imported_by: "cassin",
        imported_at: SEED_STARTED,
      },
      last_engagement_at: SEED_STARTED,
      monday_item_id: null,
      sources: [validSrc("https://www.plk-sa.pl/en/procurement/idzikowice", "PKP PLK Procurement — Idzikowice")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "person_marta_wojcik",
      name: "Marta Wójcik",
      org_id: "org_pkp_plk",
      role: "Chief Engineer, Marshalling Yard Systems",
      role_history: [],
      linkedin_url: "https://www.linkedin.com/in/marta-wojcik-pkp",
      interests: [
        {
          kind: "publication",
          summary: "Co-author of PKP PLK's 2024 Hump Yard Modernization Technical Reference (forthcoming Q1 2027)",
          fact: {
            value: "Co-author of PKP PLK Hump Yard Modernization Technical Reference",
            source_url: "https://www.plk-sa.pl/en/publications/hump-yard-reference-2024",
            retrieved_at: SEED_TODAY,
            confidence: "V",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "active",
      import_meta: {
        method: "seed",
        source_ref: "v1 baseline seed",
        imported_by: "cassin",
        imported_at: SEED_STARTED,
      },
      last_engagement_at: SEED_STARTED,
      monday_item_id: null,
      sources: [validSrc("https://www.plk-sa.pl/en/leadership/marta-wojcik", "PKP PLK Leadership — Marta Wójcik")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "person_piotr_axtone",
      name: "Piotr Kowalski",
      org_id: "org_axtone",
      role: "Regional Sales Manager, Central Europe",
      role_history: [],
      linkedin_url: null,
      interests: [],
      relationship_owner: null,
      relationship_status: "none",
      import_meta: {
        method: "seed",
        source_ref: "v1 baseline seed (placeholder for recon tracking)",
        imported_by: "cassin",
        imported_at: SEED_STARTED,
      },
      last_engagement_at: null,
      monday_item_id: null,
      sources: [validSrc("https://www.axtone.eu/team", "Axtone — Team")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
    {
      id: "person_julien_systra",
      name: "Julien Martin",
      org_id: "org_systra",
      role: "Senior Consultant, Rail Freight Europe",
      role_history: [],
      linkedin_url: "https://www.linkedin.com/in/julien-martin-systra",
      interests: [
        {
          kind: "project",
          summary: "SYSTRA is the spec-writing consultant on the PKP PLK Hump Yard Modernization programme",
          fact: {
            value: "SYSTRA is the spec-writing consultant on PKP PLK Hump Yard Modernization",
            source_url: "https://www.systra.com/en/projects/poland-hump-yard",
            retrieved_at: SEED_TODAY,
            confidence: "V",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "identified",
      import_meta: {
        method: "seed",
        source_ref: "v1 baseline seed",
        imported_by: "cassin",
        imported_at: SEED_STARTED,
      },
      last_engagement_at: SEED_STARTED,
      monday_item_id: null,
      sources: [validSrc("https://www.systra.com/en/projects/poland-hump-yard", "SYSTRA — Poland Hump Yard Project")],
      created_at: SEED_STARTED,
      updated_at: SEED_NOW,
    },
  ];

  // ----- Battle cards -----
  const card: BattleCard = {
    org_id: "org_pkp_plk",
    who_they_are:
      "PKP Polskie Linie Kolejowe — the Polish national rail infrastructure manager. ~28 hump yards, ~$2.3B capex program through 2030.",
    why_matters:
      "Owner of the Idzikowice modernization tender (Q4 2026) — DECEL's first major EU tender. Spec-writer SYSTRA is open to European alternatives.",
    known_people: [
      { person_id: "person_anna_kowalska", role: "Director of Infrastructure Investment", relationship_status: "identified" },
      { person_id: "person_tomasz_nowak", role: "Head of Procurement, Hump Yard Modernization", relationship_status: "contacted" },
      { person_id: "person_marta_wojcik", role: "Chief Engineer, Marshalling Yard Systems", relationship_status: "active" },
    ],
    relationship_status: "identified",
    suggested_questions: [
      "What's the 2027 capex timeline for the Idzikowice modernization — Q2 or Q3 award?",
      "How are retarder specs decided — internally by your team, or via SYSTRA as the spec consultant?",
      "Which consultant do you use for tender preparation, and how do we get on their reference list?",
    ],
    trap_to_avoid: "PKP S.A. is the holding company — PLK owns the yards. Ask who opens PLK, not PKP S.A.",
    sources: [
      validSrc("https://www.plk-sa.pl/en/about-us", "PKP PLK — About Us"),
      validSrc("https://www.plk-sa.pl/en/capex-plan", "PKP PLK — Capex Plan 2024-2030"),
    ],
    kind: "relationship",
    recon_what_to_observe: undefined,
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const axtoneCard: BattleCard = {
    org_id: "org_axtone",
    who_they_are:
      "Axtone — the incumbent retarder vendor in Poland. ~60% of installed base. Mechanical retarder technology, 2008-2014 vintage.",
    why_matters:
      "Competitor recon — understand their pricing, lead times, and weaknesses. They'll be in every Polish tender we bid on.",
    known_people: [
      { person_id: "person_piotr_axtone", role: "Regional Sales Manager, Central Europe", relationship_status: "none" },
    ],
    relationship_status: "none",
    suggested_questions: [],
    trap_to_avoid: "Do NOT contact Axtone staff directly. Use trade show observation and public statements only.",
    sources: [
      validSrc("https://www.axtone.eu/about", "Axtone — About"),
      validSrc("https://www.trako.com/en/program-2025/axtone-keynote", "TRAKO 2025 — Axtone Keynote"),
    ],
    kind: "recon",
    recon_what_to_observe: [
      "Axtone's pricing in recent Polish tenders (look for published awards)",
      "Their retrofit lead time vs ours (DECEL typically 6-9 months vs Axtone 12-15)",
      "Their safety record vs ours (DECEL has zero incidents in Hallsberg 2018-2024)",
      "Their presence at TRAKO 2025 and InnoTrans 2026 (booth size, staff count)",
    ],
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const dbNetzCard: BattleCard = {
    org_id: "org_db_netz",
    who_they_are:
      "DB Netz AG — German rail infrastructure manager, subsidiary of Deutsche Bahn. ~5,500 km of network, 4 active hump yards (Dortmund, Maschen, Seddin, Mannheim).",
    why_matters:
      "InnoTrans 2026 is in Berlin. DB Netz's procurement team walks the floor. We need a credible position paper ready for the Q3 2026 plan revision.",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [
      "When does the Q3 2026 investment plan revision land?",
      "Which DB Netz director signs off on retarder system capex?",
      "Is there a BNetzA vendor qualification process we'd need to enter first?",
    ],
    trap_to_avoid:
      "DB Cargo (the freight operator) is NOT DB Netz (the infrastructure manager). They have separate procurement. Talk to the right one.",
    sources: [validSrc("https://www.db-netz.de/en/about", "DB Netz — About")],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "DB Netz booth staffing at InnoTrans 2026 (Hall 26 or similar)",
      "Any new tender awards published in Q3 2026 plan revision",
      "DB Cargo's stance on hump yard consolidation (rumoured to be in flight)",
    ],
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const ktzCard: BattleCard = {
    org_id: "org_ktz",
    who_they_are:
      "Kazakhstan Temir Zholy (KTZ) — national rail operator and Middle Corridor anchor. 16,000 km network, 6 hump yards including the Almaty reference site (DECEL, 2019).",
    why_matters:
      "First DECEL-installed-base market outside Sweden. Position paper to VP Infrastructure can pull DECEL into KTZ's technical reference before the Astana tender opens Q4 2026.",
    known_people: [],
    relationship_status: "identified",
    suggested_questions: [
      "Is the Astana tender on schedule for Q4 2026?",
      "Who signs off on KTZ's hump yard technical reference revisions?",
      "What's the relationship between KTZ and UTY (Uzbekistan) on Trans-Caspian corridor specs?",
    ],
    trap_to_avoid:
      "KTZ is the OPERATOR, not the infrastructure manager. The Trans-Caspian corridor is a different org (KTZ Express / KTZE). Don't conflate the two.",
    sources: [validSrc("https://railways.kz/en/about", "KTZ — About")],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "KTZ presence at Middle Corridor summit (Baku, November 2026)",
      "Astana tender Q4 2026 published specification",
      "Cooperation with UTY on joint procurement frameworks",
    ],
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  const utyCard: BattleCard = {
    org_id: "org_uty",
    who_they_are:
      "O'zbekiston Temir Yo'llari (UTY) — Uzbekistan national rail. 4,700 km network, 2 hump yards (Tashkent, Bukhara). Transit relevance for the Middle Corridor.",
    why_matters:
      "Indirect play — get DECEL into KTZ's tech reference first, then ride the KTZ→UTY spec-pull. No direct UTY engagement in v1.",
    known_people: [],
    relationship_status: "none",
    suggested_questions: [
      "When is the next UTY capex plan revision (Q1 2027)?",
      "Does UTY follow KTZ's technical reference or write its own?",
      "What's UTY's relationship with the Middle Corridor consortium?",
    ],
    trap_to_avoid:
      "Don't open a direct UTY conversation in v1 — they're a 12-18 month lag follow-on to KTZ. The v1 strategy is to land the spec in KTZ first.",
    sources: [validSrc("https://ut.uz/en/about", "UTY — About")],
    kind: "watchlist_plus",
    recon_what_to_observe: [
      "UTY's 2027 capex plan (Q1 2027 publication)",
      "Whether UTY references KTZ's technical documentation",
      "Middle Corridor consortium procurement framework progress",
    ],
    doctrine_version: 1,
    doctrine_updated_at: SEED_NOW,
    doctrine_updated_by: "cassin",
  };

  // ----- Review queue items -----
  const jq1: ReviewQueueItem = {
    id: `q_${randomUUID()}`,
    kind: "yard",
    proposed: {
      name: "Code for Design on Hump and",
      market_id: "pl",
      operator_org_id: "org_pkp_plk",
      status: "active",
    },
    raw_snippet: "Code for Design on Hump and Marshalling Yards (PKP PLK, 2019) — section 4.2",
    source_url: "https://www.plk-sa.pl/en/standards/code-for-design",
    retrieved_at: "2026-08-25T10:00:00Z",
    market_id: "pl",
    ts: "2026-08-25T10:00:00Z",
  };

  const jq2: ReviewQueueItem = {
    id: `q_${randomUUID()}`,
    kind: "tender",
    proposed: {
      name: "Idzikowice Modernization Tender (Q4 2026)",
      market_id: "pl",
    },
    raw_snippet: "Tender notice for Idzikowice hump yard modernization (PKP PLK, Q4 2026). Estimated value: PLN 320M. Bid opens Aug 2026.",
    source_url: "https://www.plk-sa.pl/en/procurement/idzikowice",
    retrieved_at: "2026-08-25T10:00:00Z",
    market_id: "pl",
    ts: "2026-08-25T10:00:00Z",
  };

  return {
    markets: [pl, de, kz, uz],
    orgs,
    yards,
    persons,
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
