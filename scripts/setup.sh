#!/usr/bin/env bash
# =============================================================================
# setup.sh — bash bootstrap for the DECEL Intelligence Platform
# Run from the repo root:  ./scripts/setup.sh
# =============================================================================

set -euo pipefail

# Colours
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "\n${CYAN}=== DECEL Intelligence Platform — setup ===${NC}\n\n"

# 1. Check pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  printf "${RED}pnpm not found. Install it: npm i -g pnpm${NC}\n"
  exit 1
fi
printf "${GREEN}[1/6] pnpm found: $(command -v pnpm)${NC}\n"

# 2. .env file
if [ ! -f .env ]; then
  cp .env.example .env
  printf "${GREEN}[2/6] Created .env from .env.example. Edit it with your credentials.${NC}\n"
else
  printf "${YELLOW}[2/6] .env already exists — leaving it alone.${NC}\n"
fi

# 3. Install deps
printf "${CYAN}[3/6] Installing dependencies (this may take a few minutes)...${NC}\n"
pnpm install --ignore-scripts
printf "${GREEN}      dependencies installed.${NC}\n"

# 4. Optional password hash
printf "\n"
read -p "[4/6] Generate a password hash now? (y/N) " generateHash
if [ "$generateHash" = "y" ] || [ "$generateHash" = "Y" ]; then
  read -s -p "      Enter the password you want to hash: " plain
  printf "\n"
  hash=$(node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/hash-password.ts "$plain" 2>/dev/null || true)
  printf "\n${GREEN}      Generated hash:${NC}\n      $hash\n\n"
  printf "${YELLOW}      Paste this into .env as AUTH_PASS_HASH=...${NC}\n"
else
  printf "${YELLOW}[4/6] Skipped hash generation. You can run later:${NC}\n"
  printf "${YELLOW}      pnpm --filter @workspace/api-server run hash-password 'your-plain-password'${NC}\n"
fi

# 5. Docker hint
printf "\n"
if command -v docker >/dev/null 2>&1; then
  printf "${GREEN}[5/6] Docker found. Once .env is filled in, run:${NC}\n"
  printf "${CYAN}      docker compose up${NC}\n"
else
  printf "${YELLOW}[5/6] Docker not found. To run without Docker:${NC}\n"
  printf "${YELLOW}      - Start a local Postgres (any way you like)${NC}\n"
  printf "${YELLOW}      - Set DATABASE_URL in .env${NC}\n"
  printf "${YELLOW}      - pnpm --filter @workspace/db run push${NC}\n"
  printf "${YELLOW}      - pnpm --filter @workspace/api-server run dev${NC}\n"
  printf "${YELLOW}      - pnpm --filter @workspace/hump-yard-intel run dev${NC}\n"
fi

# 6. Run the eval gate
printf "\n"
read -p "[6/6] Run the eval gate now? (y/N) " runEval
if [ "$runEval" = "y" ] || [ "$runEval" = "Y" ]; then
  printf "${CYAN}      Running eval gate...${NC}\n"
  node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts
else
  printf "${YELLOW}      Skipped. Run later with:${NC}\n"
  printf "${YELLOW}      node ./node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/eval-gate.ts${NC}\n"
fi

printf "\n${CYAN}=== setup done ===${NC}\n"
printf "${YELLOW}Next: fill in .env with your real credentials, then docker compose up.${NC}\n\n"
