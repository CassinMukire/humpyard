// =============================================================================
// LinkedIn enrichment provider — pluggable adapter
//
// Spec reference: §12.5.5 (automated LinkedIn enrichment is permitted for
// the people graph; public-profile data only; minimal fields; data-provider
// API preferred over direct scraping).
//
// v1 provider: NinjaPear (https://nubela.co) — the successor to Proxycurl,
// same vendor, same API key format. Proxycurl's `/proxycurl/api/v2/linkedin`
// endpoint is sunset (410 API_SUNSET); the new endpoints live at
// `https://nubela.co/api/v1/...` and `https://nubela.co/api/v2/...`.
//
// Public-data only — no login-walled scraping, no LinkedIn ToS scraping.
// NinjaPear aggregates from the public web, then uses AI extraction to
// structure the data. Per §12.5.5, this is the data-provider API path
// (preferred over direct scraping).
//
// Auth: Bearer token via PROXYCURL_API_KEY env var (kept the same name for
// backward compat; the key is for nubela.co and works on the new endpoint).
// Cost: 3 credits / Person Profile call, free for Company Details. The v1
// cost estimate was $5-15/month at weekly scan cadence; NinjaPear stays in
// that range (~$0.05-0.10 per profile after the credit-bundle discount).
//
// With no key configured, the route returns a structured 402 so the
// operator knows to set the env var.
//
// The interface is intentionally narrow so we can swap providers (Apollo.io,
// People Data Labs, Bright Data, Apify) without touching route handlers.
// =============================================================================

import { createHash } from "node:crypto";
import { logger } from "./logger";

// Minimal fields the spec requires (§12.5.5: name, role, org, profile URL).
// Anything beyond this is rejected.
export interface LinkedInProfile {
  name: string;
  role: string | null;
  org: string | null;
  profileUrl: string;
}

export interface LinkedInEnrichment {
  profile: LinkedInProfile;
  // Recent activity items — each becomes a PersonInterest (SourcedFact)
  // surfaced under the person, so the operator can write a real message.
  interests: Array<{
    kind: "role_change" | "project" | "public_statement" | "conference" | "publication" | "other";
    summary: string;
    sourceUrl: string;
    retrievedAt: string;
  }>;
}

export interface LinkedInProvider {
  /** Whether the provider has credentials configured and can be used. */
  isConfigured(): boolean;
  /** The provider's name (for source attribution). */
  name(): string;
  /**
   * Enrich a person by their full name + organisation. Returns null when
   * the lookup cannot be performed (missing fields, no credits, no match).
   * The route should treat null as "no new facts" — not as an error.
   */
  enrichByName(name: string, org: string | null): Promise<LinkedInEnrichment | null>;
  /**
   * Enrich by LinkedIn profile URL. Legacy signature — NinjaPear does not
   * accept LinkedIn URLs as input (no scraping per their ToS). The adapter
   * makes a best effort: extract the vanity name from the URL and call
   * `enrichByName` with the org from the URL's path hint (if any).
   */
  enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment>;
}

// =============================================================================
// NinjaPear adapter (v1 default; former Proxycurl)
// =============================================================================
//
// Docs: https://nubela.co/docs
// Auth: Bearer token
// Person Profile: GET /api/v2/employee/profile?first_name=X&last_name=Y&employer_website=Z&enrichment=fast
//   Cost: 3 credits / call (refunded if no data found? per docs, no — credits
//   are charged even if no data is found).
// Company Details: GET /api/v1/company/details?website=X
//   Cost: free tier available, used at seed time.
//
// Inputs accepted (per docs, verbatim): "Must provide work_email, or
// first_name + employer_website, or employer_website + role."
// `name=...` is NOT accepted — first/last must be split.
//
// Response shape (best-effort, based on docs):
//   {
//     full_name?: string,
//     current_title?: string,
//     current_company?: string,
//     experiences?: Array<{ title, company, starts_at, ends_at, description }>,
//     education?: Array<...>,
//     social_handles?: { linkedin?: string, ... },
//     person_profile_url?: string,  // canonical URL to call again
//   }

const NINJAPEAR_BASE = "https://nubela.co/api/v2/employee/profile";

// v1's known orgs → their public website. Used to satisfy NinjaPear's
// `employer_website` input requirement. Add new entries here when a new
// dossier market is onboarded; otherwise the enrichment call returns null.
//
// Keys are matched case-insensitively after collapsing whitespace.
const ORG_WEBSITE: Record<string, string> = {
  // Poland
  "pkp plk": "https://www.plk-sa.pl",
  "pkp polskie linie kolejowe": "https://www.plk-sa.pl",
  "pkp polskie linie kolejowe s.a.": "https://www.plk-sa.pl",
  "pkp s.a.": "https://www.pkp.pl",
  "axtone": "https://axtone.com",
  "systra": "https://www.systra.com",
  // Germany
  "db netz": "https://www.deutschebahn.com/en",
  "db netz ag": "https://www.deutschebahn.com/en",
  "deutsche bahn": "https://www.deutschebahn.com/en",
  "knorr-bremse": "https://www.knorr-bremse.com",
  "voestalpine": "https://www.voestalpine.com",
  "wabtec": "https://www.wabtec.com",
  // Kazakhstan
  "ktz": "https://www.railways.kz",
  "ktz nc": "https://www.railways.kz",
  "kazakhstan temir zholy": "https://www.railways.kz",
  // Uzbekistan
  "uty": "https://www.railway.uz",
  "o'zbekiston temir yo'llari": "https://www.railway.uz",
  "uzbekistan railways": "https://www.railway.uz",
};

function normalizeOrg(org: string | null): string | null {
  if (!org) return null;
  const key = org
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/g, "")
    .trim();
  return ORG_WEBSITE[key] ?? null;
}

