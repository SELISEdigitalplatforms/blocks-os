param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

# ---- Usage ----
function Show-Usage {
@"
Usage: .\run.ps1 [OPTIONS]

Options:
  -b, --backend        Run .NET API
  -w, --worker         Run .NET Worker
  -a, --all            Build frontend + run API + Worker
  -f, --frontend       Run frontend (npm run dev)

  -n, --npm <args>     Run npm command (client/)
  -d, --dotnet <args>  Run dotnet CLI command

  -k, --kill-port      Kill process on API port
  -h, --help           Show this help

Tests:
  -tf, --test-fe       Frontend unit tests (client/: build + vitest)
  -te, --test-e2e      End-to-end tests (e2e/: playwright)
  -tb, --test-be       Backend unit tests (server/: clean + build + dotnet test)
  -ta, --test-all      Frontend unit + backend unit + e2e

Env:
  SKIP_BUILD=1         Skip the client build step in --test-fe
"@ | Write-Host
}

# ---- Flags ----
$Backend = $false
$Worker = $false
$All = $false
$Frontend = $false
$KillPort = $false
$TestFe = $false
$TestE2e = $false
$TestBe = $false
$Npm = @()
$Dotnet = @()

# ---- Parse args ----
$i = 0
while ($i -lt $CliArgs.Count) {
    switch ($CliArgs[$i]) {

        "-b" { $Backend = $true }
        "--backend" { $Backend = $true }

        "-w" { $Worker = $true }
        "--worker" { $Worker = $true }

        "-a" { $All = $true }
        "--all" { $All = $true }

        "-f" { $Frontend = $true }
        "--frontend" { $Frontend = $true }

        "-k" { $KillPort = $true }
        "--kill-port" { $KillPort = $true }

        "-tf" { $TestFe = $true }
        "--test-fe" { $TestFe = $true }

        "-te" { $TestE2e = $true }
        "--test-e2e" { $TestE2e = $true }

        "-tb" { $TestBe = $true }
        "--test-be" { $TestBe = $true }

        "-ta" { $TestFe = $true; $TestE2e = $true; $TestBe = $true }
        "--test-all" { $TestFe = $true; $TestE2e = $true; $TestBe = $true }

        "-h" { Show-Usage; exit }
        "--help" { Show-Usage; exit }

        "-n" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Npm += $CliArgs[$i]; $i++ }; $i-- }
        "--npm" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Npm += $CliArgs[$i]; $i++ }; $i-- }

        "-d" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Dotnet += $CliArgs[$i]; $i++ }; $i-- }
        "--dotnet" { $i++; while ($i -lt $CliArgs.Count -and $CliArgs[$i] -notmatch "^-") { $Dotnet += $CliArgs[$i]; $i++ }; $i-- }

        default {
            Write-Host "Unknown option: $($CliArgs[$i])"
            Show-Usage
            exit 1
        }
    }
    $i++
}

if (-not ($Backend -or $Worker -or $All -or $Frontend -or $KillPort -or $TestFe -or $TestE2e -or $TestBe -or $Npm.Count -or $Dotnet.Count)) {
    Show-Usage
    exit
}

# ---- Paths ----
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClientDir = Join-Path $ScriptDir "client"
$E2eDir = Join-Path $ScriptDir "e2e"
$Solution = Join-Path $ScriptDir "server/BlocksOS.sln"
$ApiProject = Join-Path $ScriptDir "server/Api/Api.csproj"
$WorkerProject = Join-Path $ScriptDir "server/Worker/Worker.csproj"
$Wwwroot = Join-Path $ScriptDir "server/Api/wwwroot"

$ApiPort = 5000
# Host the local API is reached by. It resolves to 127.0.0.1 via the hosts file and matches the
# dev TLS cert, so it is also the origin the served frontend must call.
$ApiHost = "dev-os.blocksdevelopers.com"

# ---- Helpers ----

function Free-Port {
    $connections = netstat -ano | Select-String ":$ApiPort"
    foreach ($line in $connections) {
        $parts = ($line -split "\s+") | Where-Object { $_ }
        # Not $pid: that is a read-only automatic variable and assigning to it throws.
        $procId = $parts[-1]
        if ($procId -match "^\d+$") {
            Write-Host "Killing PID $procId on port $ApiPort"
            taskkill /PID $procId /F | Out-Null
        }
    }
}

# HTTPS is driven by the machine env vars OS_SSL_CERT / OS_SSL_KEY (the same pair
# vite.config.ts reads for the dev server).
# Both set + both files present -> HTTPS on $ApiPort; otherwise -> HTTP (fallback).
function Configure-BackendTls {
    if ($env:OS_SSL_CERT -and $env:OS_SSL_KEY -and
        (Test-Path $env:OS_SSL_CERT) -and (Test-Path $env:OS_SSL_KEY)) {
        $env:Kestrel__Certificates__Default__Path = $env:OS_SSL_CERT
        $env:Kestrel__Certificates__Default__KeyPath = $env:OS_SSL_KEY
        $env:ASPNETCORE_URLS = "https://0.0.0.0:$ApiPort"
        Write-Host "Backend TLS: HTTPS on $ApiPort"
    }
    else {
        $env:ASPNETCORE_URLS = "http://0.0.0.0:$ApiPort"
        Write-Host "Backend TLS: cert env not set/found - HTTP on $ApiPort"
    }
}

