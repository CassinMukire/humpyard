import { Router } from "express";
import Exa from "exa-js";
import { SearchCountryBody } from "@workspace/api-zod";

const router = Router();

const COUNTRIES = [
  "Germany", "Russia", "China", "United States", "Poland", "Czech Republic",
  "Romania", "Hungary", "Austria", "Slovakia", "Ukraine", "France",
  "Netherlands", "Belgium", "Sweden", "Finland", "Norway", "Denmark",
  "Switzerland", "Italy", "Spain", "Turkey", "India", "Japan",
  "South Korea", "Kazakhstan", "Uzbekistan", "Belarus", "Latvia",
  "Lithuania", "Estonia", "Bulgaria", "Serbia", "Croatia", "Slovenia",
  "Bosnia and Herzegovina", "North Macedonia", "Albania", "Greece",
  "Portugal", "United Kingdom", "Ireland", "Australia", "Brazil",
  "Argentina", "South Africa", "Egypt", "Morocco", "Iran", "Pakistan",
];

type SourceLink = {
  url: string;
  title: string;
  publishedDate: string | null;
  snippet: string | null;
};

type KeyContact = {
  name: string | null;
  title: string;
  organisation: string;
  whyRelevant: string;
  linkedinUrl: string;
  confidence: "Named & verified" | "Role known, name uncertain" | "Role inferred";
};

type CountryResult = {
  country: string;
  verdict: "Yes" | "No" | "Uncertain";
  confidence: "High" | "Medium" | "Low";
  tier: "A" | "B" | "C" | "D";
  summary: string;
  yards: string[];
  operator: string | null;
  lastModernization: string | null;
  procurementPortal: string | null;
  contactEntryPoint: string | null;
  procurementTenders: string[];
  technicalContacts: string[];
  keyContacts: KeyContact[];
  sources: SourceLink[];
  error: string | null;
};

function getExa(): Exa {
  const apiKey = process.env["EXA_API_KEY"];
  if (!apiKey) {
    throw new Error("EXA_API_KEY environment variable is not set");
  }
  return new Exa(apiKey);
}

const HUMP_YARD_KEYWORDS = [
  "hump yard", "classification yard", "marshalling yard", "retarder",
  "wagon retarder", "hump automation", "sorting hill", "Spiralbroms",
  "GAC system", "rangieranlage", "triaj", "сортировочная станция", "编组站",
  "gravity hump", "shunting hump", "car retarder",
];

// Known key roles per operator — used as fallback when named contacts not found
const OPERATOR_KEY_ROLES: Record<string, Array<{ title: string; whyRelevant: string }>> = {
  "DB Netz AG / Deutsche Bahn": [
    { title: "Head of Freight Infrastructure", whyRelevant: "Controls marshalling yard capex budget across DB Cargo network" },
    { title: "Director of Technical Procurement", whyRelevant: "Approves retarder system tenders and supplier qualification" },
  ],
  "RZhD (Russian Railways)": [
    { title: "Deputy Head of Infrastructure", whyRelevant: "Oversees hump yard modernization programme across RZhD network" },
    { title: "Head of Capital Construction", whyRelevant: "Manages procurement for sorting yard automation projects" },
  ],
  "China Railway (CR)": [
    { title: "Director of Freight Operations Technology", whyRelevant: "Leads automation of classification yards across CR network" },
    { title: "Chief Engineer, Marshalling Systems", whyRelevant: "Technical authority on hump retarder specification and procurement" },
  ],
  "PKP Cargo / PLK": [
    { title: "Director of Infrastructure Investment", whyRelevant: "Manages PKP infrastructure modernization budget" },
    { title: "Head of Procurement, PLK", whyRelevant: "Approves tenders for track and yard equipment" },
  ],
  "ČD Cargo / SŽDC": [
    { title: "Head of Infrastructure Technology", whyRelevant: "Controls retarder procurement for Czech hump yard network" },
  ],
  "MÁV": [
    { title: "Director of Infrastructure Development", whyRelevant: "Manages EU-funded MÁV yard modernization programme" },
  ],
  "ÖBB": [
    { title: "Head of Rail Cargo Infrastructure", whyRelevant: "Oversees ÖBB classification yard investment" },
  ],
  "Kazakhstan Temir Zholy (KTZ)": [
    { title: "VP Infrastructure", whyRelevant: "Controls KTZ hump yard capex — DECEL reference site at Almaty" },
    { title: "Director of Technical Development", whyRelevant: "Leads sorting yard modernization procurement" },
  ],
  "Indian Railways": [
    { title: "Executive Director, Track Machines & Monitoring", whyRelevant: "Technical authority for marshalling yard systems across IR" },
    { title: "General Manager, Freight Business Development", whyRelevant: "Oversees classification yard capacity programmes" },
  ],
  "TCDD": [
    { title: "Director General of Infrastructure", whyRelevant: "Controls TCDD yard modernization budget" },
  ],
  "SNCF / SNCF Réseau": [
    { title: "Director of Freight Network Operations", whyRelevant: "Manages SNCF Réseau marshalling yard portfolio" },
  ],
  "Trafikverket / Green Cargo": [
    { title: "Head of Freight Infrastructure, Trafikverket", whyRelevant: "Reference operator — Hallsberg hump yard, DECEL installation" },
  ],
  "Ukrzaliznytsia": [
    { title: "Deputy Director, Infrastructure", whyRelevant: "Oversees Ukrzaliznytsia post-war reconstruction and yard modernization" },
  ],
};

