"""Dedupe review_queue by archiving older copies of each (kind, name) pair."""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20, allow_agent=False, look_for_keys=False)

# SQL: archive the older copy of each (kind, name) pair
sql = "WITH ranked AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY kind, proposed->>'name' ORDER BY ts DESC) AS rn FROM review_queue) UPDATE review_queue SET archived = true WHERE id IN (SELECT id FROM ranked WHERE rn > 1) RETURNING id, kind, proposed->>'name' AS name;"

# Escape and pass to docker exec
import shlex
quoted_sql = shlex.quote(sql)
cmd = f"docker exec decel-db psql -U decel -d decel -c {quoted_sql}"
print("cmd:", cmd[:200])
sin, so, se = client.exec_command(cmd, timeout=30)
out = so.read().decode()
err = se.read().decode()
print("STDOUT:", out)
print("STDERR:", err)

# Verify
sin, so, se = client.exec_command('docker exec decel-db psql -U decel -d decel -c "SELECT id, kind, archived FROM review_queue ORDER BY ts DESC" 2>&1', timeout=30)
print("\nAfter:")
print(so.read().decode())
