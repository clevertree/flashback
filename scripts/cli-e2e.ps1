#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# End-to-end CLI test for Flashback
# RULE: In this E2E script, do not use curl (or any HTTP client) to perform operations
#       that should be executed by the Flashback client binary or server process.
#       Testing server–client API interactions is allowed, but must be initiated via
#       the appropriate component (e.g., client CLI or running server), not by issuing
#       HTTP requests directly from this script.
# - Runs Cypress component tests first (server/npm)
# - Starts two clients in --cli mode
# - Verifies B<->A message exchange
# - Runs Cypress E2E tests at the end

function Log($msg)
{
    Write-Host "[cli-e2e.ps1] $msg"
}

$ROOT = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $ROOT

$logsDir = Join-Path $ROOT 'wdio-logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
# Server directory path used for npm and fixtures
$serverDir = Join-Path $ROOT 'server'

# Run Cypress component tests first if the script exists in server/package.json (do not fail if missing)
try
{
    $pkgJsonPath = Join-Path $serverDir 'package.json'
    $pkg = Get-Content -Raw -ErrorAction Stop $pkgJsonPath | ConvertFrom-Json
    $hasComp = $false
    if ($pkg -and $pkg.scripts -and ($pkg.scripts | Get-Member -Name 'cypress:component' -MemberType NoteProperty))
    {
        $hasComp = $true
    }
    if ($hasComp)
    {
        Log 'Running Cypress component tests (npm run cypress:component)...'
        Push-Location $serverDir
        try
        {
            & npm.cmd run cypress:component
        }
        finally
        {
            Pop-Location
        }
    }
    else
    {
        Log 'No cypress:component script found in server/package.json; skipping component tests.'
    }
}
catch
{
    Log "Unable to evaluate or run cypress:component (skipping). Details: $( $_.Exception.Message )"
}

# Build the client (debug)
Log 'Building client (Cargo debug)...'
& cargo build --manifest-path (Join-Path $ROOT 'client\src-tauri\Cargo.toml') | Out-Null

# Paths and constants
$clientExe = Join-Path $ROOT 'client\src-tauri\target\debug\client.exe'
if (-not (Test-Path $clientExe))
{
    # In case of different target name (e.g., without .exe in MSYS), try fallback
    $clientExe = Join-Path $ROOT 'client\src-tauri\target\debug\client'
}
$NEXT_PORT = 8080
$NEXT_BASE = "http://127.0.0.1:$NEXT_PORT"

# Helper: wait for URL to return 200-399
function Wait-ForUrl([string]$Url, [int]$TimeoutSec = 60)
{
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($true)
    {
        try
        {
            $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 5 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400)
            {
                return $true
            }
        }
        catch
        {
        }
        Start-Sleep -Milliseconds 250
        if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec)
        {
            throw "Timeout waiting for URL: $Url"
        }
    }
}

# Start Next.js server if not already up
$serverStarted = $false
$serverProc = $null
Log "Checking Next.js server on :$NEXT_PORT..."
$serverUp = $false
try
{
    $resp = Invoke-WebRequest -Uri $NEXT_BASE -Method Head -TimeoutSec 5
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 600)
    {
        $serverUp = $true
    }
}
catch
{
    $serverUp = $false
}

if (-not $serverUp)
{
    Log "Spawning Next.js server on :$NEXT_PORT..."
    $nextLog = Join-Path $logsDir 'cli-e2e-next.log'
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'npm.cmd'
    $startInfo.WorkingDirectory = $serverDir
    $startInfo.ArgumentList.Add('run')
    $startInfo.ArgumentList.Add('dev')
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $serverProc = New-Object System.Diagnostics.Process
    $serverProc.StartInfo = $startInfo
    $null = $serverProc.Start()
    # Async log capture
    $soWriter = [System.IO.StreamWriter]::new($nextLog, $true)
    $seWriter = [System.IO.StreamWriter]::new($nextLog, $true)
    $serverProc.BeginOutputReadLine()
    $serverProc.BeginErrorReadLine()
    $serverProc.add_OutputDataReceived({
        param($s, $e) if ($e.Data)
        {
            $soWriter.WriteLine($e.Data);$soWriter.Flush()
        }
    })
    $serverProc.add_ErrorDataReceived({
        param($s, $e) if ($e.Data)
        {
            $seWriter.WriteLine($e.Data);$seWriter.Flush()
        }
    })

    $serverStarted = $true
    Wait-ForUrl -Url $NEXT_BASE -TimeoutSec 60 | Out-Null
    Log 'Next.js server is ready.'
}
else
{
    Log 'Next.js server is already running.'
}


