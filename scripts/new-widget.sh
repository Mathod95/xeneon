#!/usr/bin/env bash
# Crée un widget à partir du modèle.
# Usage : ./scripts/new-widget.sh steam-launcher "Steam Launcher"
set -euo pipefail
slug="${1:?usage: new-widget.sh <slug> \"<Nom affiché>\"}"
name="${2:?usage: new-widget.sh <slug> \"<Nom affiché>\"}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/widgets/$slug"
[ -e "$dest" ] && { echo "widgets/$slug existe déjà"; exit 1; }
cp -r "$root/templates/widget" "$dest"; mkdir -p "$dest/mockups"
sed -i.bak "s/com.mathod95.new-widget/com.mathod95.$slug/; s/\"New widget\"/\"$name\"/" "$dest/manifest.json"
sed -i.bak "s/<title>New widget<\/title>/<title>$name<\/title>/" "$dest/index.html"
rm -f "$dest"/*.bak
echo "Créé : widgets/$slug — pensez à l’ajouter au tableau du README"
