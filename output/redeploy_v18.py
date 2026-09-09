"""Rebuild + redeploy so the 2 fixes + cleanup land live on the VPS."""
import paramiko, sys, json, time, urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20,
               allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)
print("connected")


def run(cmd, t=300):
    print("\n$ " + cmd[:200])
    sin, so, se = client.exec_command(cmd, timeout=t)
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    code = so.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[err-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


# 1. Pull + rebuild + recreate
print("\n=== A: pull + rebuild + recreate ===")
run("cd /opt/decel && git fetch origin && git reset --hard origin/main 2>&1 | tail -3")
run("cd /opt/decel && docker compose build --no-cache app 2>&1 | tail -3", t=600)
run("cd /opt/decel && docker compose up -d --force-recreate --no-deps app 2>&1 | tail -3")
time.sleep(8)

# 2. E2E — verify the 2 fixes are live
print("\n=== B: verify 2 fixes are live ===")
login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/auth/login",
    data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
    headers={"Content-Type": "application/json"}), timeout=15).read())
token = login["token"]
H = {"Authorization": "Bearer " + token}

# AT dossier
ds = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/dossiers/at", headers=H), timeout=10).read())
ky = ds["market"]["five_questions"]["know_yourself"]
print("AT know_yourself source_url:", ky["source_url"], "  (should be decel.se)")

# PL, DE, MC, FI, CZ, TR, IT, NO, HU — all dossiers' know_yourself source_url
for mid in ["pl", "de", "middle-corridor", "fi", "at", "cz", "tr", "it", "no", "hu"]:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"https://decel.cassinai.tech/api/v1/dossiers/{mid}", headers=H), timeout=10).read())
    url = d["market"]["five_questions"]["know_yourself"]["source_url"]
    flag = "OK" if "decel.se" in url else "BAD"
    print(f"  {mid:18s}  {flag}  {url}")

# SWL on AT
print("\nAT timing value (SWL check):", ds["market"]["five_questions"]["timing"]["value"][:200])

# 3. Eval gate
print("\n=== C: eval gate ===")
run("cd /opt/decel && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' pnpm run eval 2>&1 | tail -10")
