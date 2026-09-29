#!/usr/bin/env bash
# Installe Torch sur ce Mac et le branche sur ton vault Obsidian.
# Relançable sans risque : rien d'existant dans le vault n'est écrasé.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config/torch"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*"; exit 1; }

say "Installation de Torch"

# 1. Node.js (20.9 minimum, pour Next 16)
if ! command -v node >/dev/null 2>&1; then
  open "https://nodejs.org/fr/download" 2>/dev/null || true
  fail "Node.js n'est pas installé. Installe la version LTS (page ouverte dans ton navigateur), puis relance ce script."
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 9 ]; }; then
  open "https://nodejs.org/fr/download" 2>/dev/null || true
  fail "Node.js $(node -v) est trop ancien. Installe la version LTS, puis relance ce script."
fi
echo "✓ Node.js $(node -v)"

# 2. Le vault Obsidian
mkdir -p "$CONFIG_DIR"
CURRENT=""
[ -f "$CONFIG_DIR/vault-root" ] && CURRENT="$(cat "$CONFIG_DIR/vault-root")"
if [ -n "$CURRENT" ] && [ -d "$CURRENT" ]; then
  echo "✓ Vault déjà configuré : $CURRENT"
  VAULT="$CURRENT"
else
  echo "→ Une fenêtre va s'ouvrir : choisis le dossier de ton vault Obsidian."
  VAULT="$(osascript -e 'POSIX path of (choose folder with prompt "Choisis le dossier de ton vault Obsidian")' 2>/dev/null || true)"
  VAULT="${VAULT%/}"
  [ -n "$VAULT" ] && [ -d "$VAULT" ] || fail "Aucun dossier choisi. Relance le script."
  if [ ! -d "$VAULT/.obsidian" ]; then
    echo "⚠ Ce dossier ne contient pas de .obsidian : es-tu sûre que c'est la racine du vault ?"
    read -r -p "  Continuer quand même ? (o/N) " OK
    [ "$OK" = "o" ] || [ "$OK" = "O" ] || fail "Installation annulée."
  fi
  printf '%s\n' "$VAULT" > "$CONFIG_DIR/vault-root"
  echo "✓ Vault : $VAULT"
fi

# 3. Réglages (prénom qui signe les modifications)
if [ ! -f "$CONFIG_DIR/torch.env" ]; then
  cat > "$CONFIG_DIR/torch.env" <<'EOF'
# Torch : réglages de cette machine (jamais dans le vault)
TORCH_OPERATOR=Caroline
# Dossier Torch dans le vault, relatif à sa racine (défaut : Torch)
# TORCH_ZONE=Torch
# Nom du vault dans Obsidian, si tu l'as renommé (défaut : nom du dossier)
# TORCH_OBSIDIAN_VAULT=
EOF
  echo "✓ Réglages créés : $CONFIG_DIR/torch.env"
fi

# 4. Le dossier Torch dans le vault (jamais écrasé s'il existe)
ZONE_REL="$(grep -E '^TORCH_ZONE=' "$CONFIG_DIR/torch.env" | cut -d= -f2- || true)"
ZONE="$VAULT/${ZONE_REL:-Torch}"
if [ -d "$ZONE/Content" ]; then
  echo "✓ Dossier Torch déjà présent : $ZONE"
else
  mkdir -p "$ZONE/_Config"
  cp -R "$DIR/starter/Content" "$ZONE/"
  cp -n "$DIR/starter/_Config/"*.md "$ZONE/_Config/" 2>/dev/null || true
  cp -n "$DIR/starter/README.md" "$ZONE/README.md" 2>/dev/null || true
  # La fiche d'exemple prend la date du jour, pour tomber dans la semaine en cours.
  TODAY="$(date +%F)"
  for f in "$ZONE"/Content/Caroline/Posts/STARTER_*.md; do
    [ -e "$f" ] || continue
    NAME="$(basename "$f" .md)"
    NEW_ID="${TODAY}_${NAME#STARTER_}"
    sed -e "s/__ID__/$NEW_ID/" -e "s/__DATE__/$TODAY/g" "$f" > "$ZONE/Content/Caroline/Posts/$NEW_ID.md"
    rm "$f"
  done
  echo "✓ Dossier Torch créé : $ZONE"
fi

# 5. Dépendances et build (quelques minutes la première fois)
cd "$DIR"
say "Installation des dépendances (2-3 minutes la première fois)…"
npm ci --no-audit --no-fund --loglevel=error
say "Préparation de l'application…"
LOG="$HOME/Library/Logs/torch.log"
mkdir -p "$(dirname "$LOG")"
npm run build >> "$LOG" 2>&1 || fail "La préparation a échoué. Détail dans $LOG"
git rev-parse HEAD > .next/TORCH_BUILD 2>/dev/null || echo dev > .next/TORCH_BUILD
echo "✓ Application prête"

# 6. Raccourcis sur le Bureau
for NAME in "Torch" "Arrêter Torch"; do
  TARGET="$DIR/scripts/torch-serve.sh"
  [ "$NAME" = "Arrêter Torch" ] && TARGET="$DIR/scripts/torch-stop.command"
  printf '#!/usr/bin/env bash\nexec "%s"\n' "$TARGET" > "$HOME/Desktop/$NAME.command"
  chmod +x "$HOME/Desktop/$NAME.command"
done
echo "✓ Raccourcis « Torch » et « Arrêter Torch » posés sur le Bureau"

say "C'est prêt. Torch s'ouvre dans ton navigateur (http://localhost:3944)."
"$DIR/scripts/torch-serve.sh"
