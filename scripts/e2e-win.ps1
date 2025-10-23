Param(
  [switch]$Build,
  [switch]$Debug
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
  Write-Warn "cargo not found. Attempting to install Rust toolchain via rustup (non-interactive)."
  try {
    $tmp = Join-Path $env:TEMP "rustup-init.exe"
    Write-Info "Downloading rustup-init.exe"
    Invoke-WebRequest -UseBasicParsing -Uri "https://win.rustup.rs" -OutFile $tmp
    Write-Info "Running rustup-init.exe -y"
    & $tmp -y | Out-Host
    # Update PATH for current session
    $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
    if (-not ($env:PATH -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ieq $cargoBin })) {
      $env:PATH = "$cargoBin;" + $env:PATH
    }
  } catch {
    Write-Err "Automatic Rust installation failed: $($_.Exception.Message). Please install from https://rustup.rs and ensure 'cargo' is on PATH."
  }
}
# Verify cargo now
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Err "cargo still not available after attempted install. Please install Rust from https://rustup.rs and re-run."
  exit 1
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
    Write-Info "node_modules present — running npm install"
    npm install --no-audit --no-fund | Out-Host
  } else {
    Write-Info "node_modules missing — running npm ci"
    npm ci --no-audit --no-fund | Out-Host
  }
} finally {
  Pop-Location
}

# 3) Validate WebdriverIO CLI is available (fail fast)
Write-Info "Validating WebdriverIO CLI (wdio)"
Push-Location "$RepoRoot\client"
try {
  # Use npx to ensure local @wdio/cli is used
  npx wdio --version | Out-Host
  $wdioOk = ($LASTEXITCODE -eq 0)
  if (-not $wdioOk) {
    Write-Err "'wdio' CLI not found or not runnable. Ensure dev dependency @wdio/cli is installed."
    Write-Info "Attempting to verify installation by reinstalling dev dependencies (npm install)"
    npm install --no-audit --no-fund | Out-Host
    npx wdio --version | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Err "WebdriverIO CLI still not available. Try manually: cd client; npm install; npx wdio --version."
      exit 1
    }
  }
} finally {
  Pop-Location
}

# 4) Ensure tauri-driver
$DriverPort = 4551
$driverCmd = "tauri-driver"
$driverAvailable = $null -ne (Get-Command $driverCmd -ErrorAction SilentlyContinue)
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
# Ensure native WebDriver is available (msedgedriver) and pass it explicitly to tauri-driver
$nativeDriver = $null
$edgeDriverCmd = Get-Command msedgedriver -ErrorAction SilentlyContinue
if ($edgeDriverCmd) {
  $nativeDriver = $edgeDriverCmd.Source
} else {
  # Try using npm-provided msedgedriver from client devDependencies
  $npmEdgeDriver = Join-Path "$RepoRoot\client\node_modules\msedgedriver\bin" "msedgedriver.exe"
  if (Test-Path $npmEdgeDriver) {
    $nativeDriver = $npmEdgeDriver
  } else {
    # Attempt direct download of a known-good Edge WebDriver build (win64)
    $edgeZipUrl = "https://msedgedriver.microsoft.com/141.0.3537.92/edgedriver_win64.zip"
    $tempDir = Join-Path $env:TEMP "msedgedriver_manual_141_0_3537_92"
    try {
      if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }
      $zipPath = Join-Path $tempDir "edgedriver_win64.zip"
      Write-Info "Downloading msedgedriver from $edgeZipUrl"
      Invoke-WebRequest -UseBasicParsing -Uri $edgeZipUrl -OutFile $zipPath
      Write-Info "Extracting $zipPath"
      Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
      # Locate msedgedriver.exe in extracted content
      $downloadedDriver = Join-Path $tempDir "msedgedriver.exe"
      if (-not (Test-Path $downloadedDriver)) {
        $found = Get-ChildItem -Path $tempDir -Recurse -Filter "msedgedriver.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $downloadedDriver = $found.FullName }
      }
      if (Test-Path $downloadedDriver) {
        $nativeDriver = $downloadedDriver
        Write-Info "Using downloaded msedgedriver at $nativeDriver"
      } else {
        Write-Warn "Direct download did not produce msedgedriver.exe. Falling back to npm installation."
      }
    } catch {
      Write-Warn ("Direct download of msedgedriver failed: " + $_.Exception.Message + ". Falling back to npm installation.")
    }

    if (-not $nativeDriver) {
      Write-Info "msedgedriver not found on PATH. Installing npm devDependency 'msedgedriver' to provision it."
      Push-Location "$RepoRoot\client"
      try {
        npm install --no-audit --no-fund -D msedgedriver | Out-Host
      } finally { Pop-Location }
      if (Test-Path $npmEdgeDriver) { $nativeDriver = $npmEdgeDriver }
    }
  }
}
if (-not $nativeDriver) {
  Write-Err "Unable to locate msedgedriver.exe. Please install Microsoft Edge WebDriver and ensure it's on PATH, or rerun to let npm install it."
  exit 1
}

Write-Info "Starting tauri-driver on port $DriverPort"
$env:TAURI_DRIVER_PORT = "$DriverPort"
$driverArgs = "--port $DriverPort --native-driver `"$nativeDriver`""
$driverProcess = Start-Process -FilePath $driverCmd -ArgumentList $driverArgs -PassThru -WindowStyle Hidden
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
    # Default to using a built binary on Windows to satisfy WebView2 requirements
    $appPath = Join-Path "$RepoRoot\client\src-tauri\target\debug" "client.exe"
    if (-not (Test-Path $appPath)) {
      Write-Info "Tauri debug binary not found. Building (debug) now so APP_PATH is available."
      Push-Location "$RepoRoot\client"
      try {
        npx tauri build --debug | Out-Host
      } finally { Pop-Location }
    }
    if (-not (Test-Path $appPath)) {
      Write-Err "Built app not found at $appPath after build"
      throw "APP_PATH missing"
    }
    $env:APP_PATH = $appPath
    Remove-Item Env:TAURI_RUNNER -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_RUNNER_ARGS -ErrorAction SilentlyContinue
    Write-Info "Using APP_PATH=$appPath"
  }

  # 6) Run the E2E tests
  Push-Location "$RepoRoot\client"
  try {
    if ($Debug.IsPresent) { Write-Info "Running WebdriverIO E2E (debug mode)" } else { Write-Info "Running WebdriverIO E2E" }
    if ($Debug.IsPresent) {
      npm run e2e:debug | Out-Host
    } else {
      npm run e2e | Out-Host
    }
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
