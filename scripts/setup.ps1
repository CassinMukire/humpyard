# =============================================================================
# setup.ps1 — PowerShell bootstrap for the DECEL Intelligence Platform
# Run from the repo root:  .\scripts\setup.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== DECEL Intelligence Platform — setup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check pnpm
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Write-Host "pnpm not found. Install it: npm i -g pnpm" -ForegroundColor Red
  exit 1
}
Write-Host "[1/6] pnpm found: $($pnpm.Source)" -ForegroundColor Green

# 2. .env file
$envPath = Join-Path (Get-Location) ".env"
$envExamplePath = Join-Path (Get-Location) ".env.example"
if (-not (Test-Path $envPath)) {
  Copy-Item $envExamplePath $envPath
  Write-Host "[2/6] Created .env from .env.example. Edit it with your credentials." -ForegroundColor Green
} else {
  Write-Host "[2/6] .env already exists — leaving it alone." -ForegroundColor Yellow
}

# 3. Install deps
Write-Host "[3/6] Installing dependencies (this may take a few minutes)..." -ForegroundColor Cyan
pnpm install --ignore-scripts
if ($LASTEXITCODE -ne 0) {
  Write-Host "pnpm install failed." -ForegroundColor Red
  exit 1
}
Write-Host "      dependencies installed." -ForegroundColor Green

# 4. Offer to generate a password hash
Write-Host ""
$generateHash = Read-Host "[4/6] Generate a password hash now? (y/N)"
if ($generateHash -eq "y" -or $generateHash -eq "Y") {
  $plain = Read-Host "      Enter the password you want to hash" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($plain)
  $plainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

  $hash = node ".\node_modules\.pnpm\tsx@4.21.0\node_modules\tsx\dist\cli.mjs" "scripts\hash-password.ts" "$plainText" 2>$null
  Write-Host ""
  Write-Host "      Generated hash:" -ForegroundColor Green
  Write-Host "      $hash"
  Write-Host ""
  Write-Host "      Paste this into .env as AUTH_PASS_HASH=..." -ForegroundColor Yellow
  Write-Host "      (or run again if you want to copy it now)" -ForegroundColor Yellow
} else {
  Write-Host "[4/6] Skipped hash generation. You can run later:" -ForegroundColor Yellow
  Write-Host "      pnpm --filter @workspace/api-server run hash-password 'your-plain-password'" -ForegroundColor Yellow
}

# 5. Optional: docker compose up hint
Write-Host ""
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Write-Host "[5/6] Docker found. Once .env is filled in, run:" -ForegroundColor Green
  Write-Host "      docker compose up   (or: docker-compose up)" -ForegroundColor Cyan
} else {
  Write-Host "[5/6] Docker not found. To run without Docker:" -ForegroundColor Yellow
  Write-Host "      - Start a local Postgres (any way you like)" -ForegroundColor Yellow
  Write-Host "      - Set DATABASE_URL in .env" -ForegroundColor Yellow
  Write-Host "      - pnpm --filter @workspace/db run push" -ForegroundColor Yellow
  Write-Host "      - pnpm --filter @workspace/api-server run dev" -ForegroundColor Yellow
  Write-Host "      - pnpm --filter @workspace/hump-yard-intel run dev" -ForegroundColor Yellow
}

# 6. Run the eval gate
Write-Host ""
$runEval = Read-Host "[6/6] Run the eval gate now? (y/N)"
if ($runEval -eq "y" -or $runEval -eq "Y") {
  Write-Host "      Running eval gate..." -ForegroundColor Cyan
  node ".\node_modules\.pnpm\tsx@4.21.0\node_modules\tsx\dist\cli.mjs" "scripts\eval-gate.ts"
} else {
  Write-Host "      Skipped. Run later with:" -ForegroundColor Yellow
  Write-Host "      node .\node_modules\.pnpm\tsx@4.21.0\node_modules\tsx\dist\cli.mjs scripts\eval-gate.ts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== setup done ===" -ForegroundColor Cyan
Write-Host "Next: fill in .env with your real credentials, then docker compose up." -ForegroundColor Yellow
Write-Host ""