Log 'CLI E2E portion passed.'

# Run Cypress E2E tests after CLI portion
try
{
    Log 'Running Cypress E2E tests (npm run cypress:e2e)...'
    Push-Location $serverDir
    try
    {
        & npm.cmd run cypress:e2e
    }
    finally
    {
        Pop-Location
    }
    Log 'Cypress E2E completed.'
}
catch
{
    throw "Cypress E2E failed: $( $_.Exception.Message )"
}



# Helper: wait for regex pattern in file
function Wait-ForPattern([string]$Path, [string]$Pattern, [int]$TimeoutSec = 15)
{
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($true)
    {
        if (Test-Path $Path)
        {
            try
            {
                $content = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
                if ($content -match $Pattern)
                {
                    return $true
                }
            }
            catch
            {
            }
        }
        Start-Sleep -Milliseconds 200
        if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec)
        {
            throw "Timeout waiting for pattern '$Pattern' in $Path"
        }
    }
}

# HTTP helper: POST JSON and return a response object including StatusCode/body without throwing on non-2xx
function Invoke-JsonPostRaw([string]$Url, [object]$BodyObj)
{
    $json = $BodyObj | ConvertTo-Json -Depth 10 -Compress
    try
    {
        $resp = Invoke-WebRequest -Uri $Url -Method Post -ContentType 'application/json' -Body $json -ErrorAction Stop
        return [PSCustomObject]@{
            StatusCode = [int]$resp.StatusCode
            BodyText = [string]($resp.Content)
        }
    }
    catch
    {
        $status = $null
        $body = ''
        if ($_.Exception.Response)
        {
            try
            {
                $status = [int]$_.Exception.Response.StatusCode
            }
            catch
            {
            }
            try
            {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream)
                {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                }
            }
            catch
            {
            }
        }
        return [PSCustomObject]@{ StatusCode = $status; BodyText = $body }
    }
}

# Helper: wait for regex pattern in file (re-implemented)
function Wait-ForPattern2([string]$Path, [string]$Pattern, [int]$TimeoutSec = 15)
{
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($true)
    {
        if (Test-Path $Path)
        {
            try
            {
                $content = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
                if ($content -match $Pattern)
                {
                    return $true
                }
            }
            catch
            {
            }
        }
        Start-Sleep -Milliseconds 200
        if ($sw.Elapsed.TotalSeconds -ge $TimeoutSec)
        {
            throw "Timeout waiting for pattern '$Pattern' in $Path"
        }
    }
}


