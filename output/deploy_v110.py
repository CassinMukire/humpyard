"""Deploy v1.1.0 (Phase 2 finish + Phase 6 + Phase 7) to VPS.

What it does:
  1. git pull (origin/main is the v1.1.0 tip with all 4 new commits)
  2. Apply the signals migration (0002_add_signals.sql, additive only)
  3. Re-seed (so the new fi/at/cz/it/no/hu markets + 11 new orgs land)
  4. Rebuild the api-server image (--no-cache to avoid the cached-layer
     trap noted in agent memory)
  5. Force-recreate the decel-app container
  6. Smoke test: healthz, login, list markets (10 expected), list signals
  7. Run the eval gate (should stay green — 22/22)
"""
import paramiko
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HOST = "72.60.168.63"
USER = "root"
PASSWORD = "#9tqY//Q8IS2Z2N0"


def run(client, cmd, timeout=180):
    print("\n$ " + cmd[:300] + ("..." if len(cmd) > 300 else ""))
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out: print(out.rstrip()[:2000])
    if err: print("[stderr-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20,
                   allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)
    print("connected to " + HOST)

    # 1. git pull
    print("\n=== A: git pull ===")
    run(client, "cd /opt/decel && git fetch origin 2>&1")
    run(client, "cd /opt/decel && git reset --hard origin/main 2>&1")
    out, _, _ = run(client, "cd /opt/decel && git log -1 --oneline")
    print("  HEAD = " + out.strip())

    # 2. Apply signals migration
    print("\n=== B: apply signals migration (0002_add_signals.sql) ===")
    run(client, "cd /opt/decel && cat lib/db/drizzle/0002_add_signals.sql | docker exec -i decel-db psql -U decel -d decel 2>&1 | head -20")

    # 3. Re-seed (idempotent — only adds new rows)
    print("\n=== C: re-seed (additive) ===")
    out, _, code = run(client, "cd /opt/decel && docker exec -i decel-app sh -c 'DATABASE_URL=postgres://decel:$POSTGRES_PASSWORD@db:5432/decel pnpm run db:seed' 2>&1")
    if code != 0:
        print("WARN: seed returned non-zero — trying host network path")
        out, _, code = run(client, "cd /opt/decel && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' pnpm run db:seed 2>&1")
    print("  exit code: " + str(code))

    # 4. Rebuild (no cache)
    print("\n=== D: rebuild decel-app (--no-cache to avoid the cached-layer trap) ===")
    run(client, "cd /opt/decel && docker compose build --no-cache app 2>&1 | tail -20", timeout=600)

    # 5. Force-recreate
    print("\n=== E: force-recreate decel-app ===")
    run(client, "cd /opt/decel && docker compose up -d --force-recreate --no-deps app 2>&1")
    time.sleep(8)
    run(client, "docker ps --filter name=decel-app --format '{{.Names}}\\t{{.Status}}\\t{{.Ports}}'")

    # 6. Smoke test
    print("\n=== F: smoke test ===")
    run(client, "curl -s -o /dev/null -w 'healthz: %{http_code} in %{time_total}s\\n' https://decel.cassinai.tech/api/healthz")
    run(client, "curl -s -X POST -H 'Content-Type: application/json' -d '{\"username\":\"cassin\",\"password\":\"cassin-demo-2026\"}' https://decel.cassinai.tech/api/v1/auth/login -o /tmp/login.json -w 'login: %{http_code} in %{time_total}s\\n'")
    run(client, "cat /tmp/login.json | head -c 200; echo")
    # Simpler: use jq (or python with a script file) instead of one-liners
    run(client, "echo 'import json,sys; d=json.load(sys.stdin); m=d.get(\"markets\",[]); print(\"markets in DB:\",len(m)); print(\"ids:\",[x[\"id\"] for x in m])' > /tmp/dossiers_check.py")
    run(client, "TOKEN=$(python3 -c 'import json; print(json.load(open(\"/tmp/login.json\"))[\"token\"])'); curl -s -H \"Authorization: Bearer $TOKEN\" https://decel.cassinai.tech/api/v1/dossiers | python3 /tmp/dossiers_check.py")
    run(client, "echo 'import json,sys; d=json.load(sys.stdin); print(\"signals in DB:\", d.get(\"count\",0))' > /tmp/signals_check.py")
    run(client, "TOKEN=$(python3 -c 'import json; print(json.load(open(\"/tmp/login.json\"))[\"token\"])'); curl -s -H \"Authorization: Bearer $TOKEN\" https://decel.cassinai.tech/api/v1/signals | python3 /tmp/signals_check.py")

    # 7. Eval gate (full output, no tail)
    print("\n=== G: eval gate ===")
    out, _, code = run(client, "cd /opt/decel && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' pnpm run eval 2>&1")
    print("  eval exit code: " + str(code))

    print("\n=== deploy v1.1.0 done ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("FATAL: " + str(e))
        sys.exit(1)
