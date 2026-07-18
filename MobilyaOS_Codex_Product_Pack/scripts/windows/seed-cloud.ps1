$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
py -3.12 scripts/seed_supabase.py
exit $LASTEXITCODE
