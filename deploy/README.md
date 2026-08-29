# DECEL — Hetzner CX22 deploy runbook

## What's in this folder

| File | What |
|---|---|
| `setup-host.sh` | One-time, run as `root` on a fresh Hetzner CX22 (Ubuntu 24.04). Installs Docker + Caddy, creates the `decel` user, opens ports 22/80/443, hardens sshd. |
| `deploy.sh` | Run as `decel` in `~/decel/`. Builds + starts the Docker stack, waits for healthz, tails the logs. Idempotent. |
| `Caddyfile` | Reverse proxy + Let's Encrypt HTTPS. Drop on the host at `/etc/caddy/Caddyfile`. Replace `decelsun.com` with the real domain. |

## One-time setup on the host

```bash
# 1. From your laptop, SSH in as root with the SSH key Hetzner gave you
ssh root@YOUR_HETZNER_IP

# 2. Add your SSH key for the decel user (so you can log in as decel)
#    (paste the contents of your public key on the next line)
mkdir -p /home/decel/.ssh
echo "ssh-ed25519 AAAA...your-key..." > /home/decel/.ssh/authorized_keys
chmod 700 /home/decel/.ssh && chmod 600 /home/decel/.ssh/authorized_keys
chown -R decel:decel /home/decel/.ssh

# 3. Run the host setup
bash /tmp/setup-host.sh   # or wherever you put it

# 4. Log out, log back in as decel
exit
ssh decel@YOUR_HETZNER_IP
```

## Deploy

```bash
# 5. Clone the project on the host
git clone https://github.com/hitankshah/hump-yard-insight.git ~/decel
#    (or use your fork / git bundle)

cd ~/decel
cp .env.example .env
# Edit .env — paste the real API keys, MONDAY_BOARD_PEOPLE_ID, AUTH_PASS_HASH, etc.
$EDITOR .env

# 6. Run the deploy
bash deploy/deploy.sh
```

## HTTPS

```bash
# 7. Point the domain at the Hetzner IP (A record, decelsun.com → 1.2.3.4)
#    Wait for DNS to propagate.

# 8. Install the Caddyfile
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/decelsun.com/your-real-domain.com/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy auto-issues the Let's Encrypt cert within seconds. Your app is now live on **https://your-real-domain.com**.

## Ongoing updates

When you ship new code, just run `bash deploy/deploy.sh` again. Docker rebuilds only what changed; data in the `decel-db-data` named volume persists.

## Rollback

```bash
# If a deploy breaks, roll back to the previous image
docker compose down
docker compose up -d --build   # rebuilds from the current commit
# Or: git checkout <previous-tag> && bash deploy/deploy.sh
```

## Cost

Hetzner CX22 Frankfurt: €4.85/month. Plus ~€0.50/month for backups. Plus the Postgres volume (~1 GB) — included in the CX22 SSD. Total: under €6/month.
