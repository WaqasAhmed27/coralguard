$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$template = Join-Path $root "packages/sources/ci_artifacts.source.yaml"
$out = Join-Path $root "packages/sources/ci_artifacts.local.source.yaml"
$demo = (Join-Path $root "packages/sources/demo_data").Replace("\", "/")
(Get-Content $template -Raw).Replace("ABSOLUTE_PATH_TO_DEMO_DATA", $demo) | Set-Content -Path $out -Encoding UTF8
coral source lint $out
coral source add --file $out
coral source test ci_artifacts
Write-Host "Installed ci_artifacts from $out"
