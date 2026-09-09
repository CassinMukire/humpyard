"""Verify the remaining 4 review queue items are real, not leftover test data."""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20, allow_agent=False, look_for_keys=False)

cmd = """docker exec decel-db psql -U decel -d decel -c "SELECT id, kind, proposed->>'name' AS name, market_id, ts, raw_snippet FROM review_queue ORDER BY ts DESC" 2>&1"""
sin, so, se = client.exec_command(cmd, timeout=30)
print(so.read().decode())
