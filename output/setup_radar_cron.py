"""Set up the weekly radar cron on the VPS + verify the signals UI."""
import paramiko
import sys
import json
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HOST = "72.60.168.63"
USER = "root"
PASSWORD = "#9tqY//Q8IS2Z2N0"


def run(client, cmd, timeout=60):
    print("\n$ " + cmd[:200])
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[stderr-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20,
                   allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)
    print("connected")

    # 1. Add the cron line — every Monday 09:00 Stockholm (== 07:00 UTC in Sep)
    # The .env must be sourced so EXA_API_KEY is in scope.
    print("\n=== A: write radar-cron script ===")
    cron_script = """#!/bin/bash
set -a
. /opt/decel/.env
set +a
export DATABASE_URL="postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel"
cd /opt/decel
echo "[$(date -Is)] radar:fetch starting" >> /opt/decel/data/radar-cron.log
pnpm run radar:fetch >> /opt/decel/data/radar-cron.log 2>&1
echo "[$(date -Is)] radar:fetch done (exit $?)" >> /opt/decel/data/radar-cron.log
"""
    run(client, "mkdir -p /opt/decel/data")
    # Write the script via heredoc
    run(client, f"cat > /opt/decel/scripts/radar-cron.sh << 'RADAR_EOF'\n{cron_script}RADAR_EOF")
    run(client, "chmod +x /opt/decel/scripts/radar-cron.sh && cat /opt/decel/scripts/radar-cron.sh | head -5")

    print("\n=== B: install crontab ===")
    # Remove any existing line, add the new one
    run(client, "(crontab -l 2>/dev/null | grep -v 'radar-cron.sh'; echo '0 7 * * 1 /opt/decel/scripts/radar-cron.sh') | crontab -")
    run(client, "crontab -l")

    # 2. Verify signals via API
    print("\n=== C: verify signals via /api/v1/signals ===")
    login_req = urllib.request.Request(
        "https://decel.cassinai.tech/api/v1/auth/login",
        data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    login_res = json.loads(urllib.request.urlopen(login_req, timeout=15).read())
    token = login_res["token"]
    sig_req = urllib.request.Request(
        "https://decel.cassinai.tech/api/v1/signals?limit=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    sig_res = json.loads(urllib.request.urlopen(sig_req, timeout=15).read())
    print(f"  total signals: {sig_res.get('count', 0)}")
    print(f"  sample (10 most recent):")
    for s in sig_res.get("items", [])[:10]:
        print(f"    [{s['source']}] [{s['summary']['confidence']}] market={s.get('market_id') or '—'}")
        print(f"      {s['title'][:90]}")
        print(f"      {s['url']}")


if __name__ == "__main__":
    main()
