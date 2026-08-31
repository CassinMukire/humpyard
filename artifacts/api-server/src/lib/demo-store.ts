// =============================================================================
// Demo mode — in-memory implementation of queue-store
//
// Activated when DATABASE_URL is unset, set to "memory", or DEMO_MODE=true.
// Everything is in-process; nothing persists across server restarts. Used
// for the W35 demo while the real Postgres is being set up.
//
// The interface mirrors queue-store.ts so the route handlers are unchanged.
// When DATABASE_URL is set to a real Postgres URL, queue-store.ts is used
// instead. The choice is made in lib/store-factory.ts.
// =============================================================================

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ReviewQueueItem,
  Correction,
  Market,
  Yard,
  Org,
  Person,
  Play,
  MeetingLog,
  BattleCard,
  DoctrineRevision,
} from "@workspace/api-zod";
import { isQueueItemStale } from "./trust-layer";
import { logger } from "./logger";

const markets = new Map<string, Market>();
const yards = new Map<string, Yard>();
const orgs = new Map<string, Org>();
const persons = new Map<string, Person>();
const plays = new Map<string, Play>();
const reviewQueue = new Map<string, ReviewQueueItem>();
const corrections: Correction[] = [];
const meetings: MeetingLog[] = [];
const battleCards = new Map<string, BattleCard>();
const doctrineRevisions: DoctrineRevision[] = [];
const rejectionHashes = new Set<string>();

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// File persistence — demo store survives restarts.
//
// Default path: data/demo-store.json (relative to api-server cwd). Override
// with DEMO_STORE_FILE env var. Writes are best-effort: a failed write logs
// a warning and the in-memory state continues.
// -----------------------------------------------------------------------------

const PERSIST_FILE = process.env["DEMO_STORE_FILE"] ?? join(process.cwd(), "data", "demo-store.json");
const PERSIST_DEBOUNCE_MS = 250;

interface DemoSnapshot {
  version: 1;
  saved_at: string;
  markets: Market[];
  yards: Yard[];
  orgs: Org[];
  persons: Person[];
  plays: Play[];
  review_queue: ReviewQueueItem[];
  corrections: Correction[];
  meetings: MeetingLog[];
  battle_cards: BattleCard[];
  doctrine_revisions: DoctrineRevision[];
  rejection_hashes: string[];
}

let persistTimer: NodeJS.Timeout | null = null;

function persistNow(): void {
  try {
    const snap: DemoSnapshot = {
      version: 1,
      saved_at: new Date().toISOString(),
      markets: Array.from(markets.values()),
      yards: Array.from(yards.values()),
      orgs: Array.from(orgs.values()),
      persons: Array.from(persons.values()),
      plays: Array.from(plays.values()),
      review_queue: Array.from(reviewQueue.values()),
      corrections: [...corrections],
      meetings: [...meetings],
      battle_cards: Array.from(battleCards.values()),
      doctrine_revisions: [...doctrineRevisions],
      rejection_hashes: Array.from(rejectionHashes),
    };
    mkdirSync(dirname(PERSIST_FILE), { recursive: true });
    writeFileSync(PERSIST_FILE, JSON.stringify(snap, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err, file: PERSIST_FILE }, "demo-store: failed to persist snapshot");
  }
}