function buildLinkedInUrl(name: string | null, organisation: string, title: string): string {
  const keywords = name
    ? `${name} ${organisation}`
    : `${title} ${organisation}`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

function extractNamedContacts(
  texts: string[],
  operator: string | null,
): Array<{ name: string; title: string; source: "text" }> {
  const namedPatterns = [
    // "Name Surname, Director of Infrastructure at DB"
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s+(?:Director|Head|Chief|VP|President|Manager|Engineer)[^,.\n]{0,60}/g,
    // "Director Surname Name" (Slavic/Asian name order)
    /(?:Director|Head|Chief|VP|President)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})/g,
    // Academic titles
    /(?:Dr\.|Prof\.|Ing\.|Dipl\.-Ing\.)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
  ];

  const found: Array<{ name: string; title: string; source: "text" }> = [];
  const seen = new Set<string>();

  for (const text of texts) {
    for (const pattern of namedPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1]?.trim();
        if (name && name.length > 4 && name.length < 50 && !seen.has(name)) {
          // Filter out common false positives
          const skipWords = ["Railway", "Cargo", "Freight", "Transport", "Ministry", "Department"];
          if (!skipWords.some(w => name.includes(w))) {
            seen.add(name);
            const context = match[0];
            const titleMatch = context.match(/(?:Director|Head|Chief|VP|President|Manager|Engineer|General)[^,.\n]{0,60}/i);
            found.push({
              name,
              title: titleMatch?.[0]?.trim().slice(0, 80) || "Senior Official",
              source: "text",
            });
          }
        }
      }
    }
  }

  return found.slice(0, 4);
}

function buildKeyContacts(
  country: string,
  operator: string | null,
  namedContacts: Array<{ name: string; title: string }>,
  tier: "A" | "B" | "C" | "D",
): KeyContact[] {
  const contacts: KeyContact[] = [];
  const org = operator || `${country} National Railways`;

  // 1. Named contacts found in search results (highest confidence)
  for (const nc of namedContacts.slice(0, 3)) {
    contacts.push({
      name: nc.name,
      title: nc.title,
      organisation: org,
      whyRelevant: `Named in procurement or infrastructure documents for ${country}`,
      linkedinUrl: buildLinkedInUrl(nc.name, org, nc.title),
      confidence: "Role known, name uncertain",
    });
  }

  // 2. Known key roles from operator lookup
  const knownRoles = operator ? OPERATOR_KEY_ROLES[operator] : null;
  if (knownRoles) {
    for (const role of knownRoles.slice(0, 3 - contacts.length + 1)) {
      contacts.push({
        name: null,
        title: role.title,
        organisation: org,
        whyRelevant: role.whyRelevant,
        linkedinUrl: buildLinkedInUrl(null, org, role.title),
        confidence: "Role inferred",
      });
    }
  }

  // 3. If still empty and tier A/B, add generic role placeholders
  if (contacts.length === 0 && (tier === "A" || tier === "B")) {
    const genericRoles = [
      { title: "Director of Infrastructure", whyRelevant: `Controls hump yard capex budget at ${org}` },
      { title: "Head of Technical Procurement", whyRelevant: `Approves retarder and automation equipment tenders` },
      { title: "Chief Engineer, Freight Operations", whyRelevant: `Technical authority for marshalling yard systems` },
    ];
    for (const gr of genericRoles) {
      contacts.push({
        name: null,
        title: gr.title,
        organisation: org,
        whyRelevant: gr.whyRelevant,
        linkedinUrl: buildLinkedInUrl(null, org, gr.title),
        confidence: "Role inferred",
      });
    }
  }

  return contacts.slice(0, 4);
}

