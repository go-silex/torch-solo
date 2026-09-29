#!/usr/bin/env bash
# Arrêt double-clic : coupe le serveur Torch (port 3944).
set -u
PORT=3944

PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -z "$PIDS" ]; then
  echo "Torch ne tournait pas."
  exit 0
fi

# TERM d'abord (arrêt propre), KILL seulement si ça résiste.
echo "$PIDS" | xargs kill 2>/dev/null || true
for _ in 1 2 3 4 5; do
  sleep 1
  [ -z "$(lsof -ti ":$PORT" 2>/dev/null || true)" ] && break
done
REMAINING=$(lsof -ti ":$PORT" 2>/dev/null || true)
[ -n "$REMAINING" ] && echo "$REMAINING" | xargs kill -9 2>/dev/null || true

echo "Torch arrêté."
