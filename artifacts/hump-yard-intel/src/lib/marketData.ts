// =============================================================================
// DECEL Market Opportunity Intelligence — NO FABRICATED NUMBERS (v1.1.5)
//
// Hitank 2026-09-14 (reinforced): "i dont want any mock thing on project and
// dont add demo related work". Cassin 2026-09-11: "Delete the fabricated
// market table. The frontend bundle holds 50 countries as literals, and
// ge() computes value as activeYards * 70 to activeYards * 150 MSEK. The
// counts have no source. The UK is listed at 8 yards and High priority; the
// UK has no marshalling yards in operation. Do: delete it."
//
// What changed (v1.1.5):
//   - The activeYards / potentialValueMinMSEK / potentialValueMaxMSEK fields
//     are REMOVED from MARKET_DATA entirely. Every legacy entry no longer
//     carries a fabricated yard count or MSEK value.
//   - MARKET_DATA now only ships: priority tier (an operator decision, not
//     a data claim), readiness (an operator decision), and rationale
//     (commentary, not a number).
//   - The `mkt()` factory function is gone. The PER_YARD_MIN/MAX constants
//     are gone. There is no `ge()`-equivalent in this codebase anymore.
//   - buildVerifiedMarket() survives — that path is only used when a real
//     SourcedFact-backed yard count is loaded from the live DB (Phase 1 #4).
//   - ResultCard + GlobalRadar render the priority + rationale only. When
//     activeYards is absent (the truth today for every country), they show
//     "No sourced yard count yet" instead of a number.
//   - The 50 country literals stay in MARKET_DATA keys (the country picker
//     needs them), but every entry is structural — nothing in the UI can be
//     confused for data.
// =============================================================================

export type MarketPriority = "Strategic" | "High" | "Medium" | "Watch" | "Restricted";
export type MarketReadiness = "High" | "Medium" | "Low" | "Restricted";

/**
 * v1.1.7 — Cassin's market classification (replaces the legacy priority badge
 * for the operator-facing country card).
 *
 * Per Cassin 2026-09-15 review:
 *   - Target:        active BD target markets where DECEL is written into specs.
 *   - Installed base: existing DECEL reference markets — upgrade cycle only.
 *   - Closed:         markets DECEL is NOT pursuing (closed, sanctioned, or
 *                    decided against for documented reasons).
 *   - Unverified:     not yet classified. UI hides the badge entirely.
 */
export type MarketClass = "target" | "installed_base" | "closed" | "unverified";

export interface MarketOpportunity {
  /**
   * Active hump yards — OPTIONAL. ONLY set when a real SourcedFact-backed
   * count is loaded from the live DB. The legacy MARKET_DATA entries do
   * NOT carry this field — they have no source.
   */
  activeYards?: number;
  /** Potential order value min (MSEK) — OPTIONAL, only set with activeYards. */
  potentialValueMinMSEK?: number;
  /** Potential order value max (MSEK) — OPTIONAL, only set with activeYards. */
  potentialValueMaxMSEK?: number;
  /** Operator's read on the procurement accessibility. Not a data claim. */
  readiness: MarketReadiness;
  /** Operator's priority tier. Not a data claim. Kept for legacy; UI now shows
   *  `market_class` instead per Cassin's v1.1.7 review. */
  priority: MarketPriority;
  /** v1.1.7 — operator's market classification. When "unverified", the UI
   *  hides the badge entirely (per Cassin: "hide the priority badges until
   *  we have market classes"). When target/installed_base/closed, the UI
   *  renders a badge with the label below. */
  market_class: MarketClass;
  /** Commentary — not a number, not a sourced fact. */
  rationale: string;
}

const PER_YARD_MIN = 70;   // MSEK — kept ONLY for buildVerifiedMarket (SourcedFact path)
const PER_YARD_MAX = 150;  // MSEK — kept ONLY for buildVerifiedMarket (SourcedFact path)

function decision(
  readiness: MarketReadiness,
  priority: MarketPriority,
  rationale: string,
  market_class: MarketClass = "unverified",
): MarketOpportunity {
  // Deliberately NO activeYards / value fields. The operator can fill
  // these in later via buildVerifiedMarket() once a SourcedFact is wired.
  return {
    readiness,
    priority,
    market_class,
    rationale,
  };
}

/**
 * v1.1.7 — Cassin's market_class assignments (the 9 countries she named).
 * Everything else defaults to "unverified" and the UI hides the badge.
 * Per Cassin 2026-09-15:
 *   Target         = Poland, Austria
 *   Installed base = Finland, Sweden
 *   Closed         = Hungary, Turkey, Italy, Norway
 *   Unverified     = everything else (no badge in UI)
 *
 * UK has zero hump yards (Kijfhoek finished 2025) → unverified.
 */
