# Architecture — end-to-end trace

> **Read this if you're new.** It's the one-page map of the whole system.
> Every other doc (`API.md`, `DATABASE.md`, `ENV.md`) is a deep-dive into
> one of the boxes below.

---

## 1. The whole system, in one picture

```mermaid
flowchart LR
    subgraph BROWSER["📱 Cassin's phone (browser)"]
        UI["React 19 + Vite SPA<br/>(hump-yard-intel)"]
        PWA["PWA service worker<br/>(offline cache)"]
        UI -. uses .-> PWA
    end

    subgraph SERVER["🖥️  Node 24 server (Hetzner Frankfurt, EU/EEA)"]
        API["Express 5 API<br/>(port 5000)"]
        STATIC["Static frontend<br/>(built React bundle)"]
        TRUST["Trust layer<br/>lib/trust-layer.ts"]
        STORE["Drizzle queue-store<br/>lib/queue-store.ts"]
        LI["LinkedIn provider<br/>(Proxycurl)"]
        EX["Exa search"]
        OAI["OpenAI<br/>(gpt-4.1 + 4.1-mini)"]
        API --> STATIC
        API --> TRUST
        TRUST --> STORE
        API --> LI
        API --> EX
        API --> OAI
    end

    subgraph DATA["🗄️  PostgreSQL 16 (Hetzner-managed)"]
        DB["10 tables<br/>+ sessions + audit_log"]
    end

    subgraph EXTERNAL["🌐  External services"]
        LI_API["Proxycurl<br/>(LinkedIn)"]
        EX_API["Exa"]
        OAI_API["OpenAI"]
        MON["monday.com<br/>(People board)"]
    end

    BROWSER -->|"HTTPS<br/>/api/v1/*"| API
    BROWSER -->|"HTTPS<br/>(offline)"| STATIC
    SERVER --> DB
    LI --> LI_API
    EX --> EX_API
    OAI --> OAI_API
    API -->|"Engine → Monday<br/>(one-way push)"| MON
```

**One-liner:** the API serves both the React frontend and the data API. Trust layer gates every fact. Postgres stores everything. Three external services do search / LLM / LinkedIn enrichment. monday is one-way push.

---

## 2. What happens when Cassin opens the app

```mermaid
sequenceDiagram
    autonumber
    actor Cassin
    participant PWA as PWA<br/>(Cassin's phone)
    participant API as Express API
    participant AUTH as auth.ts<br/>(requireAuth)
    participant DB as Postgres

    rect rgb(240, 248, 255)
    Note over PWA,API: 1. First load (offline-capable)
    Cassin->>PWA: Opens battle card for "PKP PLK"
    PWA->>PWA: serve from cache if offline
    alt cache hit
        PWA-->>Cassin: card renders <5s ✓
    else cache miss
        PWA->>API: GET /api/v1/battle-cards/org_pkp_plk
        API->>AUTH: check Bearer token
        AUTH->>DB: SELECT sessions WHERE token_hash=...
        DB-->>AUTH: session row
        AUTH-->>API: user = "cassin", expires_at = ...
        API-->>PWA: 200 + battle card JSON
        PWA->>PWA: store in cache for next time
        PWA-->>Cassin: card renders
    end
    end

    rect rgb(255, 248, 240)
    Note over PWA,API: 2. Polish dossier (needs network)
    Cassin->>PWA: Opens "Poland" market
    PWA->>API: GET /api/v1/dossiers/pl
    API->>AUTH: requireAuth
    AUTH->>DB: lookup session
    DB-->>AUTH: ok
    API->>DB: SELECT * FROM markets WHERE id='pl'
    API->>DB: SELECT * FROM yards WHERE market_id='pl'
    API->>DB: SELECT * FROM orgs WHERE id IN (...)
    API->>DB: SELECT * FROM persons WHERE org_id IN (...)
    DB-->>API: rows
    API-->>PWA: 200 + dossier JSON
    PWA-->>Cassin: dossier renders
    end
```

**Key observation:** battle cards are pre-rendered JSON, cached on the device. They work in airplane mode. The dossier system needs the network but is fast (<5s with a warm cache).

---

## 3. The trust gate — every fact, every time

