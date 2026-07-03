param(
  [string]$TaskName = "SteamLaunchTrackerDaily",
  [string]$At = "09:30",
  [int]$TopN = 50
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $Root "run-daily.ps1"

$dailyScript = @"
`$ErrorActionPreference = "Stop"
Set-Location "$Root"
`$env:TRACK_TOP_N = "$TopN"
npm run daily
"@

Set-Content -Path $Script -Value $dailyScript -Encoding UTF8

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`""

$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Collect Steam public launch data and archive wishlist rank/review counts." `
  -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName" -ForegroundColor Green
Write-Host "Daily time: $At"
Write-Host "TopN: $TopN"
Write-Host "Runner: $Script"