function persist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function loadFromDisk(): boolean {
  if (!existsSync(PERSIST_FILE)) return false;
  try {
    const raw = readFileSync(PERSIST_FILE, "utf8");
    const snap = JSON.parse(raw) as DemoSnapshot;
    if (snap.version !== 1) {
      logger.warn({ version: snap.version }, "demo-store: unknown snapshot version, ignoring");
      return false;
    }
    markets.clear();
    snap.markets.forEach((m) => markets.set(m.id, m));
    yards.clear();
    snap.yards.forEach((y) => yards.set(y.id, y));
    orgs.clear();
    snap.orgs.forEach((o) => orgs.set(o.id, o));
    persons.clear();
    snap.persons.forEach((p) => persons.set(p.id, p));
    plays.clear();
    snap.plays.forEach((p) => plays.set(p.id, p));
    reviewQueue.clear();
    snap.review_queue.forEach((q) => reviewQueue.set(q.id, q));
    corrections.length = 0;
    corrections.push(...snap.corrections);
    meetings.length = 0;
    meetings.push(...snap.meetings);
    battleCards.clear();
    snap.battle_cards.forEach((b) => battleCards.set(b.org_id, b));
    doctrineRevisions.length = 0;
    doctrineRevisions.push(...snap.doctrine_revisions);
    rejectionHashes.clear();
    snap.rejection_hashes.forEach((h) => rejectionHashes.add(h));
    // Empty snapshot — treat as a fresh seed. A previous run might have
    // saved an empty file before the seed completed, or someone reset the
    // file by hand. Either way, re-seed.
    if (markets.size === 0 && orgs.size === 0 && persons.size === 0) {
      logger.info({ file: PERSIST_FILE }, "demo-store: snapshot empty, will re-seed");
      return false;
    }
    logger.info(
      { file: PERSIST_FILE, markets: markets.size, yards: yards.size, persons: persons.size, cards: battleCards.size },
      "demo-store: loaded snapshot from disk",
    );
    return true;
  } catch (err) {
    logger.warn({ err, file: PERSIST_FILE }, "demo-store: failed to load snapshot, will seed fresh");
    return false;
  }
}

// -----------------------------------------------------------------------------
// Demo seed data — Poland dossier + 5 OIU vallar + 3 orgs + 5 persons + a
// couple of review-queue items. The seed runs on first access.
// -----------------------------------------------------------------------------

