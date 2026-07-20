$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"
$port = if ($env:PORT) { $env:PORT } else { "5173" }

Set-Location $frontend
npm run dev -- --port $port
