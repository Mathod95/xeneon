#!/usr/bin/env bash
# Crée un widget à partir du modèle.
# Usage : ./scripts/new-widget.sh steam-launcher "Steam Launcher"
set -euo pipefail
slug="${1:?usage: new-widget.sh <slug> \"<Nom affiché>\"}"
name="${2:?usage: new-widget.sh <slug> \"<Nom affiché>\"}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/widgets/$slug"
[ -e "$dest" ] && { echo "widgets/$slug existe déjà"; exit 1; }
cp -r "$root/templates/widget" "$dest"
sed -i.bak "s/com.mathod95.nouveau-widget/com.mathod95.$slug/; s/\"Nouveau widget\"/\"$name\"/" "$dest/manifest.json"
sed -i.bak "s/<title>Nouveau widget<\/title>/<title>$name<\/title>/" "$dest/index.html"
rm -f "$dest"/*.bak
echo "Créé : widgets/$slug — pensez à l'ajouter dans docs/WIDGETS.md"
