$ErrorActionPreference = "Stop"
Set-Location "D:\test\steam-launch-tracker"
$env:TRACK_TOP_N = "50"
npm run daily