# The FrontendRuntime values Program.cs bakes into wwwroot come from the Mongo "Secrets"
# document, which stores the *deployed* origin - https://dev-os.blocksdevelopers.com, with no
# port. Served locally that aims every frontend API call at :443, where nothing listens.
# Program.cs reads "FrontendRuntime__<key>" env vars ahead of the Mongo section, so pin the OS
# origin to the port this script actually binds. Call it after Configure-BackendTls: the scheme
# has to match the one chosen there.
function Configure-FrontendRuntime {
    $scheme = if ($env:ASPNETCORE_URLS -like "https://*") { "https" } else { "http" }
    $origin = "${scheme}://${ApiHost}:$ApiPort"

    $env:FrontendRuntime__BLOCKS_OS_BASE_URL = $origin
    $env:FrontendRuntime__BLOCKS_OS_CALLBACK_URL = "$origin/login/callback"

    Write-Host "Frontend runtime: BLOCKS_OS_BASE_URL = $origin"
}

function Restore-Dotnet {
    Write-Host "Restoring .NET dependencies..."
    dotnet restore $ApiProject
    dotnet restore $WorkerProject
}

function Build-Frontend {
    Write-Host "Building frontend..."
    npm --prefix $ClientDir install
    npm --prefix $ClientDir run build

    if (!(Test-Path $Wwwroot)) {
        New-Item -ItemType Directory -Path $Wwwroot | Out-Null
    }

    if (Test-Path "$ClientDir/dist") {
        Write-Host "Syncing dist → wwwroot..."
        robocopy "$ClientDir/dist" $Wwwroot /MIR | Out-Null
    }
}

function Run-Backend {
    Configure-BackendTls
    Configure-FrontendRuntime
    Write-Host "Running .NET API on port $ApiPort..."
    # Pass the URL on the command line: it has higher precedence than the
    # launchSettings.json applicationUrl, which would otherwise override
    # the ASPNETCORE_URLS set above.
    dotnet run --project $ApiProject -- --urls $env:ASPNETCORE_URLS
}

function Run-Worker {
    Write-Host "Running .NET Worker..."
    dotnet run --project $WorkerProject
}

# ---- Tests ----

# Native commands do not stop the script on failure, so check the exit code.
function Invoke-Step {
    param([scriptblock]$Step, [string]$Name)

    & $Step
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$Name failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

function Ensure-NodeModules {
    param([string]$Dir)

    if (!(Test-Path (Join-Path $Dir "node_modules"))) {
        Write-Host "Installing dependencies in $(Split-Path -Leaf $Dir)..."
        Invoke-Step { npm --prefix $Dir clean-install } "npm clean-install"
    }
}

# Vitest does not read dist/, so the build is only a TypeScript gate.
# Skip it with $env:SKIP_BUILD = "1" for a faster loop.
function Test-Frontend {
    Write-Host "=== Frontend unit tests ==="

    Ensure-NodeModules $ClientDir

    if ($env:SKIP_BUILD -eq "1") {
        Write-Host "SKIP_BUILD=1 - skipping client build."
    }
    else {
        Invoke-Step { npm --prefix $ClientDir run build } "client build"
    }

    Invoke-Step { npm --prefix $ClientDir run test } "client unit tests"
}

# Playwright starts the app itself (webServer: run.sh -b) and needs e2e/.env.e2e.
function Test-E2E {
    Write-Host "=== E2E tests ==="

    if (!(Test-Path (Join-Path $E2eDir ".env.e2e"))) {
        Write-Host "Missing $E2eDir\.env.e2e - copy .env.e2e.example and set E2E_BASE_URL + credentials."
        exit 1
    }

    Ensure-NodeModules $E2eDir

    Push-Location $E2eDir
    try {
        Invoke-Step { npx playwright install --no-shell chromium } "playwright install"
        Invoke-Step { npm run test } "e2e tests"
    }
    finally {
        Pop-Location
    }
}

function Test-Backend {
    Write-Host "=== Backend unit tests ==="

    Invoke-Step { dotnet clean $Solution } "dotnet clean"
    Invoke-Step { dotnet build $Solution } "dotnet build"
    Invoke-Step { dotnet test $Solution --no-build } "dotnet test"
}

# ---- Execution ----

if ($KillPort) {
    Free-Port
    exit
}

if ($TestFe -or $TestE2e -or $TestBe) {
    if ($TestFe) { Test-Frontend }
    if ($TestBe) { Test-Backend }
    if ($TestE2e) { Test-E2E }
    exit
}

if ($Dotnet.Count -gt 0) {
    dotnet @Dotnet
    exit
}

if ($Npm.Count -gt 0) {
    npm --prefix $ClientDir @Npm
    exit
}

if ($Backend) {
    Free-Port
    Restore-Dotnet
    Run-Backend
    exit
}

if ($Worker) {
    Restore-Dotnet
    Run-Worker
    exit
}

if ($Frontend) {
    npm --prefix $ClientDir install
    npm --prefix $ClientDir run dev
    exit
}

if ($All) {
    Free-Port
    Restore-Dotnet
    Build-Frontend

    Configure-BackendTls
    Configure-FrontendRuntime

    Write-Host "Starting API + Worker..."

    # Start-Process spawns a child shell, which inherits the env vars set by
    # Configure-BackendTls; --urls still has to be explicit to beat launchSettings.json.
    $api = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "dotnet run --project '$ApiProject' -- --urls '$($env:ASPNETCORE_URLS)'" `
        -PassThru

    $worker = Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "dotnet run --project '$WorkerProject'" `
        -PassThru

    Write-Host "API PID: $($api.Id)"
    Write-Host "Worker PID: $($worker.Id)"
    Write-Host "Press Enter to stop..."

    [void][Console]::ReadLine()

    try { Stop-Process $api.Id -Force } catch {}
    try { Stop-Process $worker.Id -Force } catch {}
}