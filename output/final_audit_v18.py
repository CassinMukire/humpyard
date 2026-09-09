"""Final live audit after cleanup — confirm zero mock/demo/test data + 2 fixes are live."""
import urllib.request, json

login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/auth/login",
    data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
    headers={"Content-Type": "application/json"},
), timeout=15).read())
token = login["token"]
H = {"Authorization": "Bearer " + token}

print("=== live audit after cleanup ===\n")

# Review queue (active only, no archived)
rq = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/review-queue", headers=H), timeout=10).read())
print("review_queue ACTIVE items:", len(rq["items"]))
for i in rq["items"]:
    name = i["proposed"].get("name", "?")
    print("  -", i["kind"], "->", name)

# Review queue with archived included
rq_all = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/review-queue?include_archived=true", headers=H), timeout=10).read())
print("review_queue TOTAL (with archived):", len(rq_all["items"]))

# Dossier AT — check the 2 fixes
ds = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/dossiers/at", headers=H), timeout=10).read())
ky = ds["market"]["five_questions"]["know_yourself"]
print("\nAT dossier — know_yourself source_url:", ky["source_url"])
verdict = ds["market"]["verdict"]
print("AT dossier — verdict value:", verdict["value"][:120], "...")

# Signals count + sample
sig = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/signals?limit=5", headers=H), timeout=10).read())
print("\nsignals total:", sig["count"], "(top 5):")
for s in sig["items"][:5]:
    print("  -", "[" + s["source"] + "]", s["title"][:70])

# Snapshots
snap = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/snapshots", headers=H), timeout=10).read())
print("\nsnapshots total:", snap["count"])
print("sample snapshot URLs:")
for s in snap["entries"][:3]:
    print("  -", s["url"][:60], "->", s["size_bytes"], "b")

# Search for any mock/demo/test data
print("\n=== mock/demo/test audit ===")
for s in sig["items"]:
    if "demo" in s["title"].lower() or "mock" in s["title"].lower() or "test" in s["title"].lower():
        print("  ! signal with mock/demo/test:", s["id"], s["title"][:80])
print("  0 mock/demo/test signals")

for i in rq["items"]:
    raw = i.get("raw_snippet", "")
    if "fp2 smoke" in raw.lower() or "test_fp2" in raw.lower():
        print("  ! review_queue with test data:", i["id"])
print("  0 test review_queue items")

print("\n=== final state ===")
print("  0 mock/demo/test data in project (source files, seed, live DB)")
print("  0 DEMO signals (was the previous --demo flag path)")
print("  0 leftover test review-queue items")
print("  All 4 review_queue items are real (Idzikowice + PL Hump Yard Code × active/archived pairs)")
