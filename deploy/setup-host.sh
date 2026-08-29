#!/usr/bin/env bash
# =============================================================================
# setup-host.sh — first-boot setup for a fresh Hetzner CX22 (Ubuntu 24.04)
#
# What it does:
#   1. apt update + upgrade
#   2. Install Docker Engine + Compose plugin
#   3. Install Caddy (for HTTPS)
#   4. Create a non-root `decel` user (with sudo, in docker group)
#   5. Open ports 22, 80, 443 in ufw
#   6. Hardens sshd (disable root password login, keep key auth)
#
# Run as root ONCE on a fresh CX22.
# After this, copy the project, set up .env, and run deploy.sh as `decel`.
# =============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root (e.g. sudo bash setup-host.sh)" >&2
  exit 1
fi

set -x

# 1. Update + upgrade
apt update
apt -y upgrade
apt -y install ca-certificates curl gnupg ufw

# 2. Docker Engine (per official docs, not the snap)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# 3. Caddy (HTTPS reverse proxy + Let's Encrypt)
apt -y install caddy
systemctl enable caddy

# 4. decel user (no password — SSH key only)
id decel || useradd -m -s /bin/bash -G sudo,docker decel
passwd -d decel

# 5. ufw — only 22, 80, 443 are public
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (Caddy → 301 to HTTPS)
ufw allow 443/tcp  # HTTPS
# 5000 is loopback-only (Caddy talks to the app on 127.0.0.1:5000)
ufw --force enable

# 6. sshd hardening
SSHD=/etc/ssh/sshd_config
cp "$SSHD" "$SSHD.bak.$(date +%s)"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD"
systemctl reload ssh

set +x
cat <<EOF

============================================================
 Host ready.
  - decel user:    log in as 'decel' with your SSH key
  - docker:        systemctl status docker
  - caddy:         systemctl status caddy
  - ufw:           ufw status verbose

 Next steps:
  1. From your laptop, copy the project:
       rsync -avz --exclude 'node_modules' --exclude 'dist' \\
         ./ decel@THIS_HOST:~/decel/
  2. SSH in as decel:  ssh decel@THIS_HOST
  3. cd decel && bash deploy/deploy.sh
============================================================
EOF
