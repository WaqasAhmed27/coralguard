$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-live-env.ps1")
cmd /c npm run dev
