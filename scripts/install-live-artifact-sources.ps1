$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$envFile = Join-Path $root ".env.live.local"
if (Test-Path $envFile) {
  . (Join-Path $PSScriptRoot "load-live-env.ps1")
}

$coral = if ($env:CORAL_BIN) { $env:CORAL_BIN } else { Join-Path $root ".tools/coral/coral.exe" }
$liveConfig = if ($env:CORAL_CONFIG_DIR) { $env:CORAL_CONFIG_DIR } else { Join-Path $root ".coral-live-config" }
$artifactRoot = if ($env:CORAL_LIVE_ARTIFACT_DIR) { $env:CORAL_LIVE_ARTIFACT_DIR } else { Join-Path $root "packages/sources/live_artifacts" }

New-Item -ItemType Directory -Force -Path $liveConfig | Out-Null
$env:CORAL_CONFIG_DIR = (Resolve-Path $liveConfig).Path

$resolvedArtifacts = (Resolve-Path $artifactRoot).Path.Replace("\", "/")

foreach ($source in @("ci_artifacts", "slack_incidents", "osv")) {
  $template = Join-Path $root "packages/sources/$source.live.source.yaml"
  $out = Join-Path $root ".coral-temp-info/$source.live.generated.source.yaml"
  New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
  $content = (Get-Content $template -Raw).Replace("ABSOLUTE_PATH_TO_LIVE_ARTIFACTS", $resolvedArtifacts)
  [System.IO.File]::WriteAllText($out, $content, (New-Object System.Text.UTF8Encoding($false)))
  & $coral source lint $out
  & $coral source remove $source *> $null
  & $coral source add --file $out
  & $coral source test $source
}

Write-Host "Installed live artifact sources from $resolvedArtifacts into $env:CORAL_CONFIG_DIR"
