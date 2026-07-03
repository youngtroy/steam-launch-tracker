param(
  [int]$TopN = 5,
  [switch]$SkipCollect,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:PORT) { [int]$env:PORT } else { 5177 }
$Url = "http://localhost:$Port"

Set-Location $Root

function Test-Server {
  try {
    $response = Invoke-WebRequest -UseBasicParsing "$Url/api/data" -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "Steam Launch Tracker" -ForegroundColor Cyan
Write-Host "Working directory: $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Please install Node.js 20+ first:" -ForegroundColor Red
  Write-Host "https://nodejs.org/"
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path "$Root\config.json")) {
  Copy-Item "$Root\config.example.json" "$Root\config.json"
  Write-Host "Created config.json from config.example.json"
}

if (-not $SkipCollect) {
  Write-Host "Collecting Steam data. TopN=$TopN ..."
  $oldTopN = $env:TRACK_TOP_N
  $env:TRACK_TOP_N = [string]$TopN

  try {
    npm run collect
  } catch {
    Write-Host "Collect failed; continuing with existing local data." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor DarkYellow
  } finally {
    if ($null -eq $oldTopN) {
      Remove-Item Env:\TRACK_TOP_N -ErrorAction SilentlyContinue
    } else {
      $env:TRACK_TOP_N = $oldTopN
    }
  }
}

if (Test-Server) {
  Write-Host "Server is already running at $Url"
} else {
  Write-Host "Starting dashboard server..."
  Start-Process -FilePath "node.exe" -ArgumentList "src/server.js" -WorkingDirectory $Root -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

if (Test-Server) {
  Write-Host "Dashboard: $Url" -ForegroundColor Green
  if (-not $NoBrowser) {
    Start-Process $Url
  }
} else {
  Write-Host "Server did not respond. Run this manually to see errors:" -ForegroundColor Red
  Write-Host "cd /d $Root"
  Write-Host "npm run serve"
}

Write-Host ""
Write-Host "You can close this window. The dashboard server keeps running in the background."
Start-Sleep -Seconds 3
