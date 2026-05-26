$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$coral = if ($env:CORAL_BIN) { $env:CORAL_BIN } else { Join-Path $root ".tools/coral/coral.exe" }
$demo = (Join-Path $root "packages/sources/demo_data").Replace("\", "/")
$sources = @(
  "github",
  "ci_artifacts",
  "sentry",
  "slack_incidents",
  "support",
  "flags",
  "osv"
)

foreach ($source in $sources) {
  $template = Join-Path $root "packages/sources/$source.source.yaml"
  $out = Join-Path $root "packages/sources/$source.local.source.yaml"
  $content = (Get-Content $template -Raw).Replace("ABSOLUTE_PATH_TO_DEMO_DATA", $demo)
  [System.IO.File]::WriteAllText($out, $content, (New-Object System.Text.UTF8Encoding($false)))
  & $coral source lint $out
  & $coral source add --file $out
  & $coral source test $source
}

Write-Host "Installed CoralGuard demo sources with $coral"
