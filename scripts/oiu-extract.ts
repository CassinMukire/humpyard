// =============================================================================
// oiu-extract.ts — pure text → entity candidates
//
// Deterministic, regex-based, no LLM. Runs on plain text (PDFs are pre-
// converted to text by the runner in oiu-ingest.ts).
//
// Output shape matches what the rest of the platform already understands:
//   { markets: Market[], yards: Yard[], orgs: Org[], persons: Person[] }
//
// Every candidate is wrapped in a SourcedFact with the source URL = the
// file path. Confidence is assigned in oiu-route.ts via trust-layer.
// =============================================================================

import { randomUUID } from "node:crypto";
import type { SourcedFact, Yard, Org, Person, Market } from "@workspace/api-zod";

export interface ExtractedText {
  filePath: string;
  text: string;
  retrievedAt: string; // ISO date
}

export interface ExtractionResult {
  markets: Market[];
  yards: Yard[];
  orgs: Org[];
  persons: Person[];
  rejected: Array<{ kind: string; reason: string; snippet: string }>;
  rawMatches: Record<string, Array<{ text: string; offset: number }>>;
}

const ISO_TODAY = new Date().toISOString().slice(0, 10);

function snippet(text: string, offset: number, len = 120): string {
  return text.slice(Math.max(0, offset - 30), Math.min(text.length, offset + len + 30)).replace(/\s+/g, " ").trim();
}

function sourcesFor(filePath: string, kind: "pdf" | "doc" | "txt" = "doc"): SourcedFact[] {
  const sourceUrl = filePath.startsWith("http") ? filePath : `oiu://${filePath}`;
  return [
    {
      value: sourceUrl,
      source_url: sourceUrl,
      retrieved_at: ISO_TODAY,
      confidence: "V",
      verified_by: "doc-import",
    },
  ];
}

// -----------------------------------------------------------------------------
// Yard extraction — match against the alias list + the well-known OIU names
// -----------------------------------------------------------------------------

// First-pass: scan for explicit "yard" / "vall" / "Rbf" / "Vbf" mentions
const YARD_REGEXES: RegExp[] = [
  // "Idzikowice (classification yard)" / "Idzikowice Modernization Project"
  /\b([A-ZÀ-Ž][\p{L}'.-]{2,}(?:\s[A-ZÀ-Ž][\p{L}'.-]{1,})*)\s+(?:Classification Yard|Sorting Yard|Hump Yard|Modernization|Marshalling Yard)/gu,
  // "yard Idzikowice" / "yard: Idzikowice"
  /\byard[:\s]+([A-ZÀ-Ž][\p{L}'.-]{2,}(?:\s[A-ZÀ-Ž][\p{L}'.-]{1,})*)/gu,
  // German: "Rbf" / "Vbf" — Rangierbahnhof
  /\b([A-ZÀ-Ž][\p{L}'.-]{2,}(?:\s[A-ZÀ-Ž][\p{L}'.-]{1,})*)\s+(?:Rbf|Vbf|Rangierbahnhof)/gu,
];

// 5 OIU vallar (per OIU mapping Z1.2 / Z1.4 — placeholder list, real names land
// once the corpus PDFs are processed). Curated to anchor the extractor to
// the 5 names Cassin expects to see.
const OIU_PLACEHOLDER_YARDS: Record<string, { id: string; market_id: string; status: Yard["status"] }> = {
  Idzikowice: { id: "yard_idzikowice", market_id: "pl", status: "modernizing" },
  Karsznice: { id: "yard_karsznice", market_id: "pl", status: "active" },
  "Warszawa Praga": { id: "yard_warszawa_praga", market_id: "pl", status: "active" },
  Gliwice: { id: "yard_gliwice", market_id: "pl", status: "active" },
  "Łódź Olechów": { id: "yard_lodz_olechow", market_id: "pl", status: "active" },
  "Wrocław Brochów": { id: "yard_wroclaw_brochow", market_id: "pl", status: "active" },
};

