$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$coral = if ($env:CORAL_BIN) { $env:CORAL_BIN } else { Join-Path $root ".tools/coral/coral.exe" }
$liveConfig = if ($env:CORAL_CONFIG_DIR) { $env:CORAL_CONFIG_DIR } else { Join-Path $root ".coral-live-config" }
$demo = (Join-Path $root "packages/sources/demo_data").Replace("\", "/")

New-Item -ItemType Directory -Force -Path $liveConfig | Out-Null
$env:CORAL_CONFIG_DIR = (Resolve-Path $liveConfig).Path

if (-not $env:GITHUB_TOKEN) {
  $ghToken = (& gh auth token 2>$null)
  if ($LASTEXITCODE -eq 0 -and $ghToken) {
    $env:GITHUB_TOKEN = $ghToken.Trim()
  }
}

if (-not $env:GITHUB_TOKEN) {
  throw "Set GITHUB_TOKEN or authenticate gh CLI before installing the live GitHub source."
}

& $coral source add github
& $coral source test github

# Keep non-GitHub evidence reliable unless live credentials are also configured.
$fallbackSources = @(
  "ci_artifacts",
  "sentry",
  "slack_incidents",
  "support",
  "flags",
  "osv"
)

foreach ($source in $fallbackSources) {
  $template = Join-Path $root "packages/sources/$source.source.yaml"
  $out = Join-Path $root "packages/sources/$source.live-fallback.source.yaml"
  $content = (Get-Content $template -Raw).Replace("ABSOLUTE_PATH_TO_DEMO_DATA", $demo)
  [System.IO.File]::WriteAllText($out, $content, (New-Object System.Text.UTF8Encoding($false)))
  & $coral source lint $out
  & $coral source add --file $out
  & $coral source test $source
}

Write-Host "Installed live GitHub plus fallback evidence sources into $env:CORAL_CONFIG_DIR"