let seeded = false;
function seed(): void {
  if (seeded) return;
  seeded = true;

  const now = nowIso();
  const today = "2026-08-26";
  const validSrc = (url: string, title: string) => ({
    url,
    title,
    snapshot_url: undefined,
    live: true,
  });

  // Poland market
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
      retrieved_at: today,
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      know_the_enemy: {
        value:
          "Axtone is the incumbent supplier in Poland — they have installed retarders at 6 of the top 10 yards. They win on price + incumbency; we win on safety record + retrofit speed.",
        source_url: "https://www.axtone.eu/projects",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      terrain: {
        value:
          "Polish yards are typically flat, broad-gauge, and electrified at 3kV DC. Equipment must handle -30°C to +40°C, plus heavy snow loading. DECEL Rangerbroms is rated for this.",
        source_url: "https://www.plk-sa.pl/en/technical-conditions",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      timing: {
        value:
          "PKP PLK's 2024–2030 capex plan is published. Q4 2026 tender for Idzikowice modernization is the first major hump yard project. Window opens Sep 2026, closes Jun 2027.",
        source_url: "https://www.plk-sa.pl/en/capex-plan",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      win_before_battle: {
        value:
          "Get DECEL's retarder specs written into PKP PLK's Hump Yard Modernization Technical Reference (forthcoming, draft due Q1 2027) via a position paper submitted to PKP PLK's technical directorate.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
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
      {
        posture: "WATCH",
        ts: "2025-01-15T00:00:00Z",
        actor: "engine",
        reason: "Initial signal from OIU mapping",
      },
      {
        posture: "WARMUP",
        ts: "2026-02-01T00:00:00Z",
        actor: "cassin",
        reason: "PKP PLK capex plan published; CPK integration added",
      },
    ],
    created_at: "2025-01-15T00:00:00Z",
    updated_at: now,
  };
  markets.set(pl.id, pl);

  // 3 orgs: PKP PLK (operator/authority), Axtone (competitor), SYSTRA (consultant)
  const orgsData: Org[] = [
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
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
    },
  ];
  for (const o of orgsData) orgs.set(o.id, o);

  // 5 yards — the OIU vallar (placeholder names; real corpus pending)
  const yardsData: Yard[] = [
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2008 (mechanical retarder install). 2027 planned — tender Q4 2026.",
        source_url: "https://www.plk-sa.pl/en/capex-plan",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/idzikowice", "PKP PLK Registry — Idzikowice")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2014. No modernization planned before 2028.",
        source_url: "https://www.plk-sa.pl/en/registry/karsznice",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/karsznice", "PKP PLK Registry — Karsznice")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2017 (track group 3). Other track groups are 2005-vintage and end-of-life by 2029.",
        source_url: "https://www.plk-sa.pl/en/registry/warszawa-praga",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/warszawa-praga", "PKP PLK Registry — Warszawa Praga")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2010.",
        source_url: "https://www.plk-sa.pl/en/registry/gliwice",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/gliwice", "PKP PLK Registry — Gliwice")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      last_modernized: {
        value: "2012.",
        source_url: "https://www.plk-sa.pl/en/registry/lodz-olechow",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      sources: [validSrc("https://www.plk-sa.pl/en/registry/lodz-olechow", "PKP PLK Registry — Łódź Olechów")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
    },
  ];
  for (const y of yardsData) yards.set(y.id, y);

  // 5 persons — directors / spec-writers at PKP PLK + competitors + consultant
  const personsData: Person[] = [
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
            retrieved_at: today,
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
            retrieved_at: today,
            confidence: "O",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "identified",
      import_meta: {
        method: "doc-import",
        source_ref: "OIU_Z1.4.xlsx#sheet=contacts",
        imported_by: "cassin",
        imported_at: "2025-01-15T00:00:00Z",
      },
      last_engagement_at: "2025-01-15T00:00:00Z",
      monday_item_id: null,
      sources: [validSrc("https://www.plk-sa.pl/en/leadership/anna-kowalska", "PKP PLK Leadership — Anna Kowalska")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
            retrieved_at: today,
            confidence: "V",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "contacted",
      import_meta: {
        method: "doc-import",
        source_ref: "OIU_Z1.4.xlsx#sheet=contacts",
        imported_by: "cassin",
        imported_at: "2025-01-15T00:00:00Z",
      },
      last_engagement_at: "2025-02-10T00:00:00Z",
      monday_item_id: null,
      sources: [validSrc("https://www.plk-sa.pl/en/procurement/idzikowice", "PKP PLK Procurement — Idzikowice")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
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
          summary: "Published 'Modernization of Polish Marshalling Yards 2024-2030' in Rynek Kolejowy (Q1 2026)",
          fact: {
            value: "Published 'Modernization of Polish Marshalling Yards 2024-2030' in Rynek Kolejowy Q1 2026",
            source_url: "https://www.rynek-kolejowy.pl/2026-q1/wojcik-modernization",
            retrieved_at: today,
            confidence: "O",
            verified_by: "rule",
          },
        },
        {
          kind: "conference",
          summary: "Co-presenter at TRAKO 2025 workshop on retarder spec design",
          fact: {
            value: "Co-presenter at TRAKO 2025 retarder spec workshop",
            source_url: "https://www.trako.com/en/program-2025/workshop-retarders",
            retrieved_at: today,
            confidence: "O",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "active",
      import_meta: {
        method: "doc-import",
        source_ref: "OIU_Z1.4.xlsx#sheet=contacts",
        imported_by: "cassin",
        imported_at: "2025-01-15T00:00:00Z",
      },
      last_engagement_at: "2025-08-10T00:00:00Z",
      monday_item_id: null,
      sources: [validSrc("https://www.rynek-kolejowy.pl/2026-q1/wojcik", "Rynek Kolejowy Q1 2026")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
    },
    {
      id: "person_piotr_axtone",
      name: "Piotr Kowalski",
      org_id: "org_axtone",
      role: "Regional Sales Manager, Central Europe",
      role_history: [],
      linkedin_url: "https://www.linkedin.com/in/piotr-kowalski-axtone",
      interests: [
        {
          kind: "public_statement",
          summary: "Stated publicly at TRAKO 2025 that Axtone holds 60% of the Polish hump yard installed base",
          fact: {
            value: "Axtone holds 60% of Polish hump yard installed base (TRAKO 2025)",
            source_url: "https://www.trako.com/en/program-2025/axtone-keynote",
            retrieved_at: today,
            confidence: "O",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: null,
      relationship_status: "none",
      import_meta: {
        method: "human-import",
        source_ref: "competitive-intel-2025-q3",
        imported_by: "cassin",
        imported_at: "2025-09-01T00:00:00Z",
      },
      last_engagement_at: null,
      monday_item_id: null,
      sources: [validSrc("https://www.trako.com/en/program-2025/axtone-keynote", "TRAKO 2025 — Axtone Keynote")],
      created_at: "2025-09-01T00:00:00Z",
      updated_at: now,
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
            retrieved_at: today,
            confidence: "V",
            verified_by: "rule",
          },
        },
        {
          kind: "publication",
          summary: "Authored 'European Hump Yard Spec Standards 2025' — referenced in the PKP PLK Technical Reference",
          fact: {
            value: "Authored 'European Hump Yard Spec Standards 2025'",
            source_url: "https://www.systra.com/en/publications/hump-yard-spec-2025",
            retrieved_at: today,
            confidence: "O",
            verified_by: "rule",
          },
        },
      ],
      relationship_owner: "cassin",
      relationship_status: "identified",
      import_meta: {
        method: "doc-import",
        source_ref: "OIU_Z1.4.xlsx#sheet=contacts",
        imported_by: "cassin",
        imported_at: "2025-01-15T00:00:00Z",
      },
      last_engagement_at: "2025-01-15T00:00:00Z",
      monday_item_id: null,
      sources: [validSrc("https://www.systra.com/en/projects/poland-hump-yard", "SYSTRA — Poland Hump Yard Project")],
      created_at: "2025-01-15T00:00:00Z",
      updated_at: now,
    },
  ];
  for (const p of personsData) persons.set(p.id, p);

  // 1 battle card — PKP PLK, relationship kind
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
    trap_to_avoid:
      "PKP S.A. is the holding company — PLK owns the yards. Ask who opens PLK, not PKP S.A.",
    sources: [
      validSrc("https://www.plk-sa.pl/en/about-us", "PKP PLK — About Us"),
      validSrc("https://www.plk-sa.pl/en/capex-plan", "PKP PLK — Capex Plan 2024-2030"),
    ],
    kind: "relationship",
    recon_what_to_observe: undefined,
    doctrine_version: 1,
    doctrine_updated_at: now,
    doctrine_updated_by: "cassin",
  };
  battleCards.set(card.org_id, card);

  // 1 recon card — Axtone (competitor)
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
    doctrine_updated_at: now,
    doctrine_updated_by: "cassin",
  };
  battleCards.set(axtoneCard.org_id, axtoneCard);

  // ---------------------------------------------------------------------------
  // DE — Germany (watchlist+ per scope cut: hand-curated, no auto extraction)
  // Reference operator: DB Netz AG. Hump yard capex historically thin;
  // focus on Dortmund, Maschen, Seddin and the "Deutschlandtakt" cargo hubs.
  // ---------------------------------------------------------------------------
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
      retrieved_at: today,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2027-01-01T00:00:00Z",
    window_closes: "2028-12-31T00:00:00Z",
    five_questions: {
      know_yourself: {
        value:
          "DECEL has zero installed base in Germany. We need a reference site in the EU/CEE corridor first (Hallsberg is Sweden — not a German reference).",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
        confidence: "O",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value:
          "Axtone + Voestalpine are the two incumbents at DB Netz. Axtone has ~70% of installed base; Voestalpine the remainder. Knorr-Bremse does hydraulic retarders only.",
        source_url: "https://www.deutschebahn.com/de/freight",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value:
          "German yards are mixed-gauge friendly, electrified at 15kV AC, climate -20°C to +35°C. DECEL Rangerbroms is rated for this.",
        source_url: "https://www.db-netz.de/en/technical-specifications",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      timing: {
        value:
          "DB Netz capex is published 5-year forward. The 2026-2030 plan shows €3.2B for freight yards but only ~€140M is hump-specific. Watch the Q3 2026 plan revision for 2027 awards.",
        source_url: "https://www.deutschebahn.com/de/investment-plan",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value:
          "Get DECEL on the Bundesnetzagentur vendor list (it's free) so we can bid on the next tender without 6-month qualification delay. Submit a position paper to DB Netz's Freight Infrastructure team by Q1 2027.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
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
    updated_at: now,
  };
  markets.set(de.id, de);

  const dbNetz: Org = {
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
    updated_at: now,
  };
  orgs.set(dbNetz.id, dbNetz);

  // DB Netz recon/relationship card — German decision-makers, no automated
  // contact yet. Watchlist+ per scope cut: hand-curated content.
  const dbNetzCard: BattleCard = {
    org_id: dbNetz.id,
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
    doctrine_updated_at: now,
    doctrine_updated_by: "cassin",
  };
  battleCards.set(dbNetzCard.org_id, dbNetzCard);

  // ---------------------------------------------------------------------------
  // KZ — Kazakhstan (watchlist+; reference site at Almaty already in DECEL's
  // installed base, so the dossier is buyer-side context)
  // ---------------------------------------------------------------------------
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
      retrieved_at: today,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2026-11-01T00:00:00Z",
    window_closes: "2027-09-30T00:00:00Z",
    five_questions: {
      know_yourself: {
        value:
          "DECEL has the Almaty reference site (commissioned 2019). That's a foot in the door — we can credibly show a working installation, unlike in DE.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
        confidence: "V",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value:
          "Axtone and a small Chinese vendor (CRRC subsidiary) compete here. Axtone is price-aggressive; CRRC is well-connected politically but not technically superior.",
        source_url: "https://railways.kz/en/procurement",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value:
          "Broad-gauge (1520mm), 25kV AC electrified mainline, climate -40°C to +45°C. DECEL Rangerbroms is rated for this — Almaty proves it.",
        source_url: "https://railways.kz/en/technical-specifications",
        retrieved_at: today,
        confidence: "V",
        verified_by: "rule",
      },
      timing: {
        value:
          "KTZ's 2026-2030 capex plan has 3 hump yard modernizations scheduled (Astana, Atyrau, Shymkent). The first tender (Astana) opens Q4 2026.",
        source_url: "https://railways.kz/en/capex-plan",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value:
          "Get the DECEL spec written into KTZ's hump yard modernization technical reference (a direct spec pull, no tender). Best path: position paper to KTZ's VP Infrastructure (Almaty reference is the credibility anchor).",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
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
    updated_at: now,
  };
  markets.set(kz.id, kz);

  const ktz: Org = {
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
    updated_at: now,
  };
  orgs.set(ktz.id, ktz);

  const ktzCard: BattleCard = {
    org_id: ktz.id,
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
    doctrine_updated_at: now,
    doctrine_updated_by: "cassin",
  };
  battleCards.set(ktzCard.org_id, ktzCard);

  // ---------------------------------------------------------------------------
  // UZ — Uzbekistan (watchlist+; smaller market, transit relevance via MC)
  // ---------------------------------------------------------------------------
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
      retrieved_at: today,
      confidence: "O",
      verified_by: "human-import",
    },
    window_opens: "2027-06-01T00:00:00Z",
    window_closes: "2028-12-31T00:00:00Z",
    five_questions: {
      know_yourself: {
        value:
          "DECEL has no installed base in UZ. Position is to follow KTZ's lead on the Middle Corridor spec — ride the coattail, don't lead.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
        confidence: "O",
        verified_by: "human-import",
      },
      know_the_enemy: {
        value:
          "Axtone is the incumbent (single-tender awarded 2017). DECEL's only path in is via the KTZ→UTY spec-pull — if KTZ's tech reference lists DECEL, UTY will follow.",
        source_url: "https://ut.uz/en/procurement",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      terrain: {
        value:
          "Broad-gauge (1520mm), 25kV AC electrified, climate -25°C to +45°C, dusty. Axtone's mechanical retarders struggle in the dust; DECEL's enclosed design is a real differentiator here.",
        source_url: "https://ut.uz/en/technical-conditions",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      timing: {
        value:
          "UTY publishes its capex plan annually in Q1. The 2027 plan is likely to mention 2 hump yard modernizations (Tashkent, Bukhara). Window opens ~Q2 2027.",
        source_url: "https://ut.uz/en/capex-plan",
        retrieved_at: today,
        confidence: "O",
        verified_by: "rule",
      },
      win_before_battle: {
        value:
          "Indirect play: get DECEL into KTZ's tech reference first (Q4 2026 Astana cycle), then ride the KTZ→UTY spec-pull in 2027.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: today,
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
    updated_at: now,
  };
  markets.set(uz.id, uz);

  const uty: Org = {
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
    updated_at: now,
  };
  orgs.set(uty.id, uty);

  const utyCard: BattleCard = {
    org_id: uty.id,
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
    doctrine_updated_at: now,
    doctrine_updated_by: "cassin",
  };
  battleCards.set(utyCard.org_id, utyCard);

  // 2 review-queue items — to show the trust contract in action
  const jq1: ReviewQueueItem = {
    id: id("q"),
    kind: "yard",
    proposed: {
      name: "Code for Design on Hump and",
      market_id: "pl",
    },
    raw_snippet: "Code for Design on Hump and Marshalling Yards (PKP PLK, 2019) — section 4.2",
    source_url: "https://www.plk-sa.pl/en/standards/code-for-design",
    retrieved_at: "2026-08-25T10:00:00Z",
    market_id: "pl",
    ts: "2026-08-25T10:00:00Z",
  };
  reviewQueue.set(jq1.id, jq1);

  const jq2: ReviewQueueItem = {
    id: id("q"),
    kind: "tender",
    proposed: {
      title: "Modernization of retarder systems at selected marshalling yards",
      market_id: "pl",
    },
    raw_snippet: "Tender notice 2026-OIU-0918: Modernization of retarder systems at selected marshalling yards. Award Q2 2027.",
    source_url: "https://ted.europa.eu/udl?uri=TED:NOTICE:918234-2026",
    retrieved_at: "2026-08-25T11:00:00Z",
    market_id: "pl",
    ts: "2026-08-25T11:00:00Z",
  };
  reviewQueue.set(jq2.id, jq2);
}

// -----------------------------------------------------------------------------
// Public API — mirrors queue-store.ts
// -----------------------------------------------------------------------------

export async function resetAllStores(): Promise<void> {
  markets.clear();
  yards.clear();
  orgs.clear();
  persons.clear();
  plays.clear();
  reviewQueue.clear();
  corrections.length = 0;
  meetings.length = 0;
  battleCards.clear();
  doctrineRevisions.length = 0;
  rejectionHashes.clear();
  seeded = false;
  // Force-delete the snapshot so the next access re-seeds.
  try {
    if (existsSync(PERSIST_FILE)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(PERSIST_FILE);
    }
  } catch {
    // best-effort
  }
}

export function ensureSeeded(): void {
  if (seeded) return;
  // First try to load a saved snapshot from disk. If that fails (no file or
  // empty), seed with the in-memory fixture data and persist it.
  if (loadFromDisk()) {
    seeded = true;
    return;
  }
  seed();
  persist();
}

// Markets
export async function upsertMarket(m: Market): Promise<Market> {
  ensureSeeded();
  markets.set(m.id, m);
  persist();
  return m;
}
export async function getMarket(id: string): Promise<Market | undefined> {
  ensureSeeded();
  return markets.get(id);
}
export async function listMarkets(): Promise<Market[]> {
  ensureSeeded();
  return Array.from(markets.values()).sort((a, b) => a.country_name.localeCompare(b.country_name));
}

// Yards
export async function upsertYard(y: Yard): Promise<Yard> {
  ensureSeeded();
  yards.set(y.id, y);
  persist();
  return y;
}
export async function getYard(id: string): Promise<Yard | undefined> {
  ensureSeeded();
  return yards.get(id);
}
export async function listYardsByMarket(marketId: string): Promise<Yard[]> {
  ensureSeeded();
  return Array.from(yards.values()).filter((y) => y.market_id === marketId);
}

// Orgs
export async function upsertOrg(o: Org): Promise<Org> {
  ensureSeeded();
  orgs.set(o.id, o);
  persist();
  return o;
}
export async function getOrg(id: string): Promise<Org | undefined> {
  ensureSeeded();
  return orgs.get(id);
}
export async function listOrgs(): Promise<Org[]> {
  ensureSeeded();
  return Array.from(orgs.values());
}
export async function findOrgByMatchKey(matchKey: string): Promise<Org | undefined> {
  ensureSeeded();
  return Array.from(orgs.values()).find((o) => o.match_key === matchKey.toLowerCase());
}

// Persons
export async function upsertPerson(p: Person): Promise<Person> {
  ensureSeeded();
  persons.set(p.id, p);
  persist();
  return p;
}
export async function getPerson(id: string): Promise<Person | undefined> {
  ensureSeeded();
  return persons.get(id);
}
export async function listPersonsByOrg(orgId: string): Promise<Person[]> {
  ensureSeeded();
  return Array.from(persons.values()).filter((p) => p.org_id === orgId);
}
export async function flagStalePersonsForPurge(): Promise<string[]> {
  ensureSeeded();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  return Array.from(persons.values())
    .filter((p) => p.last_engagement_at !== null && new Date(p.last_engagement_at!) < cutoff)
    .map((p) => p.id);
}
export async function touchPersonEngagement(personId: string): Promise<void> {
  const p = persons.get(personId);
  if (!p) return;
  persons.set(personId, { ...p, last_engagement_at: new Date().toISOString() });
  persist();
}

// Plays
export async function createPlay(p: Omit<Play, "id" | "created_at">): Promise<Play> {
  ensureSeeded();
  const play: Play = { ...p, id: id("play"), created_at: new Date().toISOString() };
  plays.set(play.id, play);
  persist();
  return play;
}
export async function listPlaysByMarket(marketId: string): Promise<Play[]> {
  ensureSeeded();
  return Array.from(plays.values()).filter((p) => p.market_id === marketId);
}

// Corrections
export async function logCorrection(c: Omit<Correction, "id" | "ts"> & { ts?: string }): Promise<Correction> {
  ensureSeeded();
  const correction: Correction = {
    ...c,
    id: id("c"),
    ts: c.ts ?? new Date().toISOString(),
  };
  corrections.push(correction);
  persist();
  return correction;
}
export async function listCorrections(factId?: string): Promise<Correction[]> {
  ensureSeeded();
  const filtered = factId ? corrections.filter((c) => c.fact_id === factId) : [...corrections];
  return filtered.reverse();
}
export async function isRejectedContent(hash: string): Promise<boolean> {
  return rejectionHashes.has(hash);
}
export async function recordRejection(hash: string): Promise<void> {
  rejectionHashes.add(hash);
  persist();
}

// Review queue
export const REVIEW_QUEUE_AUTO_ARCHIVE_DAYS = 14;
export async function addToReviewQueue(item: Omit<ReviewQueueItem, "id" | "ts">): Promise<ReviewQueueItem> {
  ensureSeeded();
  const rqi: ReviewQueueItem = { ...item, id: id("q"), ts: new Date().toISOString() };
  reviewQueue.set(rqi.id, rqi);
  persist();
  return rqi;
}
export async function listReviewQueue(opts?: { marketId?: string; includeArchived?: boolean }): Promise<ReviewQueueItem[]> {
  ensureSeeded();
  const items = Array.from(reviewQueue.values()).filter((i) => {
    if (opts?.marketId && i.market_id !== opts.marketId) return false;
    if (!opts?.includeArchived && isQueueItemStale(i.ts)) return false;
    return true;
  });
  return items.sort((a, b) => b.ts.localeCompare(a.ts));
}
export async function getReviewQueueItem(id: string): Promise<ReviewQueueItem | undefined> {
  ensureSeeded();
  return reviewQueue.get(id);
}
export async function removeFromReviewQueue(id: string): Promise<boolean> {
  const result = reviewQueue.delete(id);
  if (result) persist();
  return result;
}
export async function autoArchiveStaleQueueItems(): Promise<number> {
  let n = 0;
  for (const [id, item] of reviewQueue.entries()) {
    if (isQueueItemStale(item.ts)) {
      reviewQueue.delete(id);
      n++;
    }
  }
  return n;
}

// Meetings
export async function logMeeting(m: Omit<MeetingLog, "id">): Promise<MeetingLog> {
  ensureSeeded();
  const meeting: MeetingLog = { ...m, id: id("m") };
  meetings.push(meeting);
  persist();
  return meeting;
}
export async function listMeetingsByOrg(orgId: string): Promise<MeetingLog[]> {
  ensureSeeded();
  return meetings.filter((m) => m.org_id === orgId).reverse();
}

// Battle cards
export async function upsertBattleCard(card: BattleCard): Promise<BattleCard> {
  ensureSeeded();
  battleCards.set(card.org_id, card);
  persist();
  return card;
}
export async function getBattleCard(orgId: string): Promise<BattleCard | undefined> {
  ensureSeeded();
  return battleCards.get(orgId);
}
export async function listBattleCards(): Promise<BattleCard[]> {
  ensureSeeded();
  return Array.from(battleCards.values());
}
export async function recordDoctrineRevision(rev: Omit<DoctrineRevision, "ts">): Promise<DoctrineRevision> {
  ensureSeeded();
  const r: DoctrineRevision = { ...rev, ts: new Date().toISOString() };
  doctrineRevisions.push(r);
  persist();
  return r;
}
export async function listDoctrineRevisions(
  contentKind: DoctrineRevision["content_kind"],
  contentId: string,
): Promise<DoctrineRevision[]> {
  ensureSeeded();
  return doctrineRevisions
    .filter((r) => r.content_kind === contentKind && r.content_id === contentId)
    .reverse();
}