```mermaid
flowchart TD
    A["Source page<br/>(e.g. plk-sa.pl/registry)"] --> B["Exa search +<br/>content extraction"]
    B --> C["Proposed SourcedFact<br/>{ value, source_url,<br/>  retrieved_at,<br/>  confidence, verified_by }"]

    C --> D{"trust-layer gate<br/>lib/trust-layer.ts"}

    D -->|"[V] primary domain<br/>OR human confirm"| R1["✓ RENDER<br/>(goes to UI)"]
    D -->|"[I] model inference<br/>(always)"| Q1["📋 REVIEW QUEUE<br/>(operator decides)"]
    D -->|"[O] single secondary<br/>(needs corroboration)"| Q1
    D -->|"empty source_url"| X1["✗ DISCARD<br/>(hard rule)"]
    D -->|"text fragment<br/>(no name, no market)"| X1

    Q1 -->|"operator: confirm"| R1
    Q1 -->|"operator: reject<br/>(rejection_hash logged)"| X2["✗ DISCARD<br/>(rejection logged)"]
    Q1 -->|"operator: edit<br/>(with corrected value)"| R1
    Q1 -->|"14d unreviewed"| X3["🗄️ AUTO-ARCHIVE<br/>(recoverable)"]

    R1 --> E["Doctrine layer<br/>(Cassin writes battle cards)"]
    E --> F["Pre-rendered HTML+JSON<br/>(static bundle)"]
    F --> G["📱 Cassin's phone<br/>(PWA cache)"]
    G -->|"<5s, offline-capable"| Cassin

    style R1 fill:#d4f4dd
    style Q1 fill:#fff3cd
    style X1 fill:#f8d7da
    style X2 fill:#f8d7da
    style X3 fill:#e2d6f3
    style F fill:#cfe2ff
    style G fill:#cfe2ff
```

**Hard rule:** a fact with no resolvable source cannot render. Ever. This is enforced in `lib/trust-layer.ts:gateSourcedFact` and tested by the eval gate (21/21 green).

---

## 4. The SourcedFact envelope — every claim, every time

```mermaid
flowchart LR
    subgraph SF["SourcedFact envelope (the only allowed shape for a claim)"]
        V["value<br/>'PKP PLK is the<br/>infrastructure manager'"]
        U["source_url<br/>'https://www.plk-sa.pl/...'"]
        R["retrieved_at<br/>'2026-08-17'"]
        C["confidence<br/>'V' or 'O' or 'I'"]
        VB["verified_by<br/>'rule' | 'human' | 'human-import' | 'doc-import' | null"]
    end

    C -. "[V]: primary source<br/>OR ≥2 non-primary<br/>OR human confirmed" .-> CONF1[✓]
    C -. "[O]: single secondary" .-> CONF2[⚠]
    C -. "[I]: model inference" .-> CONF3[?]

    style CONF1 fill:#d4f4dd
    style CONF2 fill:#fff3cd
    style CONF3 fill:#f8d7da
```

**Confidence rules** (mechanical, §11.3):
- **[V]** verified → render
- **[O]** observed (single secondary) → queue (needs corroboration)
- **[I]** inferred (model) → queue (never auto-`[V]`)

---

## 5. The data model — what lives where

```mermaid
erDiagram
    MARKETS ||--o{ YARDS : "has"
    MARKETS ||--o{ POSTURE_HISTORY : "tracks"
    ORGS ||--o{ PERSONS : "employs"
    YARDS }o--|| ORGS : "operated by"
    PERSONS ||--o{ ROLE_HISTORY : "tracks"
    ORG_RISKS ||--|| ORGS : "names (Market/Org level only, per §12.5)"
    PERSONS ||--o{ PERSON_INTERESTS : "has"
    SESSIONS ||--o{ USERS : "authenticates"
    AUDIT_LOG ||--o{ USERS : "tracks"

    MARKETS {
        text id PK
        text country_iso
        text country_name
        tier tier
        posture posture
        jsonb verdict
        jsonb five_questions
    }
    YARDS {
        text id PK
        text market_id FK
        text name
        jsonb geo
        text operator_org_id FK
        yard_status status
    }
    ORGS {
        text id PK
        text name
        text match_key "UNIQUE — cross-lingual dedupe"
        org_type type
    }
    PERSONS {
        text id PK
        text name
        text org_id FK
        text role
        text linkedin_url
        jsonb interests "topics of interest (Cassin correction Aug 22)"
    }
    SESSIONS {
        text token_hash PK "SHA-256, never the raw token"
        text user_id
        timestamptz expires_at
    }
```

See `docs/DATABASE.md` for the full column-by-column spec.

---

## 6. The auth flow — how a session actually works

