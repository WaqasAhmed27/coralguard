$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-live-env.ps1")

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$coral = if ($env:CORAL_BIN) { $env:CORAL_BIN } else { Join-Path $root ".tools/coral/coral.exe" }
$env:CORAL_CONFIG_DIR = if ($env:CORAL_CONFIG_DIR) { $env:CORAL_CONFIG_DIR } else { Join-Path $root ".coral-live-config" }

$requiredEnv = @(
  "CORAL_CONFIG_DIR",
  "CORAL_QUERY_PROFILE",
  "SENTRY_ORG",
  "SENTRY_TOKEN",
  "SLACK_TOKEN",
  "LAUNCHDARKLY_TOKEN",
  "LINEAR_API_KEY"
)

function Test-EnvValue {
  param([string]$Name)
  [pscustomobject]@{
    name = $Name
    ok = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))
  }
}

function Test-SlackEndpoint {
  param(
    [string]$Name,
    [string]$Uri
  )

  if ([string]::IsNullOrWhiteSpace($env:SLACK_TOKEN)) {
    return [pscustomobject]@{ name = $Name; ok = $false; error = "missing_token" }
  }

  try {
    $response = Invoke-RestMethod -Method Get -Uri $Uri -Headers @{ Authorization = "Bearer $env:SLACK_TOKEN" }
  } catch {
    return [pscustomobject]@{ name = $Name; ok = $false; error = $_.Exception.Message }
  }

  $result = [ordered]@{ name = $Name; ok = [bool]$response.ok }
  if (-not $response.ok) {
    $result.error = $response.error
    if ($response.needed) { $result.needed = $response.needed }
    if ($response.provided) { $result.provided = $response.provided }
  }
  [pscustomobject]$result
}

function Test-CoralSource {
  param([string]$Name)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = (& $coral source test $Name 2>&1 | Out-String)
    $ok = $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $detail = ""
  if (-not $ok) {
    if ($output -match "missing_scope") {
      $detail = "missing_scope"
    } elseif ($output -match "source '.*' was not found") {
      $detail = "not_installed"
    } elseif ($output -match "timed out") {
      $detail = "timeout"
    } else {
      $detail = "validation_failed"
    }
  }

  [pscustomobject]@{
    name = $Name
    ok = $ok
    detail = $detail
  }
}

$envChecks = $requiredEnv | ForEach-Object { Test-EnvValue $_ }
$slackChecks = @()
$slackChecks += Test-SlackEndpoint "conversations.list" "https://slack.com/api/conversations.list?limit=1"
$slackChecks += Test-SlackEndpoint "users.list" "https://slack.com/api/users.list?limit=1"
$sourceChecks = @(
  "github",
  "sentry",
  "slack",
  "launchdarkly",
  "linear",
  "ci_artifacts",
  "slack_incidents",
  "support",
  "osv"
) | ForEach-Object { Test-CoralSource $_ }

$readiness = [pscustomobject]@{
  env = $envChecks
  slack = $slackChecks
  coralSources = $sourceChecks
}

$readiness | ConvertTo-Json -Depth 5

$failedEnv = $envChecks | Where-Object { -not $_.ok }
$failedSlack = $slackChecks | Where-Object { -not $_.ok }
$failedSources = $sourceChecks | Where-Object { -not $_.ok }

if ($failedEnv -or $failedSlack -or $failedSources) {
  throw "Live readiness failed. Fix missing env values, Slack scopes, or failing Coral sources before strict all-live demo."
}

Write-Host "Live readiness passed."
