$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$services = @(
  @{ Name = 'api-gateway'; Port = 4000; Script = 'dist/apps/api-gateway/src/main.js' },
  @{ Name = 'auth-service'; Port = 4101; Script = 'dist/src/apps/auth-service/main.js' },
  @{ Name = 'catalog-service'; Port = 4102; Script = 'dist/src/apps/catalog-service/main.js' },
  @{ Name = 'cart-service'; Port = 4103; Script = 'dist/src/apps/cart-service/main.js' },
  @{ Name = 'promo-service'; Port = 4104; Script = 'dist/src/apps/promo-service/main.js' },
  @{ Name = 'order-service'; Port = 4105; Script = 'dist/src/apps/order-service/main.js' },
  @{ Name = 'delivery-service'; Port = 4106; Script = 'dist/src/apps/delivery-service/main.js' },
  @{ Name = 'analytics-service'; Port = 4107; Script = 'dist/src/apps/analytics-service/main.js' }
)

foreach ($service in $services) {
  $connections = Get-NetTCPConnection -LocalPort $service.Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

foreach ($service in $services) {
  Start-Process -FilePath 'node' -ArgumentList $service.Script -WorkingDirectory $root -WindowStyle Hidden
}

Write-Output 'Core services started: api-gateway, auth-service, catalog-service, cart-service, promo-service, order-service, delivery-service, analytics-service'