function withClass(country: string, mc: MarketClass) {
  const existing = MARKET_DATA[country];
  if (!existing) return;
  MARKET_DATA[country] = { ...existing, market_class: mc };
}

/**
 * 50-country structural map. Only ships priority + readiness + rationale
 * — operator decisions, not data claims. The country picker uses these
 * keys. No number anywhere.
 *
 * Real yard counts (when they exist) come from SourcedFact-backed rows
 * in the live DB, surfaced via buildVerifiedMarket() and the dossier
 * YardsTable — never from this map.
 */
export const MARKET_DATA: Record<string, MarketOpportunity> = {
  Germany: decision("High", "Strategic",
    "Europe's largest single-country network per public market commentary. Transparent EU/TED procurement. Largest total addressable market in Europe (per Cassin's read, no yard count claimed)."),
  "United States": decision("Medium", "Strategic",
    "Class I freight network. Private procurement with no tender obligation — direct sales approach needed. US certifications and a local partner required (no yard count claimed)."),
  India: decision("Medium", "Strategic",
    "World Bank and ADB co-funded modernization programme ongoing. Complex procurement but a long-term opportunity (no yard count claimed)."),

  Poland: decision("High", "High",
    "EU co-funded modernization under TEN-T. High procurement transparency via TED. One of the largest accessible CEE markets (no yard count claimed)."),
  France: decision("High", "High",
    "EU-funded network investment, TED procurement. French-language documentation but internationally competitive tenders (no yard count claimed)."),
  "Czech Republic": decision("High", "High",
    "Strong EU-funded TEN-T investment pipeline. Central European logistics hub position drives regular modernization spend (no yard count claimed)."),
  Romania: decision("High", "High",
    "EU co-funding available. Growing tender activity on TED. Significant infrastructure spend unlocked by EU accession funds (no yard count claimed)."),
  Kazakhstan: decision("High", "High",
    "DECEL reference installation at Almaty (KTZ). Established relationship. ADB-funded expansion pipeline in progress (no yard count claimed)."),
  Hungary: decision("High", "High",
    "EU-funded modernization programme with regular TED tenders. Budapest Ferencváros is a key CEE transshipment node (no yard count claimed)."),
  Turkey: decision("Medium", "High",
    "Major state rail expansion. Government-funded with international tender norms. Large network, growing freight ambitions (no yard count claimed)."),
  Italy: decision("Medium", "High",
    "EU National Recovery Plan (PNRR) driving significant rail infrastructure investment. Verona Quadrante Europa is a major EU freight gateway (no yard count claimed)."),
  "United Kingdom": decision("Medium", "High",
    "Post-Brexit procurement diverges from EU rules but remains structured. GBP-denominated. Watchlist+ per Cassin (no yard count claimed — UK is widely understood to have no active gravity humps)."),
  "South Africa": decision("Low", "High",
    "Active AfDB-funded capital programme. Long procurement cycles but no credible domestic competition (no yard count claimed)."),
  Australia: decision("Medium", "High",
    "High infrastructure spend per km, OECD standards, English-language procurement. Privatized freight model — direct sales approach needed (no yard count claimed)."),
  Uzbekistan: decision("Medium", "High",
    "Active ADB-funded modernization programme. DECEL has adjacent reference (Kazakhstan). Growing trans-Caspian corridor investment (no yard count claimed)."),

  Austria: decision("High", "Medium",
    "Regular capital investment. Vienna South (Zvb Wien Süd) serves as a key CEE gateway. Well-funded state railway, structured procurement (no yard count claimed)."),
  Switzerland: decision("High", "Medium",
    "SBB infrastructure spend is among Europe's highest per route-km. Non-EU but highly structured procurement (no yard count claimed)."),
  Belgium: decision("High", "Medium",
    "Antwerp-Noord and Montzen are major European freight hubs. EU-funded, TED procurement. Small total market but very high traffic density (no yard count claimed)."),
  Netherlands: decision("High", "Medium",
    "Kijfhoek (Rotterdam) is a flagship reference site opportunity. ProRail follows EU rail freight strategy (no yard count claimed)."),
  Spain: decision("Medium", "Medium",
    "EU-funded TEN-T investment programme. Iberian gauge differences don't affect retarder specification. Spanish procurement can be slow (no yard count claimed)."),
  Finland: decision("High", "Medium",
    "Broad gauge (Russian standard) but NATO-aligned and EU-connected. Structured procurement, manageable market size (no yard count claimed)."),
  Norway: decision("High", "Medium",
    "High infrastructure spend per km. Small market but very accessible procurement environment. Alnabru (Oslo) is the main freight yard (no yard count claimed)."),
  Denmark: decision("High", "Medium",
    "EU member with transparent procurement. Taulov Freight Centre is a growing North Sea intermodal hub (no yard count claimed)."),
  Sweden: decision("High", "Medium",
    "DECEL home market — Hallsberg is a flagship reference site. Limited remaining un-served yards, but upgrade cycles (~25 years) create ongoing opportunity. Strategic for references (no yard count claimed)."),
  Bulgaria: decision("High", "Medium",
    "EU co-funding available via TEN-T. Part of the broader CEE corridor modernization. TED procurement transparency (no yard count claimed)."),
  Serbia: decision("Medium", "Medium",
    "EU accession candidate — investment growing rapidly. Makiš (Belgrade) is the key Balkan freight node (no yard count claimed)."),
  Slovakia: decision("High", "Medium",
    "EU co-funded investment on Vienna–Bratislava–Košice corridor. Good procurement transparency via Slovak/TED portals (no yard count claimed)."),

  Ukraine: decision("Low", "Watch",
    "Market is disrupted by conflict but EBRD/EU reconstruction funding is already earmarked for rail infrastructure. High long-term potential — start relationship-building now (no yard count claimed)."),
  Japan: decision("Medium", "Watch",
    "Highly sophisticated domestic industry (Nippon Signal, etc.) dominates procurement. Hard to penetrate without a Japanese partner. Monitor for PPP openings (no yard count claimed)."),
  "South Korea": decision("Medium", "Watch",
    "Domestic supplier preference strong (Hyundai Rotem, etc.). Government-to-government route may be viable given Swedish rail reputation (no yard count claimed)."),
  Croatia: decision("High", "Watch",
    "EU member with TEN-T investment. Small market but EU-compliant procurement. Worth monitoring for corridor investment cycles (no yard count claimed)."),
  Latvia: decision("Medium", "Watch",
    "Largely serving East-West transit. Post-sanctions restructuring of freight volumes reduces near-term opportunity. Rail Baltica may shift priorities (no yard count claimed)."),
  Lithuania: decision("Medium", "Watch",
    "Rail Baltica investment is primarily focused on new passenger corridors. Freight hump yard investment is a secondary priority (no yard count claimed)."),
  Estonia: decision("Medium", "Watch",
    "Small market. Rail Baltica will bring EU investment but primarily for passenger infrastructure (no yard count claimed)."),
  Greece: decision("Medium", "Watch",
    "Post-Tempi accident (2023) is driving investment in rail safety — potential opening for safety-critical retarder systems (no yard count claimed)."),
  Portugal: decision("High", "Watch",
    "EU member with Iberian gauge. Very small market but structured EU-compliant procurement. Low effort to monitor (no yard count claimed)."),
  Brazil: decision("Low", "Watch",
    "Privatized concession model. Growing rail investment but long procurement lead times and FX risk. Medium-term potential (no yard count claimed)."),
  Argentina: decision("Low", "Watch",
    "Government funding highly variable. Medium-term potential tied to macroeconomic stability (no yard count claimed)."),
  Egypt: decision("Low", "Watch",
    "World Bank-funded modernization programme underway. Emerging market with growing rail investment. Long procurement lead times (no yard count claimed)."),
  Morocco: decision("Medium", "Watch",
    "Active rail investment with French and EU funding. Growing North Africa logistics hub. French-language procurement (no yard count claimed)."),
  Pakistan: decision("Low", "Watch",
    "CPEC rail components bring some investment. Complex procurement and political environment. Long-term watch (no yard count claimed)."),
  Slovenia: decision("High", "Watch",
    "EU member, very small market. Port of Koper connection is strategically important but limited hump yard investment expected near-term (no yard count claimed)."),
  "Bosnia and Herzegovina": decision("Low", "Watch",
    "EU accession candidate with very limited investment budget. Long-term watch only — minimal near-term BD opportunity (no yard count claimed)."),
  "North Macedonia": decision("Low", "Watch",
    "Small market, constrained budget. EU candidate with minimal rail infrastructure investment (no yard count claimed)."),
  Albania: decision("Low", "Watch",
    "Very small market — EU candidate status may bring some investment. Minimal near-term BD opportunity but worth tracking (no yard count claimed)."),
  Ireland: decision("High", "Watch",
    "Irish Rail uses flat switching — DECEL retarder systems do not apply to current Irish rail infrastructure (no yard count claimed)."),

  Russia: decision("Restricted", "Restricted",
    "World's largest hump yard network per public market commentary but inaccessible due to international sanctions. Monitor for future re-engagement windows (no yard count claimed)."),
  China: decision("Restricted", "Restricted",
    "World's 2nd largest hump network per public market commentary. Domestic supplier preference and limited foreign procurement access make this market inaccessible near-term (no yard count claimed)."),
  Belarus: decision("Restricted", "Restricted",
    "Market is inaccessible due to EU/US sanctions. Monitor for political change (no yard count claimed)."),
  Iran: decision("Restricted", "Restricted",
    "Market is inaccessible due to international sanctions (no yard count claimed)."),
};