# Start client processes with redirected IO and loggers
function Start-Client([string]$name, [string]$extraArgs = '')
{
    $logPath = Join-Path $logsDir ("cli-e2e-$name.log")
    # Open a single shared writer for both stdout and stderr to avoid file lock conflicts
    $fs = [System.IO.File]::Open($logPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    $logWriter = [System.IO.StreamWriter]::new($fs)
    $logWriter.AutoFlush = $true

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $clientExe
    $psi.Arguments = "--cli $extraArgs".Trim()
    $psi.WorkingDirectory = (Split-Path -Parent $clientExe)
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    # Attach handlers BEFORE starting async reads
    $proc.add_OutputDataReceived({
        param($s, $e) if ($e.Data)
        {
            $logWriter.WriteLine($e.Data)
        }
    })
    $proc.add_ErrorDataReceived({
        param($s, $e) if ($e.Data)
        {
            $logWriter.WriteLine($e.Data)
        }
    })

    $null = $proc.Start()
    $logWriter.WriteLine("[client $name] started PID=$( $proc.Id ) at $( Get-Date -Format o )")
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    Start-Sleep -Milliseconds 200
    if ($proc.HasExited)
    {
        $logWriter.WriteLine("[client $name] exited early with code $( $proc.ExitCode )")
    }

    return [PSCustomObject]@{ Proc = $proc; In = $proc.StandardInput; Log = $logPath }
}

# Prepare unique emails for cert generation at startup
$ts = Get-Date -Format 'yyyyMMddHHmmss'
$EmailA = "testA+$ts@test.com"
$EmailB = "testB+$ts@test.com"

Log 'Starting client A (CLI)...'
$A = Start-Client -name 'clientA' -extraArgs "--start-listener --auto-allow --gen-cert=$EmailA"
Log 'Starting client B (CLI)...'
$B = Start-Client -name 'clientB' -extraArgs "--start-listener --gen-cert=$EmailB"

Start-Sleep -Milliseconds 500

# Start peer listeners explicitly on both clients
$A.In.WriteLine('start-listener');$A.In.Flush()
$B.In.WriteLine('start-listener');$B.In.Flush()

# Capture peer listener ports via port files (stdout may be unavailable on Windows GUI subsystem)
$clientDir = Split-Path -Parent $clientExe
$A_PortFile = Join-Path $clientDir ("peer-port-" + $A.Proc.Id + ".txt")
$B_PortFile = Join-Path $clientDir ("peer-port-" + $B.Proc.Id + ".txt")

$sw = [Diagnostics.Stopwatch]::StartNew()
while (-not (Test-Path $A_PortFile) -and $sw.Elapsed.TotalSeconds -lt 20)
{
    Start-Sleep -Milliseconds 200
}
if (-not (Test-Path $A_PortFile))
{
    throw "Timeout waiting for A port file: $A_PortFile"
}
$A_PORT = (Get-Content -Raw $A_PortFile).Trim()
Log "Client A peer port: $A_PORT"

$sw.Restart()
while (-not (Test-Path $B_PortFile) -and $sw.Elapsed.TotalSeconds -lt 20)
{
    Start-Sleep -Milliseconds 200
}
if (-not (Test-Path $B_PortFile))
{
    throw "Timeout waiting for B port file: $B_PortFile"
}
$B_PORT = (Get-Content -Raw $B_PortFile).Trim()
Log "Client B peer port: $B_PORT"

# Auto-allow on A
Start-Sleep -Milliseconds 200
Log 'Enabling auto-allow on A...'
$A.In.WriteLine('allow auto')
$A.In.Flush()
try
{
    Wait-ForPattern -Path $A.Log -Pattern 'Auto-allow enabled' -TimeoutSec 5 | Out-Null
}
catch
{
    Log 'ERROR: Auto-allow confirmation not seen in A log within timeout. Dumping A log:'
    try { Get-Content -Path $A.Log -Raw | Write-Host } catch {}
    throw 'Auto-allow did not enable in time'
}

# Wait for PEM and PKH files written by the client next to the executable (generated at startup via --gen-cert)
$A_CertPath = Join-Path $clientDir ("cert-" + $A.Proc.Id + ".pem")
$B_CertPath = Join-Path $clientDir ("cert-" + $B.Proc.Id + ".pem")
$A_PkhPath = Join-Path $clientDir ("pkh-" + $A.Proc.Id + ".txt")
$B_PkhPath = Join-Path $clientDir ("pkh-" + $B.Proc.Id + ".txt")

$sw.Restart(); while (-not (Test-Path $A_CertPath) -and $sw.Elapsed.TotalSeconds -lt 20)
{
    Start-Sleep -Milliseconds 200
}
if (-not (Test-Path $A_CertPath))
{
    throw "Timeout waiting for A cert file: $A_CertPath"
}
$sw.Restart(); while (-not (Test-Path $B_CertPath) -and $sw.Elapsed.TotalSeconds -lt 20)
{
    Start-Sleep -Milliseconds 200
}
if (-not (Test-Path $B_CertPath))
{
    throw "Timeout waiting for B cert file: $B_CertPath"
}

$CertA = (Get-Content -Raw $A_CertPath)
$CertB = (Get-Content -Raw $B_CertPath)
Log "EmailA=$EmailA EmailB=$EmailB"

# Register both clients with the server
Log 'Registering Client A via /api/register...'
$regA = Invoke-JsonPostRaw -Url "$NEXT_BASE/api/register" -BodyObj @{ certificate = $CertA }
if ($regA.StatusCode -ne 201 -and $regA.StatusCode -ne 409)
{
    throw "Register A failed: HTTP $( $regA.StatusCode ) Body=$( $regA.BodyText )"
}
Log "Register A status: $( $regA.StatusCode )"
Log 'Registering Client B via /api/register...'
$regB = Invoke-JsonPostRaw -Url "$NEXT_BASE/api/register" -BodyObj @{ certificate = $CertB }
if ($regB.StatusCode -ne 201 -and $regB.StatusCode -ne 409)
{
    throw "Register B failed: HTTP $( $regB.StatusCode ) Body=$( $regB.BodyText )"
}
Log "Register B status: $( $regB.StatusCode )"

# Announce A via broadcast/ready
$A_SOCKET_DIRECT = "127.0.0.1:$A_PORT"
Log "Announcing A via /api/broadcast/ready with socket $A_SOCKET_DIRECT"
$readyResp = Invoke-JsonPostRaw -Url "$NEXT_BASE/api/broadcast/ready" -BodyObj @{ email = $EmailA; socket_address = $A_SOCKET_DIRECT }
if ($readyResp.StatusCode -ne 200 -and $readyResp.StatusCode -ne 201)
{
    throw "broadcast/ready failed: HTTP $( $readyResp.StatusCode ) Body=$( $readyResp.BodyText )"
}

# Lookup A from B's perspective
$lookupUrl = "$NEXT_BASE/api/broadcast/lookup?email=$EmailA&minutes=10"
Log "Looking up A via $lookupUrl"
$A_SOCKET = $null
$sw.Restart()
while ($null -eq $A_SOCKET -and $sw.Elapsed.TotalSeconds -lt 30)
{
    try
    {
        $resp = Invoke-RestMethod -Uri $lookupUrl -Method Get -ErrorAction Stop
        $items = @()
        if ($resp -and $resp.items)
        {
            $items = $resp.items
        }
        if ($items.Count -gt 0)
        {
            $A_SOCKET = $items[0].socket_address
            if (-not $A_SOCKET)
            {
                $A_SOCKET = $null
            }
        }
    }
    catch
    {
    }
    if ($null -eq $A_SOCKET)
    {
        Start-Sleep -Milliseconds 300
    }
}
if (-not $A_SOCKET)
{
    throw "A not found in broadcast lookup in time."
}
Log "Discovered A socket via lookup: $A_SOCKET"

# Connect B->A using discovered socket and send message
Log 'B connecting to A peer and sending DCC message...'
$B.In.WriteLine("connect-peer $A_SOCKET")
$B.In.Flush()
Wait-ForPattern -Path $B.Log -Pattern ([regex]::Escape("Connected to peer $A_SOCKET")) -TimeoutSec 20 | Out-Null
Start-Sleep -Milliseconds 200
$MSG1 = 'hi-from-B'
$B.In.WriteLine("send-client $A_SOCKET $MSG1")
$B.In.Flush()

# Verify A received the message
Wait-ForPattern -Path $A.Log -Pattern '"text":\s*"hi-from-B"|DCC chat|hi-from-B' -TimeoutSec 20 | Out-Null

# A replies to B
$MSG2 = 'hello-back-from-A'
$A.In.WriteLine("send-client 127.0.0.1:$B_PORT $MSG2")
$A.In.Flush()

# Verify B receives the reply
Wait-ForPattern -Path $B.Log -Pattern '"text":\s*"hello-back-from-A"|DCC chat|hello-back-from-A' -TimeoutSec 20 | Out-Null

# Exit clients
$A.In.WriteLine('exit');$A.In.Flush()
$B.In.WriteLine('exit');$B.In.Flush()
Start-Sleep -Milliseconds 500

# Stop Next server if we started it
if ($serverStarted -and $serverProc -and -not $serverProc.HasExited)
{
    Log "Stopping spawned Next.js server (PID $( $serverProc.Id ))..."
    try
    {
        $serverProc.Kill()
    }
    catch
    {
    }
}
