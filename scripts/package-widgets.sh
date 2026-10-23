#!/usr/bin/env bash
# Valide et empaquette tous les widgets prêts (ceux qui ont un manifest.json) dans dist/.
# Les mocks et le README de chaque widget ne sont pas inclus dans le paquet.
# Prérequis : Node.js + npm install -g icuewidget-cli
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/dist"; build="$root/.build"
rm -rf "$build"; mkdir -p "$dist" "$build"
for w in "$root"/widgets/*/; do
  name="$(basename "$w")"
  [ -f "$w/manifest.json" ] || { echo "-- $name : pas encore de code, ignoré"; continue; }
  echo "== $name"
  mkdir -p "$build/$name"
  (cd "$w" && tar --exclude=./mockups --exclude=./README.md -cf - .) | (cd "$build/$name" && tar -xf -)
  icuewidget validate "$build/$name"
  icuewidget package "$build/$name"
done
mv "$build"/*.icuewidget "$dist/" 2>/dev/null || true
rm -rf "$build"
echo "Paquets disponibles dans $dist"
