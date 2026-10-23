#!/usr/bin/env bash
# Valide et empaquette tous les widgets de widgets/ dans dist/
# Prérequis : Node.js + npm install -g icuewidget-cli
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/dist"
for w in "$root"/widgets/*/; do
  echo "== $(basename "$w")"
  icuewidget validate "$w"
  icuewidget package "$w"
done
# le CLI écrit le paquet à côté du dossier du widget : on le range dans dist/
mv "$root"/widgets/*.icuewidget "$root/dist/"
echo "Paquets disponibles dans $root/dist"
