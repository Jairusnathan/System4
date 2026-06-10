$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

$services = @(
  'api-gateway',
  'auth-service',
  'cart-service',
  'catalog-service',
  'order-service',
  'delivery-service',
  'promo-service'
)

# Kill any leftover node processes on service ports
@(3001,3002,3003,3004,3005,3006,3007) | ForEach-Object {
  $conn = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host "Starting all Greenovate microservices..."

$jobs = @()
foreach ($svc in $services) {
  $svcPath = Join-Path $root $svc
  $job = Start-Job -ScriptBlock {
    param($path, $name)
    Set-Location $path
    npm run start:dev 2>&1 | ForEach-Object { "[$name] $_" }
  } -ArgumentList $svcPath, $svc
  $jobs += $job
  Write-Host "  Starting: $svc"
}

Write-Host ""
Write-Host "All services building... (this takes 30-60 seconds)"
Write-Host "Press Ctrl+C to stop all services."
Write-Host ""

try {
  while ($true) {
    foreach ($job in $jobs) {
      $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
      if ($output) { $output | ForEach-Object { Write-Host $_ } }
    }
    Start-Sleep -Milliseconds 300
  }
} finally {
  Write-Host ""
  Write-Host "Stopping all services..."
  $jobs | ForEach-Object { Stop-Job -Job $_ -ErrorAction SilentlyContinue; Remove-Job -Job $_ -Force -ErrorAction SilentlyContinue }
}
