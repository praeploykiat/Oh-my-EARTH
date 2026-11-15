param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pythonPath = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$workerPath = Join-Path $PSScriptRoot 'worker.py'
$runtimePath = Join-Path $PSScriptRoot 'raw\worker'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$statePath = Join-Path $runtimePath 'process.json'
$existing = $null
if (Test-Path -LiteralPath $statePath) {
    $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($saved.processId)" -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.ExecutablePath -eq $pythonPath -and $candidate.CommandLine.Contains($workerPath)) { $existing = $candidate }
}
if ($Stop) {
    if ($existing) {
        # Windows venv launchers may own a second python.exe; stop only matching worker children.
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $($existing.ProcessId)" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($workerPath) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
        Stop-Process -Id $existing.ProcessId -ErrorAction SilentlyContinue
        Write-Output 'Stopped ingestion worker; durable jobs resume on restart.'
    }
    else { Write-Output 'No matching ingestion worker is running.' }
    exit
}
if ($existing) { Write-Output "Ingestion worker already running (PID $($existing.ProcessId))."; exit }
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Create pipeline/.venv and install requirements-ingestion.txt first.' }
$workerProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-u', ('"' + $workerPath + '"'), 'run', '--watch', '--workers', '2', '--publish') -WorkingDirectory $repoPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'stdout.log') -RedirectStandardError (Join-Path $runtimePath 'stderr.log') -PassThru
@{processId=$workerProcess.Id; startedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $statePath
Write-Output "Started ingestion worker (PID $($workerProcess.Id)); logs: pipeline/raw/worker."
