# Crée un widget à partir du modèle.
# Usage : .\scripts\new-widget.ps1 steam-launcher "Steam Launcher"
param([Parameter(Mandatory)][string]$Slug, [Parameter(Mandatory)][string]$Name)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "widgets\$Slug"
if (Test-Path $dest) { throw "widgets\$Slug existe déjà" }
Copy-Item -Recurse (Join-Path $root "templates\widget") $dest; New-Item -ItemType Directory -Force (Join-Path $dest "mockups") | Out-Null
$m = Join-Path $dest "manifest.json"
(Get-Content $m -Raw).Replace("com.mathod95.new-widget", "com.mathod95.$Slug").Replace('"New widget"', "`"$Name`"") | Set-Content $m -Encoding utf8
$h = Join-Path $dest "index.html"
(Get-Content $h -Raw).Replace("<title>New widget</title>", "<title>$Name</title>") | Set-Content $h -Encoding utf8
Write-Host "Créé : widgets\$Slug — pensez à l’ajouter au tableau du README"
