"""Apply the 2 Cassin fixes to the live DB. Multiple SQL statements because
Postgres doesn't allow multiple assignments to the same column in one UPDATE."""
import paramiko, json, urllib.request, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("72.60.168.63", port=22, username="root", password="#9tqY//Q8IS2Z2N0", timeout=20,
               allow_agent=False, look_for_keys=False, banner_timeout=30, auth_timeout=30)


def run(cmd, t=60):
    sin, so, se = client.exec_command(cmd, timeout=t)
    out = so.read().decode("utf-8", errors="replace")
    err = se.read().decode("utf-8", errors="replace")
    code = so.channel.recv_exit_status()
    if out: print(out.rstrip()[:3000])
    if err: print("[err-" + str(code) + "] " + err.rstrip()[:500])
    return out, err, code


# Pass the SQL via stdin (heredoc) to avoid shell escaping issues
sql = r"""
-- Pass 1: fix decel.com -> decel.se in know_yourself source_url (multiple variants)
UPDATE markets
SET five_questions = jsonb_set(
  five_questions,
  '{know_yourself,source_url}',
  to_jsonb(
    replace(
      replace(
        replace(five_questions->'know_yourself'->>'source_url', 'www.decel.com', 'decel.se'),
        'https://decel.com', 'https://decel.se'
      ),
      'decel.com', 'decel.se'
    )
  )
)
WHERE five_questions->'know_yourself'->>'source_url' LIKE '%decel.com%';

-- Pass 2: fix SWL = Single Wagon Load in every five_questions value + verdict
UPDATE markets
SET verdict = jsonb_set(verdict, '{value}', to_jsonb(replace(verdict->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE verdict->>'value' LIKE '%Sweeper / Wagon Load%';

UPDATE markets
SET five_questions = jsonb_set(five_questions, '{know_yourself,value}', to_jsonb(replace(five_questions->'know_yourself'->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE five_questions->'know_yourself'->>'value' LIKE '%Sweeper / Wagon Load%';

UPDATE markets
SET five_questions = jsonb_set(five_questions, '{know_the_enemy,value}', to_jsonb(replace(five_questions->'know_the_enemy'->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE five_questions->'know_the_enemy'->>'value' LIKE '%Sweeper / Wagon Load%';

UPDATE markets
SET five_questions = jsonb_set(five_questions, '{terrain,value}', to_jsonb(replace(five_questions->'terrain'->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE five_questions->'terrain'->>'value' LIKE '%Sweeper / Wagon Load%';

UPDATE markets
SET five_questions = jsonb_set(five_questions, '{timing,value}', to_jsonb(replace(five_questions->'timing'->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE five_questions->'timing'->>'value' LIKE '%Sweeper / Wagon Load%';

UPDATE markets
SET five_questions = jsonb_set(five_questions, '{win_before_battle,value}', to_jsonb(replace(five_questions->'win_before_battle'->>'value', 'Sweeper / Wagon Load', 'Single Wagon Load')))
WHERE five_questions->'win_before_battle'->>'value' LIKE '%Sweeper / Wagon Load%';
"""

# Write SQL to a temp file on the VPS, then run psql with that file
print("\n=== write SQL to VPS ===")
run("cat > /tmp/fix_corr.sql << 'EOF_SQL'\n" + sql + "\nEOF_SQL")
run("wc -l /tmp/fix_corr.sql")

# Run the SQL file
print("\n=== run psql ===")
out, _, _ = run("docker exec -i decel-db psql -U decel -d decel < /tmp/fix_corr.sql 2>&1 | tail -20")

# Verify via live API
print("\n=== verify live ===")
login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "https://decel.cassinai.tech/api/v1/auth/login",
    data=json.dumps({"username": "cassin", "password": "cassin-demo-2026"}).encode(),
    headers={"Content-Type": "application/json"}), timeout=15).read())
token = login["token"]
H = {"Authorization": "Bearer " + token}

bad_url = 0
bad_swl = 0
for mid in ["pl", "de", "middle-corridor", "fi", "at", "cz", "tr", "it", "no", "hu"]:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"https://decel.cassinai.tech/api/v1/dossiers/{mid}", headers=H), timeout=10).read())
    url = d["market"]["five_questions"]["know_yourself"]["source_url"]
    verdict = d["market"]["verdict"]["value"]
    timing = d["market"]["five_questions"]["timing"]["value"]
    terrain = d["market"]["five_questions"]["terrain"]["value"]
    win = d["market"]["five_questions"]["win_before_battle"]["value"]
    all_text = f"{url} {verdict} {timing} {terrain} {win}"
    if "www.decel.com" in all_text or "https://decel.com" in all_text and "https://decel.se" not in all_text.replace("https://decel.com", "https://decel.se"):
        bad_url += 1
        print(f"  ! {mid}: URL still bad: {url}")
    if "Sweeper" in all_text:
        bad_swl += 1
        print(f"  ! {mid}: SWL still wrong")
    else:
        if "Single Wagon" in all_text or mid in ("pl", "de", "middle-corridor", "fi", "cz", "tr", "it", "no", "hu"):
            # ok either no SWL at all, or fixed
            pass
print(f"\n  BAD URLs: {bad_url}/10  BAD SWL: {bad_swl}/10")
print(f"  AT verdict snippet: {d['market']['verdict']['value'][:120]}")
print(f"  AT know_yourself source_url: {d['market']['five_questions']['know_yourself']['source_url']}")
