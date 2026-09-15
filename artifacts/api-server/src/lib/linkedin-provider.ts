// =============================================================================
// LinkedIn enrichment provider — v1.1.8 (LIVE per Cassin 2026-09-15)
//
// History:
//   v1.0 — F3 brief (2026-09-01): NoOpProvider. Operator opens LinkedIn
//          search URL in a new tab, pastes back the URL.
//   v1.1.8 — Cassin re-enabled auto-enrichment: "I need that one to work
//            properly that is why." Wired ProxycurlProvider when
//            PROXYCURL_API_KEY is set. NoOpProvider remains as fallback.
//
// Contract:
//   - LinkedInProvider interface (stable; route handlers don't change).
//   - `getLinkedInProvider()` returns the right one per env state.
//   - `buildLinkedInSearchUrl` is still exported for the manual-search
//     UI (used in tandem with Enrich when Proxycurl isn't configured).
//
// GDPR (§12.5.2):
//   - Only public-profile data is fetched. Proxycurl refuses non-public
//     profiles at the API level.
//   - Subjects are business contacts on public LinkedIn pages. Cassin
//     has the lawful basis (legitimate interest, Art. 6(1)(f)).
//   - Every enrichment call is logged to the `corrections` table by the
//     route handler — see artifacts/api-server/src/routes/v1/people.ts.
// =============================================================================

import { createHash } from "node:crypto";
import { ProxycurlProvider } from "./proxycurl-provider";

// =============================================================================
// Type contracts (kept stable so route handlers don't change)
// =============================================================================

export interface LinkedInProfile {
  name: string;
  role: string | null;
  org: string | null;
  profileUrl: string;
}

export interface LinkedInEnrichment {
  profile: LinkedInProfile;
  interests: Array<{
    kind: "role_change" | "project" | "public_statement" | "conference" | "publication" | "other";
    summary: string;
    sourceUrl: string;
    retrievedAt: string;
  }>;
}

export interface LinkedInProvider {
  isConfigured(): boolean;
  name(): string;
  enrichByName(name: string, org: string | null): Promise<LinkedInEnrichment | null>;
  enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment>;
}

// =============================================================================
// NoOpProvider — fallback when PROXYCURL_API_KEY is not set
// =============================================================================

class NoOpProvider implements LinkedInProvider {
  isConfigured(): boolean {
    return false;
  }
  name(): string {
    return "manual-search";
  }
  async enrichByName(_name: string, _org: string | null): Promise<LinkedInEnrichment | null> {
    return null;
  }
  async enrichByProfile(_profileUrl: string): Promise<LinkedInEnrichment> {
    throw new Error(
      "LinkedIn enrichment is not configured on this server. " +
        "Set PROXYCURL_API_KEY in the server env to enable Proxycurl. " +
        "Without it, paste the URL into the manual field instead.",
    );
  }
}

// =============================================================================
// Provider selection — picks Proxycurl when key is set, else NoOp
// =============================================================================

let _provider: LinkedInProvider | null = null;

export function getLinkedInProvider(): LinkedInProvider {
  if (_provider) return _provider;
  if (process.env["PROXYCURL_API_KEY"]) {
    _provider = new ProxycurlProvider();
  } else {
    _provider = new NoOpProvider();
  }
  return _provider;
}

/**
 * Reset the cached provider. Tests + config changes that flip
 * PROXYCURL_API_KEY at runtime need this. Not used by route handlers.
 */
export function resetLinkedInProvider(): void {
  _provider = null;
}

// =============================================================================
// Helpers (used by the UI + audit code)
// =============================================================================

/**
 * Build the SourcedFact envelope for a person-interest. Each interest gets
 * the provider's name + a content-hash as the rejection key so the same
 * fact never re-renders from the same provider.
 */
export function buildSourceUrlForProvider(providerName: string, originalUrl: string): string {
  const u = new URL(originalUrl);
  u.searchParams.set("via", providerName);
  return u.toString();
}

export function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Build a LinkedIn people-search URL for a given name + org. The UI uses
 * this on the person-detail page when Proxycurl is OFF or the operator
 * wants to verify the match manually.
 */
export function buildLinkedInSearchUrl(name: string, org: string | null): string {
  const keywords = [name, org].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