```mermaid
sequenceDiagram
    autonumber
    actor Cassin
    participant Browser
    participant API
    participant Auth as auth middleware
    participant Sessions as sessions table
    participant Audit as audit_log

    rect rgb(240, 255, 240)
    Note over Browser,Audit: 1. Login
    Browser->>API: POST /api/v1/auth/login<br/>{ username, password }
    API->>API: rate-limit (5/15min/IP)
    API->>API: checkCredentials<br/>(scrypt or legacy plaintext)
    alt valid
        API->>Sessions: INSERT (token_hash, user, expires_at, ip, ua)
        API->>Audit: log login_success
        API-->>Browser: { token, expires_at, user } + HttpOnly cookie
    else invalid
        API->>Audit: log login_failure
        API-->>Browser: 401
    end
    end

    rect rgb(255, 255, 240)
    Note over Browser,Audit: 2. Subsequent requests
    Browser->>API: GET /api/v1/dossiers/pl<br/>Authorization: Bearer <token>
    API->>Auth: requireAuth middleware
    Auth->>Sessions: SELECT WHERE token_hash = sha256(token)
    Sessions-->>Auth: session row
    Auth->>Auth: check expires_at > now()
    Auth->>Sessions: UPDATE last_seen_at (sliding window)
    Auth-->>API: req.authUser = "cassin"
    API-->>Browser: 200 + dossier
    end

    rect rgb(255, 240, 240)
    Note over Browser,Audit: 3. Logout
    Browser->>API: POST /api/v1/auth/logout
    API->>Sessions: DELETE WHERE token_hash = ...
    API->>Audit: log logout
    API-->>Browser: 204 + cleared cookie
    end
```

**Three auth modes, in priority order:**
1. **Bearer token** (`Authorization: Bearer <token>`) — preferred
2. **HttpOnly cookie** (`decel_session`) — set on login, browser flows
3. **HTTP Basic** (`Authorization: Basic <b64>`) — backward compat, curl-friendly

`DISABLE_AUTH=true` short-circuits everything (dev only).

---

## 7. The deployment — what runs where

```mermaid
flowchart TB
    subgraph HOST["Host (Hetzner CX22, Frankfurt, EU/EEA)"]
        direction TB

        subgraph REVERSE["Caddy reverse proxy :443 :80"]
            TLS["TLS termination<br/>(Let's Encrypt)"]
        end

        subgraph STACK["docker compose"]
            APP["decel-app<br/>(built from Dockerfile)<br/>api-server :5000<br/>+ static frontend"]
            DB["decel-db<br/>(postgres:16-alpine)<br/>:5432"]
        end

        VOL1["Volume: decel-db-data<br/>/var/lib/postgresql/data"]
        VOL2["Volume: decel-snapshots<br/>/app/data/snapshots"]
    end

    NET["Cassin on his phone<br/>OR the operator's browser"] -->|"HTTPS<br/>decel.example.com"| TLS
    TLS -->|"localhost:8080"| APP
    APP -->|"postgres://<br/>decel:***@db:5432/decel"| DB
    DB -.->|persists| VOL1
    APP -.->|persists| VOL2

    APP -.->|"HTTPS"| EXT1["Exa API"]
    APP -.->|"HTTPS"| EXT2["OpenAI API"]
    APP -.->|"HTTPS"| EXT3["Proxycurl<br/>(LinkedIn)"]
    APP -.->|"HTTPS"| EXT4["monday.com<br/>(one-way push)"]
```

**Run it:**
```bash
cp .env.example .env
# fill in DATABASE_URL, EXA_API_KEY, OPENAI_API_KEY, AUTH_PASS_HASH, ...
docker compose up
# open http://localhost:8080
```

---

## 8. The metric loop — how we know it's working

```mermaid
flowchart LR
    subgraph INPUT["Inputs (the 4 jobs)"]
        I1["Dossiers"]
        I2["Key contacts"]
        I3["Topics of interest"]
        I4["Battle cards"]
    end

    subgraph GATE["Trust layer gate"]
        G["Every fact:<br/>SourcedFact?<br/>Confidence [V/O/I]?<br/>Render / queue / discard"]
    end

    subgraph METRIC["The metric:<br/>'Procurements where DECEL<br/>is in the spec before tendering'"]
        M["Proxy: Cassin walks into<br/>every InnoTrans meeting<br/>knowing more than the<br/>other side expects"]
    end

    subgraph FEEDBACK["Feedback loop"]
        EVAL["Eval gate<br/>(golden sets A/B/C)"]
        REVIEW["Review queue<br/>(operator confirm/reject/edit)"]
        LEARN["Correction log →<br/>tomorrow's training set"]
    end

    INPUT --> G --> METRIC
    G -.->|"rejected facts"| REVIEW
    REVIEW --> LEARN
    G -.->|"golden-set<br/>gates"| EVAL
    EVAL -.->|"red build = no deploy"| G

    style METRIC fill:#fff3cd
    style EVAL fill:#cfe2ff
    style REVIEW fill:#cfe2ff
    style LEARN fill:#d4f4dd
```

