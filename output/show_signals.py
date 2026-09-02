"""Show signal distribution via direct DB query (no login needed)."""
import paramiko
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HOST = "72.60.168.63"
USER = "root"
PASSWORD = "#9tqY//Q8IS2Z2N0"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20,
               allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)

# Run a direct psql query on the decel-db container
sql = """
SELECT
  source,
  market_id,
  summary->>'confidence' AS confidence,
  count(*) AS n
FROM signals
GROUP BY 1, 2, 3
ORDER BY n DESC;
"""
cmd = f"""docker exec decel-db psql -U decel -d decel -c "{sql}" 2>&1"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
print(stdout.read().decode("utf-8", errors="replace"))

# Also total + sample 5
sql2 = """
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE market_id IS NOT NULL) AS with_market,
  count(*) FILTER (WHERE summary->>'confidence' = 'V') AS v_count,
  count(*) FILTER (WHERE summary->>'confidence' = 'O') AS o_count
FROM signals;
"""
cmd2 = f"""docker exec decel-db psql -U decel -d decel -c "{sql2}" 2>&1"""
print("\n" + stdout.channel.recv_ready.__doc__ or "")
stdin, stdout, stderr = client.exec_command(cmd2, timeout=30)
print(stdout.read().decode("utf-8", errors="replace"))

# 5 most recent
sql3 = """SELECT title, url, market_id, summary->>'confidence' AS conf FROM signals ORDER BY fetched_at DESC LIMIT 5;"""
cmd3 = f"""docker exec decel-db psql -U decel -d decel -c "{sql3}" 2>&1"""
stdin, stdout, stderr = client.exec_command(cmd3, timeout=30)
print("\n=== 5 most recent ===")
print(stdout.read().decode("utf-8", errors="replace"))
