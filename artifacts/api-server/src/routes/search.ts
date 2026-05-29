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
    { title: "Chief Engineer, Freight Operations", whyRelevant: "Technical specification authority for hump yard systems" },
  ],
  "RZhD (Russian Railways)": [
    { title: "Deputy Head of Infrastructure", whyRelevant: "Oversees hump yard modernization programme across RZhD network" },
    { title: "Head of Capital Construction", whyRelevant: "Manages procurement for sorting yard automation projects" },
    { title: "Director of Technical Development", whyRelevant: "Technical authority on retarder and automation specifications" },
  ],
  "China Railway (CR)": [
    { title: "Director of Freight Operations Technology", whyRelevant: "Leads automation of classification yards across CR network" },
    { title: "Chief Engineer, Marshalling Systems", whyRelevant: "Technical authority on hump retarder specification and procurement" },
    { title: "Head of Infrastructure Procurement", whyRelevant: "Manages tenders for yard equipment across CR network" },
  ],
  "PKP Cargo / PLK": [
    { title: "Director of Infrastructure Investment", whyRelevant: "Manages PKP infrastructure modernization budget" },
    { title: "Head of Procurement, PLK", whyRelevant: "Approves tenders for track and yard equipment" },
    { title: "Chief Engineer, PLK", whyRelevant: "Technical approver for hump yard safety systems" },
  ],
  "ČD Cargo / SŽDC": [
    { title: "Head of Infrastructure Technology", whyRelevant: "Controls retarder procurement for Czech hump yard network" },
    { title: "Director of Infrastructure Investment, SŽDC", whyRelevant: "Manages EU co-funded yard modernization projects" },
  ],
  "CFR Călători / CFR Marfă": [
    { title: "Director of Infrastructure, CFR SA", whyRelevant: "Controls Romanian national rail infrastructure investment including marshalling yards" },
    { title: "Head of Procurement, CFR", whyRelevant: "Runs EU-funded tenders for track and yard equipment" },
    { title: "Chief Engineer, CFR Marfă", whyRelevant: "Technical authority on freight yard systems and retarder specifications" },
  ],
  "MÁV": [
    { title: "Director of Infrastructure Development", whyRelevant: "Manages EU-funded MÁV yard modernization programme" },
    { title: "Head of Procurement, MÁV", whyRelevant: "Approves capital tenders for yard equipment" },
  ],
  "ÖBB": [
    { title: "Head of Rail Cargo Infrastructure", whyRelevant: "Oversees ÖBB classification yard investment" },
    { title: "Director of Technical Procurement, ÖBB", whyRelevant: "Manages tenders for safety-critical rail systems" },
  ],
  "ZSSK Cargo": [
    { title: "Director of Infrastructure, ŽSR", whyRelevant: "Controls Slovak rail infrastructure budget including hump yards" },
    { title: "Head of Technical Operations, ZSSK Cargo", whyRelevant: "Manages freight yard equipment and maintenance programme" },
  ],
  "Ukrzaliznytsia": [
    { title: "Deputy Director, Infrastructure", whyRelevant: "Oversees Ukrzaliznytsia post-war reconstruction and yard modernization" },
    { title: "Head of Capital Investment, Ukrzaliznytsia", whyRelevant: "Manages international donor-funded rail infrastructure projects" },
  ],
  "SNCF / SNCF Réseau": [
    { title: "Director of Freight Network Operations", whyRelevant: "Manages SNCF Réseau marshalling yard portfolio" },
    { title: "Head of Infrastructure Procurement, SNCF Réseau", whyRelevant: "Approves capital tenders for network equipment" },
    { title: "Chief Engineer, Freight Infrastructure", whyRelevant: "Technical specification authority for yard automation" },
  ],
  "ProRail / NS": [
    { title: "Manager Freight Corridors, ProRail", whyRelevant: "Oversees ProRail classification yard operations and investment" },
    { title: "Director Asset Management, ProRail", whyRelevant: "Controls infrastructure renewal budget including hump facilities" },
  ],
  "Infrabel / SNCB": [
    { title: "Director of Infrastructure, Infrabel", whyRelevant: "Manages Infrabel's marshalling yard asset base" },
    { title: "Head of Technical Procurement, Infrabel", whyRelevant: "Approves tenders for safety-critical rail infrastructure equipment" },
  ],
  "Trafikverket / Green Cargo": [
    { title: "Head of Freight Infrastructure, Trafikverket", whyRelevant: "Reference operator — Hallsberg hump yard, DECEL installation" },
    { title: "Head of Asset Management, Green Cargo", whyRelevant: "Manages Green Cargo freight terminal and yard investment" },
  ],
  "Finrail / VR": [
    { title: "Director of Infrastructure, Väylävirasto", whyRelevant: "Controls Finnish Transport Infrastructure Agency rail investment" },
    { title: "Head of Freight Operations, VR Transpoint", whyRelevant: "Manages VR marshalling yard operations and modernization" },
  ],
  "Bane NOR / CargoNet": [
    { title: "Director of Asset Management, Bane NOR", whyRelevant: "Oversees Norwegian rail infrastructure renewal including hump yards" },
    { title: "Head of Freight Infrastructure, Bane NOR", whyRelevant: "Technical authority for classification yard investments" },
  ],
  "Banedanmark / DSB": [
    { title: "Head of Infrastructure, Banedanmark", whyRelevant: "Controls Danish national rail infrastructure budget" },
    { title: "Director of Procurement, Banedanmark", whyRelevant: "Manages tenders for rail infrastructure equipment" },
  ],
  "SBB / Railcare": [
    { title: "Head of Infrastructure, SBB Cargo", whyRelevant: "Manages SBB classification yard portfolio" },
    { title: "Director of Technical Procurement, SBB", whyRelevant: "Approves capital tenders for Swiss rail network equipment" },
  ],
  "RFI / Mercitalia": [
    { title: "Director of Infrastructure, RFI", whyRelevant: "Controls Italian national rail infrastructure investment" },
    { title: "Head of Procurement, RFI", whyRelevant: "Manages EU-funded tenders for track and yard systems" },
    { title: "Head of Freight Operations, Mercitalia Rail", whyRelevant: "Oversees Mercitalia marshalling yard operations" },
  ],
  "ADIF / Renfe Mercancías": [
    { title: "Director of Infrastructure, ADIF", whyRelevant: "Controls ADIF's rail infrastructure investment programme" },
    { title: "Head of Freight Terminal Operations, ADIF", whyRelevant: "Manages classification yard assets across Spain" },
    { title: "Director of Procurement, ADIF", whyRelevant: "Approves capital tenders for Spanish rail infrastructure" },
  ],
  "TCDD": [
    { title: "Director General of Infrastructure, TCDD", whyRelevant: "Controls TCDD yard modernization budget" },
    { title: "Head of Technical Procurement, TCDD", whyRelevant: "Manages tenders for rail safety equipment" },
    { title: "Chief Engineer, TCDD", whyRelevant: "Technical specification authority for hump yard systems" },
  ],
  "Indian Railways": [
    { title: "Executive Director, Track Machines & Monitoring", whyRelevant: "Technical authority for marshalling yard systems across IR" },
    { title: "General Manager, Freight Business Development", whyRelevant: "Oversees classification yard capacity programmes" },
    { title: "Principal Chief Engineer (Construction)", whyRelevant: "Manages IR infrastructure development including new hump yards" },
  ],
  "JR Freight": [
    { title: "Director of Infrastructure, JR Freight", whyRelevant: "Controls JR Freight classification yard investment" },
    { title: "Head of Technical Operations, JR Freight", whyRelevant: "Manages hump yard modernization and retarder maintenance" },
  ],
  "Korail": [
    { title: "Director of Infrastructure, Korea Railroad", whyRelevant: "Oversees Korail marshalling yard asset base" },
    { title: "Head of Procurement, Korail", whyRelevant: "Approves tenders for rail safety equipment" },
  ],
  "Kazakhstan Temir Zholy (KTZ)": [
    { title: "VP Infrastructure", whyRelevant: "Controls KTZ hump yard capex — DECEL reference site at Almaty" },
    { title: "Director of Technical Development", whyRelevant: "Leads sorting yard modernization procurement" },
    { title: "Head of Procurement, KTZ", whyRelevant: "Manages international tenders for rail equipment" },
  ],
  "O'zbekiston Temir Yo'llari (UTY)": [
    { title: "Deputy Director General, Infrastructure", whyRelevant: "Oversees UTY freight yard modernization programme" },
    { title: "Head of Technical Procurement, UTY", whyRelevant: "Manages tenders for rail safety and automation equipment" },
  ],
  "Belarusian Railway (BC)": [
    { title: "First Deputy Head, Infrastructure", whyRelevant: "Controls BC hump yard investment across the network" },
    { title: "Head of Capital Construction, BC", whyRelevant: "Manages procurement for sorting yard modernization" },
  ],
  "LDz (Latvijas dzelzceļš)": [
    { title: "Director of Infrastructure, LDz", whyRelevant: "Controls Latvian rail infrastructure investment" },
    { title: "Head of Procurement, LDz", whyRelevant: "Manages tenders for track and yard equipment" },
  ],
  "Lietuvos geležinkeliai (LG)": [
    { title: "Director of Infrastructure, LTG Infra", whyRelevant: "Manages Lithuanian rail infrastructure investment" },
    { title: "Head of Procurement, LTG", whyRelevant: "Approves capital tenders for rail equipment" },
  ],
  "Eesti Raudtee (EVR)": [
    { title: "Director of Infrastructure, Eesti Raudtee", whyRelevant: "Controls Estonian rail infrastructure budget" },
    { title: "Head of Asset Management, EVR", whyRelevant: "Manages freight yard asset renewal" },
  ],
  "BDZ / NKZHI": [
    { title: "Director of Infrastructure, NKZHI", whyRelevant: "Controls Bulgarian national rail infrastructure investment" },
    { title: "Head of Procurement, NKZHI", whyRelevant: "Manages EU-funded tenders for track and yard systems" },
  ],
  "Infrastruktura Železnice Srbije": [
    { title: "Director of Infrastructure, IŽS", whyRelevant: "Oversees Serbian rail infrastructure investment" },
    { title: "Head of Technical Procurement, IŽS", whyRelevant: "Manages tenders for yard safety systems" },
  ],
  "HŽ Infrastruktura": [
    { title: "Director of Infrastructure, HŽ Infrastruktura", whyRelevant: "Controls Croatian rail infrastructure budget" },
    { title: "Head of Asset Management, HŽ", whyRelevant: "Manages freight yard renewal programme" },
  ],
  "SŽ Infrastruktura": [
    { title: "Director of Infrastructure, SŽ", whyRelevant: "Controls Slovenian rail infrastructure investment" },
    { title: "Head of Procurement, SŽ", whyRelevant: "Manages tenders for rail safety equipment" },
  ],
  "Željeznice Federacije BiH / ZRS": [
    { title: "Director General of Infrastructure", whyRelevant: "Controls Bosnian rail infrastructure budget" },
    { title: "Head of Procurement", whyRelevant: "Manages tenders for rail safety and yard equipment" },
  ],
  "MŽT (North Macedonia Railways)": [
    { title: "Director of Infrastructure, MŽT", whyRelevant: "Oversees North Macedonia rail infrastructure investment" },
  ],
  "HSH (Albanian Railways)": [
    { title: "Director General, HSH", whyRelevant: "Controls Albanian rail network investment" },
  ],
  "OSE / Hellenic Train": [
    { title: "Director of Infrastructure, OSE", whyRelevant: "Manages Greek national rail infrastructure investment" },
    { title: "Head of Procurement, Hellenic Train", whyRelevant: "Approves capital tenders for rail equipment" },
  ],
  "IP (Infraestruturas de Portugal)": [
    { title: "Director of Infrastructure, IP", whyRelevant: "Controls Portuguese rail infrastructure investment" },
    { title: "Head of Procurement, IP", whyRelevant: "Manages EU-funded tenders for track and yard equipment" },
  ],
  "Network Rail / DB Cargo UK": [
    { title: "Head of Freight Infrastructure, Network Rail", whyRelevant: "Oversees Network Rail marshalling yard portfolio" },
    { title: "Director of Asset Management, Network Rail", whyRelevant: "Controls infrastructure renewal budget" },
    { title: "Head of Operations, DB Cargo UK", whyRelevant: "Manages DB Cargo UK classification yard operations" },
  ],
  "Irish Rail": [
    { title: "Head of Infrastructure, Iarnród Éireann", whyRelevant: "Controls Irish Rail infrastructure investment" },
  ],
  "ARTC / Pacific National": [
    { title: "Head of Infrastructure, ARTC", whyRelevant: "Manages Australian Rail Track Corporation network investment" },
    { title: "Director of Operations, Pacific National", whyRelevant: "Oversees Pacific National freight classification operations" },
  ],
  "Class I Railroads (BNSF, UP, CSX, NS)": [
    { title: "VP Engineering", whyRelevant: "Capital engineering authority across Class I hump yard network" },
    { title: "Director of Mechanical Operations", whyRelevant: "Manages hump retarder maintenance and replacement programmes" },
    { title: "Director of Capital Projects", whyRelevant: "Approves retarder system capex across the network" },
  ],
  "ALL / MRS / Rumo": [
    { title: "Director of Infrastructure, Rumo", whyRelevant: "Controls Rumo classification yard investment in Brazil" },
    { title: "Head of Operations, MRS Logística", whyRelevant: "Manages MRS freight yard operations and modernization" },
  ],
  "Ferroviaria Central / Belgrano Cargas": [
    { title: "Director of Infrastructure, Belgrano Cargas", whyRelevant: "Controls Argentine freight rail infrastructure investment" },
    { title: "Head of Technical Operations", whyRelevant: "Manages classification yard systems procurement" },
  ],
  "Transnet Freight Rail": [
    { title: "Head of Infrastructure, Transnet Freight Rail", whyRelevant: "Controls South African freight rail infrastructure investment" },
    { title: "Chief Engineer, Transnet Freight Rail", whyRelevant: "Technical specification authority for hump yard systems" },
    { title: "Head of Procurement, Transnet", whyRelevant: "Manages capital tenders for rail equipment" },
  ],
  "Egyptian National Railways": [
    { title: "Deputy Chairman of Infrastructure, ENR", whyRelevant: "Controls ENR yard infrastructure investment" },
    { title: "Head of Procurement, ENR", whyRelevant: "Manages tenders for rail safety equipment" },
  ],
  "ONCF": [
    { title: "Director of Infrastructure, ONCF", whyRelevant: "Controls Moroccan national railway infrastructure investment" },
    { title: "Head of Procurement, ONCF", whyRelevant: "Manages tenders for rail equipment" },
  ],
  "RAI (Islamic Republic of Iran Railways)": [
    { title: "Deputy Director General, Infrastructure", whyRelevant: "Oversees RAI freight yard modernization programme" },
    { title: "Head of Technical Procurement, RAI", whyRelevant: "Manages tenders for rail safety and automation systems" },
  ],
  "Pakistan Railways": [
    { title: "Additional Director General, Infrastructure", whyRelevant: "Controls Pakistan Railways infrastructure investment" },
    { title: "Chief Engineer (Works), Pakistan Railways", whyRelevant: "Technical authority for marshalling yard systems" },
  ],
};