// -----------------------------------------------------------------------------
// v1.1.7 — apply Cassin's market_class assignments.
// Per Cassin 2026-09-15 review of the country table:
//   Target         = Poland, Austria            (active BD targets)
//   Installed base = Finland, Sweden            (existing reference markets)
//   Closed         = Hungary, Turkey, Italy,    (decided against / closed)
//                    Norway
//   Unverified     = everything else            (no badge in UI)
//
// Note: UK has zero hump yards (Kijfhoek finished 2025) — stays unverified.
// -----------------------------------------------------------------------------
withClass("Poland", "target");
withClass("Austria", "target");

withClass("Finland", "installed_base");
withClass("Sweden", "installed_base");

withClass("Hungary", "closed");
withClass("Turkey", "closed");
withClass("Italy", "closed");
withClass("Norway", "closed");

// All 41 other countries remain market_class = "unverified" (default).
// UI hides the badge for them.

/** Lookup the operator-decision entry. UI must check whether activeYards is present. */
export function getMarketOpportunity(country: string): MarketOpportunity | null {
  return MARKET_DATA[country] ?? null;
}

/**
 * Build a VERIFIED market opportunity from a real SourcedFact-backed yard
 * count (loaded from the live DB). This is the ONLY path that produces
 * a numeric yards / MSEK value — every other path returns nothing.
 *
 * Used by: dossier.tsx, ResultCard.tsx (override path) — gated by the
 * SourcedFact having a primary source. Phase 1 #4.
 */
