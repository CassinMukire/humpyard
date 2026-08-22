# API Reference

Base URL: `http://localhost:5000/api` (dev) · `https://<your-domain>/api` (prod)

**Auth**: v1 endpoints (`/api/v1/*`) require single-user basic auth
(`AUTH_USER` + `AUTH_PASS`). Existing scanner endpoints (`/api/*`) are public
in v1 for the W35 cutover — flagged for gating in v1.1.

**Conventions**:
- All bodies and responses are JSON
- All errors return `{ error: string, ... }` with an HTTP status
- All facts carry the SourcedFact envelope (see DATABASE.md)
- Request IDs in `req.id` for log correlation

---

## Public — existing scanner

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/healthz` | Health check |
| `GET`  | `/api/search/countries` | List of pre-loaded countries for the scanner |
| `POST` | `/api/search/country` | Run an Exa-powered country scan |

> These power the existing Target Scanner + Global Radar UI. Not gated.
>
> **Removed 2026-08-22:** `POST /api/search/outreach` — the tool no longer
> generates personalised messages. See `docs/DECISIONS.md` for context.

---

## v1 — gated by single-user basic auth

### Auth (token-based, v1.1)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Exchange username + password for a session token | Public (rate-limited 5/15min/IP) |
| `POST` | `/api/v1/auth/logout` | Destroy the current session | Gated |
| `GET`  | `/api/v1/auth/me` | Whoami + session expiry | Gated |
| `GET`  | `/api/v1/auth/sessions` | List active sessions (admin) | Gated |

**Three auth modes supported in priority order:**
1. `Authorization: Bearer <token>` (preferred)
2. `Cookie: decel_session=<token>` (set on login, HttpOnly, Secure in prod)
3. `Authorization: Basic <b64>` (backward compat, curl-friendly)

**Login body**:
```json
{ "username": "cassin", "password": "..." }
```

**Login response**:
```json
{
  "token": "abc123...",
  "expires_at": "2026-08-29T20:00:00Z",
  "user": "cassin"
}
```

**Password storage**:
- `AUTH_PASS_HASH` (preferred): scrypt hash. Generate with `pnpm --filter @workspace/api-server run hash-password "your-plain-password"`.
- `AUTH_PASS` (legacy): plaintext. Only works in dev. Refuses to work in `NODE_ENV=production`.
- `DISABLE_AUTH=true`: short-circuits everything. **Dev only.**

Token TTL: 7 days, sliding window (refreshed on every request). Sessions stored in the `sessions` table as SHA-256 hashes — the raw token is never persisted.

### Dossiers (Epic 2)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/dossiers` | List all market dossiers |
| `GET`  | `/api/v1/dossiers/:id` | Get one dossier + its yards + orgs + people + plays |
| `POST` | `/api/v1/dossiers` | Upsert a market. Validated by `MarketSchema` |
| `GET`  | `/api/v1/orgs/resolve?match_key=<key>` | Cross-lingual org lookup (§12.3). 404 with "file in review queue" suggestion if no match. |

**Example — create a market dossier**

```bash
curl -u $AUTH_USER:$AUTH_PASS \
  -X POST http://localhost:5000/api/v1/dossiers \
  -H "Content-Type: application/json" \
  -d @market.json
```

```json
{
  "id": "pl",
  "country_iso": "PL",
  "country_name": "Poland",
  "tier": "A",
  "posture": "WARMUP",
  "verdict": {
    "value": "Active modernization in progress; PKP PLK is the primary actor.",
    "source_url": "https://www.plk-sa.pl/registry",
    "retrieved_at": "2026-08-21",
    "confidence": "V",
    "verified_by": "rule"
  },
  "five_questions": {
    "know_yourself": { "value": "DECEL is the only...", "source_url": "...", "retrieved_at": "...", "confidence": "V", "verified_by": "human" },
    "know_the_enemy": { "...": "..." },
    "terrain": { "...": "..." },
    "timing": { "...": "..." },
    "win_before_battle": { "...": "..." }
  },
  "window_opens": "2026-09-01T00:00:00Z",
  "window_closes": "2027-06-30T00:00:00Z",
  "sources": [
    { "url": "https://www.plk-sa.pl/registry", "title": "PKP PLK Infrastructure Registry" }
  ],
  "posture_history": [],
  "created_at": "2026-08-21T17:00:00Z",
  "updated_at": "2026-08-21T17:00:00Z"
}
```

