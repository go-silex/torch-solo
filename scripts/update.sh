#!/usr/bin/env bash
# Met Torch à jour : arrêt, récupération de la dernière version, relance.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
"$DIR/scripts/torch-stop.command"
cd "$DIR"
git pull --ff-only
npm ci --no-audit --no-fund --loglevel=error
exec "$DIR/scripts/torch-serve.sh"
