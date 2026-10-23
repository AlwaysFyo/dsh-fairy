# Starts the isolated Fairy dev instance on a fresh port and prints its token URL.
#
# The dev instance keeps its own DSH_HOME so it never touches the real profile:
#   .dsh-dev-home/profiles/fairy-dev -> dev/profile (junction)
#
# Usage:
#   pwsh -File tools/dev-start.ps1 [-Port 3400] [-WithChrome] [-WithBalance]
#
# -WithChrome    also starts headless Chromium with CDP on 9222 (for tools/cdp/*)
# -WithBalance   lets the balance card read the real credentials file (opt-in, so
#                the secret is never copied into the dev home)
param(
  [int]$Port = 3400,
  [switch]$WithChrome,
  [switch]$WithBalance
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$node = 'C:\Users\yolo\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$home_ = Join-Path $repo '.dsh-dev-home'
$bootLog = Join-Path $home_ 'boot-latest.log'

# Stop a stale instance: the web server holds the port and the log files.
# netstat is used instead of Get-NetTCPConnection, which blocks in some sandboxes.
function Stop-Port {
  param([int]$Target)
  netstat -ano | Select-String ":$Target\s.*LISTENING" | ForEach-Object {
    $pid_ = ($_ -split '\s+')[-1]
    if ($pid_ -match '^\d+$') { Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue }
  }
}
Stop-Port -Target $Port
Start-Sleep -Milliseconds 500

$env:DSH_HOME = $home_
Remove-Item Env:DSH_PROFILE -ErrorAction SilentlyContinue
$env:NO_COLOR = '1'
# api.deepseek.com resolves to a synthetic address here, so the host must use the
# local forward proxy for outbound requests (the balance card needs this).
$env:NODE_USE_ENV_PROXY = '1'
$env:HTTP_PROXY = 'http://127.0.0.1:7897'
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
if ($WithBalance) {
  $env:DSH_FAIRY_CREDENTIALS = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'
} else {
  Remove-Item Env:DSH_FAIRY_CREDENTIALS -ErrorAction SilentlyContinue
}

$arguments = @(
  'node_modules\@deepseek-ai\dsh\lib\bin.js',
  '--profile', 'fairy-dev',
  '--no-open',
  '--port', "$Port"
)
Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $repo `
  -RedirectStandardOutput $bootLog -RedirectStandardError "$bootLog.err" -WindowStyle Hidden

$token = $null
for ($i = 0; $i -lt 40 -and -not $token; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $bootLog) {
    $token = ([regex]'token=([A-Za-z0-9_\-]+)').Match((Get-Content $bootLog -Raw)).Groups[1].Value
  }
}
if (-not $token) {
  Write-Host 'dev instance did not report a token; tail of boot log:'
  if (Test-Path "$bootLog.err") { Get-Content "$bootLog.err" | Select-Object -Last 20 }
  exit 1
}

if ($WithChrome) {
  Stop-Port -Target 9222
  $chrome = Join-Path $env:LOCALAPPDATA 'ms-playwright\chromium-1243\chrome-win64\chrome.exe'
  Start-Process -FilePath $chrome -ArgumentList @(
    '--headless=new', '--remote-debugging-port=9222',
    "--user-data-dir=$home_\chrome-prof",
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'
  ) -WindowStyle Hidden
  Start-Sleep -Seconds 4
}

Write-Host "URL=http://127.0.0.1:$Port/?token=$token"
