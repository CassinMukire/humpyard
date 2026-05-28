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
  const operatorPatterns = [
    /\b((?:[A-Z]{2,}(?:\s+[A-Z]{2,})*)|(?:(?:National |State |Federal )?Railway(?:s)?(?:\s+of\s+[A-Z][a-z]+)?))\b/g,
    /\b([A-Z]{2,10})\s+(?:railways?|railroad|Bahn|chemin de fer|ferroviaria)\b/gi,
  ];

  const candidates = new Set<string>();
  for (const text of texts) {
    for (const pattern of operatorPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const op = match[1];
        if (op && op.length > 2 && op.length < 80) {
          candidates.add(op.trim());
        }
      }
    }
  }

  // Common operators by country pattern
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
  };

  return countryOperatorMap[country] || Array.from(candidates)[0] || null;
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

function extractContacts(texts: string[]): string[] {
  const contactPatterns = [
    /(?:Director|Chief|Head|Manager|President|CEO|VP|Director-General)\s+(?:of\s+)?(?:Infrastructure|Procurement|Engineering|Operations|Technical)[^,.\n]{0,60}/gi,
    /(?:Ing\.|Dr\.|Dipl\.|Ir\.) [A-Z][a-z]+ [A-Z][a-z]+/g,
  ];

  const contacts = new Set<string>();
  for (const text of texts) {
    for (const pattern of contactPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const contact = match[0].trim();
        if (contact.length > 5 && contact.length < 120) {
          contacts.add(contact);
        }
      }
    }
  }
  return Array.from(contacts).slice(0, 5);
}

function detectProcurementPortal(texts: string[], sources: SourceLink[]): string | null {
  const portalDomains = [
    "ted.europa.eu", "worldbank.org", "adb.org", "ebrd.com",
    "procurement", "tender", "bidding", "etender", "gepir",
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
    if (match && match[0]) return match[0];
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
  const contacts = extractContacts(allTexts);
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

  // Find last modernization reference
  let lastModernization: string | null = null;
  const yearMatches = combinedText.match(/\b(20[12][0-9])\b.*?(?:moderniz|upgrad|contract|tender)/g);
  if (yearMatches && yearMatches.length > 0) {
    lastModernization = yearMatches[yearMatches.length - 1].slice(0, 100).trim();
  }

  // Build summary
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
      : `No strong hump yard signals found for ${country} across ${results.length} search results. Manual verification recommended, particularly via national railway authority publications and regional procurement portals. This may reflect a genuine absence of hump yards or a gap in available indexed sources.`;

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
    contactEntryPoint: contacts[0] || null,
    procurementTenders: tenders,
    technicalContacts: contacts,
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
    res.status(500).json({ error: "EXA_API_KEY not configured. Please add your Exa API key to secrets." });
    return;
  }

  const queries = [
    `${country} marshalling yard retarder modernization`,
    `${country} hump yard classification yard railway`,
    `${country} railway authority sorting hump tender procurement`,
    `${country} rangieranlage OR triaj OR сортировочная станция OR 编组站`,
    `site:ted.europa.eu OR site:worldbank.org OR site:adb.org ${country} wagon retarder hump automation`,
    `${country} GAC system OR wagon retarder OR Spiralbroms OR hump automation railway`,
  ];

  try {
    const searchPromises = queries.map((query) =>
      exa.searchAndContents(query, {
        numResults: 3,
        highlights: { numSentences: 2, highlightsPerUrl: 2 },
        text: { maxCharacters: 500 },
      }).catch(() => ({ results: [] as typeof exa extends Exa ? any[] : never }))
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
      const uncertainResult: CountryResult = {
        country,
        verdict: "Uncertain",
        confidence: "Low",
        tier: "D",
        summary: `No search results returned for ${country}. This may indicate a lack of indexed sources rather than absence of hump yards. Manual verification via national railway authority websites is strongly recommended.`,
        yards: [],
        operator: null,
        lastModernization: null,
        procurementPortal: null,
        contactEntryPoint: null,
        procurementTenders: [],
        technicalContacts: [],
        sources: [],
        error: "No results returned from search — manual verification needed",
      };
      res.json(uncertainResult);
      return;
    }

    const result = analyzeResults(country, allResults);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Search failed");
    const errorResult: CountryResult = {
      country,
      verdict: "Uncertain",
      confidence: "Low",
      tier: "D",
      summary: `Search failed for ${country}. Manual verification required.`,
      yards: [],
      operator: null,
      lastModernization: null,
      procurementPortal: null,
      contactEntryPoint: null,
      procurementTenders: [],
      technicalContacts: [],
      sources: [],
      error: err?.message || "Search failed — manual verification needed",
    };
    res.json(errorResult);
  }
});

export default router;
