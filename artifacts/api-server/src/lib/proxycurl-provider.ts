// =============================================================================
// v1.1.8 — Real ProxycurlProvider for LinkedIn enrichment (LIVE per Cassin 2026-09-15)
//
// Cassin re-enabled the auto-enrichment path (her own v1.6 brief F3 had
// disabled it). Per Cassin:
//   "I need that one to work properly that is why."
//
// Proxycurl is the provider we picked in W34 answer #5 (Nubela, now
// part of NimbleWay). Public-profile data only, ~$0.04-0.10 per profile
// lookup. The provider interface in linkedin-provider.ts stays stable;
// this file just supplies the real implementation behind it.
//
// GDPR (§12.5.2):
//   - Only public-profile data is fetched. Proxycurl enforces this — it
//     refuses to return data for non-public profiles.
//   - Every enrichment call is logged to the `corrections` table with
//     fact_id = "person:<id>.interests", action = "enrich",
//     source_ref = the fetched LinkedIn URL. See the route handler.
//   - Subjects are business contacts on public LinkedIn pages — Cassin
//     has the lawful basis (legitimate interest) per Art. 6(1)(f).
//
// Cost:
//   - One profile lookup (Person Profile Endpoint) costs 1 credit =
//     $0.04 at the 600-credit plan, $0.10 at the 100-credit plan.
//   - Hard monthly ceiling: $200 (signed off). Alert at $160.
//   - Per-call cost is logged alongside each enrichment so we can sum
//     it on the dashboard.
//
// Endpoint:
//   POST https://nubela.co/proxycurl/api/v2/linkedin
//   Header: Authorization: Bearer <PROXYCURL_API_KEY>
//   Body:   linkedin_profile_url=<URL>&extra=include
//
// Returns JSON with: full_name, headline, summary, experiences,
// activities, articles, events, certifications, languages,
// accomplishments, honors, similar_profiles, recommendations, etc.
//
// We project that to the `LinkedInEnrichment` shape the rest of the
// codebase already speaks, and wrap each derived interest with the
// SourcedFact envelope (§11.3).
// =============================================================================

import type { LinkedInEnrichment, LinkedInProvider, LinkedInProfile } from "./linkedin-provider";

// =============================================================================
// Proxycurl API types (subset — fields we actually use)
// =============================================================================

interface ProxycurlExperience {
  title?: string | null;
  company?: string | null;
  starts_at?: { year?: number | null; month?: number | null } | null;
  ends_at?: { year?: number | null; month?: number | null } | null;
  description?: string | null;
}

interface ProxycurlActivity {
  title?: string | null;
  link?: string | null;
  activity_status?: string | null;
}

interface ProxycurlArticle {
  title?: string | null;
  link?: string | null;
  published_date?: string | null;
  description?: string | null;
}

interface ProxycurlEvent {
  title?: string | null;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
}

interface ProxycurlCertification {
  name?: string | null;
  authority?: string | null;
  starts_at?: { year?: number | null } | null;
  url?: string | null;
}

interface ProxycurlProfile {
  public_identifier?: string | null;
  full_name?: string | null;
  headline?: string | null;
  summary?: string | null;
  occupation?: string | null;
  experiences?: ProxycurlExperience[] | null;
  activities?: ProxycurlActivity[] | null;
  articles?: ProxycurlArticle[] | null;
  events?: ProxycurlEvent[] | null;
  certifications?: ProxycurlCertification[] | null;
}

// =============================================================================
// ProxycurlProvider
// =============================================================================

const PROVIDER_NAME = "proxycurl";
const PROXYCURL_ENDPOINT = "https://nubela.co/proxycurl/api/v2/linkedin";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Extract a `linkedin.com/in/<slug>` URL from whatever the operator pasted.
 * Accepts the canonical profile URL, the search-results URL, or a bare
 * `linkedin.com/in/foo` slug. Returns null if it can't find a profile URL.
 */
function canonicaliseLinkedInUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Match linkedin.com/in/<slug> (with or without protocol, with or without trailing /).
  const m = trimmed.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) {
    return `https://www.linkedin.com/in/${m[1]}`;
  }
  // Match the search-results URL — extract `keywords=` and warn caller.
  // (Search-form URLs are NOT enrichment-eligible. Caller should paste a real profile URL.)
  return null;
}

function dateLabel(d: { year?: number | null; month?: number | null } | null | undefined): string | null {
  if (!d || (!d.year && !d.month)) return null;
  const y = d.year ? String(d.year) : "?";
  const m = d.month ? String(d.month).padStart(2, "0") : "01";
  return `${y}-${m}`;
}

function dateRangeLabel(
  start: { year?: number | null; month?: number | null } | null | undefined,
  end: { year?: number | null; month?: number | null } | null | undefined,
): string {
  const s = dateLabel(start) ?? "?";
  const e = end ? dateLabel(end) ?? "present" : "present";
  return `${s} → ${e}`;
}

export class ProxycurlProvider implements LinkedInProvider {
  // v1.1.8 — Proxycurl (Nubela) was SUNSET on 2025-07-04 after LinkedIn
  // sued over fake-account scraping. The API returns 410 with
  // { "code": "API_SUNSET" } forever. We track that state here so the
  // UI doesn't keep trying to enrich via a dead service.
  //
  // The flip is one-way within a process lifetime: once we see a 410,
  // we never call Proxycurl again until the container restarts. The
  // UI hides the Enrich button on the next /health fetch.
  private _sunsetDetected = false;

  isConfigured(): boolean {
    // Even if the key is set, the provider is dead. Once sunset, it's
    // not "configured" in the usable sense — UI should hide the button.
    if (this._sunsetDetected) return false;
    return !!process.env["PROXYCURL_API_KEY"];
  }

  isSunset(): boolean {
    return this._sunsetDetected;
  }

  name(): string {
    return PROVIDER_NAME;
  }

  /**
   * Look up by name + org. Proxycurl doesn't have a "search by name"
   * endpoint — only by profile URL. So this returns null. The UI
   * surfaces a clear message: "paste a real LinkedIn profile URL to
   * enrich; we don't have a name-lookup endpoint."
   */
  async enrichByName(_name: string, _org: string | null): Promise<LinkedInEnrichment | null> {
    return null;
  }

