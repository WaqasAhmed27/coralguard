param(
  [switch]$Strict
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-live-env.ps1")

$required = @(
  "CORAL_CONFIG_DIR",
  "CORAL_QUERY_PROFILE",
  "SENTRY_ORG",
  "SENTRY_TOKEN",
  "SLACK_TOKEN",
  "LAUNCHDARKLY_TOKEN",
  "LINEAR_API_KEY"
)

$missing = @()
foreach ($key in $required) {
  $value = [Environment]::GetEnvironmentVariable($key, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $key
    Write-Host "$key=missing"
  } else {
    Write-Host "$key=set"
  }
}

if ($env:CORAL_QUERY_PROFILE -ne "live") {
  $missing += "CORAL_QUERY_PROFILE=live"
  Write-Host "CORAL_QUERY_PROFILE must be live for a full live demo."
}

if ($Strict -and $missing.Count -gt 0) {
  throw "Live env is incomplete. Missing: $($missing -join ', ')"
}

if ($missing.Count -eq 0) {
  Write-Host "Live env is complete for Sentry, Slack, LaunchDarkly, and Linear."
}
