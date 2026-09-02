"""Run radar-fetch with EXA_API_KEY explicitly passed (not via --env-file)."""
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


def run(client, cmd, timeout=240):
    print("\n$ " + cmd[:300])
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out: print(out.rstrip()[:4000])
    if err: print("[stderr-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20,
                   allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)
    print("connected")

    # 1. git pull
    print("\n=== A: git pull ===")
    run(client, "cd /opt/decel && git fetch origin && git reset --hard origin/main 2>&1 | tail -3")

    # 2. Read EXA key from .env
    print("\n=== B: source .env + run fetch with explicit env ===")
    cmd = """cd /opt/decel && set -a && . ./.env && set +a && echo "EXA key length: ${#EXA_API_KEY}" && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' EXA_API_KEY="$EXA_API_KEY" pnpm run radar:fetch --feed=exa 2>&1"""
    out, _, code = run(client, cmd, timeout=240)
    print("  exit code: " + str(code))

    # 3. Verify count
    print("\n=== C: verify via /api/v1/signals ===")
    login_req = urllib.request.Request(
        "https://decel.cassinai.tech/api/v1/auth/login",
        data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
        headers={"Content-Type": "application/json"},
    )
    login_res = json.loads(urllib.request.urlopen(login_req, timeout=15).read())
    token = login_res["token"]
    sig_req = urllib.request.Request(
        "https://decel.cassinai.tech/api/v1/signals",
        headers={"Authorization": f"Bearer {token}"},
    )
    sig_res = json.loads(urllib.request.urlopen(sig_req, timeout=15).read())
    print(f"  signals count: {sig_res.get('count', 0)}")
    for s in sig_res.get("items", [])[:8]:
        print(f"  - [{s['source']}] {s['title'][:80]}")
        print(f"      url: {s['url']}")
        print(f"      confidence: {s['summary']['confidence']}, market: {s.get('market_id')}")


if __name__ == "__main__":
    main()
