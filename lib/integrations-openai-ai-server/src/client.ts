// =============================================================================
// OpenAI client — lazy, env-tolerant
//
// v1 (Replit-style): AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY
// were required at import time, which meant the api-server crashed before
// serving any traffic when those vars were missing.
//
// v1.1+: We accept either the Replit-named env vars or the standard
// OPENAI_API_KEY, and we initialise the client lazily so the api-server can
// boot even when OpenAI is not configured. Routes that need OpenAI throw a
// clear error on first call.
// =============================================================================

import OpenAI from "openai";

function getOpenAIConfig(): { apiKey: string; baseURL: string } {
  const apiKey =
    process.env["OPENAI_API_KEY"] ??
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY must be set to use OpenAI-backed routes (e.g. /api/search/outreach).",
    );
  }
  const baseURL =
    process.env["OPENAI_BASE_URL"] ??
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ??
    "https://api.openai.com/v1";
  return { apiKey, baseURL };
}

let _client: OpenAI | null = null;

/** Lazily-initialised OpenAI client. Throws on first use if OPENAI_API_KEY is unset. */
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const { apiKey, baseURL } = getOpenAIConfig();
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

/**
 * Back-compat shim: the old `openai` export was the client instance. Existing
 * callers do `import { openai } from "..."` and use it directly. We keep that
 * working by returning a Proxy that defers to the lazy client. This means
 * `openai.chat.completions.create(...)` works without throwing at import.
 */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAIClient(), prop, receiver);
  },
});
