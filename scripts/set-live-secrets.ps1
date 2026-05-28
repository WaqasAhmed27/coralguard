$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env.live.local"
$example = Join-Path $root "env.live.example"

if (-not (Test-Path $envFile)) {
  Copy-Item $example $envFile
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

function Read-SecretValue {
  param([string]$Name)
  $current = $existing[$Name]
  if ($current) {
    $keep = Read-Host "$Name is already set. Press Enter to keep it, or type replace"
    if ($keep -ne "replace") {
      return $current
    }
  }

  $secure = Read-Host "Enter $Name" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Set-ValueIfProvided {
  param([string]$Name, [string]$Prompt)
  $answer = Read-Host "$Prompt (y/N)"
  if ($answer -match "^(y|yes)$") {
    $existing[$Name] = Read-SecretValue $Name
  }
}

Write-Host "This writes secrets only to .env.live.local, which is gitignored."
if (-not $existing["CORAL_CONFIG_DIR"]) {
  $existing["CORAL_CONFIG_DIR"] = Join-Path $root ".coral-live-config"
}
$existing["CORAL_QUERY_PROFILE"] = "live"

Set-ValueIfProvided "SENTRY_ORG" "Set SENTRY_ORG"
Set-ValueIfProvided "SENTRY_TOKEN" "Set SENTRY_TOKEN"
Set-ValueIfProvided "SLACK_TOKEN" "Set SLACK_TOKEN"
Set-ValueIfProvided "LAUNCHDARKLY_TOKEN" "Set LAUNCHDARKLY_TOKEN"
Set-ValueIfProvided "LINEAR_API_KEY" "Set LINEAR_API_KEY"
Set-ValueIfProvided "INTERCOM_ACCESS_TOKEN" "Set INTERCOM_ACCESS_TOKEN"
Set-ValueIfProvided "PAGERDUTY_API_TOKEN" "Set PAGERDUTY_API_TOKEN"
Set-ValueIfProvided "INCIDENT_IO_API_KEY" "Set INCIDENT_IO_API_KEY"
Set-ValueIfProvided "DD_API_KEY" "Set DD_API_KEY"
Set-ValueIfProvided "DD_APPLICATION_KEY" "Set DD_APPLICATION_KEY"

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