function extractYards(texts: string[]): string[] {
  const yardPatterns = [
    /([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+(?:hump|classification|marshalling|sorting)\s+yard/gi,
    /(?:hump|classification|marshalling|sorting)\s+yard\s+(?:at|in|near)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)/gi,
    /([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+(?:rangieranlage|сортировочная)/gi,
  ];

  const yards = new Set<string>();
  for (const text of texts) {
    for (const pattern of yardPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const yard = match[1];
        if (yard && yard.length > 2 && yard.length < 60) {
          yards.add(yard.trim());
        }
      }
    }
  }
  return Array.from(yards).slice(0, 10);
}

function extractOperator(texts: string[], country: string): string | null {
  const countryOperatorMap: Record<string, string> = {
    Germany: "DB Netz AG / Deutsche Bahn",
    Russia: "RZhD (Russian Railways)",
    China: "China Railway (CR)",
    "United States": "Class I Railroads (BNSF, UP, CSX, NS)",
    Poland: "PKP Cargo / PLK",
    "Czech Republic": "ČD Cargo / SŽDC",
    Romania: "CFR Călători / CFR Marfă",
    Hungary: "MÁV",
    Austria: "ÖBB",
    Slovakia: "ZSSK Cargo",
    Ukraine: "Ukrzaliznytsia",
    France: "SNCF / SNCF Réseau",
    Netherlands: "ProRail / NS",
    Belgium: "Infrabel / SNCB",
    Sweden: "Trafikverket / Green Cargo",
    Finland: "Finrail / VR",
    Norway: "Bane NOR / CargoNet",
    Denmark: "Banedanmark / DSB",
    Switzerland: "SBB / Railcare",
    Italy: "RFI / Mercitalia",
    Spain: "ADIF / Renfe Mercancías",
    Turkey: "TCDD",
    India: "Indian Railways",
    Japan: "JR Freight",
    "South Korea": "Korail",
    Kazakhstan: "Kazakhstan Temir Zholy (KTZ)",
    Uzbekistan: "O'zbekiston Temir Yo'llari (UTY)",
    Belarus: "Belarusian Railway (BC)",
    Bulgaria: "BDZ / NKZHI",
    Serbia: "Infrastruktura Železnice Srbije",
    Croatia: "HŽ Infrastruktura",
  };

  return countryOperatorMap[country] || null;
}

function extractTenders(texts: string[]): string[] {
  const tenderPatterns = [
    /(?:tender|procurement|contract|bid)\s+(?:for|on)\s+([^.]{10,80})/gi,
    /(?:moderniz|upgrad|replac)\w+\s+(?:of\s+)?([^.]{10,80}retarder[^.]{0,40})/gi,
    /(?:hump automation|wagon retarder|car retarder)[^.]{0,60}/gi,
  ];

  const tenders = new Set<string>();
  for (const text of texts) {
    for (const pattern of tenderPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const tender = (match[1] || match[0]).trim();
        if (tender.length > 15 && tender.length < 200) {
          tenders.add(tender);
        }
      }
    }
  }
  return Array.from(tenders).slice(0, 5);
}

function detectProcurementPortal(texts: string[], sources: SourceLink[]): string | null {
  const portalDomains = [
    "ted.europa.eu", "worldbank.org", "adb.org", "ebrd.com",
    "procurement", "tender", "bidding", "etender",
  ];

  for (const source of sources) {
    for (const domain of portalDomains) {
      if (source.url.toLowerCase().includes(domain)) {
        return source.url;
      }
    }
  }

  const urlPattern = /https?:\/\/[^\s"'<>]+(?:tender|procurement|bid)[^\s"'<>]*/gi;
  for (const text of texts) {
    const match = text.match(urlPattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function analyzeResults(
  country: string,
  results: Array<{ title: string; url: string; publishedDate?: string; text?: string; highlights?: string[] }>,
): CountryResult {
  const allTexts = results.map((r) => `${r.title} ${r.text || ""} ${(r.highlights || []).join(" ")}`);
  const combinedText = allTexts.join(" ").toLowerCase();

  const humpSignals = HUMP_YARD_KEYWORDS.filter((kw) =>
    combinedText.includes(kw.toLowerCase())
  );

  const modernizationKeywords = [
    "modernization", "upgrade", "tender", "procurement", "2023", "2024", "2025",
    "new contract", "installation", "replacement",
  ];
  const modernizationSignals = modernizationKeywords.filter((kw) =>
    combinedText.includes(kw)
  );

  const noHumpSignals = [
    "no hump yard", "no classification yard", "no marshalling yard",
    "discontinued", "closed", "decommissioned",
  ].filter((kw) => combinedText.includes(kw));

  const sources: SourceLink[] = results.map((r) => ({
    url: r.url,
    title: r.title,
    publishedDate: r.publishedDate || null,
    snippet: r.highlights?.[0] || (r.text ? r.text.slice(0, 200) : null),
  }));

  const yards = extractYards(allTexts);
  const operator = extractOperator(allTexts, country);
  const tenders = extractTenders(allTexts);
  const procurementPortal = detectProcurementPortal(allTexts, sources);

  // Scoring
  let verdict: "Yes" | "No" | "Uncertain" = "Uncertain";
  let confidence: "High" | "Medium" | "Low" = "Low";
  let tier: "A" | "B" | "C" | "D" = "D";

  const humpScore = humpSignals.length;
  const modernScore = modernizationSignals.length;

  if (noHumpSignals.length > 0 && humpScore === 0) {
    verdict = "No";
    confidence = "Medium";
    tier = "D";
  } else if (humpScore >= 3) {
    verdict = "Yes";
    confidence = humpScore >= 6 ? "High" : "Medium";
    if (modernScore >= 3 || tenders.length > 0) {
      tier = "A";
    } else if (modernScore >= 1 || yards.length > 0) {
      tier = "B";
    } else {
      tier = "C";
    }
  } else if (humpScore >= 1) {
    verdict = "Uncertain";
    confidence = "Low";
    tier = "C";
  } else {
    verdict = "Uncertain";
    confidence = "Low";
    tier = "D";
  }

  let lastModernization: string | null = null;
  const yearMatches = combinedText.match(/\b(20[12][0-9])\b.*?(?:moderniz|upgrad|contract|tender)/g);
  if (yearMatches?.length) {
    lastModernization = yearMatches[yearMatches.length - 1].slice(0, 100).trim();
  }

  const topSnippets = results
    .slice(0, 3)
    .map((r) => r.highlights?.[0] || "")
    .filter(Boolean)
    .join(" ");

  const tierLabels: Record<string, string> = {
    A: "active modernization program — high BD priority",
    B: "active hump yards with limited recent procurement activity",
    C: "legacy hump yard base — lower spend profile",
    D: "no confirmed active hump yards",
  };

  const summary =
    humpScore > 0
      ? `${country} shows ${verdict === "Yes" ? "confirmed" : "possible"} hump/classification yard activity (${humpSignals.slice(0, 3).join(", ")} signals found across ${results.length} sources). Railway operator: ${operator || "unknown"}. ${topSnippets ? `Key context: ${topSnippets.slice(0, 300)}.` : ""} Market assessment: ${tierLabels[tier]}.`
      : `No strong hump yard signals found for ${country} across ${results.length} search results. Manual verification recommended via national railway authority publications and regional procurement portals.`;

  // Extract named contacts from all texts, then build structured KeyContacts
  const namedContacts = extractNamedContacts(allTexts, operator);
  const keyContacts = buildKeyContacts(country, operator, namedContacts, tier);

  const legacyContacts = namedContacts.map((c) => `${c.name} — ${c.title}`);

  return {
    country,
    verdict,
    confidence,
    tier,
    summary: summary.slice(0, 600),
    yards,
    operator,
    lastModernization,
    procurementPortal,
    contactEntryPoint: legacyContacts[0] || null,
    procurementTenders: tenders,
    technicalContacts: legacyContacts,
    keyContacts,
    sources: sources.slice(0, 8),
    error: null,
  };
}

router.get("/search/countries", (_req, res) => {
  res.json({ countries: COUNTRIES });
});

router.post("/search/country", async (req, res) => {
  const parseResult = SearchCountryBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { country } = parseResult.data;

  let exa: Exa;
  try {
    exa = getExa();
  } catch {
    res.status(500).json({ error: "EXA_API_KEY not configured." });
    return;
  }

  const operator = extractOperator([], country);

  const queries = [
    `${country} marshalling yard retarder modernization`,
    `${country} hump yard classification yard railway`,
    `${country} railway authority sorting hump tender procurement`,
    `${country} rangieranlage OR triaj OR сортировочная станция OR 编组站`,
    `site:ted.europa.eu OR site:worldbank.org OR site:adb.org ${country} wagon retarder hump automation`,
    `${country} GAC system OR wagon retarder OR Spiralbroms OR hump automation railway`,
    // Contact-focused queries
    `${operator || country + " railway"} infrastructure director procurement contact`,
    `${country} ministry transport railway director general infrastructure`,
  ];

  try {
    const searchPromises = queries.map((query) =>
      exa.searchAndContents(query, {
        numResults: 3,
        highlights: { numSentences: 2, highlightsPerUrl: 2 },
        text: { maxCharacters: 500 },
      }).catch(() => ({ results: [] as any[] }))
    );

    const searchResponses = await Promise.all(searchPromises);

    const allResults: Array<{
      title: string;
      url: string;
      publishedDate?: string;
      text?: string;
      highlights?: string[];
    }> = [];

    const seenUrls = new Set<string>();
    for (const response of searchResponses) {
      for (const result of (response as any).results || []) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push({
            title: result.title || "",
            url: result.url,
            publishedDate: result.publishedDate,
            text: result.text,
            highlights: result.highlights?.map((h: any) =>
              typeof h === "string" ? h : h.highlight || ""
            ),
          });
        }
      }
    }

    if (allResults.length === 0) {
      const keyContacts = buildKeyContacts(country, operator, [], "D");
      res.json({
        country,
        verdict: "Uncertain",
        confidence: "Low",
        tier: "D",
        summary: `No search results returned for ${country}. Manual verification via national railway authority websites is strongly recommended.`,
        yards: [],
        operator,
        lastModernization: null,
        procurementPortal: null,
        contactEntryPoint: null,
        procurementTenders: [],
        technicalContacts: [],
        keyContacts,
        sources: [],
        error: "No results returned from search — manual verification needed",
      } satisfies CountryResult);
      return;
    }

    const result = analyzeResults(country, allResults);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Search failed");
    const keyContacts = buildKeyContacts(country, operator, [], "D");
    res.json({
      country,
      verdict: "Uncertain",
      confidence: "Low",
      tier: "D",
      summary: `Search failed for ${country}. Manual verification required.`,
      yards: [],
      operator,
      lastModernization: null,
      procurementPortal: null,
      contactEntryPoint: null,
      procurementTenders: [],
      technicalContacts: [],
      keyContacts,
      sources: [],
      error: err?.message || "Search failed — manual verification needed",
    } satisfies CountryResult);
  }
});

export default router;
