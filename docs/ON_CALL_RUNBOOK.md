# DECEL Intelligence Platform — Fair-Week On-Call Runbook

**Window:** Sep 21 (smoke) – Sep 25 (close), 2026
**Operator:** Builder (Mavis), via Slack DM + this runbook
**Public URL:** https://decel.cassinai.tech
**VPS:** Hostinger `72.60.168.63`

**One-line rule:** the platform should survive a single container restart without
a human. Anything that requires the on-call to act is a Phase 6 escalation.

---

## 0. Before the fair (Sep 18 freeze)

| Task | Command | Status |
|---|---|---|
| Offline bundle on phone | `pnpm run build:offline-bundle` (run on VPS, then copy `dist/offline/` to phone via AirDrop / cloud) | ✅ already built (v1.0.0) |
| Static `index.html` opens on file:// | Open it on the phone (no Wi-Fi). It must render. | ⏳ Cassin to verify |
| Static password is set | `cassin` / `cassin-demo-2026` (or Hitank-rotated value in 1Password) | ⏳ Hitank to rotate |
| Cron self-reminder for Sep 21, 22, 23, 24, 25 at 09:00 Stockholm | `mavis cron self --every "0 9 21-25 9 *" --prompt "..."` | ✅ set by Builder Sep 2 |

## 1. Daily routine (09:00 Stockholm each fair day)

```bash
ssh root@72.60.168.63
docker ps --filter name=decel-app --filter name=decel-db    # both 'Up'
curl -sS https://decel.cassinai.tech/api/healthz            # → {"status":"ok"}
tail -f /opt/decel/data/fair-week-events.log                # monitor output
```

If the monitor isn't running (TMUX session dead), restart it:
```bash
cd /opt/decel
tmux new -s fair-monitor -d 'pnpm run monitor:fair-week'   # -d = detached
tmux ls                                                    # confirm 'fair-monitor' is up
```

## 2. Escalation decision tree

| Symptom | First check | If yes | If no |
|---|---|---|---|
| `healthz` returns 5xx | `docker logs --tail 50 decel-app` | Restart the container: `cd /opt/decel && docker compose restart app` (one shot, no loops) | See "5xx without log noise" below |
| `healthz` returns 000 (timeout) | `docker ps` (is the container alive?) | If `decel-app` is down: `cd /opt/decel && docker compose up -d app` | If up but no response: VPS network issue, see §3 |
| `healthz` is OK but UI 500s | `docker logs --tail 200 decel-app \| grep -i "5[0-9][0-9] "` | Find the route in the log → if Postgres: `docker ps` (is decel-db up?) | Probably a one-off; restart the app: `docker compose restart app` |
| Login returns 401 with right password | `cat /opt/decel/secrets/auth_pass_hash \| head -c 30` (does it look like a scrypt hash starting with `scrypt$`?) | If empty: Hitank cleared the file. Recreate: `pnpm run hash-password "..."` → write to secret → `docker compose restart app` | If the hash is non-scrypt (e.g. empty or wrong format): Hitank wrote a plain password. Recreate. |
| Login returns 503 "Auth not configured" | Env var `AUTH_PASS_HASH` is unset inside the container | Docker secret file `/run/secrets/auth_pass_hash` not mounted. Check `docker inspect decel-app \| grep -A5 Mounts` | Bug in `lib/auth/secrets.ts`; restart shouldn't help. Escalate. |
| Rate-limit 429 (5/15min) | `SELECT count(*) FROM sessions WHERE created_at > now() - interval '15 minutes'` (use psql via `pg-forward`) | If a Cassin device is hammering: ask them to wait 15min | If it's an attacker: check `docker logs decel-app \| grep "rate-limit"` for the IP — refer to the gibberish pattern memory for IP-blocking heuristic |
| Drizzle / migration error on startup | `docker logs decel-app 2>&1 \| grep -i "drizzle\|migrat\|column.*does not exist"` | If a column is missing: re-run `pnpm run db:push` from the VPS (it reapplies the additive migration) | If a type mismatch: don't fix on a fair day. Roll back to the previous git tag. |
| `decel-db` is down | `docker ps` (is the container listed?) | If down: `cd /opt/decel && docker compose up -d db` — give it 30s, then restart app | If up but refusing connections: `docker logs --tail 100 decel-db` |
| Disk full on VPS | `df -h /` (host filesystem) | If `/` is >90%: `docker system prune -af` (careful: this also nukes unused images) | If `/opt/decel` is the offender: `find /opt/decel -size +100M` (snapshots?) |
| TLS cert expired | `curl -vI https://decel.cassinai.tech 2>&1 \| grep -i "expire\|cert"` | Run `certbot renew` — should be auto-renewed by cron, but manual fix: `certbot --nginx -d decel.cassinai.tech --force-renewal` | Cert is fine; the 5xx is from the app, not TLS |

