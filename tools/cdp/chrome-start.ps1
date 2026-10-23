# Start a headless Chromium owned by this repo (Playwright's bundled build).
# The DSH file sandbox blocks child_process.spawn with piped stdio, so the
# browser is started here and driven over CDP by tools/cdp/*.mjs.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$chrome = Join-Path $env:LOCALAPPDATA 'ms-playwright\chromium-1243\chrome-win64\chrome.exe'
$profile = Join-Path $root '.dsh-dev-home\chrome-profile'
$port = if ($env:CDP_PORT) { $env:CDP_PORT } else { '9222' }

if (-not (Test-Path $chrome)) { throw "chromium not found: $chrome" }

# Reap an instance started by an earlier run.
Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*chrome-profile*" } |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

$args = @(
    '--headless=new',
    "--remote-debugging-port=$port",
    "--user-data-dir=$profile",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1440,900',
    '--force-device-scale-factor=1',
    '--disable-features=Translate,MediaRouter',
    'about:blank'
)
Start-Process -FilePath $chrome -ArgumentList $args -WindowStyle Hidden | Out-Null

$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
    try {
        $version = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
        "CDP $($version.Browser)"
        exit 0
    } catch {
        Start-Sleep -Milliseconds 300
    }
}
throw "chromium did not expose CDP on port $port"
