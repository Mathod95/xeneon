# Valide et empaquette tous les widgets prêts (ceux qui ont un manifest.json) dans dist\.
# Les mocks et le README de chaque widget ne sont pas inclus dans le paquet.
# Prérequis : Node.js + npm install -g icuewidget-cli
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"; $build = Join-Path $root ".build"
if (Test-Path $build) { Remove-Item -Recurse -Force $build }
New-Item -ItemType Directory -Force -Path $dist, $build | Out-Null
Get-ChildItem -Directory (Join-Path $root "widgets") | ForEach-Object {
    if (-not (Test-Path (Join-Path $_.FullName "manifest.json"))) { Write-Host "-- $($_.Name) : module de Dot Hub, pas de paquet iCUE"; return }
    Write-Host "== $($_.Name)"
    $dest = Join-Path $build $_.Name
    Copy-Item -Recurse $_.FullName $dest
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $dest "mockups"), (Join-Path $dest "README.md")
    icuewidget validate $dest
    icuewidget package $dest
}
Get-ChildItem (Join-Path $build "*.icuewidget") | Move-Item -Force -Destination $dist
Remove-Item -Recurse -Force $build
Write-Host "Paquets disponibles dans $dist"
