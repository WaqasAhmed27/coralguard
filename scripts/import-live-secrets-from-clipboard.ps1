$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env.live.local"
$example = Join-Path $root "env.live.example"

if (-not (Test-Path $envFile)) {
  Copy-Item $example $envFile
}

$clipboard = Get-Clipboard -Raw
if ([string]::IsNullOrWhiteSpace($clipboard)) {
  throw "Clipboard is empty. Copy the token block, then rerun this script."
}

$existing = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_
  if ($line.Trim().StartsWith("#") -or -not $line.Contains("=")) {
    return
  }
  $idx = $line.IndexOf("=")
  $existing[$line.Substring(0, $idx).Trim()] = $line.Substring($idx + 1).Trim()
}

$existing["CORAL_CONFIG_DIR"] = Join-Path $root ".coral-live-config"
$existing["CORAL_QUERY_PROFILE"] = "live"

function Set-FromPattern {
  param(
    [string]$Key,
    [string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    $match = [regex]::Match($clipboard, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $existing[$Key] = $match.Groups["value"].Value.Trim()
      Write-Host "$Key=set"
      return
    }
  }

  $current = $existing[$Key]
  if ([string]::IsNullOrWhiteSpace($current)) {
    Write-Host "$Key=missing"
  } else {
    Write-Host "$Key=kept"
  }
}

Set-FromPattern "LAUNCHDARKLY_TOKEN" @(
  "launchdarkly(?:admin)?\s+token\s*:\s*(?<value>api-[A-Za-z0-9-]+)",
  "LAUNCHDARKLY_TOKEN\s*=\s*(?<value>api-[A-Za-z0-9-]+)"
)
Set-FromPattern "SENTRY_ORG" @(
  "SENTRY_ORG\s+slug\s*:\s*(?<value>[A-Za-z0-9_-]+)",
  "SENTRY_ORG\s*=\s*(?<value>[A-Za-z0-9_-]+)"
)
Set-FromPattern "SENTRY_TOKEN" @(
  "SENTRY_TOKEN(?:\s+personal\s+auth)?\s*:\s*(?<value>sntryu_[A-Za-z0-9]+)",
  "SENTRY_TOKEN\s*=\s*(?<value>sntryu_[A-Za-z0-9]+)"
)
Set-FromPattern "SLACK_TOKEN" @(
  "SLACK_TOKEN\s*:\s*(?<value>xoxb-[A-Za-z0-9-]+)",
  "SLACK_TOKEN\s*=\s*(?<value>xoxb-[A-Za-z0-9-]+)"
)
Set-FromPattern "LINEAR_API_KEY" @(
  "Linear_API_KEY\s*:\s*(?<value>lin_api_[A-Za-z0-9]+)",
  "LINEAR_API_KEY\s*=\s*(?<value>lin_api_[A-Za-z0-9]+)"
)

$order = @(
  "CORAL_CONFIG_DIR",
  "CORAL_QUERY_PROFILE",
  "GITHUB_TOKEN",
  "SENTRY_ORG",
  "SENTRY_TOKEN",
  "SLACK_TOKEN",
  "LAUNCHDARKLY_TOKEN",
  "LAUNCHDARKLY_API_BASE",
  "LINEAR_API_KEY",
  "INTERCOM_ACCESS_TOKEN",
  "JIRA_BASE_URL",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "PAGERDUTY_API_TOKEN",
  "INCIDENT_IO_API_KEY",
  "DD_SITE",
  "DD_API_KEY",
  "DD_APPLICATION_KEY"
)

$lines = @(
  "# Local live credentials. Gitignored. Do not commit.",
  "# Rotate any token that was pasted into chat or logs."
)
foreach ($key in $order) {
  $value = if ($existing.ContainsKey($key)) { $existing[$key] } else { "" }
  $lines += "$key=$value"
}

[System.IO.File]::WriteAllText($envFile, ($lines -join [Environment]::NewLine) + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Updated $envFile"
