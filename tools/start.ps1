param([switch]$NoBrowser, [switch]$Lan)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$url = 'http://localhost:5188'
$listenHost = if ($Lan) { '0.0.0.0' } else { '127.0.0.1' }
$logDir = Join-Path $root '.artifacts'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Get-LocalPage {
    try { return Invoke-WebRequest -Uri 'http://127.0.0.1:5188' -TimeoutSec 4 -UseBasicParsing } catch { return $null }
}

function Test-LanAccess {
    foreach ($address in $lanAddresses) {
        try {
            $lanPage = Invoke-WebRequest -Uri "http://${address}:5188" -TimeoutSec 4 -UseBasicParsing
            if ($lanPage.Content -match 'name="application-name" content="wanxian-life"') { return $true }
        } catch { }
    }
    return $false
}

try {
    $lanAddresses = @()
    if ($Lan) {
        $lanAddresses = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -and $_ -notmatch '^(127\.|169\.254\.)' } | Select-Object -Unique)
        if (-not $lanAddresses.Count) { throw 'Connect this computer to Wi-Fi or Ethernet before starting LAN mode.' }
    }
    $page = Get-LocalPage
    if ($page -and $page.Content -notmatch 'name="application-name" content="wanxian-life"') {
        throw 'Port 5188 is being used by another app. No process was stopped.'
    }
    if ($page -and $Lan) {
        if (-not (Test-LanAccess)) {
            throw 'This game is running, but its LAN address is unavailable. Close its local-only preview, then restart with -Lan. No process was stopped.'
        }
    }
    if (-not $page) {
        $vite = Join-Path $root 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path $vite)) { throw 'Dependencies are missing. Run npm install in the project folder.' }
        if (-not (Test-Path (Join-Path $root 'dist\index.html'))) {
            $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
            Push-Location $root
            try {
                & $npm run build *> (Join-Path $logDir 'build.log')
                if ($LASTEXITCODE -ne 0) { throw 'Build failed. See .artifacts/build.log.' }
            } finally { Pop-Location }
        }
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        $commandLine = '"' + $node + '" "' + $vite + '" preview --host ' + $listenHost + ' --port 5188 --strictPort'
        # Start detached from the launcher's console and inherited native-command job.
        $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
        $created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $root; ProcessStartupInformation = $startup }
        if ($created.ReturnValue -ne 0) { throw "Windows could not start the local preview (code $($created.ReturnValue))." }
        $previewProcessId = [int]$created.ProcessId
        for ($i = 0; $i -lt 40; $i++) {
            Start-Sleep -Milliseconds 250
            $page = Get-LocalPage
            if ($page) { break }
            if (-not (Get-Process -Id $previewProcessId -ErrorAction SilentlyContinue)) { throw 'The local preview exited. Run npm run preview to inspect the error.' }
        }
        if (-not $page -or $page.Content -notmatch 'name="application-name" content="wanxian-life"') { throw 'The local app did not become ready. Run npm run preview to inspect the error.' }
    }
    if (-not $NoBrowser) { Start-Process $url }
    Write-Output "Wanxian Life ready: $url"
    if ($Lan) {
        if (-not (Test-LanAccess)) {
            throw 'The LAN address did not respond. Check that Node.js is allowed on the current network.'
        }
        foreach ($address in $lanAddresses) { Write-Output "Same-network phone URL: http://${address}:5188" }
    }
    # Keep this hidden launcher alive while the server it created is running.
    if ($process) { Wait-Process -Id $process.Id }
} catch {
    $_ | Out-File (Join-Path $logDir 'launcher-error.log') -Encoding utf8
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Wanxian Life - Startup', 'OK', 'Error') | Out-Null
    exit 1
}
