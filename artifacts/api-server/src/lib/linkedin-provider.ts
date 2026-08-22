// =============================================================================
// LinkedIn enrichment provider — pluggable adapter
//
// Spec reference: §12.5.5 (automated LinkedIn enrichment is permitted for
// the people graph; public-profile data only; minimal fields; data-provider
// API preferred over direct scraping).
//
// v1 provider: Proxycurl (now part of NimbleWay). Public-profile enrichment
// via REST API. ~$0.04–0.10 per profile depending on the endpoint. Public
// data only — no login-walled scraping.
//
// Set LINKEDIN_PROVIDER_API_KEY in env to enable. With no key configured,
// `enrichPerson` returns a structured "not_configured" error so the route
// can surface a clean 402 Payment Required to the operator.
//
// The interface is intentionally narrow so we can swap providers (Apollo.io,
// People Data Labs, Bright Data, Apify) without touching route handlers.
// =============================================================================

import { createHash } from "node:crypto";

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
  /** Fetch a public profile by LinkedIn URL or vanity name. */
  enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment>;
  /** Fetch a public profile by full name + organisation (best-effort). */
  enrichByName(name: string, org: string | null): Promise<LinkedInEnrichment | null>;
}

// =============================================================================
// Proxycurl adapter (v1 default)
// =============================================================================
//
// Docs: https://nubela.co/proxycurl/
// Auth: Bearer token via PROXYCURL_API_KEY env var
// Cost: ~$0.04/person (Person Lookup endpoint), ~$0.10/person (Person Profile
//       endpoint with role history + posts)
//
// Per §12.5.5: only public-profile fields. No login-walled scraping.

const PROXYCURL_BASE = "https://nubela.co/proxycurl/api/v2";

class ProxycurlProvider implements LinkedInProvider {
  isConfigured(): boolean {
    return !!process.env["PROXYCURL_API_KEY"];
  }
  name(): string {
    return "proxycurl";
  }

  private async call<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const key = process.env["PROXYCURL_API_KEY"];
    if (!key) throw new Error("PROXYCURL_API_KEY not set");
    const url = new URL(`${PROXYCURL_BASE}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`proxycurl ${endpoint} ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment> {
    const data = await this.call<{
      full_name?: string;
      occupation?: string;
      headline?: string;
      experiences?: Array<{
        starts_at?: { year?: number };
        ends_at?: { year?: number } | null;
        title?: string;
        company?: string;
        description?: string;
      }>;
      articles?: Array<{ title?: string; link?: string; published_on?: { year?: number } }>;
    }>("linkedin", {
      url: profileUrl,
      fallback_to_cache: "on-error",
      use_cache: "if-present",
      fields: "full_name,occupation,headline,experiences,articles",
    });

    const name = data.full_name ?? "";
    const role = data.occupation ?? data.headline ?? null;
    const org = data.experiences?.[0]?.company ?? null;
    const interests: LinkedInEnrichment["interests"] = [];

    // Most recent role change
    if (data.experiences && data.experiences.length > 0) {
      const latest = data.experiences[0];
      if (latest.title && latest.company) {
        interests.push({
          kind: "role_change",
          summary: `${latest.title} at ${latest.company} since ${latest.starts_at?.year ?? "?"}`,
          sourceUrl: profileUrl,
          retrievedAt: new Date().toISOString(),
        });
      }
    }

    // Recent articles / publications
    for (const art of data.articles?.slice(0, 3) ?? []) {
      if (art.title && art.link) {
        interests.push({
          kind: "publication",
          summary: `Published: ${art.title} (${art.published_on?.year ?? "?"})`,
          sourceUrl: art.link,
          retrievedAt: new Date().toISOString(),
        });
      }
    }

    return {
      profile: { name, role, org, profileUrl },
      interests,
    };
  }

  async enrichByName(_name: string, _org: string | null): Promise<LinkedInEnrichment | null> {
    // Proxycurl doesn't have a free "person lookup by name" endpoint.
    // The operator should pass a profile URL. If we ever need a lookup,
    // we'd switch to a provider that supports it (Apollo.io does).
    return null;
  }
}

// =============================================================================
// Provider selection
// =============================================================================

let _provider: LinkedInProvider | null = null;

export function getLinkedInProvider(): LinkedInProvider {
  if (_provider) return _provider;
  // v1: only Proxycurl is wired. Add Apollo/PDL adapters here when needed.
  _provider = new ProxycurlProvider();
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
