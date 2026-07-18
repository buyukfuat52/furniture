$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
py -3.12 scripts/verify_supabase_connection.py
exit $LASTEXITCODE
