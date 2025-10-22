Param(
  [switch]$Build
)

# Stop on errors
$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Repository root (this script lives in scripts/)
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# 1) Basic checks
Write-Info "Checking prerequisites (Rust/cargo, Node/npm)"
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Warn "cargo not found. Please install Rust toolchain from https://rustup.rs and ensure 'cargo' is on PATH."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Err "node not found. Install Node.js from https://nodejs.org/."
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Err "npm not found. Install Node.js/npm from https://nodejs.org/."
  exit 1
}

# 2) Ensure client deps
Write-Info "Installing client dependencies if needed"
Push-Location "$RepoRoot\client"
try {
  if (Test-Path "node_modules") {
    Write-Info "node_modules present — running npm install (fast)"
    npm install --no-audit --no-fund | Out-Host
  } else {
    Write-Info "node_modules missing — running npm ci"
    npm ci --no-audit --no-fund | Out-Host
  }
} finally {
  Pop-Location
}

# 3) Ensure tauri-driver
$DriverPort = 4551
$driverCmd = "tauri-driver"
$driverAvailable = $true
try {
  & $driverCmd --version | Out-Null
} catch {
  $driverAvailable = $false
}
if (-not $driverAvailable) {
  if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Info "Installing tauri-driver via cargo (cargo install tauri-driver)"
    cargo install tauri-driver
  } else {
    Write-Err "tauri-driver not found and cargo missing. Install tauri-driver manually (https://github.com/tauri-apps/tauri-driver/releases) or install Rust/cargo and rerun."
    exit 1
  }
}

# 4) Start tauri-driver in background
Write-Info "Starting tauri-driver on port $DriverPort"
$env:TAURI_DRIVER_PORT = "$DriverPort"
$driverProcess = Start-Process -FilePath $driverCmd -ArgumentList "--port $DriverPort" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 1

# Ensure we always clean up driver
$script:ExitCode = 0
$cleanup = {
  if ($driverProcess -and -not $driverProcess.HasExited) {
    Write-Info "Stopping tauri-driver (PID=$($driverProcess.Id))"
    try { $driverProcess.Kill() } catch {}
  }
}

try {
  # 5) Decide how to launch app for E2E
  if ($Build.IsPresent) {
    Write-Info "Building Tauri app (debug) for deterministic E2E"
    Push-Location "$RepoRoot\client"
    try {
      # Debug build is faster and binary sits in src-tauri\target\debug
      npx tauri build --debug | Out-Host
    } finally { Pop-Location }

    $appPath = Join-Path "$RepoRoot\client\src-tauri\target\debug" "client.exe"
    if (-not (Test-Path $appPath)) {
      Write-Err "Built app not found at $appPath"
      throw "APP_PATH missing"
    }
    $env:APP_PATH = $appPath
    Remove-Item Env:TAURI_RUNNER -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_RUNNER_ARGS -ErrorAction SilentlyContinue
    Write-Info "Using APP_PATH=$appPath"
  } else {
    # Use runner (tauri dev) by default for speed/convenience
    $env:TAURI_RUNNER = "npm"
    $env:TAURI_RUNNER_ARGS = '["run","tauri:dev"]'
    Remove-Item Env:APP_PATH -ErrorAction SilentlyContinue
    Write-Info "Using runner: TAURI_RUNNER=$env:TAURI_RUNNER TAURI_RUNNER_ARGS=$env:TAURI_RUNNER_ARGS"
  }

  # 6) Run the E2E tests
  Push-Location "$RepoRoot\client"
  try {
    Write-Info "Running WebdriverIO E2E"
    npm run e2e | Out-Host
    if ($LASTEXITCODE -ne 0) { $script:ExitCode = $LASTEXITCODE }
  } finally { Pop-Location }
}
catch {
  Write-Err ("E2E run failed: " + $_.Exception.Message)
  $script:ExitCode = 1
}
finally {
  & $cleanup
}

exit $script:ExitCode