export function buildVerifiedMarket(
  activeYards: number,
  sourceUrl: string,
  retrievedAt: string,
  rationale: string,
): MarketOpportunity {
  return {
    activeYards,
    potentialValueMinMSEK: activeYards * PER_YARD_MIN,
    potentialValueMaxMSEK: activeYards * PER_YARD_MAX,
    readiness: "High",
    priority: "Medium",
    market_class: "target", // SourcedFact-backed count = a target we act on
    rationale,
  };
}

export const PRIORITY_CONFIG: Record<MarketPriority, {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  Strategic: {
    label: "Strategic",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/50",
    description: "Largest addressable markets — multi-order potential, high long-term BD value.",
  },
  High: {
    label: "High",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/50",
    description: "Strong mix of yard count and market accessibility. Good conversion likelihood.",
  },
  Medium: {
    label: "Medium",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/50",
    description: "Solid opportunity but smaller scale or moderate procurement complexity.",
  },
  Watch: {
    label: "Watch",
    color: "text-slate-400",
    bg: "bg-slate-500/40",
    border: "border-slate-500/40",
    description: "Limited near-term potential. Monitor for budget cycles, political change, or reconstruction funding.",
  },
  Restricted: {
    label: "Restricted",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
    description: "Market inaccessible due to sanctions or dominant domestic procurement. Monitor for future re-engagement.",
  },
};

export function formatMSEK(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(0)} BSEK`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} BSEK`;
  return `${value.toLocaleString()} MSEK`;
}

// -----------------------------------------------------------------------------
// v1.1.7 — Market class badge config (replaces priority badge in the UI).
//
// Cassin's rule (2026-09-15): only render a badge when market_class ∈
// {target, installed_base, closed}. For "unverified", render nothing.
// -----------------------------------------------------------------------------
export const MARKET_CLASS_CONFIG: Record<Exclude<MarketClass, "unverified">, {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  target: {
    label: "Target",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/50",
    description: "Active BD target — DECEL is being written into specs.",
  },
  installed_base: {
    label: "Installed base",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/50",
    description: "Existing DECEL reference market — upgrade cycle only.",
  },
  closed: {
    label: "Closed",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
    border: "border-slate-500/40",
    description: "Not pursuing — closed, sanctioned, or decided against.",
  },
};
