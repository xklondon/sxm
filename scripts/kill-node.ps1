# Stop all Node.js processes — use when Vitest/npm test hangs and shell waits exceed ~2 minutes.
# WARNING: Also stops npm run dev, Vite, and the API server. Restart dev after running this.

$ErrorActionPreference = 'SilentlyContinue'

Write-Host '[SXM] Stopping all node.exe processes...'

$processes = Get-Process -Name node -ErrorAction SilentlyContinue
if (-not $processes) {
  Write-Host '[SXM] No node.exe processes found.'
  exit 0
}

taskkill /F /IM node.exe | Out-Null

if ($LASTEXITCODE -eq 0) {
  Write-Host "[SXM] Stopped $($processes.Count) node.exe process(es)."
  exit 0
}

Write-Host '[SXM] taskkill failed (access denied or processes already exited).'
exit $LASTEXITCODE
