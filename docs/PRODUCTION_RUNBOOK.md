# DECEL Intelligence Platform — Production Runbook

**Version:** v1.0.0
**Frozen:** 2026-09-02
**Public URL:** https://decel.cassinai.tech
**Repository:** https://github.com/CassinMukire/humpyard
**VPS:** Hostinger `72.60.168.63` (Ubuntu 24.04.4 LTS, 2 vCPU, 8GB RAM, EU/EEA)

---

## 1. Architecture at a glance

```
nginx (TLS :443, Let's Encrypt)
  ↓
decel-app (Express 5, Node 24, port 5000, api + static SPA)
  ↓ Drizzle ORM
decel-db (PostgreSQL 16-alpine, port 5432, EU/EEA timezone)
  ↓
pg-forward (socat, host network, localhost:55432 → decel-db:5432)
```

Containers on the VPS:
- `decel-app` — the api-server + React SPA (1 container, port 5000)
- `decel-db` — Postgres 16 (no port exposure, internal network only)
- `pg-forward` — socat for `localhost:55432` → `db:5432` (used by host-side scripts)

Pre-existing containers (untouched):
- `coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime`, `coolify-sentinel`
- `supabase-*` (multiple), `cassin_api`, `cassin_grafana`, `cassin_vector_postgres`

---

## 2. Login & access

| Resource | Value |
|---|---|
| Public URL | `https://decel.cassinai.tech` |
| Login (v1 dev) | user `cassin` / password `cassin-demo-2026` |
| SSH | `ssh root@72.60.168.63` (password in 1Password "Hostinger VPS" entry) |
| GitHub | `https://github.com/CassinMukire/humpyard` (public repo) |
| Auth pass hash | scrypt file at `/opt/decel/secrets/auth_pass_hash` (Docker secret, mode 0644) |
| .env | `/opt/decel/.env` (mode 0600, contains real keys) |

**Rotate password:** `pnpm run hash-password "new-pw" | tr -d '\n' > /opt/decel/secrets/auth_pass_hash && cd /opt/decel && docker compose restart app`

---

## 3. Daily operations

### Check health
```bash
ssh root@72.60.168.63
docker ps --filter name=decel-app
curl -sS https://decel.cassinai.tech/api/healthz   # → {"status":"ok"}
```

### View logs
```bash
docker logs --tail 100 decel-app      # api-server logs (JSON-pino)
docker logs --tail 50  decel-db       # Postgres logs
nginx -t 2>&1; tail -f /var/log/nginx/error.log
```

### Restart services
```bash
cd /opt/decel
docker compose restart app             # ~10s downtime
docker compose restart db              # careful — kills all connections
```

### Force-recreate with new image (after deploy)
```bash
cd /opt/decel && git pull
docker compose build --no-cache app
docker compose up -d --force-recreate --no-deps app
```

---

## 4. Deploy a new version

```bash
# Local: commit + push
git add <files>
git commit -m "..."
git push origin main

# VPS: pull + rebuild + restart
ssh root@72.60.168.63
cd /opt/decel
git fetch origin && git reset --hard origin/main
docker compose build --no-cache app
docker compose up -d --force-recreate --no-deps app
sleep 15
curl -sS https://decel.cassinai.tech/api/healthz   # confirm green
```

**No database migrations** in v1 — the schema is the live Postgres. To add a column, hand-write the `ALTER TABLE` and apply via `docker exec decel-db psql -U decel -d decel -f migration.sql`.

---

## 5. Backup & restore

**Volumes:**
- `decel-db-data` (Postgres data) — auto-backed up to Hostinger's volume snapshots
- `decel-snapshots` (raw source snapshots, currently unused) — backed up

**On-demand DB backup:**
```bash
ssh root@72.60.168.63
docker exec decel-db pg_dump -U decel -d decel > /opt/decel/backups/decel-$(date +%Y%m%d-%H%M%S).sql
```

**Restore (DESTRUCTIVE — wipes current DB):**
```bash
cat /opt/decel/backups/decel-20260902-150000.sql | docker exec -i decel-db psql -U decel -d decel
```

**Offsite backup** is Hitank's responsibility (per v1 brief §12.6 / `docs/DECISIONS.md`).

---

## 6. Run the eval gate

```bash
ssh root@72.60.168.63
cd /opt/decel
git pull   # if golden set changed
DATABASE_URL='postgres://decel:$POSTGRES_PASSWORD@localhost:55432/decel' \
  NODE_ENV=production pnpm run eval
```

**Expected:** 22 pass, 0 fail (as of v1.0.0). The gate is green because:
- Tests 1-3 (junk corpus, confidence rules, unsourced hard rule) are pure logic — always green
- Test 0 (Poland yards) reflects the v1.6 state: 0 yards expected, only checks "no hallucinated yards"

