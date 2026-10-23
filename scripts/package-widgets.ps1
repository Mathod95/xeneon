# Valide et empaquette tous les widgets de widgets/ dans dist/
# Prérequis : Node.js + npm install -g icuewidget-cli
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Get-ChildItem -Directory (Join-Path $root "widgets") | ForEach-Object {
    Write-Host "== $($_.Name)"
    icuewidget validate $_.FullName
    icuewidget package $_.FullName
}
# le CLI écrit le paquet à côté du dossier du widget : on le range dans dist/
Move-Item -Force (Join-Path $root "widgets\*.icuewidget") $dist
Write-Host "Paquets disponibles dans $dist"
