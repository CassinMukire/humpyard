// =============================================================================
// v1 LinkedIn enrichment — automated, public-profile data only
//
// Spec reference: §12.5.5 (auto enrichment is permitted; minimal fields;
// data-provider API preferred over direct scraping).
//
// Per Cassin's correction (Aug 22): this route pulls the public profile
// (name, role, org, profile URL) + recent role changes, projects, public
// statements, conference appearances. Every interest is wrapped in a
// SourcedFact so it shows up with the same source + confidence UI as
// every other fact in the system.
//
// IMPORTANT: this route does NOT generate outreach messages. It surfaces
// what the contact is interested in. The operator writes the message.
//
// Provider: NinjaPear (formerly Proxycurl — same vendor rebranded). The
// Person Profile endpoint takes first_name + last_name + employer_website
// (no LinkedIn URL — NinjaPear doesn't scrape LinkedIn per their ToS).
// We use the person's name + org from the person record. If the body
// includes a profile_url, we use that ONLY to update linkedin_url; we
// never pass it to the provider.
// =============================================================================

import { Router } from "express";
import {
  getPerson,
  getOrg,
  upsertPerson,
} from "../../lib/store-factory";
import { getLinkedInProvider, buildSourceUrlForProvider } from "../../lib/linkedin-provider";
import { validateBody } from "../../middlewares/validate";
import { z } from "zod";

const router = Router();

const EnrichBody = z.object({
  // Optional — if present, saved to person.linkedin_url. Not used for
  // the provider lookup (NinjaPear takes name + org, not a URL).
  profile_url: z.string().url().optional(),
});

// POST /api/v1/people/:id/enrich — run a single-person enrichment
router.post(
  "/people/:id/enrich",
  validateBody(EnrichBody),
  async (req, res, next) => {
    try {
      const person = await getPerson(String(req.params.id));
      if (!person) {
        res.status(404).json({ error: "Person not found" });
        return;
      }
      const provider = getLinkedInProvider();
      if (!provider.isConfigured()) {
        res.status(402).json({
          error: "LinkedIn provider not configured",
          provider: provider.name(),
          fix: "Set PROXYCURL_API_KEY in the env to enable enrichment.",
        });
        return;
      }
      const body = (req as unknown as { validatedBody: z.infer<typeof EnrichBody> })
        .validatedBody;

      // Resolve the org name for the provider. The Person record only has
      // org_id; we look up the org to get the display name. If the org is
      // not in the v1 lookup table, the provider returns null and we
      // surface a 422 so the operator knows to add it.
      const org = person.org_id ? await getOrg(person.org_id) : null;
      const orgName = org?.name ?? null;

      const result = await provider.enrichByName(person.name, orgName);
      if (!result) {
        res.status(422).json({
          error: "Enrichment could not be performed",
          reason:
            orgName
              ? `Provider has no record for "${person.name}" at "${orgName}". Check the org is in the v1 lookup table, or top up the provider's credits.`
              : `Person "${person.name}" has no org on file. Link them to an org first.`,
          provider: provider.name(),
          person_id: person.id,
        });
        return;
      }

      const now = new Date().toISOString();

      // Wrap each provider interest in a PersonInterest (SourcedFact) and
      // append to the person's interests list. Existing interests are kept
      // (de-duped by source_url + summary so re-runs are idempotent).
      const newInterests = result.interests.map((i) => ({
        kind: i.kind,
        summary: i.summary,
        fact: {
          value: i.summary,
          source_url: buildSourceUrlForProvider(provider.name(), i.sourceUrl),
          retrieved_at: i.retrievedAt || now,
          // LinkedIn enrichment is a single secondary source → [O] by default
          // (unless the provider returns a primary-source-backed fact)
          confidence: "O" as const,
          verified_by: "rule" as const,
        },
      }));

      const dedupedInterests = dedupeInterests([...person.interests, ...newInterests]);

      // Update linkedin_url ONLY if:
      //   (a) the body explicitly supplied a profile_url, OR
      //   (b) the person already has one and the provider didn't suggest a change
      // We do NOT auto-overwrite linkedin_url with the provider's own
      // person_profile_url — that's a NinjaPear URL, not a LinkedIn URL.
      const newLinkedinUrl =
        body.profile_url ?? person.linkedin_url ?? null;

      const updated = {
        ...person,
        linkedin_url: newLinkedinUrl,
        interests: dedupedInterests,
        import_meta: {
          method: "linkedin-enrichment" as const,
          source_ref: provider.name(),
          imported_by: (req as unknown as { authUser?: string }).authUser ?? "engine",
          imported_at: now,
        },
        // §12.5.3: enrichment counts as engagement
        last_engagement_at: now,
        updated_at: now,
      };
      await upsertPerson(updated);
      res.json({ person: updated, provider: provider.name() });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/people/enrich/health — is the provider configured?
router.get("/people/enrich/health", (_req, res) => {
  const provider = getLinkedInProvider();
  res.json({
    provider: provider.name(),
    configured: provider.isConfigured(),
  });
});

function dedupeInterests(
  interests: import("@workspace/api-zod").PersonInterest[],
): import("@workspace/api-zod").PersonInterest[] {
  const seen = new Set<string>();
  const out: import("@workspace/api-zod").PersonInterest[] = [];
  for (const i of interests) {
    const key = `${i.fact.source_url}|${i.summary}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  }
  return out;
}

export default router;
