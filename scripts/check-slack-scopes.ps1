$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-live-env.ps1")

if ([string]::IsNullOrWhiteSpace($env:SLACK_TOKEN)) {
  throw "SLACK_TOKEN is missing from .env.live.local."
}

$headers = @{ Authorization = "Bearer $env:SLACK_TOKEN" }

function Test-SlackEndpoint {
  param(
    [string]$Name,
    [string]$Uri
  )

  try {
    $response = Invoke-RestMethod -Method Get -Uri $Uri -Headers $headers
  } catch {
    $webResponse = $_.Exception.Response
    $body = ""
    if ($webResponse -and $webResponse.GetResponseStream()) {
      $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
      $body = $reader.ReadToEnd()
    }
    return [pscustomobject]@{
      endpoint = $Name
      ok = $false
      error = if ($body) { $body } else { $_.Exception.Message }
    }
  }

  $result = [ordered]@{
    endpoint = $Name
    ok = [bool]$response.ok
  }
  if (-not $response.ok) {
    $result.error = $response.error
    if ($response.needed) { $result.needed = $response.needed }
    if ($response.provided) { $result.provided = $response.provided }
  }
  [pscustomobject]$result
}

$checks = @()
$checks += Test-SlackEndpoint "conversations.list" "https://slack.com/api/conversations.list?limit=1"
$checks += Test-SlackEndpoint "users.list" "https://slack.com/api/users.list?limit=1"

$checks | ConvertTo-Json -Depth 4

$failed = $checks | Where-Object { -not $_.ok }
if ($failed) {
  throw "Slack token is missing scopes required by Coral."
}
