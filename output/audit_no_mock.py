"""Audit the live DB + offline bundle for any pre-existing mock/demo/test data."""
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
    if out: print(out.rstrip()[:5000])
    if err: print("[stderr-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20,
                   allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)
    print("connected")

    # 1. Search the live DB for any "demo", "mock", "test", "placeholder" text
    print("\n=== A: search live DB for mock/demo/test text ===")
    sql = r"""
    SELECT 'markets' AS table_name, id, verdict->>'value' AS value
      FROM markets WHERE verdict->>'value' ~* 'demo|mock|test data|placeholder'
    UNION ALL
    SELECT 'orgs', id, name FROM orgs WHERE name ~* 'demo|mock|test|placeholder'
    UNION ALL
    SELECT 'battle_cards', org_id, who_they_are FROM battle_cards
      WHERE who_they_are ~* 'demo|mock|placeholder|^test '
      OR why_matters ~* 'demo|mock|placeholder'
      OR trap_to_avoid ~* 'demo|mock|placeholder'
    UNION ALL
    SELECT 'signals', id, title FROM signals
      WHERE title ~* 'demo|mock|placeholder' OR summary->>'value' ~* 'demo|mock|placeholder'
    UNION ALL
    SELECT 'review_queue', id, raw_snippet FROM review_queue
      WHERE raw_snippet ~* 'demo|mock|placeholder'
    ORDER BY table_name, id;
    """
    run(client, f"docker exec decel-db psql -U decel -d decel -c \"{sql}\" 2>&1 | head -20")

    # 2. Check the review_queue for the TEST_FP2 items I added during smoke tests
    print("\n=== B: review queue — any TEST_FP2 leftover? ===")
    run(client, "docker exec decel-db psql -U decel -d decel -c \"SELECT id, raw_snippet FROM review_queue WHERE raw_snippet LIKE '%TEST_FP2%' OR raw_snippet LIKE '%FP2 smoke%' OR raw_snippet LIKE '%Seeßle%'\" 2>&1 | head -20")

    # 3. Check the signals for any 'DEMO' markers (the radar-fetch I removed had DEMO seed)
    print("\n=== C: signals — any DEMO in notes? ===")
    run(client, "docker exec decel-db psql -U decel -d decel -c \"SELECT count(*) AS total, count(*) FILTER (WHERE notes LIKE '%DEMO%') AS demo_count FROM signals\" 2>&1")

    # 4. Offline bundle content — check for any cached page that says "demo"
    print("\n=== D: offline bundle — any 'demo' or 'mock' content? ===")
    run(client, "grep -liE 'demo|mock|placeholder' /opt/decel/dist/offline/*.html 2>&1 | head -5")
    run(client, "grep -E 'demo|mock|placeholder' /opt/decel/dist/offline/*.html 2>&1 | head -10")
    run(client, "grep -liE 'demo|mock|placeholder' /opt/decel/dist/offline/snapshots/*.html 2>&1 | head -5; echo 'snapshot count:'; ls /opt/decel/dist/offline/snapshots/ | wc -l")

    # 5. Final state — counts
    print("\n=== E: live DB counts ===")
    run(client, "docker exec decel-db psql -U decel -d decel -c \"SELECT 'markets' AS t, count(*) FROM markets UNION ALL SELECT 'orgs', count(*) FROM orgs UNION ALL SELECT 'battle_cards', count(*) FROM battle_cards UNION ALL SELECT 'signals', count(*) FROM signals UNION ALL SELECT 'review_queue', count(*) FROM review_queue ORDER BY t\" 2>&1")


if __name__ == "__main__":
    main()
