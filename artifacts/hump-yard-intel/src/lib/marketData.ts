// DECEL Market Opportunity Intelligence
// Order value benchmark: 70–150 MSEK per hump yard (DECEL internal)
// Replacement cycle: ~25 years
// Scoring factors: yard count × order value, market accessibility, procurement transparency

export type MarketPriority = "Strategic" | "High" | "Medium" | "Watch" | "Restricted";
export type MarketReadiness = "High" | "Medium" | "Low" | "Restricted";

export interface MarketOpportunity {
  activeYards: number;
  potentialValueMinMSEK: number;
  potentialValueMaxMSEK: number;
  readiness: MarketReadiness;
  priority: MarketPriority;
  rationale: string;
}

const PER_YARD_MIN = 70;   // MSEK
const PER_YARD_MAX = 150;  // MSEK

function mkt(
  activeYards: number,
  readiness: MarketReadiness,
  priority: MarketPriority,
  rationale: string,
): MarketOpportunity {
  return {
    activeYards,
    potentialValueMinMSEK: activeYards * PER_YARD_MIN,
    potentialValueMaxMSEK: activeYards * PER_YARD_MAX,
    readiness,
    priority,
    rationale,
  };
}

export const MARKET_DATA: Record<string, MarketOpportunity> = {

  // ── STRATEGIC ─────────────────────────────────────────────────────────────

  Germany: mkt(85, "High", "Strategic",
    "DB operates ~85 retarder-equipped yards — Europe's largest single-country network. Maschen alone is the world's 2nd largest yard. Transparent EU/TED procurement. Largest total addressable market in Europe."),

  "United States": mkt(65, "Medium", "Strategic",
    "Class I railroads run 60+ active hump yards (BNSF, UP, CSX, NS). Private procurement with no tender obligation — needs direct sales approach. Very large market but requires US certifications and a local partner."),

  India: mkt(42, "Medium", "Strategic",
    "Indian Railways operates 40+ marshalling yards with retarder systems. World Bank and ADB co-funded modernization programme ongoing. Complex procurement process but among the largest long-term opportunities globally."),

  // ── HIGH ──────────────────────────────────────────────────────────────────

  Poland: mkt(28, "High", "High",
    "PKP network has ~28 hump yards. EU co-funded modernization under TEN-T. High procurement transparency via TED. One of the largest accessible CEE markets."),

  France: mkt(14, "High", "High",
    "SNCF Réseau operates ~14 marshalling yards. EU-funded network investment, TED procurement. French-language documentation but internationally competitive tenders."),

  "Czech Republic": mkt(12, "High", "High",
    "SŽDC operates 12 hump yards. Strong EU-funded TEN-T investment pipeline. Central European logistics hub position drives regular modernization spend."),

  Romania: mkt(10, "High", "High",
    "CFR network has ~10 active hump yards. EU co-funding available. Growing tender activity on TED. Significant infrastructure spend unlocked by EU accession funds."),

  Kazakhstan: mkt(14, "High", "High",
    "KTZ operates ~14 hump yards including Almaty (DECEL reference installation). Established relationship. ADB-funded expansion pipeline in progress. Warm market."),

  Hungary: mkt(8, "High", "High",
    "MÁV operates ~8 active hump yards including Budapest Ferencváros — a key CEE transshipment node. EU-funded modernization programme with regular TED tenders."),

  Turkey: mkt(14, "Medium", "High",
    "TCDD operates ~14 marshalling yards as part of a major state rail expansion. Government-funded with international tender norms. Large network, growing freight ambitions."),

  Italy: mkt(10, "Medium", "High",
    "RFI/Mercitalia operates ~10 hump yards. EU National Recovery Plan (PNRR) driving significant rail infrastructure investment. Verona Quadrante Europa is a major EU freight gateway."),

  "United Kingdom": mkt(8, "Medium", "High",
    "Network Rail/DB Cargo UK operates ~8 active hump yards. Post-Brexit procurement diverges from EU rules but remains structured. GBP-denominated. Toton and Doncaster are key targets."),

  "South Africa": mkt(6, "Low", "High",
    "Transnet Freight Rail operates ~6 major hump yards including Sentrarand (Johannesburg) — Africa's largest. Active AfDB-funded capital programme. Long procurement cycles but no credible domestic competition."),

  Australia: mkt(5, "Medium", "High",
    "ARTC/Pacific National operates ~5 hump yards. High infrastructure spend per km, OECD standards, English-language procurement. Privatized freight model — direct sales approach needed."),

  Uzbekistan: mkt(8, "Medium", "High",
    "UTY operates ~8 hump yards. Active ADB-funded modernization programme. DECEL has adjacent reference (Kazakhstan). Growing trans-Caspian corridor investment."),

  // ── MEDIUM ────────────────────────────────────────────────────────────────

  Austria: mkt(6, "High", "Medium",
    "ÖBB operates ~6 hump yards with regular capital investment. Vienna South (Zvb Wien Süd) serves as a key CEE gateway. Well-funded state railway, structured procurement."),

  Switzerland: mkt(4, "High", "Medium",
    "SBB infrastructure spend is among Europe's highest per route-km. Basel Wolf and Limmattal are active hump yards. Non-EU but highly structured procurement process."),

  Belgium: mkt(4, "High", "Medium",
    "Infrabel operates Antwerp-Noord and Montzen — major European freight hubs. EU-funded, TED procurement. Small total market but very high traffic density and visibility."),

  Netherlands: mkt(3, "High", "Medium",
    "Kijfhoek (Rotterdam) is one of Europe's most automated classification yards. ProRail follows EU rail freight strategy. Small market but a flagship reference site opportunity."),

  Spain: mkt(8, "Medium", "Medium",
    "ADIF operates ~8 marshalling yards. EU-funded TEN-T investment programme. Iberian gauge differences don't affect retarder specification. Spanish procurement can be slow."),

  Finland: mkt(5, "High", "Medium",
    "VR/Väylävirasto operates ~5 hump yards. Broad gauge (Russian standard) but NATO-aligned and EU-connected. Structured procurement, manageable market size."),

  Norway: mkt(3, "High", "Medium",
    "Bane NOR/CargoNet operates ~3 hump yards including Alnabru (Oslo). High infrastructure spend per km. Small market but very accessible procurement environment."),

  Denmark: mkt(3, "High", "Medium",
    "Banedanmark operates ~3 classification yards. EU member with transparent procurement. Taulov Freight Centre is a growing North Sea intermodal hub."),

  Sweden: mkt(6, "High", "Medium",
    "DECEL home market — Hallsberg is a flagship reference site. Limited remaining un-served yards, but upgrade cycles (~25 years) create ongoing opportunity. Strategic for references."),

  Bulgaria: mkt(4, "High", "Medium",
    "BDZ/NKZHI operates ~4 active hump yards. EU co-funding available via TEN-T. Part of the broader CEE corridor modernization. TED procurement transparency."),

  Serbia: mkt(4, "Medium", "Medium",
    "Infrastruktura Železnice Srbije operates ~4 yards. EU accession candidate — investment growing rapidly. Makiš (Belgrade) is the key Balkan freight node."),

  Slovakia: mkt(5, "High", "Medium",
    "ŽSR/ZSSK Cargo operates ~5 hump yards. EU co-funded investment on Vienna–Bratislava–Košice corridor. Good procurement transparency via Slovak/TED portals."),

  // ── WATCH ─────────────────────────────────────────────────────────────────

  Ukraine: mkt(8, "Low", "Watch",
    "Ukrzaliznytsia has ~8 major hump yards. Market is disrupted by conflict but EBRD/EU reconstruction funding is already earmarked for rail infrastructure. High long-term potential — start relationship-building now."),

  Japan: mkt(12, "Medium", "Watch",
    "JR Freight operates ~12 hump yards. Highly sophisticated domestic industry (Nippon Signal, etc.) dominates procurement. Hard to penetrate without a Japanese partner. Monitor for PPP openings."),

  "South Korea": mkt(5, "Medium", "Watch",
    "Korail operates ~5 classification yards. Domestic supplier preference strong (Hyundai Rotem, etc.). Government-to-government route may be viable given Swedish rail reputation."),

  Croatia: mkt(3, "High", "Watch",
    "HŽ Infrastruktura operates ~3 active hump yards. EU member with TEN-T investment. Small market but EU-compliant procurement. Worth monitoring for corridor investment cycles."),

  Latvia: mkt(3, "Medium", "Watch",
    "LDz operates ~3 hump yards, largely serving East-West transit. Post-sanctions restructuring of freight volumes reduces near-term opportunity. Rail Baltica may shift priorities."),

  Lithuania: mkt(3, "Medium", "Watch",
    "LTG Infra operates ~3 yards. Rail Baltica investment is primarily focused on new passenger corridors. Freight hump yard investment is a secondary priority."),

  Estonia: mkt(2, "Medium", "Watch",
    "Eesti Raudtee operates ~2 hump yards. Small market. Rail Baltica will bring EU investment but primarily for passenger infrastructure."),

  Greece: mkt(3, "Medium", "Watch",
    "OSE/Hellenic Train operates ~3 yards. Post-Tempi accident (2023) is driving investment in rail safety — potential opening for safety-critical retarder systems."),

  Portugal: mkt(2, "High", "Watch",
    "IP/CP operates ~2 hump yards. EU member with Iberian gauge. Very small market but structured EU-compliant procurement. Low effort to monitor."),

  Brazil: mkt(5, "Low", "Watch",
    "Rumo/MRS operate ~5 classification yards. Privatized concession model. Growing rail investment but long procurement lead times and FX risk. Medium-term potential."),

  Argentina: mkt(3, "Low", "Watch",
    "Belgrano Cargas operates ~3 active hump yards. Government funding highly variable. Medium-term potential tied to macroeconomic stability."),

  Egypt: mkt(4, "Low", "Watch",
    "ENR operates ~4 hump yards. World Bank-funded modernization programme underway. Emerging market with growing rail investment. Long procurement lead times."),

  Morocco: mkt(3, "Medium", "Watch",
    "ONCF operates ~3 classification yards. Active rail investment with French and EU funding. Growing North Africa logistics hub. French-language procurement."),

  Pakistan: mkt(4, "Low", "Watch",
    "Pakistan Railways operates ~4 hump yards. CPEC rail components bring some investment. Complex procurement and political environment. Long-term watch."),

  Slovenia: mkt(2, "High", "Watch",
    "SŽ operates ~2 hump yards. EU member, very small market. Port of Koper connection is strategically important but limited hump yard investment expected near-term."),

  "Bosnia and Herzegovina": mkt(2, "Low", "Watch",
    "ZBH/ŽFBH operate ~2 yards. EU accession candidate with very limited investment budget. Long-term watch only — minimal near-term BD opportunity."),

  "North Macedonia": mkt(1, "Low", "Watch",
    "MŽT operates ~1 hump yard. Small market, constrained budget. EU candidate with minimal rail infrastructure investment."),

  Albania: mkt(1, "Low", "Watch",
    "HSH operates ~1 active hump yard. Very small market — EU candidate status may bring some investment. Minimal near-term BD opportunity but worth tracking."),

  Ireland: mkt(0, "High", "Watch",
    "Irish Rail uses flat switching — no significant hump yards. DECEL retarder systems do not apply to current Irish rail infrastructure."),

  // ── RESTRICTED ────────────────────────────────────────────────────────────

  Russia: mkt(0, "Restricted", "Restricted",
    "RZhD operates the world's largest hump yard network (~400+ yards) but is inaccessible due to international sanctions. The theoretical market is enormous — monitor for future re-engagement windows."),

  China: mkt(0, "Restricted", "Restricted",
    "China Railway operates 150+ classification yards — the world's 2nd largest hump network. Domestic supplier preference and limited foreign procurement access make this market inaccessible near-term."),

  Belarus: mkt(0, "Restricted", "Restricted",
    "Belarusian Railway operates ~20 hump yards but market is inaccessible due to EU/US sanctions. Monitor for political change."),

  Iran: mkt(0, "Restricted", "Restricted",
    "RAI (Iranian Railways) operates ~8 hump yards but market is inaccessible due to international sanctions."),
};

export function getMarketOpportunity(country: string): MarketOpportunity | null {
  return MARKET_DATA[country] ?? null;
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
    bg: "bg-slate-500/10",
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
