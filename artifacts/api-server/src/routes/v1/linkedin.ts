// =============================================================================
// v1 LinkedIn enrichment — DISABLED per Cassin's v1.6 brief F3
//
// "The LinkedIn button opens a LinkedIn people search (name + org) in a
//  new tab; the person record gets a manual linkedin_url field the
//  operator pastes after looking. No scraping, no enrichment, no stored
//  data beyond the pasted URL."
//
// This route is preserved as a thin health endpoint so the UI can confirm
// "the platform knows we have no enrichment API configured" and surface
// the manual-search flow instead.
//
// The actual search + paste flow is implemented in the React UI
// (`hump-yard-intel/src/components/...`). The UI calls
// `buildLinkedInSearchUrl(name, org)` from `lib/linkedin-provider` to get
// the linkedin.com/search URL.
// =============================================================================

import { Router } from "express";
import { getLinkedInProvider } from "../../lib/linkedin-provider";

const router = Router();

// GET /api/v1/people/enrich/health
// Always returns `configured: false` in v1. The UI shows the manual-search
// flow when this is false.
router.get("/people/enrich/health", (_req, res) => {
  const provider = getLinkedInProvider();
  res.json({
    provider: provider.name(),
    configured: provider.isConfigured(),
    // v1.6 brief: "no scraping, no enrichment". The operator uses a
    // search link in a new tab and pastes back the URL.
    mode: "manual-search",
  });
});

export default router;