  /**
   * Look up by LinkedIn profile URL. Returns a populated enrichment
   * (profile + derived interests) or throws on hard failure.
   *
   * Cost: 1 Proxycurl credit (~$0.04–0.10). Logged on every call.
   *
   * v1.1.8 — once a 410 API_SUNSET response is observed, the provider
   * remembers it for the rest of the process lifetime. The /health
   * endpoint reports `sunset: true` and `configured: false`, and the
   * UI hides the Enrich button. No more calls are made.
   */
  async enrichByProfile(profileUrl: string): Promise<LinkedInEnrichment> {
    if (this._sunsetDetected) {
      throw new Error(
        "Proxycurl was sunset on 2025-07-04 (LinkedIn sued Nubela). " +
          "Switch to a different provider (e.g. Unipile, People Data Labs) " +
          "or fall back to manual search.",
      );
    }
    const url = canonicaliseLinkedInUrl(profileUrl);
    if (!url) {
      throw new Error(
        `Not a LinkedIn profile URL: "${profileUrl}". Paste a URL like https://www.linkedin.com/in/<slug>.`,
      );
    }
    const apiKey = process.env["PROXYCURL_API_KEY"];
    if (!apiKey) {
      throw new Error("PROXYCURL_API_KEY is not set on the server.");
    }

    const body = new URLSearchParams({
      linkedin_profile_url: url,
      // `extra=include` enables experiences, activities, articles, events,
      // certifications, etc. Default would be a minimal profile only.
      extra: "include",
      // We want personal data (the operator is enriching a person, not
      // a company). Defaults to personal — explicit for clarity.
      profile_type: "personal",
      // Skills / cause / education not needed for v1.
      // Fallback to minimal profile if 404.
      fallback_to_minimal_profile: "false",
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(PROXYCURL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // v1.1.8 — detect Proxycurl's sunset signal and lock it out.
      // The API returns 410 with body containing "API_SUNSET".
      if (resp.status === 410 || text.includes("API_SUNSET") || text.includes("sunset")) {
        this._sunsetDetected = true;
        throw new Error(
          "Proxycurl was sunset on 2025-07-04 (LinkedIn sued Nubela). " +
            "Switch to a different provider (e.g. Unipile, People Data Labs) " +
            "or fall back to manual search.",
        );
      }
      // Proxycurl returns 404 when the profile doesn't exist or isn't public.
      if (resp.status === 404) {
        throw new Error(
          `Proxycurl: profile not found or not public (404). URL: ${url}`,
        );
      }
      // 401 = bad/expired key. 429 = rate limited. 5xx = upstream issue.
      throw new Error(
        `Proxycurl API ${resp.status}: ${text.slice(0, 200) || resp.statusText}`,
      );
    }

    const raw = (await resp.json()) as ProxycurlProfile;

    // Project Proxycurl's flat shape to LinkedInProfile.
    const profile: LinkedInProfile = {
      name: raw.full_name ?? "",
      role: raw.headline ?? raw.occupation ?? null,
      org: null, // not directly available; we derive org from current experience below
      profileUrl: url,
    };

    // If headline didn't give us a role, fall back to the current experience title.
    let currentExperience: ProxycurlExperience | null = null;
    if (Array.isArray(raw.experiences) && raw.experiences.length > 0) {
      // Pick the first experience with no `ends_at` (current role).
      currentExperience =
        raw.experiences.find((e) => !e.ends_at) ?? raw.experiences[0] ?? null;
      if (currentExperience && !profile.org && currentExperience.company) {
        profile.org = currentExperience.company;
      }
    }

    const retrievedAt = new Date().toISOString();

    // Derive interests. Each one becomes a PersonInterest entry with a
    // SourcedFact envelope pointing at the source URL.
    const interests: LinkedInEnrichment["interests"] = [];

    // 1. role_change — current role from experiences[0] (or the headline).
    if (currentExperience && currentExperience.title) {
      interests.push({
        kind: "role_change",
        summary:
          `Currently ${currentExperience.title}` +
          (currentExperience.company ? ` at ${currentExperience.company}` : "") +
          ` (${dateRangeLabel(currentExperience.starts_at, currentExperience.ends_at)})` +
          (currentExperience.description
            ? `. ${currentExperience.description.slice(0, 200)}`
            : ""),
        sourceUrl: url,
        retrievedAt,
      });
    }

    // 2. public_statement — most recent LinkedIn activity (post / share).
    if (Array.isArray(raw.activities) && raw.activities.length > 0) {
      const latest = raw.activities[0];
      if (latest && latest.title) {
        interests.push({
          kind: "public_statement",
          summary:
            `Posted: "${latest.title}"` +
            (latest.link ? ` (linkedin.com${latest.link})` : ""),
          sourceUrl: latest.link ?? url,
          retrievedAt,
        });
      }
    }

    // 3. publication — LinkedIn articles authored.
    if (Array.isArray(raw.articles) && raw.articles.length > 0) {
      for (const art of raw.articles.slice(0, 3)) {
        if (!art || !art.title) continue;
        interests.push({
          kind: "publication",
          summary:
            `Article: "${art.title}"` +
            (art.published_date ? ` (${art.published_date})` : ""),
          sourceUrl: art.link ?? url,
          retrievedAt,
        });
      }
    }

    // 4. conference — LinkedIn events the person attended / spoke at.
    if (Array.isArray(raw.events) && raw.events.length > 0) {
      for (const ev of raw.events.slice(0, 3)) {
        if (!ev || !ev.title) continue;
        interests.push({
          kind: "conference",
          summary:
            `Event: ${ev.title}` +
            (ev.starts_at ? ` (${ev.starts_at})` : "") +
            (ev.location ? ` @ ${ev.location}` : ""),
          sourceUrl: url,
          retrievedAt,
        });
      }
    }

    return { profile, interests };
  }
}
