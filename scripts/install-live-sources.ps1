$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$envFile = Join-Path $root ".env.live.local"
if (Test-Path $envFile) {
  . (Join-Path $PSScriptRoot "load-live-env.ps1")
}

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

function Install-BundledIfConfigured {
  param(
    [string]$SourceName,
    [string[]]$RequiredEnv
  )

  foreach ($key in $RequiredEnv) {
    if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
      Write-Host "Skipping live $SourceName; missing $key"
      return $false
    }
  }

  Write-Host "Installing live $SourceName"
  & $coral source remove $SourceName 2>$null
  & $coral source add $SourceName
  & $coral source test $SourceName
  return $true
}

$liveInstalled = @{}
$liveInstalled["sentry"] = Install-BundledIfConfigured "sentry" @("SENTRY_ORG", "SENTRY_TOKEN")
$liveInstalled["slack"] = Install-BundledIfConfigured "slack" @("SLACK_TOKEN")
$liveInstalled["launchdarkly"] = Install-BundledIfConfigured "launchdarkly" @("LAUNCHDARKLY_TOKEN")
$liveInstalled["linear"] = Install-BundledIfConfigured "linear" @("LINEAR_API_KEY")
$liveInstalled["intercom"] = Install-BundledIfConfigured "intercom" @("INTERCOM_ACCESS_TOKEN")
$liveInstalled["jira"] = Install-BundledIfConfigured "jira" @("JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN")
$liveInstalled["pagerduty"] = Install-BundledIfConfigured "pagerduty" @("PAGERDUTY_API_TOKEN")
$liveInstalled["incident_io"] = Install-BundledIfConfigured "incident_io" @("INCIDENT_IO_API_KEY")
$liveInstalled["datadog"] = Install-BundledIfConfigured "datadog" @("DD_API_KEY", "DD_APPLICATION_KEY")

# Keep missing product evidence reliable with local Coral fallback sources.
$fallbackSources = @(
  "ci_artifacts",
  "support",
  "osv"
)

if (-not $liveInstalled["sentry"]) { $fallbackSources += "sentry" }
if (-not $liveInstalled["slack"]) { $fallbackSources += "slack_incidents" }
if (-not $liveInstalled["launchdarkly"]) { $fallbackSources += "flags" }

foreach ($source in $fallbackSources) {
  $template = Join-Path $root "packages/sources/$source.source.yaml"
  $out = Join-Path $root "packages/sources/$source.live-fallback.source.yaml"
  $content = (Get-Content $template -Raw).Replace("ABSOLUTE_PATH_TO_DEMO_DATA", $demo)
  [System.IO.File]::WriteAllText($out, $content, (New-Object System.Text.UTF8Encoding($false)))
  & $coral source lint $out
  & $coral source add --file $out
  & $coral source test $source
}

Write-Host "Installed live configured sources plus fallback evidence sources into $env:CORAL_CONFIG_DIR"
