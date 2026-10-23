# Xeneon

Widgets et outils pour l’écran tactile **CORSAIR XENEON EDGE** (iCUE).

## Organisation du repo

```
xeneon/
├── widgets/              un dossier par widget iCUE (empaqueté par la CI)
│   └── system-monitor/
├── templates/widget/     modèle de départ, avec détection des tailles S/M/L/XL
├── tools/                programmes Rust (Windows)
│   └── edge-swipe-test/  test : iCUE accepte-t-il un swipe simulé ?
├── docs/
│   ├── WIDGETS.md        catalogue et statut de chaque widget
│   ├── SPEC-TEMPLATE.md  fiche à remplir pour un nouveau widget
│   └── widgets/          une fiche par widget
├── scripts/              créer, valider et empaqueter les widgets
└── .github/workflows/    build automatique et releases
```

Voir le [catalogue des widgets](docs/WIDGETS.md).

## Installer un widget

Téléchargez le fichier `.icuewidget` depuis l’onglet **Releases** (ou les artefacts de la dernière exécution **Actions**), puis dans iCUE : section **Widgets** → **+** → glissez le fichier. Requiert iCUE 5.47 ou plus récent.

## Développer

### Widgets

Chaque widget est un dossier dans `widgets/` contenant au minimum `index.html`, `manifest.json` et une icône. Pour en créer un à partir du modèle :

```bash
./scripts/new-widget.sh steam-launcher "Steam Launcher"      # Linux / macOS
.\scripts\new-widget.ps1 steam-launcher "Steam Launcher"     # Windows
```

Puis pour valider et empaqueter tous les widgets :

```bash
npm install -g icuewidget-cli     # CLI officiel Corsair
./scripts/package-widgets.sh      # Linux / macOS
.\scripts\package-widgets.ps1     # Windows
```

Les paquets sont générés dans `dist/`. Ouvrir `index.html` dans un navigateur affiche un aperçu avec des données simulées ; dans iCUE, seules les vraies données sont affichées.

Tailles d’emplacement sur le XENEON EDGE :

| Taille | Horizontal | Vertical |
|---|---|---|
| S | 840 × 344 | 696 × 416 |
| M | 840 × 696 | 696 × 840 |
| L | 1688 × 696 | 696 × 1688 |
| XL | 2536 × 696 | 696 × 2536 |

### Outils Rust

```bash
cd tools/edge-swipe-test
cargo build --release
```

## Intégration continue

À chaque push, GitHub Actions valide et empaquette tous les widgets, et compile les outils Rust pour Windows. Pousser un tag `v*` (par exemple `v1.1.0`) publie automatiquement une release avec tous les fichiers.

## Documentation de référence

- Spécification des widgets iCUE : https://docs.elgato.com/icue/widgets/
