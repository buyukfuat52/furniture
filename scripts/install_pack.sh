#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-.}"
mkdir -p "$TARGET"
rsync -a --exclude 'scripts/install_pack.sh' "$SRC_DIR/" "$TARGET/"
echo "Installed MobilyaOS Codex product pack into $TARGET"
echo "Open the repository in Codex and submit CODEX_ONE_SHOT_PROMPT.md."
