$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
py -3.12 scripts/check_supabase_env.py
exit $LASTEXITCODE