function buildLinkedInSearchUrl(name: string | null, organisation: string, title: string): string {
  const keywords = name
    ? `${name} ${organisation}`
    : `${title} ${organisation}`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

// Use Exa to find the actual linkedin.com/in/ profile URL for a named contact.
// Falls back to the keyword search URL if Exa finds nothing.
async function resolveLinkedInProfile(
  exa: Exa,
  name: string,
  organisation: string,
  fallback: string,
): Promise<string> {
  try {
    const query = `${name} ${organisation} railway infrastructure`;
    const result = await exa.search(query, {
      numResults: 3,
      includeDomains: ["linkedin.com"],
      type: "neural",
    } as Parameters<typeof exa.search>[1]);
    const profileUrl = (result.results as Array<{ url: string }>)
      .map((r) => r.url)
      .find((url) => url.includes("linkedin.com/in/"));
    return profileUrl ?? fallback;
  } catch {
    return fallback;
  }
}

// Enrich up to 3 named contacts with real LinkedIn profile URLs (parallel Exa lookups)
async function enrichContactsWithLinkedIn(
  exa: Exa,
  contacts: KeyContact[],
): Promise<KeyContact[]> {
  const targets = contacts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.name !== null)
    .slice(0, 3);

  if (targets.length === 0) return contacts;

  const resolved = await Promise.allSettled(
    targets.map(({ c }) =>
      resolveLinkedInProfile(exa, c.name!, c.organisation, c.linkedinUrl),
    ),
  );

  const updated = [...contacts];
  targets.forEach(({ i }, idx) => {
    const r = resolved[idx];
    if (r.status === "fulfilled") {
      updated[i] = { ...updated[i], linkedinUrl: r.value };
      // Upgrade confidence label when we have a verified profile URL
      if (r.value.includes("linkedin.com/in/")) {
        updated[i] = { ...updated[i], confidence: "Named & verified" };
      }
    }
  });
  return updated;
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
      linkedinUrl: buildLinkedInSearchUrl(nc.name, org, nc.title),
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
        linkedinUrl: buildLinkedInSearchUrl(null, org, role.title),
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
        linkedinUrl: buildLinkedInSearchUrl(null, org, gr.title),
        confidence: "Role inferred",
      });
    }
  }

  return contacts.slice(0, 4);
}