**When it goes red:** the script prints which test failed and the diff. Fix and re-run.

---

## 7. One-command operations (npm scripts)

```bash
pnpm run eval                    # Eval gate (Tests 0-3)
pnpm run import:cards <file>     # F6 — import Cassin's markdown/JSON cards
pnpm run snapshots:fetch         # F2b — cache source URLs to data/snapshots/
pnpm run build:offline-bundle   # Phase 4 — write dist/offline/ for the phone
pnpm run db:seed                 # Re-seed (idempotent: --force to wipe)
pnpm run db:push                 # Apply Drizzle migrations
pnpm run hash-password "..."     # Generate scrypt hash for new password
```

---

## 8. Pre-fair-week checklist (Sep 18-20)

- [x] **Eval gate green** (22 pass, 0 fail)
- [x] **All 21 routes return 200** (12 API + 9 SPA)
- [x] **CSP, HSTS, X-Frame-Options, X-Content-Type-Options** all set
- [x] **Real Postgres, no demo store** (`in_memory_store: false`)
- [x] **Auth enforced** (`auth_disabled: false`)
- [x] **Cold-start < 1s** (healthz: 37ms, login: 218ms)
- [x] **Offline bundle built** (`dist/offline/`, 28 KB, 6 files)
- [x] **No 5xx in last 200 log lines**
- [x] **All real API keys live** (EXA, OpenAI, monday)
- [ ] **Real password** (still using `cassin-demo-2026`)
- [ ] **md back-up the prod DB to a safe location** (Hitank)

---

## 9. On-call (Sep 21-25)

**Channel:** Hitank (ops) + Cassin (PO). Slack or phone for P0.
**Severity:**

| Sev | What | Action | SLA |
|---|---|---|---|
| **P0** | Platform down (5xx on /api/healthz) | Check `docker ps`, restart app, look at logs | 15 min |
| **P0** | DB unreachable | Check `decel-db` container, see if volume is OK | 15 min |
| **P1** | Auth broken (no one can log in) | Reset `secrets/auth_pass_hash`, restart | 30 min |
| **P1** | Login works but dossier list is empty | Check Postgres data, re-seed if needed | 1 hour |
| **P2** | Single endpoint returns 5xx | Check logs, fix forward | 4 hours |
| **P3** | UI bug, content wrong, etc. | Add to backlog, fix after fair | best effort |

**Quick triage commands:**
```bash
# Is the app up?
curl -sS https://decel.cassinai.tech/api/healthz
docker ps --filter name=decel-app

# What's in the logs?
docker logs --tail 50 decel-app | grep -E 'level.:50|errored'

# Can the app reach the DB?
docker exec decel-app sh -c 'echo "SELECT 1;" | nc -w 2 db 5432'

# Is the SSL cert still valid?
echo | openssl s_client -connect decel.cassinai.tech:443 -servername decel.cassinai.tech 2>/dev/null | openssl x509 -noout -dates
```

---

## 10. Spec reference

- **v1.6 brief** (binding): `docs/DECISIONS.md` (or the PDF Cassin sent)
- **v1.4 spec**: §1-§12
- **v1.6 §13**: Morning Queue (post-fair P2)
- **DoD**: §12.4
- **Kill criteria**: Sep 18 (freeze) / Oct 15 (radar MVP) / Dec 1 (value test)

---

## 11. Known limitations (v1)

- **No live OIU corpus / F6 import** — battle cards are the Cassin-curated seed. Real person data arrives via the markdown/JSON import.
- **LinkedIn enrichment is manual** — F3: no API call. Operator pastes the URL into the person page after a LinkedIn search.
- **Snapshot layer is opt-in** — run `pnpm run snapshots:fetch` to cache source HTML. The SourcedFact envelope doesn't link to snapshots yet (v1.1).
- **Closed markets are filtered out of the dossier list UI** but the row stays for history (per v1.6 TR/IT/NO/HU ruling).
- **No mobile PWA service worker** — the v1 PWA was reverted in commit `96e1d01` because it intercepted /api/* with 503s. Offline bundle (HTML files) is the v1 story instead.

---

## 12. Contacts

| Role | Person | Slack | Email |
|---|---|---|---|
| Product owner | Cassin (DECEL) | (per Hitank) | cassin@tangoscale.com (per monday config) |
| Ops / coordinator | Hitank (Avora Agency) | cassinai.tech | operations@avora.agency |
| Builder | Mavis | (this session) | (Mavis) |

For fair week (Sep 21-25), the builder is on-call per the agreed response SLA.
