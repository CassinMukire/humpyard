"""Deploy radar flow + E2E test the chain."""
import paramiko, sys, json, time, urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20,
               allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)


def run(cmd, t=300):
    sin, so, se = client.exec_command(cmd, timeout=t)
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    code = so.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[err-" + str(code) + "] " + err.rstrip()[:500])
    return out


print("=== A: pull + rebuild + recreate ===")
run("cd /opt/decel && git fetch origin && git reset --hard origin/main 2>&1 | tail -3")
run("cd /opt/decel && docker compose build --no-cache app 2>&1 | tail -3", t=600)
run("cd /opt/decel && docker compose up -d --force-recreate --no-deps app 2>&1 | tail -3")
time.sleep(8)

print("\n=== B: SPA routes ===")
for path in ["/", "/radar", "/signals", "/dossiers", "/dossiers/pl"]:
    try:
        r = urllib.request.urlopen(f"https://decel.cassinai.tech{path}", timeout=10)
        print(f"  {r.status}  {path}")
    except Exception as e:
        print(f"  ERR  {path}  {e}")

print("\n=== C: end-to-end radar/save test ===")
login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/auth/login",
    data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
    headers={"Content-Type": "application/json"}), timeout=15).read())
token = login["token"]
H = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}

# Save a Poland radar finding
print("\n  C1: save Poland radar finding (real flow, no mock)")
r = urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/radar/save",
    data=json.dumps({
        "country": "Poland",
        "summary": "PKP PLK Idzikowice hump yard modernization — Q4 2026 tender expected per Cassin's v1.6 brief §3.",
        "url": "https://www.plk-sa.pl/o-spolce/biuro-prasowe/informacje-prasowe/szczegoly/po-nowych-torach-na-cmk-zmienia-sie-stacja-idzikowice-4308",
        "tier": "A",
        "yards": ["Idzikowice", "Karsznice", "Łódź Olechów"],
        "operator": "PKP PLK",
    }).encode(),
    headers=H,
), timeout=15)
data = json.loads(r.read().decode())
print(f"    status: {r.status}")
print(f"    signal_id: {data['signal_id']}")
print(f"    play_id: {data['play_id']}")
print(f"    market_id: {data['market_id']}")
print(f"    dossier_url: {data['dossier_url']}")

# Verify signal + play exist
print("\n  C2: verify the signal landed in the DB")
sig_id = data["signal_id"]
sig = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://decel.cassinai.tech/api/v1/signals/{sig_id}", headers=H), timeout=10).read())
print(f"    signal title: {sig['title']}")
print(f"    signal status: {sig['status']}")
print(f"    signal market: {sig.get('market_id')}")
print(f"    signal promoted_to_play: {sig.get('promoted_to_play_id')}")

print("\n  C3: verify the play is in PL's dossier")
ds = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/dossiers/pl", headers=H), timeout=10).read())
play = next((p for p in ds.get("plays", []) if p["id"] == data["play_id"]), None)
print(f"    play in dossier plays[]: {play is not None}")
if play:
    print(f"    play action: {play['action']}")
    print(f"    play status: {play['status']}")
    print(f"    play origin: {play['origin']}")

# Save a non-portfolio country (should land with null market_id)
print("\n  C4: save India (no portfolio market — should land in radar queue, no dossier)")
r = urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/radar/save",
    data=json.dumps({
        "country": "India",
        "summary": "Indian Railways MoR — active tenders for hump yard modernization across multiple zones.",
        "url": "https://www.tendershark.com/details/haryana-tender/ministry-of-railways/",
        "tier": "B",
        "yards": ["Mughal Sarai", "Asansol"],
        "operator": "Indian Railways",
    }).encode(),
    headers=H,
), timeout=15)
data2 = json.loads(r.read().decode())
print(f"    status: {r.status}, market_id: {data2['market_id']}, dossier_url: {data2['dossier_url']}")

print("\n=== D: eval gate ===")
run("cd /opt/decel && DATABASE_URL='postgres://decel:DECEL-PROD-CHANGEME-2026-Sep@localhost:55432/decel' pnpm run eval 2>&1 | tail -10")