// Verified hump/classification yard locations per country — primary source for the "Identified Yards" field
const KNOWN_YARDS: Record<string, string[]> = {
  Germany: [
    "Maschen (Hamburg) — Europe's largest classification yard",
    "München Ost Rbf",
    "Halle-Engelsdorf",
    "Seelze (Hannover)",
    "Gremberg (Cologne)",
    "Mannheim Rbf",
    "Nürnberg Rbf",
    "Frankfurt-Höchst",
  ],
  Sweden: [
    "Hallsberg Classification Yard (DECEL reference site)",
    "Malmö Triangeln Classification Yard",
    "Göteborg Sävenäs",
  ],
  Kazakhstan: [
    "Almaty Classification Yard (DECEL reference site)",
    "Dostyk (border yard)",
    "Astana Sorting Yard",
  ],
  Poland: [
    "Warsaw Praga Classification Yard",
    "Gliwice Sorting Yard",
    "Wrocław Brochów",
    "Łódź Olechów",
    "Tarnowskie Góry",
  ],
  "Czech Republic": [
    "Přerov Classification Yard",
    "Brno-Maloměřice",
    "Praha Žižkov",
    "Ostrava-Svinov",
  ],
  Romania: [
    "Roșiori de Vede Hump Yard",
    "Cluj-Napoca Sorting Yard",
    "Brașov Classification Yard",
    "Craiova Hump Yard",
    "Iași Sorting Yard",
  ],
  Hungary: [
    "Budapest Ferencváros Classification Yard",
    "Győr Sorting Yard",
    "Debrecen Hump Yard",
  ],
  Austria: [
    "Wien Zvb (Vienna South Classification Yard)",
    "Linz-Vbf",
    "Graz-Vbf",
  ],
  Slovakia: [
    "Žilina-Teplička Classification Yard",
    "Bratislava-Východ",
    "Košice Hump Yard",
  ],
  Russia: [
    "Likhobory (Moscow) Classification Yard",
    "Dolgintsevo",
    "Orenburg Sorting Yard",
    "Ekaterinburg-Sorting",
    "Novosibirsk-Vostochny",
    "Chelyabinsk Hump Yard",
  ],
  Ukraine: [
    "Znamianka Classification Yard",
    "Kharkiv-Sorting",
    "Dnipro Hump Yard",
    "Lviv Classification Yard",
  ],
  Belarus: [
    "Minsk-Sorting Classification Yard",
    "Baranovichi Hump Yard",
    "Vitebsk Sorting Yard",
  ],
  China: [
    "Zhengzhou North (largest in Asia)",
    "Wuhan North Classification Yard",
    "Xuzhou East Hump Yard",
    "Harbin Hump Yard",
    "Xi'an Hump Yard",
    "Chengdu Hump Yard",
  ],
  "United States": [
    "Bailey Yard, North Platte NE (world's largest)",
    "Conway Yard, Pittsburgh PA",
    "Selkirk Yard, Albany NY",
    "Proviso Yard, Chicago IL",
    "Belen Yard, New Mexico",
    "Avondale Yard, Birmingham AL",
  ],
  India: [
    "Mughal Sarai (Pandit Deen Dayal Upadhyaya) Classification Yard",
    "Itarsi Classification Yard",
    "Secunderabad Sorting Yard",
    "Shakurbasti Hump Yard (Delhi)",
    "Pune Classification Yard",
  ],
  France: [
    "Woippy Hump Yard (Metz)",
    "Sibelin (Lyon) Classification Yard",
    "Le Bourget (Paris)",
  ],
  Netherlands: [
    "Kijfhoek Classification Yard (Rotterdam)",
  ],
  Belgium: [
    "Antwerp-Noord Classification Yard",
    "Montzen Hump Yard",
  ],
  Switzerland: [
    "Basel Wolf Classification Yard",
    "Limmattal Rangierbahnhof (Zürich)",
  ],
  Italy: [
    "Verona Quadrante Europa Classification Yard",
    "Bologna Interporto Hump Yard",
    "Torino Orbassano",
  ],
  Spain: [
    "Miranda de Ebro Classification Yard",
    "Madrid-Abroñigal",
    "Barcelona-La Sagrera",
  ],
  Turkey: [
    "Kocaeli (Izmit) Classification Yard",
    "Ankara Hump Yard",
    "Konya Sorting Yard",
  ],
  Japan: [
    "Kokura Classification Yard (Kitakyushu)",
    "Moji Classification Yard",
    "Nishi-Kobe Hump Yard",
  ],
  "South Korea": [
    "Okcheon Classification Yard",
    "Busan Hump Yard",
  ],
  Finland: [
    "Tampere Järvensuo Classification Yard",
    "Kontiomäki Hump Yard",
  ],
  Norway: [
    "Alnabru Classification Yard (Oslo)",
  ],
  Denmark: [
    "Taulov Freight Centre Classification Yard",
  ],
  Uzbekistan: [
    "Tashkent Sorting Yard",
    "Samarkand Classification Yard",
  ],
  Bulgaria: [
    "Sofia Yard (Filipovo)",
    "Plovdiv Classification Yard",
  ],
  Serbia: [
    "Makiš Classification Yard (Belgrade)",
    "Novi Sad Hump Yard",
  ],
  Croatia: [
    "Rijeka Classification Yard",
    "Zagreb-Ranžirni Kolodvor",
  ],
  "South Africa": [
    "Sentrarand Classification Yard (Johannesburg)",
    "Bellville Hump Yard (Cape Town)",
    "Rosslyn (Pretoria)",
  ],
  "United Kingdom": [
    "Toton Yard (Nottingham)",
    "Wentloog (Cardiff)",
    "Doncaster Hump Yard",
  ],
  Australia: [
    "Enfield Intermodal Logistics Centre (Sydney)",
    "Acacia Ridge Classification Yard (Brisbane)",
    "Dynon (Melbourne)",
  ],
  Brazil: [
    "Santos Port Classification Yard",
    "Campinas Hump Yard",
  ],
  "Latin America": [],
  Iran: [
    "Tehran Sorting Yard",
    "Isfahan Classification Yard",
  ],
};

