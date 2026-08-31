// =============================================================================
// v1 country scan — SourcedFact-wrapped version of the legacy /api/search/country
//
// The legacy scanner returns a CountryResult with bare string fields
// (verdict, summary, operator, etc.). Per §11.3 / the trust contract, every
// fact a user renders must carry a SourcedFact envelope. This route proxies
// the legacy scan logic (extracted into `scanCountry()`) and upgrades the
// key string fields into SourcedFact so the v1 dossier pages can render
// them with the source attribution UI.
//
// The legacy /api/search/country endpoint is left untouched (the legacy
// scanner UI still depends on the raw shape).
// =============================================================================

import { Router } from "express";
import type { SourcedFact } from "@workspace/api-zod";
import { scanCountry } from "../search";

const router = Router();

// Primary domain whitelist — source on one of these hosts → confidence "V".
// Otherwise "O" (single secondary source / press / aggregator).
const PRIMARY_HOSTS = new Set<string>([
  "plk-sa.pl",
  "pkp.pl",
  "plk.pl",
  "gov.pl",
  "eurail-infra.eu",
  "europa.eu",
  "ted.europa.eu",
  "deutschebahn.com",
  "db-netz.de",
  "oebb.at",
  "sbb.ch",
  "renfe.es",
  "sncf.fr",
  "trenitalia.it",
  "rfi.it",
  "szdc.cz",
  "cd.cz",
  "mav.hu",
  "trafikverket.se",
  "banenor.no",
  "banedanmark.dk",
  "railways.kz",
  "ut.uz",
  "ktz.kz",
]);

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface LegacySourceLink {
  url: string;
  title: string;
  publishedDate: string | null;
  snippet: string | null;
}

interface LegacyKeyContact {
  name: string | null;
  title: string;
  organisation: string;
  whyRelevant: string;
  linkedinUrl: string;
  confidence: string;
}

interface LegacyCountryResult {
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
  keyContacts: LegacyKeyContact[];
  sources: LegacySourceLink[];
  error: string | null;
}

export interface CountryResultV1 {
  country: string;
  tier: "A" | "B" | "C" | "D";
  verdict: SourcedFact;
  summary: SourcedFact;
  operator: SourcedFact | null;
  last_modernization: SourcedFact | null;
  procurement_portal: SourcedFact | null;
  contact_entry_point: LegacyKeyContact | null;
  procurement_tenders: SourcedFact[];
  technical_contacts: string[];
  key_contacts: LegacyKeyContact[];
  sources: LegacySourceLink[];
  error: string | null;
  /** ISO timestamp of the upgrade to SourcedFact envelopes. */
  wrapped_at: string;
  /** Provenance note for the upgrade. */
  wrapped_provenance: string;
}

function confidenceFromSource(url: string | null | undefined): SourcedFact["confidence"] {
  const host = hostFromUrl(url);
  if (host && PRIMARY_HOSTS.has(host)) return "V";
  if (url) return "O";
  return "I";
}

function wrapString(
  value: string | null,
  source: LegacySourceLink | undefined,
  fallbackUrl: string,
): SourcedFact | null {
  if (value == null || value === "") return null;
  const url = source?.url ?? fallbackUrl;
  return {
    value,
    source_url: url,
    retrieved_at: source?.publishedDate ?? new Date().toISOString().slice(0, 10),
    confidence: confidenceFromSource(url),
    verified_by: "rule",
  };
}

export function wrapCountryResult(raw: LegacyCountryResult): CountryResultV1 {
  const firstSource = raw.sources[0];
  const fallbackUrl = firstSource?.url ?? "internal://no-source";

  const verdictText =
    raw.verdict === "Yes"
      ? `${raw.country} is in scope: hump yard modernization activity is documented in the public record.`
      : raw.verdict === "No"
        ? `${raw.country} is out of scope: no active hump yard capex in the public record.`
        : `${raw.country} is unconfirmed: not enough public record to call.`;

  const tenders: SourcedFact[] = raw.procurementTenders
    .filter((t) => /^https?:\/\//.test(t))
    .map((url, i) => ({
      value: `Tender #${i + 1} (from scan)`,
      source_url: url,
      retrieved_at: new Date().toISOString().slice(0, 10),
      confidence: confidenceFromSource(url),
      verified_by: "rule",
    }));

  return {
    country: raw.country,
    tier: raw.tier,
    verdict: {
      value: verdictText,
      source_url: firstSource?.url ?? fallbackUrl,
      retrieved_at: firstSource?.publishedDate ?? new Date().toISOString().slice(0, 10),
      confidence: confidenceFromSource(firstSource?.url),
      verified_by: "rule",
    },
    summary: wrapString(raw.summary, firstSource, fallbackUrl)!,
    operator: wrapString(raw.operator, firstSource, fallbackUrl),
    last_modernization: wrapString(raw.lastModernization, firstSource, fallbackUrl),
    procurement_portal: wrapString(raw.procurementPortal, firstSource, fallbackUrl),
    contact_entry_point: raw.keyContacts[0] ?? null,
    procurement_tenders: tenders,
    technical_contacts: raw.technicalContacts,
    key_contacts: raw.keyContacts,
    sources: raw.sources,
    error: raw.error,
    wrapped_at: new Date().toISOString(),
    wrapped_provenance:
      "Upgraded from legacy /api/search/country CountryResult to SourcedFact envelopes. " +
      "Confidence is V when source is on the primary operator/tender domain whitelist; O otherwise.",
  };
}

// POST /api/v1/countries/scan — SourcedFact-wrapped country scan
//
// Body: { country: string }
// Response: CountryResultV1
router.post("/countries/scan", async (req, res, next) => {
  try {
    const body = req.body as { country?: unknown };
    if (typeof body?.country !== "string" || !body.country.trim()) {
      res.status(400).json({ error: "country (string) required" });
      return;
    }
    const raw = await scanCountry(body.country.trim());
    const wrapped = wrapCountryResult(raw);
    res.json(wrapped);
  } catch (err) {
    next(err);
  }
});

export default router;
