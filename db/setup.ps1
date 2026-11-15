$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $configPath)) {
  $bytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $dbPassword = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
  $settings = @("PGHOST=127.0.0.1", "PGPORT=54329", "PGDATABASE=earth_trends", "PGUSER=earth_app", "PGPASSWORD=$dbPassword")
  [IO.File]::WriteAllLines($configPath, $settings, (New-Object Text.UTF8Encoding($false)))
  Write-Host 'Created ignored local database configuration; password not displayed.'
}
& docker compose --project-directory $projectRoot --env-file $configPath -f (Join-Path $projectRoot 'compose.yaml') up -d --wait db
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start. Start Docker Desktop and retry this script.' }
Write-Host 'Local PostgreSQL is ready. Install pipeline/requirements-db.txt, then run pipeline/database.py migrate and import-validated.'
