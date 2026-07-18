$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
py -3.12 scripts/apply_supabase_migrations.py
exit $LASTEXITCODE
