// =============================================================================
// v1.1.8 — LinkedIn enrichment routes (LIVE per Cassin 2026-09-15)
//
// History:
//   v1.0 — Only `/health` existed. UI did manual search + paste.
//   v1.1.8 — Re-enabled auto-enrichment via Proxycurl. Per Cassin:
//            "I need that one to work properly that is why."
//
// Endpoints:
//   GET  /api/v1/people/enrich/health
//     → { provider, configured, mode }
//     provider = "proxycurl" when key is set, "manual-search" otherwise
//     configured = whether the provider can take a real lookup
//     mode = "auto" when configured, "manual-search" otherwise
//
//   POST /api/v1/people/enrich
//     Body: { linkedin_url: string, person_id?: string, role?: string }
//     → Calls provider.enrichByProfile(url) → returns { profile, interests }
//     If `person_id` is given and the person exists in the DB, persists
//     interests to the person record and updates linkedin_url. Also logs
//     to the corrections table for §12.5.2 (GDPR Art. 14 audit).
//
// Rate limit: 10 calls/min per IP (cost control — $0.04-0.10/call).
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getLinkedInProvider } from "../../lib/linkedin-provider";
import { getPerson, upsertPerson, logCorrection } from "../../lib/store-factory";
import { validateBody } from "../../middlewares/validate";
import { logger } from "../../lib/logger";

const router = Router();

// Cost-control rate limit. Proxycurl costs $0.04-0.10 per call, so a
// runaway loop would burn budget fast. 10/min/IP is generous for v1.
const enrichLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit: 10 enrichment calls per minute per IP" },
});

// GET /api/v1/people/enrich/health
router.get("/people/enrich/health", (_req, res) => {
  const provider = getLinkedInProvider();
  const configured = provider.isConfigured();
  res.json({
    provider: provider.name(),
    configured,
    mode: configured ? "auto" : "manual-search",
  });
});

const EnrichBody = z
  .object({
    // Required: a real linkedin.com/in/<slug> URL. We canonicalise server-side.
    linkedin_url: z.string().min(8).max(500),
    // Optional: if given, persist interests to this person + log correction.
    person_id: z.string().optional(),
    // Optional: operator's role for the contact (e.g. "Chief Engineer").
    // Stored in the interest summary for context. Free-text, not validated.
    role: z.string().max(200).optional(),
  })
  .strict();

// POST /api/v1/people/enrich
router.post(
  "/people/enrich",
  enrichLimiter,
  validateBody(EnrichBody),
  async (req, res, next) => {
    try {
      const body = (req as unknown as { validatedBody: z.infer<typeof EnrichBody> })
        .validatedBody;
      const provider = getLinkedInProvider();
      const user =
        (req as unknown as { authUser?: string }).authUser ?? "unknown";

      if (!provider.isConfigured()) {
        res.status(402).json({
          error:
            "LinkedIn enrichment is not configured. Set PROXYCURL_API_KEY on the server.",
          provider: provider.name(),
          configured: false,
        });
        return;
      }

      // Provider call. Provider throws on hard failure; we map to 4xx/5xx.
      let enrichment;
      try {
        enrichment = await provider.enrichByProfile(body.linkedin_url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ linkedin_url: body.linkedin_url, err: msg }, "linkedin enrich failed");
        // 404 (profile not found) and 422 (bad URL) → user error.
        // Anything else → 502 (upstream).
        if (msg.includes("Not a LinkedIn profile URL")) {
          res.status(422).json({ error: msg });
          return;
        }
        if (msg.includes("404") || msg.includes("not found")) {
          res.status(404).json({ error: msg });
          return;
        }
        res.status(502).json({ error: `Proxycurl enrichment failed: ${msg}` });
        return;
      }

      // Persist to person if person_id was given.
      let persisted = false;
      if (body.person_id) {
        const person = await getPerson(body.person_id);
        if (!person) {
          res.status(404).json({
            error: `Person not found: ${body.person_id}`,
            enrichment, // still return the enrichment — UI may want to show it
          });
          return;
        }

        // Merge interests: keep existing ones (operator may have curated),
        // append this batch's, dedupe by source_url.
        const existingUrls = new Set(person.interests.map((i) => i.fact.source_url));
        const newInterests = enrichment.interests
          .filter((i) => !existingUrls.has(i.sourceUrl))
          .map((i) => ({
            kind: i.kind,
            summary: body.role
              ? `[${body.role}] ${i.summary}`
              : i.summary,
            fact: {
              value: i.summary,
              source_url: i.sourceUrl,
              retrieved_at: i.retrievedAt,
              confidence: "O" as const, // Proxycurl = single secondary source
              // verified_by is constrained to the VerifiedBySchema enum.
              // We narrow provider.name() to one of the legal literals;
              // ProxycurlProvider.name() always returns "proxycurl".
              verified_by: "proxycurl" as const,
            },
          }));
        const merged = {
          ...person,
          interests: [...person.interests, ...newInterests],
          linkedin_url: enrichment.profile.profileUrl,
          manual_linkedin_url:
            person.manual_linkedin_url ?? enrichment.profile.profileUrl,
          updated_at: new Date().toISOString(),
          last_engagement_at: new Date().toISOString(),
        };
        await upsertPerson(merged);

        // §12.5.2 — log the enrichment to the corrections table for
        // audit. fact_id includes the person + the action + the source.
        await logCorrection({
          fact_id: `person:${person.id}.interests`,
          fact_kind: "person",
          action: "enrich",
          corrected_value: enrichment.interests.map((i) => ({
            kind: i.kind,
            summary: i.summary,
            source_url: i.sourceUrl,
          })) as never,
          user,
        });

        persisted = true;
      }

      res.json({
        enrichment,
        persisted,
        provider: provider.name(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
