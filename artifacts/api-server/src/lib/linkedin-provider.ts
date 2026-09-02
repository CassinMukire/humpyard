// =============================================================================
// LinkedIn enrichment provider — DISABLED per Cassin's v1.6 brief F3
//
// "Replace the Proxycurl call — the button stays, but it must work: the
//  LinkedIn button opens a LinkedIn people search (name + org) in a new
//  tab; the person record gets a manual `linkedin_url` field the operator
//  pastes after looking. No scraping, no enrichment, no stored data
//  beyond the pasted URL. §12.5.5 unchanged."
//
// The provider is kept as a stub so the rest of the codebase compiles
// without changes. enrichByName / enrichByProfile always return null
// (no interests, no profile data) — the UI is the only place the
// LinkedIn search + paste flow is implemented.
//
// To re-enable any provider in the future:
//   1. Implement enrichByName + enrichByProfile
//   2. Wire the route to call the provider
//   3. Update the UI to show "Enrich" instead of "Search LinkedIn"
//
// The contract: a LinkedInProvider that does nothing is still a
// LinkedInProvider. v1 ships with no API calls. v2 (P2) may add a
// provider back if Cassin changes his mind.
// =============================================================================

import { createHash } from "node:crypto";

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
// Disabled provider (v1)
// =============================================================================

class NoOpProvider implements LinkedInProvider {
  isConfigured(): boolean {
    // No external provider is configured in v1. The UI does the search
    // via a direct link to linkedin.com/search/results/people/, and the
    // operator pastes back the URL they found.
    return false;
  }
  name(): string {
    return "manual-search";
  }
  async enrichByName(_name: string, _org: string | null): Promise<LinkedInEnrichment | null> {
    // F3: no enrichment API. The UI opens a LinkedIn search URL in a new
    // tab. The operator pastes back the LinkedIn URL they found into
    // `person.manual_linkedin_url`.
    return null;
  }
  async enrichByProfile(_profileUrl: string): Promise<LinkedInEnrichment> {
    // F3: no enrichment API. Same as enrichByName — return empty interests.
    return {
      profile: { name: "", role: null, org: null, profileUrl: _profileUrl },
      interests: [],
    };
  }
}

// =============================================================================
// Provider selection
// =============================================================================

let _provider: LinkedInProvider | null = null;

export function getLinkedInProvider(): LinkedInProvider {
  if (_provider) return _provider;
  _provider = new NoOpProvider();
  return _provider;
}

// =============================================================================
// Helpers (kept for forward-compat with a future P2 provider)
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
 * this on the person-detail page (F3): the "Search LinkedIn" button is
 * just an `<a href={url} target="_blank">` with this URL.
 *
 * The search form (linkedin.com/search/results/people/?keywords=...) does
 * NOT require auth for a basic name+org lookup. The operator clicks
 * through, finds the real profile, and pastes the URL back into
 * `person.manual_linkedin_url`.
 */
export function buildLinkedInSearchUrl(name: string, org: string | null): string {
  const keywords = [name, org].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