## 3. VPS-level failures (the platform isn't the problem)

| Symptom | First check | Action |
|---|---|---|
| SSH refuses connection | VPS up at all? | Check Hostinger control panel; if VPS is down, Cassin's offline bundle is the fallback — there's no remote fix |
| All Docker containers dead | `systemctl status docker` | `systemctl restart docker` then `cd /opt/decel && docker compose up -d` |
| `coolify` or `supabase` is hogging CPU | `docker stats --no-stream` | **Do not touch their containers** — they are not the DECEL stack. If a peer stack is broken, the only fix is on Hostinger's side |

## 4. Things the on-call MUST NOT do

- **Do not run a re-seed** (`pnpm run db:seed --force`) during fair week. It
  truncates the live DB. If content needs to be added, use
  `pnpm run import:cards <file>` (idempotent, additive only).
- **Do not change the `.env` file** unless a key is verified dead. A typo in
  `.env` will silently disable an integration and Cassin won't notice until
  the next demo.
- **Do not deploy a new commit** unless Cassin signs off. Hotfixes are OK
  if Cassin is paged and confirms; otherwise, the on-call waits.
- **Do not rotate the auth password** during fair week. If you do, Cassin
  can't log in on their phone until the offline bundle is rebuilt.
- **Do not delete the offline bundle** (`/opt/decel/dist/offline/`). It's
  the fallback if the live API dies. Keep it intact.

## 5. When to page Cassin

Page Cassin (Slack DM) immediately if:
- `healthz` is down for **>2 consecutive minutes** (i.e. monitor logged `health-fail` twice in a row)
- Any **5xx spike** of >10 in a single 60s window
- A **login failure** is reported by Cassin (means the password rotation didn't propagate, or the secret file is corrupted)
- The **offline bundle is missing or corrupt** on the phone (Cassin asks you to rebuild it from the VPS)
- The **Caddy/nginx reverse proxy** is down (the API might be fine, but no one can reach it)

Do **not** page Cassin for:
- One-off 5xx that self-resolves in <30s
- A bot hammering login (rate limit is doing its job)
- A non-DECEL container on the VPS (coolify, supabase) — Hitank's call

## 6. End of fair (Sep 25)

After the close of the fair:
1. **Stop the monitor:** `tmux kill-session -t fair-monitor`
2. **Snapshot the events log:** `cp /opt/decel/data/fair-week-events.log /opt/decel/output/fair-week-events-2026-09-25.log`
3. **Open the corrections log:** `GET /api/v1/corrections/summary` (Cassin will use this in the Oct 1 workstyle-evidence meeting)
4. **No automatic teardown** — leave the platform running, the post-fair
   radar (Phase 7) needs it from Oct 1 onward.

## 7. Phase 7 handoff (Oct 1+)

The radar skeleton (TED EU, signal page) is in main as of v1.1.0. From
Oct 1 onward, the cadence is the Morning Queue (§13 in Cassin's v1.6 brief),
not the fair-week on-call. The on-call SLA reverts to "next business day"
(per the production runbook §5).

## 8. Contacts

| Role | Name | Channel | Response SLA |
|---|---|---|---|
| Product owner | Cassin | Slack DM | 5 min during fair (09:00-19:00 Stockholm) |
| Ops coordinator | Hitank | Slack DM | 30 min |
| VPS host | Hostinger | support@hostinger.com | 1h (fair week only) |
| Builder | Mavis | this runbook + Slack thread | continuous during on-call shift |

---

**Owner:** Builder (Mavis) for the script + runbook. Cassin for the doctrine
(when to page, what to do). Hitank for the off-VPS parts (GitHub, monday).
**Last updated:** 2026-09-02 (Phase 6, v1.1.0).