**Eval gate (21/21 green right now):** China junk corpus → 0 entities render. Confidence rules enforced. No-resolvable-source → discard. Runs on every push to main; red = no deploy (§11.12).

---

## 9. The 3 things that decide if we ship by Sep 18

```mermaid
flowchart TD
    OIU["1. OIU corpus PDFs<br/>in the repo by Aug 25<br/><b>OWNER: Hitank</b>"]
    CAS["2. Cassin writes 30<br/>doctrine entries by Sep 11<br/><b>OWNER: Cassin</b>"]
    MON["3. monday.com DPA +<br/>People board ready by W35<br/><b>OWNER: Hitank + Cassin</b>"]

    OIU --> SHIP["🚀 Sep 18 freeze<br/>Sep 22-25 InnoTrans"]
    CAS --> SHIP
    MON --> SHIP

    OIU -.->|"if late"| CUT1["Cut: Middle Corridor<br/>→ plain watchlist+"]
    CAS -.->|"if late"| CUT2["Cut: battle mode<br/>→ text-only"]
    MON -.->|"if late"| CUT3["Cut: W35 push<br/>→ sandbox board"]

    OIU -.->|"Sep 8 slip call"| SLIP
    CAS -.->|"Sep 8 slip call"| SLIP
    MON -.->|"Sep 8 slip call"| SLIP
    SLIP["📞 Sep 8 slip call<br/>'we say so this day,<br/>not Sep 17'"] -.->|"if any of 1/2/3 are red"| SHIP

    style SHIP fill:#d4f4dd
    style SLIP fill:#fff3cd
    style CUT1 fill:#f8d7da
    style CUT2 fill:#f8d7da
    style CUT3 fill:#f8d7da
```

---

## 10. Where to look next

| You want to... | Read |
|---|---|
| Understand the API surface | `docs/API.md` |
| Understand the database | `docs/DATABASE.md` |
| Set up env vars | `docs/ENV.md` |
| Understand the 8 contract gaps + sign-offs | `docs/DECISIONS.md` |
| See the sprint plan | `docs/SPRINT.md` |
| Understand the trust gate in code | `artifacts/api-server/src/lib/trust-layer.ts` |
| Understand the data shape | `lib/api-zod/src/manual/schemas.ts` |
| Understand the schema | `lib/db/src/schema/` |
| Run the eval gate | `scripts/eval-gate.ts` |
| Generate a password hash | `pnpm --filter @workspace/api-server run hash-password "your-plain-password"` |
| Bootstrap from scratch | `scripts/setup.ps1` (Windows) or `scripts/setup.sh` (bash) |

---

**ASCII version for terminals that don't render Mermaid:**

```
┌──────────────┐   HTTPS    ┌──────────────────────────────────────────────┐
│  Cassin's    │ ─────────► │ Express 5 API (port 5000)                   │
│  phone       │            │ ├─ helmet security headers                  │
│  (PWA cache) │ ◄───────── │ ├─ requireAuth (token / cookie / basic)    │
└──────────────┘   static    │ ├─ /api/v1/auth/{login,logout,me,...}       │
                               │ ├─ /api/v1/dossiers/*                       │
                               │ ├─ /api/v1/review-queue/*                   │
                               │ ├─ /api/v1/battle-cards/*                   │
                               │ ├─ /api/v1/monday/push/person/:id           │
                               │ ├─ /api/v1/people/:id/enrich                │
                               │ ├─ trust-layer gate (every fact)            │
                               │ └─ queue-store (Drizzle)                     │
                               │     ↓                     ↓                 │
                               │ Postgres 16        Exa · OpenAI · Proxycurl │
                               │ (10 + sessions      (HTTPS, all EU/EEA)  │
                               │  + audit tables)                            │
                               └──────────────────────────────────────────────┘

Trust gate: SourcedFact → { render | queue | discard }
  V  primary source / human confirm     → render
  O  single secondary source            → queue (needs corroboration)
  I  model inference                    → queue (never auto-V)
  no source                            → DISCARD (hard rule)
```
