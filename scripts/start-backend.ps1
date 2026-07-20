$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$port = if ($env:PORT) { $env:PORT } else { "8001" }

Set-Location $backend
python -m uvicorn main:app --port $port