### Review queue (US-1.2, §11.7)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/review-queue?market_id=<id>&include_archived=<bool>` | List queue items (excludes archived by default) |
| `POST` | `/api/v1/review-queue` | Enqueue a new item (used by the trust layer) |
| `POST` | `/api/v1/review-queue/archive-stale` | Admin: archive items older than 14 days |
| `POST` | `/api/v1/review-queue/:id/confirm` | Promote + log Correction |
| `POST` | `/api/v1/review-queue/:id/reject` | Discard + record rejection hash (dedupes re-render) |
| `POST` | `/api/v1/review-queue/:id/edit` | Promote with corrected value |

**Reject body**:
```json
{ "user": "cassin" }
```

**Edit body**:
```json
{ "user": "cassin", "corrected_value": { "name": "Idzikowice", "operator_org_id": "org_pkp_plk" } }
```

### Battle cards (US-4.1, US-4.2, §11.4)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/battle-cards` | List all (used by the offline bundle generator) |
| `GET`  | `/api/v1/battle-cards/:orgId` | Get one card (used by mobile in <5s) |
| `PUT`  | `/api/v1/battle-cards/:orgId` | Upsert. Bumps `doctrine_version` + records a revision |
| `GET`  | `/api/v1/battle-cards/:orgId/revisions` | Doctrine edit history (§11.11) |

**Card body** (Cassin-authored doctrine):
```json
{
  "org_id": "org_pkp_plk",
  "who_they_are": "PKP Polskie Linie Kolejowe — Polish national rail infrastructure manager",
  "why_matters": "Owns 28 hump yards; the largest CEE modernization program; controls all retarder procurement",
  "known_people": [
    { "person_id": "person_xyz", "role": "Director of Infrastructure", "relationship_status": "identified" }
  ],
  "relationship_status": "identified",
  "suggested_questions": [
    "What's the 2027 capex timeline for the Idzikowice modernization?",
    "How are retarder specs decided — internally or via consultant?",
    "Which consultant do you use for tender preparation?"
  ],
  "trap_to_avoid": "PKP S.A. is the holding — PLK owns the yards. Ask who opens PLK.",
  "sources": [{ "url": "...", "title": "..." }],
  "kind": "relationship",
  "recon_what_to_observe": null,
  "doctrine_version": 1,
  "doctrine_updated_at": "2026-08-21T17:00:00Z",
  "doctrine_updated_by": "cassin"
}
```

### Monday.com sync (US-3.1, US-3.2, §5, §11.6)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/monday/push/person/:id` | Push one person to Monday People board |
| `GET`  | `/api/v1/monday/health` | Token configured? board IDs? people count? |

### LinkedIn enrichment (§12.5.5, Cassin's correction 2026-08-22)

Automated public-profile enrichment via a data-provider API (v1: Proxycurl).
Fetches the minimal field set (name, role, org, profile URL) + recent
role changes, projects, public statements, conference appearances. Each
item is wrapped in a SourcedFact and appended to the person's
`interests` list.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/people/:id/enrich` | Run enrichment for one person. Body: `{ profile_url? }` (uses stored `linkedin_url` if omitted) |
| `GET`  | `/api/v1/people/enrich/health` | Provider configured? |

**Without `PROXYCURL_API_KEY`**, the enrich route returns `402 Payment
Required` with the fix instruction — the route never crashes the server.

**Enrich body**:
```json
{ "profile_url": "https://www.linkedin.com/in/jane-doe" }
```

**Enrich response**:
```json
{
  "person": { ... full Person record with new interests ... },
  "provider": "proxycurl"
}
```

**Push result**:
```json
{
  "person_id": "person_xyz",
  "monday_item_id": "9876543210",
  "status": "created",
  "reason": null
}
```

`status` is one of: `created` · `updated` · `human_edited` · `skipped_no_token` · `error`.

---

## Error responses

| Status | Body | When |
|---|---|---|
| 400 | `{ error: "Invalid request body", issues: [...] }` | Zod validation failed |
| 401 | `{ error: "Auth required" }` or `Invalid credentials` | Basic auth failed/missing |
| 404 | `{ error: "Not found" }` or `{ error: "Market not found" }` etc. | Resource missing |
| 409 | `{ error: "Content already rejected; not re-queued" }` | Review queue dedupe hit |
| 500 | `{ error: "Internal server error", request_id: "..." }` | Unhandled exception |

The `request_id` in 500s matches `req.id` in pino logs — copy it when reporting
an error so we can find the trace.
