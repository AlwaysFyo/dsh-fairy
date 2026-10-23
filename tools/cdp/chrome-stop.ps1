# Stop the headless Chromium started by tools/cdp/chrome-start.ps1.
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$profile = Join-Path $root '.dsh-dev-home\chrome-profile'

$stopped = 0
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        if ($_.CommandLine -like "*chrome-profile*") {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stopped++
        }
    } catch {
        # CommandLine is unavailable for some protected processes; ignore them.
    }
}
"stopped $stopped chrome process(es)"
