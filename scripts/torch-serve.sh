#!/usr/bin/env bash
# Serveur Torch idempotent, mode production.
# - déjà up → ouvre juste le navigateur
# - build si nécessaire (premier lancement ou code mis à jour), puis next start
# Log : ~/Library/Logs/torch.log
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="http://localhost:3944"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# macOS et Linux (miroir dev) n'ont ni le même dossier de logs ni la même
# commande d'ouverture de navigateur.
if [ "$(uname -s)" = "Darwin" ]; then
  LOG_DIR="$HOME/Library/Logs"
else
  LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}"
fi
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/torch.log"

open_url() {
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  else echo "Torch est prêt : $URL"
  fi
}

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }

if curl -s -o /dev/null --max-time 2 "$URL"; then
  open_url
  exit 0
fi

cd "$DIR"
log "démarrage Torch depuis $DIR"

if [ ! -d node_modules ]; then
  log "npm ci (première installation)…"
  npm ci >> "$LOG" 2>&1 || { log "npm ci a échoué"; exit 1; }
fi

# Rebuild si aucun build, ou si le code (git HEAD) a changé depuis le dernier build.
HEAD="$(git rev-parse HEAD 2>/dev/null || echo dev)"
BUILT="$(cat .next/TORCH_BUILD 2>/dev/null || echo none)"
if [ ! -f .next/BUILD_ID ] || [ "$HEAD" != "$BUILT" ]; then
  log "build de production ($HEAD)…"
  npm run build >> "$LOG" 2>&1 || { log "build échoué"; exit 1; }
  echo "$HEAD" > .next/TORCH_BUILD
fi

log "next start -p 3944"
nohup npm run start >> "$LOG" 2>&1 &

for _ in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 1 "$URL"; then
    open_url
    log "Torch prêt sur $URL"
    exit 0
  fi
  sleep 1
done
log "le serveur n'a pas répondu à temps — voir $LOG"
exit 1
