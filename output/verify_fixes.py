"""Final verify: all 10 dossiers correct + eval gate green."""
import paramiko, json, urllib.request, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20,
               allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)


def run(cmd, t=120):
    sin, so, se = client.exec_command(cmd, timeout=t)
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    code = so.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[err-" + str(code) + "] " + err.rstrip()[:500])
    return out


# All 10 dossiers — verify both fixes
print("=== All 10 dossiers ===")
login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/auth/login",
    data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
    headers={"Content-Type": "application/json"}), timeout=15).read())
token = login["token"]
H = {"Authorization": "Bearer " + token}

print(f"{'market':18s}  ky_url                                         verdict excerpt")
print("-" * 110)
for mid in ["pl", "de", "middle-corridor", "fi", "at", "cz", "tr", "it", "no", "hu"]:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"https://decel.cassinai.tech/api/v1/dossiers/{mid}", headers=H), timeout=10).read())
    url = d["market"]["five_questions"]["know_yourself"]["source_url"]
    verdict = d["market"]["verdict"]["value"]
    if len(verdict) > 50:
        verdict = verdict[:50] + "..."
    print(f"  {mid:18s}  {url:48s}  {verdict}")

# Eval gate
print("\n=== eval gate ===")
out = run("cd /opt/decel && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' pnpm run eval 2>&1 | tail -10")