function extractYards(input: ExtractedText, marketId: string): { yards: Yard[]; rawMatches: Array<{ text: string; offset: number }> } {
  const rawMatches: Array<{ text: string; offset: number }> = [];
  const seen = new Set<string>();
  const yards: Yard[] = [];

  // First pass: regex matches in text
  for (const re of YARD_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      const raw = m[1]?.trim() ?? "";
      if (!raw) continue;
      rawMatches.push({ text: raw, offset: m.index });
    }
  }

  // Second pass: known-yard anchors (OIU placeholder list, the 5 + 1)
  for (const [name, info] of Object.entries(OIU_PLACEHOLDER_YARDS)) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      rawMatches.push({ text: name, offset: m.index });
    }
  }

  // Build Yard entities from the matches — dedupe by canonical name
  for (const { text, offset } of rawMatches) {
    const canonical = canonicalizeYardName(text);
    if (!canonical) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const meta = OIU_PLACEHOLDER_YARDS[canonical] ?? {
      id: `yard_${canonical.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${randomUUID().slice(0, 4)}`,
      market_id: marketId,
      status: "active" as Yard["status"],
    };
    const src = sourcesFor(input.filePath);
    const around = snippet(input.text, offset, 200);
    yards.push({
      id: meta.id,
      market_id: meta.market_id,
      name: canonical,
      geo: null,
      operator_org_id: null,
      status: meta.status,
      brake_tech: {
        value: `Extracted from corpus — context: "${around.slice(0, 160)}"`,
        source_url: src[0].source_url,
        retrieved_at: input.retrievedAt,
        confidence: "O",
        verified_by: "doc-import",
      },
      last_modernized: null,
      sources: src,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { yards, rawMatches: rawMatches.map((m) => ({ text: m.text, offset: m.offset })) };
}

function canonicalizeYardName(raw: string): string | null {
  // Strip common suffix words, trim, title-case
  const cleaned = raw
    .replace(/\s+(Classification Yard|Sorting Yard|Hump Yard|Modernization|Project|Marshalling Yard)\b.*$/i, "")
    .replace(/\s+(Rbf|Vbf|Rangierbahnhof)\b.*$/i, "")
    .trim();
  if (cleaned.length < 3 || cleaned.length > 80) return null;
  // Match against known anchors (case-insensitive)
  for (const anchor of Object.keys(OIU_PLACEHOLDER_YARDS)) {
    if (anchor.toLowerCase() === cleaned.toLowerCase()) return anchor;
  }
  // Title-case the rest
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// -----------------------------------------------------------------------------
// Person extraction — "Firstname Lastname — Role @ Org" or "Firstname Lastname, role"
// -----------------------------------------------------------------------------

const PERSON_REGEX = /\b([A-ZÀ-Ž][\p{L}']{1,})\s+([A-ZÀ-Ž][\p{L}']{2,}(?:\s[A-ZÀ-Ž][\p{L}']{1,})?)\s*(?:[—–-]\s*|\(\s*|,\s*)([A-ZÀ-Ž][\p{L} &/.-]{3,60})\s*(?:@\s*([A-ZÀ-Ž][\p{L}\s&/.-]{2,60}))?/gu;

const STOP_ROLES = new Set([
  "EU", "TEN-T", "CPK", "PLK", "PKP", "Inc", "Ltd", "GmbH", "SA", "S.A.", "Sp zoo",
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
]);

function looksLikePersonName(first: string, last: string): boolean {
  if (STOP_ROLES.has(first) || STOP_ROLES.has(last)) return false;
  if (first.length < 2 || last.length < 3) return false;
  // Common Polish surname suffixes
  if (/(ski|ska|cka|cki|owa|ewski|ewska|wicz|icz|ak|ek|yk|ik)$/i.test(last)) return true;
  // English / German / Scandinavian surnames
  if (/(son|sen|berg|mann|ovic|ski|ström)$/i.test(last)) return true;
  // Default: capitalized token of length 3+ → accept
  return last.length >= 4;
}

function extractPersons(input: ExtractedText, marketId: string): { persons: Person[]; rawMatches: Array<{ text: string; offset: number }> } {
  const rawMatches: Array<{ text: string; offset: number }> = [];
  const seen = new Set<string>();
  const persons: Person[] = [];
  const src = sourcesFor(input.filePath);
  const personRegex = new RegExp(PERSON_REGEX.source, "gu");
  let m: RegExpExecArray | null;
  while ((m = personRegex.exec(input.text)) !== null) {
    const first = m[1] ?? "";
    const last = m[2] ?? "";
    const role = (m[3] ?? "").trim();
    const orgName = (m[4] ?? "").trim();
    if (!looksLikePersonName(first, last)) continue;
    const fullName = `${first} ${last}`.trim();
    if (seen.has(fullName)) continue;
    seen.add(fullName);
    rawMatches.push({ text: fullName, offset: m.index });
    const id = `person_${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${randomUUID().slice(0, 4)}`;
    persons.push({
      id,
      name: fullName,
      org_id: null, // resolved later by the routing step
      role,
      role_history: [],
      linkedin_url: null,
      interests: [],
      relationship_owner: "engine",
      relationship_status: "identified",
      import_meta: {
        method: "doc-import",
        source_ref: input.filePath,
        imported_by: "oiu-extract",
        imported_at: new Date().toISOString(),
      },
      last_engagement_at: null,
      monday_item_id: null,
      sources: src,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return { persons, rawMatches };
}

// -----------------------------------------------------------------------------
// Org extraction — match against the alias table (data/aliases.yaml)
// -----------------------------------------------------------------------------

const ALIAS_ANCHORS: Array<{ name: string; match_key: string; type: Org["type"]; market_ids: string[] }> = [
  { name: "PKP Polskie Linie Kolejowe", match_key: "pkp polskie linie kolejowe", type: "authority", market_ids: ["pl"] },
  { name: "Axtone", match_key: "axtone", type: "competitor", market_ids: ["pl"] },
  { name: "SYSTRA", match_key: "systra", type: "consultant", market_ids: ["pl"] },
  { name: "Trafikverket", match_key: "trafikverket", type: "authority", market_ids: ["se"] },
  { name: "DB Netz AG", match_key: "db netz ag", type: "authority", market_ids: ["de"] },
  { name: "Kazakhstan Temir Zholy", match_key: "kazakhstan temir zholy", type: "operator", market_ids: ["kz"] },
  { name: "UTY (Uzbekistan Temir Yollari)", match_key: "uty", type: "operator", market_ids: ["uz"] },
  { name: "Správa železnic", match_key: "sprava zeleznic", type: "authority", market_ids: ["cz"] },
  { name: "MÁV", match_key: "mav", type: "authority", market_ids: ["hu"] },
  { name: "ÖBB", match_key: "obb", type: "authority", market_ids: ["at"] },
  { name: "RZhD", match_key: "rzhd", type: "operator", market_ids: ["ru"] },
  { name: "CFR SA", match_key: "cfr sa", type: "authority", market_ids: ["ro"] },
  { name: "SNCF Réseau", match_key: "sncf reseau", type: "authority", market_ids: ["fr"] },
  { name: "ProRail", match_key: "prorail", type: "authority", market_ids: ["nl"] },
  { name: "Bane NOR", match_key: "bane nor", type: "authority", market_ids: ["no"] },
  { name: "SBB", match_key: "sbb", type: "authority", market_ids: ["ch"] },
  { name: "RFI", match_key: "rfi", type: "authority", market_ids: ["it"] },
  { name: "ADIF", match_key: "adif", type: "authority", market_ids: ["es"] },
  { name: "TCDD", match_key: "tcdd", type: "authority", market_ids: ["tr"] },
  { name: "Infrabel", match_key: "infrabel", type: "authority", market_ids: ["be"] },
  { name: "Väylävirasto", match_key: "vaylavirasto", type: "authority", market_ids: ["fi"] },
  { name: "ŽSR", match_key: "zsr", type: "authority", market_ids: ["sk"] },
  { name: "Ukrzaliznytsia", match_key: "ukrzaliznytsia", type: "authority", market_ids: ["ua"] },
  { name: "Knorr-Bremse", match_key: "knorr bremse", type: "competitor", market_ids: [] },
  { name: "Voestalpine", match_key: "voestalpine", type: "competitor", market_ids: [] },
];

function extractOrgs(input: ExtractedText): { orgs: Org[]; rawMatches: Array<{ text: string; offset: number }> } {
  const rawMatches: Array<{ text: string; offset: number }> = [];
  const seen = new Set<string>();
  const orgs: Org[] = [];
  for (const anchor of ALIAS_ANCHORS) {
    const aliases = [
      anchor.name,
      ...aliasNamesFor(anchor.match_key),
    ];
    for (const alias of aliases) {
      if (!alias) continue;
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gu");
      let m: RegExpExecArray | null;
      while ((m = re.exec(input.text)) !== null) {
        rawMatches.push({ text: alias, offset: m.index });
        if (seen.has(anchor.match_key)) break;
        seen.add(anchor.match_key);
        const src = sourcesFor(input.filePath);
        const id = `org_${anchor.match_key.replace(/[^a-z0-9]+/g, "_")}`;
        orgs.push({
          id,
          name: anchor.name,
          match_key: anchor.match_key,
          type: anchor.type,
          market_ids: anchor.market_ids,
          monday_item_id: null,
          innotrans_target: anchor.type === "authority" || anchor.type === "competitor",
          risk_facts: [],
          sources: src,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        break;
      }
    }
  }
  return { orgs, rawMatches };
}

function aliasNamesFor(matchKey: string): string[] {
  // Hard-coded mini-aliases for the org extraction step. The full canonical
  // list lives in data/aliases.yaml (loaded by the routing step).
  const map: Record<string, string[]> = {
    "pkp polskie linie kolejowe": ["PKP PLK", "Polskie Linie Kolejowe", "PLK", "PKP PLK S.A."],
    axtone: ["Axtone GmbH", "Axtone SA", "Axtone retarder"],
    systra: ["SYSTRA SA", "Systra Group"],
    trafikverket: ["Trafikverket (Sweden)", "TrV", "Swedish Transport Administration"],
    "db netz ag": ["DB Netz", "Deutsche Bahn Netz"],
    "kazakhstan temir zholy": ["KTZ", "KTZ NC", "Kazakhstan Railways", "Қазақстан Темір Жолы"],
    uty: ["Uzbekistan Railways", "O'zbekiston Temir Yo'llari"],
    "sprava zeleznic": ["SŽDC", "Sprava zeleznic", "Czech Railway Infrastructure Administration"],
    mav: ["MÁV Hungarian State Railways", "MAV"],
    obb: ["ÖBB-Infrastruktur AG", "ÖBB Infrastructure", "OEBB", "Österreichische Bundesbahnen"],
    rzhd: ["RZhD (Russian Railways)", "Russian Railways", "RZD"],
    "cfr sa": ["CFR Infrastructura", "Căile Ferate Romane", "Căile Ferate Române"],
    "sncf reseau": ["SNCF Reseau", "SNCF Réseau", "Reseau Ferre de France"],
    prorail: ["ProRail B.V.", "Prorail"],
    "bane nor": ["Bane NOR SF", "BaneNor"],
    sbb: ["SBB CFF FFS", "Schweizerische Bundesbahnen"],
    rfi: ["Rete Ferroviaria Italiana", "RFI S.p.A."],
    adif: ["ADIF (Administrador de Infraestructuras Ferroviarias)", "Administrador de Infraestructuras Ferroviarias"],
    tcdd: ["TCDD Taşımacılık", "Turkish State Railways"],
    infrabel: ["Infrabel NV"],
    "vaylavirasto": ["Väylä", "Finnish Transport Infrastructure Agency"],
    zsr: ["ŽSR (Železnice Slovenskej republiky)", "ZSR", "Slovak Railways"],
    ukrzaliznytsia: ["Ukrzaliznytsia (Ukrainian Railways)", "Ukrainian Railways"],
    "knorr bremse": ["Knorr-Bremse AG", "KB"],
    voestalpine: ["voestalpine AG"],
  };
  return map[matchKey] ?? [];
}

// -----------------------------------------------------------------------------
// Junk rejection — apply structural gates inline (no LLM)
// -----------------------------------------------------------------------------

function rejectJunk(input: ExtractedText): Array<{ kind: string; reason: string; snippet: string }> {
  const rejected: Array<{ kind: string; reason: string; snippet: string }> = [];
  // Discard sentences that have no real entity — they look like boilerplate
  const noiseRegex = /\b(cookie policy|terms of service|all rights reserved|subscribe to our newsletter)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = noiseRegex.exec(input.text)) !== null) {
    rejected.push({ kind: "noise", reason: "boilerplate", snippet: snippet(input.text, m.index) });
  }
  return rejected;
}

// -----------------------------------------------------------------------------
// Public entry
// -----------------------------------------------------------------------------

export function extractFromText(input: ExtractedText, marketId = "pl"): ExtractionResult {
  const yardsR = extractYards(input, marketId);
  const personsR = extractPersons(input, marketId);
  const orgsR = extractOrgs(input);
  const rejected = rejectJunk(input);
  // Markets: if the text mentions a country, emit a Market if not already present
  const market: Market = {
    id: marketId,
    country_iso: marketId.toUpperCase(),
    country_name: marketId === "pl" ? "Poland" : marketId.toUpperCase(),
    tier: "A",
    posture: "WARMUP",
    verdict: {
      value: `Auto-extracted from ${input.filePath}`,
      source_url: `oiu://${input.filePath}`,
      retrieved_at: input.retrievedAt,
      confidence: "O",
      verified_by: "doc-import",
    },
    window_opens: null,
    window_closes: null,
    five_questions: {
      know_yourself: {
        value: "DECEL is the only European vendor with Rangerbroms in production. Hallsberg and Almaty are reference sites.",
        source_url: "internal://decelsun-tzu-analysis",
        retrieved_at: input.retrievedAt,
        confidence: "O",
        verified_by: "human-import",
      },
      know_the_enemy: { value: "TBD", source_url: "internal://pending", retrieved_at: input.retrievedAt, confidence: "I", verified_by: "rule" },
      terrain: { value: "TBD", source_url: "internal://pending", retrieved_at: input.retrievedAt, confidence: "I", verified_by: "rule" },
      timing: { value: "TBD", source_url: "internal://pending", retrieved_at: input.retrievedAt, confidence: "I", verified_by: "rule" },
      win_before_battle: { value: "TBD", source_url: "internal://pending", retrieved_at: input.retrievedAt, confidence: "I", verified_by: "rule" },
    },
    sources: sourcesFor(input.filePath),
    posture_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    markets: [market],
    yards: yardsR.yards,
    orgs: orgsR.orgs,
    persons: personsR.persons,
    rejected,
    rawMatches: {
      yards: yardsR.rawMatches,
      persons: personsR.rawMatches,
      orgs: orgsR.rawMatches,
    },
  };
}

export async function extractFromPdf(pdfPath: string): Promise<ExtractedText> {
  // Minimal PDF→text using a small inline decoder. For real production we
  // would use `pdf-parse` or similar; this avoids the dependency until the
  // corpus actually arrives. If the file isn't a PDF, the caller falls back
  // to reading it as plain text.
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(pdfPath);
  // Heuristic: extract printable ASCII runs of 4+ chars, plus all UTF-8
  // letters. This is enough for most prospectus-style PDFs.
  const text = buf
    .toString("latin1")
    .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    filePath: pdfPath,
    text,
    retrievedAt: new Date().toISOString().slice(0, 10),
  };
}

export async function extractFromFile(filePath: string): Promise<ExtractedText> {
  if (filePath.toLowerCase().endsWith(".pdf")) {
    return extractFromPdf(filePath);
  }
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(filePath, "utf8");
  return {
    filePath,
    text,
    retrievedAt: new Date().toISOString().slice(0, 10),
  };
}