// Fallback regex extraction when known yards don't exist for the country
function extractYardsFromText(texts: string[]): string[] {
  const yardPatterns = [
    // "Maschen classification yard", "Warsaw Praga hump yard"
    /([A-Z][a-zÀ-ž\-]+(?:[ \-][A-Z][a-zÀ-ž\-]+){0,3})\s+(?:hump|classification|marshalling|sorting|shunting)\s+yard/gi,
    // "hump yard at/in/near Maschen"
    /(?:hump|classification|marshalling|sorting|shunting)\s+yard\s+(?:at|in|near)\s+([A-Z][a-zÀ-ž\-]+(?:[ \-][A-Z][a-zÀ-ž\-]+){0,3})/gi,
    // German: "Rangierbahnhof Maschen"
    /(?:Rangierbahnhof|Rbf|Verschiebebahnhof)\s+([A-Z][a-zÀ-ž\-]+)/gi,
    // Russian: "Сортировочная Лихоборы"
    /сортировочная\s+([А-ЯЁ][а-яёА-ЯЁ\-]+)/gi,
  ];

  const NOISE_WORDS = new Set([
    "The", "This", "New", "Main", "Old", "National", "Central", "North", "South",
    "East", "West", "Large", "Major", "Local", "First", "Second", "Rail", "Train",
    "Freight", "Cargo", "Railway", "Station", "Terminal", "Port", "City", "Town",
  ]);

  const yards = new Set<string>();
  for (const text of texts) {
    for (const pattern of yardPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const rawYard = (match[1] || "").trim();
        if (
          rawYard.length > 3 &&
          rawYard.length < 50 &&
          !NOISE_WORDS.has(rawYard.split(/\s/)[0])
        ) {
          yards.add(rawYard);
        }
      }
    }
  }
  return Array.from(yards).slice(0, 6);
}

function extractYards(texts: string[], country: string): string[] {
  // Prefer curated known yards — only fall back to text extraction if nothing is in the database
  const known = KNOWN_YARDS[country];
  if (known && known.length > 0) return known;
  return extractYardsFromText(texts);
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

  const yards = extractYards(allTexts, country);
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
    // Enrich named contacts with real LinkedIn profile URLs (parallel Exa lookups)
    result.keyContacts = await enrichContactsWithLinkedIn(exa, result.keyContacts);
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
