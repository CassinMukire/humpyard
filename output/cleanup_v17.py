"""Cleanup: identify why snapshots match 'demo', then delete the 3 test review-queue items."""
import paramiko
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20, allow_agent=False, look_for_keys=False)


def run(cmd):
    print("\n$ " + cmd[:200])
    sin, so, se = client.exec_command(cmd, timeout=60)
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    code = so.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[err-" + str(code) + "] " + err.rstrip()[:500])
    return out


# Check why the snapshots match 'demo'
print("\n=== A: per-snapshot 'demo' context ===")
out = run("for f in /opt/decel/dist/offline/snapshots/*.html; do n=$(grep -oE 'demo[a-zA-Z]{0,15}' $f | wc -l); echo \"$(basename $f .html | head -c 12): $n matches: $(grep -oE 'demo[a-zA-Z]{0,15}' $f | sort -u | head -3 | tr '\\n' ' ')\"; done | head -20")
print("\n=== B: delete 3 Seeßle test review_queue items ===")
out = run("""docker exec decel-db psql -U decel -d decel -c "DELETE FROM review_queue WHERE raw_snippet LIKE '%FP2 smoke%' OR raw_snippet LIKE '%TEST_FP2%' RETURNING id, raw_snippet" 2>&1 | head -10""")

print("\n=== C: verify review_queue count ===")
out = run("""docker exec decel-db psql -U decel -d decel -c "SELECT count(*) AS review_queue_count, count(*) FILTER (WHERE raw_snippet LIKE '%FP2%' OR raw_snippet LIKE '%TEST_%') AS leftover_test_count FROM review_queue" 2>&1""")

print("\n=== D: final audit (no mock/demo/test data anywhere) ===")
out = run("""docker exec decel-db psql -U decel -d decel -c "SELECT 'markets' AS t, count(*) FROM markets UNION ALL SELECT 'orgs', count(*) FROM orgs UNION ALL SELECT 'battle_cards', count(*) FROM battle_cards UNION ALL SELECT 'signals', count(*) FROM signals UNION ALL SELECT 'review_queue', count(*) FROM review_queue ORDER BY t" 2>&1""")