function splitName(name: string): { first: string; last: string } | null {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

class NinjaPearProvider implements LinkedInProvider {
  isConfigured(): boolean {
    // The env var is named PROXYCURL_API_KEY for backward compat. The key
    // is a NinjaPear key (Proxycurl was sunset, same vendor rebranded).
    return !!process.env["PROXYCURL_API_KEY"];
  }
  name(): string {
    return "ninjapear";
  }

  private get apiKey(): string {
    const k = process.env["PROXYCURL_API_KEY"];
    if (!k) throw new Error("PROXYCURL_API_KEY not set");
    return k;
  }

  /**
   * Call NinjaPear's Person Profile endpoint.
   * Returns null on soft failures (no credits, not found) so the route
   * can treat it as "no new facts" rather than a 500.
   * Throws on hard failures (network, bad request).
   */
  private async callProfile(
    firstName: string,
    lastName: string,
    employerWebsite: string,
  ): Promise<Record<string, unknown> | null> {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      employer_website: employerWebsite,
      enrichment: "fast",
    });
    const res = await fetch(`${NINJAPEAR_BASE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }
    const body = await res.text();
    // Soft failures — return null so the route degrades gracefully
    if (res.status === 403 && /credit/i.test(body)) {
      logger.warn(
        { provider: "ninjapear", status: 403 },
        "NinjaPear key has insufficient credits — enrichment will skip until topped up",
      );
      return null;
    }
    if (res.status === 404) {
      // No profile found
      return null;
    }
    // Hard failure — let the route return 502
    throw new Error(`ninjapear ${res.status}: ${body.slice(0, 200)}`);
  }

  async enrichByName(name: string, org: string | null): Promise<LinkedInEnrichment | null> {
    const parts = splitName(name);
    if (!parts) {
      logger.debug({ name }, "NinjaPear: need first + last name; skipping");
      return null;
    }
    const website = normalizeOrg(org);
    if (!website) {
      logger.debug({ name, org }, "NinjaPear: org not in v1 lookup table; skipping");
      return null;
    }
    const data = await this.callProfile(parts.first, parts.last, website);
    if (!data) return null;
    return this.toEnrichment(data, name, org, website);
  }

  async enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment> {
    // NinjaPear does not accept LinkedIn URLs (no scraping per their ToS).
    // Best effort: extract a vanity name from the URL and try enrichByName
    // with no org hint.
    const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (!match) {
      throw new Error(
        "Provider does not support arbitrary URLs. Pass a LinkedIn profile URL like https://www.linkedin.com/in/vanity-name, or use enrichByName(name, org).",
      );
    }
    const vanity = match[1]!.replace(/-\d+$/, "").replace(/-/g, " ");
    // Title-case the name so it looks reasonable in logs
    const name = vanity
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(" ");
    const result = await this.enrichByName(name, null);
    if (!result) {
      throw new Error(
        `Could not resolve LinkedIn vanity "${vanity}" via NinjaPear (no org context). Re-run with the person's name + org.`,
      );
    }
    return result;
  }

  private toEnrichment(
    data: Record<string, unknown>,
    fallbackName: string,
    fallbackOrg: string | null,
    website: string,
  ): LinkedInEnrichment {
    // Defensive field reads — NinjaPear's response shape can shift. Map
    // common keys (`full_name`, `current_title`, `current_company`,
    // `experiences[]`) and skip missing pieces silently.
    const name = (data["full_name"] as string | undefined) ?? fallbackName;
    const role =
      (data["current_title"] as string | undefined) ??
      (data["occupation"] as string | undefined) ??
      (data["headline"] as string | undefined) ??
      null;
    const org =
      (data["current_company"] as string | undefined) ??
      fallbackOrg ??
      null;

    // The provider's own profile URL is a stable reference for re-fetching.
    // Use that as the source URL for the resulting SourcedFact so future
    // corrections can route back to the provider.
    const providerUrl =
      (data["person_profile_url"] as string | undefined) ??
      `${NINJAPEAR_BASE}?${new URLSearchParams({
        first_name: splitName(name)?.first ?? "",
        last_name: splitName(name)?.last ?? "",
        employer_website: website,
      }).toString()}`;

    const interests: LinkedInEnrichment["interests"] = [];

    // Most recent role change (first entry in `experiences` per the docs)
    const experiences = data["experiences"];
    if (Array.isArray(experiences) && experiences.length > 0) {
      const latest = experiences[0] as {
        title?: string;
        company?: string;
        starts_at?: { year?: number };
      };
      if (latest?.title && latest?.company) {
        interests.push({
          kind: "role_change",
          summary: `${latest.title} at ${latest.company} since ${latest.starts_at?.year ?? "?"}`,
          sourceUrl: providerUrl,
          retrievedAt: new Date().toISOString(),
        });
      }
    }

    return {
      profile: { name, role, org, profileUrl: providerUrl },
      interests,
    };
  }
}

// =============================================================================
// Provider selection
// =============================================================================

let _provider: LinkedInProvider | null = null;

export function getLinkedInProvider(): LinkedInProvider {
  if (_provider) return _provider;
  // v1: only NinjaPear is wired. Add Apollo/PDL adapters here when needed.
  _provider = new NinjaPearProvider();
  return _provider;
}

/**
 * Build the SourcedFact envelope for a person-interest. Each interest gets
 * the provider's name + a content-hash as the rejection key so the same
 * fact never re-renders from the same provider.
 */
export function buildSourceUrlForProvider(providerName: string, originalUrl: string): string {
  // Wrap the original URL with a query param identifying the provider.
  // This lets us track which provider surfaced the fact and route
  // corrections back to the right adapter if needed.
  const u = new URL(originalUrl);
  u.searchParams.set("via", providerName);
  return u.toString();
}

export function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
