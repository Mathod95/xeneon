# CLAUDE.md

Contexte du projet pour Claude Code. À lire avant toute modification.

## Le projet

Collection de widgets iCUE pour l’écran tactile **CORSAIR XENEON EDGE** (2560 × 720, 14,5"), tous dans un même **style dot-matrix**. Propriétaire : Mathod95. Langue de travail : **français** (docs, commits, échanges). **Tout le contenu des widgets est en anglais** : `lang="en"`, textes affichés, libellés et groupes des réglages iCUE, nom et description du `manifest.json`.

La liste des widgets et leur description est dans `README.md`. Chaque widget a sa fiche dans `widgets/<slug>/README.md` et ses mocks dans `widgets/<slug>/mockups/`.

## Façon de travailler avec Mathod95

- Ne pas poser de questions : avancer avec des choix raisonnables et les signaler en une ligne.
- Réponses courtes. Quand il ajoute un widget : mettre à jour le tableau du `README.md` (colonnes Name, Description ; ne pas y répéter « style dot-matrix », déjà dit en tête, et garder les colonnes alignées) et créer `widgets/<slug>/` avec sa fiche et ses mocks.
- Arborescence montrée en n’affichant que le premier niveau des widgets.
- Git : commits directement sur `main`, en français. **Ne jamais pousser sans validation explicite de Mathod95** : commiter en local, montrer ce qui change, attendre son accord.
- Pour concevoir un widget : un artefact « maquette de référence » (taille réelle S, M, L, XL, réglages simulés, tableau des choix de design), copié dans `widgets/<slug>/mockups/reference.html`. Le tableau README a une colonne Compagnon (Oui / Optionnel / Non) à tenir à jour.
- Les mocks fournis peuvent ne pas être au style dot : ce sont des références de fonctionnalités, le style est toujours à refaire en dot-matrix.

## Organisation

```
widgets/<slug>/          un widget iCUE (index.html, manifest.json, resources/, scripts/, styles/)
  README.md              fiche : statut, contenu, données, tailles, notes, mocks
  mockups/               mocks de référence (exclus du paquet)
templates/widget/        modèle de départ, avec détection des 8 tailles (scripts/sizes.js)
docs/                    documentation Markdown (DESIGN.md, SPEC-TEMPLATE.md)
docs/DESIGN.md           charte graphique (référence unique, en cours de définition)
docs/SPEC-TEMPLATE.md    fiche type d’un widget
tools/build_site.py      génère le site GitHub Pages (`site/`) : accueil `tools/site/index.html` + maquettes de référence
scripts/                 new-widget, package-widgets (.sh et .ps1)
.github/workflows/       CI : build.yml valide et empaquette les widgets (tag v* → release) ; docs.yml publie la doc sur GitHub Pages
```

Site GitHub Pages (https://mathod95.github.io/xeneon/) : page d’accueil au style dot (`tools/site/index.html`) avec une Xeneon Edge simulée (Dot Home en page 1, une page par maquette, aperçus XL capturés avec Playwright), remplie avec le tableau du README, le statut de chaque fiche et la présence d’une maquette ; chaque maquette de référence est servie sur `/<slug>/`. Généré par `python3 tools/build_site.py` (sortie dans `site/`, ignoré par Git ; `--fragment FICHIER` pour l’aperçu en artefact) et déployé par `.github/workflows/docs.yml` à chaque push sur `main`. Le README et les fiches sont donc la source : les tenir à jour suffit.

Un dossier de widget sans `manifest.json` est une fiche seule : la CI l’ignore. Créer le code avec `./scripts/new-widget.sh <slug> "<Nom>"` (le dossier ne doit pas exister ; sinon copier `templates/widget` à la main sans écraser README.md ni mockups/).

## Format des widgets iCUE

- Spécification officielle : https://docs.elgato.com/icue/widgets/ — la consulter en cas de doute.
- CLI officiel Corsair : `npm install -g icuewidget-cli` (paquet publié par Corsair-Labs). `icuewidget validate <dossier>` puis `icuewidget package <dossier>` (le paquet est écrit à côté du dossier). Version utilisée en CI : 0.4.48.
- `manifest.json` : `author` = Mathod95, `id` = `com.mathod95.<slug>` (lettres, chiffres, points, tirets uniquement), `supported_devices` type `dashboard_lcd`, `min_app_version` 5.47, `interactive: true`, `required_plugins` selon les besoins.
- `index.html` : tout le `<head>` doit être du **XML strict** (balises auto-fermées, pas de `<` ni `&` bruts). CSS et JS dans des fichiers séparés.
- Réglages iCUE : balises `<meta name="x-icue-property" …>` (types utilisés : `color`, `sensors-combobox`) et groupes dans `<script type="application/json" id="x-icue-groups">`. Les valeurs arrivent dans des variables globales du même nom ; écouter `icueEvents.onDataUpdated`.
- Plugins iCUE (accès `window.plugins.<Nom>`, appels asynchrones par `requestId` + signal `asyncResponse`, événements `plugin<Nom>Events.onInitialized` et drapeau `plugin<nom>_initialized`) :
  - `widgetbuilder.sensorsdataprovider:Sensors:1.0` — capteurs (températures, charges, ventilateurs, pompe, batterie des appareils CORSAIR).
  - `widgetbuilder.fpsdataprovider:Fps:1.0` — FPS et processus au premier plan.
  - Également disponibles : Media (lecture en cours), Liens (ouvrir une URL), notifications, Stream Deck, actions d’appareil.
- Stockage : `localStorage` du widget pour les données locales (Dot Notes).
- **Saisie au clavier** (vérifié sur l’Edge avec Dot Frametest et Dot Typetest, octobre 2026) : toucher l’Edge ne donne pas le clavier à iCUE ; iCUE ne le prend que quand un champ de la page du widget reçoit le focus. Il faut la structure de la Checklist Corsair : `"features": ["sensor-screen"]` dans `supported_devices`, `<meta name="x-icue-interactive" />` (plus `x-icue-restrictions` et `x-icue-widget-group`) dans le `<head>`, un `translation.json`, au moins une `x-icue-property`, et `icueEvents = {…}` sans `var` ni `window.`. Sans ça, les touches partent dans la dernière fenêtre active de Windows.
- **Réseau et iframes** (même test) : `fetch` vers `localhost` et `127.0.0.1` avec permission et port, iframe locale ou distante (GitHub Pages), `postMessage` dans les deux sens et toucher dans l’iframe fonctionnent (le toucher arrive comme souris). Le clavier n’entre **pas** dans une iframe : le widget garde le focus dans un champ invisible et renvoie les touches à l’iframe (pont clavier, voir Dot Frametest 0.0.6). `uniqueId` se lit avec `typeof uniqueId`, pas sur `window`. Le widget est un fichier local (`%APPDATA%\Corsair\CUE5\html_widgets\…`), moteur QtWebEngine 6.9.3.

## Règles de conception (détail dans docs/DESIGN.md)

- Dot-matrix partout (police 5 × 7 dessinée en canvas, voir `widgets/dot-system-monitor/scripts/widget.js`, fonction `drawDots`).
- **Une mise en page par taille**, pas de simple mise à l’échelle :

| Taille | Horizontal | Vertical |
|---|---|---|
| S | 840 × 344 | 696 × 416 |
| M | 840 × 696 | 696 × 840 |
| L | 1688 × 696 | 696 × 1688 |
| XL | 2536 × 696 | 696 × 2536 |

  `templates/widget/scripts/sizes.js` pose `data-size` (s/m/l/xl) et `data-orientation` (h/v) sur `<html>`, d’après le rapport largeur / hauteur (l’aperçu de l’éditeur iCUE est réduit) ; S et L horizontaux sont séparés par la hauteur.
- Ne pas nommer une propriété `accentColor`, `textColor` ou `backgroundColor` si sa valeur par défaut doit s’appliquer : iCUE les remplace par le style de page tant que « Style personnalisé » est désactivé.
- Textes ≥ 18 px, zones tactiles ≥ 60 × 60 px. Couleurs via variables CSS (`--bg`, `--text`, `--accent`) pilotées par les réglages iCUE.
- **Dans iCUE, jamais de données simulées** : afficher `--` ou un état explicite (« NO GAME DETECTED »). Le mode démo n’existe que si le widget est ouvert hors iCUE (navigateur), pour l’aperçu.

## Le compagnon Rust (à construire)

Beaucoup de widgets ont besoin d’accès que iCUE ne donne pas. Ils passeront par **un seul programme compagnon Rust pour Windows**, en arrière-plan (zone de notification, démarrage avec Windows), qui écoute **uniquement sur 127.0.0.1** et que les widgets appellent en HTTP/WebSocket local. Organisation en modules indépendants. Secrets (mots de passe, jetons, clés d’API) stockés chiffrés côté PC (DPAPI), jamais dans les réglages iCUE.

| Module | Widgets | Rôle |
|---|---|---|
| audio | Dot Audio | volume, mixeur par app, mute de tous les micros, périphériques par défaut (API audio Windows) ; égaliseur via Equalizer APO |
| pages | Dot Home | simuler des swipes sur l’Edge pour changer de page (voir plus bas) |
| apps | Dot Apps, Dot Launcher (repli) | lancer des programmes / `steam://` |
| bambulab | Dot Bambu Lab | MQTT TLS en réseau local (IP + code d’accès) |
| discord | Dot Discord | RPC local (accès réservé aux apps approuvées) ; repli : raccourcis clavier |
| battery | Dot Battery | casque Logitech via HID++ (sans G HUB), Bluetooth via Windows |
| network | Dot Network | ping ICMP, débit, speedtest |
| mail | Dot Mail | IMAP |
| homelab | Dot Homelab, Dot Plex | Radarr, Sonarr, Seerr, Plex… (un sous-module par application) |
| ics | Dot Calendar (repli) | récupérer les ICS si le serveur bloque l’accès direct |
| ia | Dot IA | limites d’utilisation Claude de plusieurs comptes (session 5 h, hebdo) ; source à vérifier (pas d’API publique documentée) |
| github | Dot GitHub | contributions (GraphQL), pull requests, notifications et runs Actions (REST) ; token classique chiffré ; ouvre les pages GitHub dans le navigateur du PC |
| notes | Dot Notes (optionnel) | sauvegarde et synchronisation des notes dans un fichier (`%APPDATA%\Xeneon\notes.json`), partage d’une liste entre widgets, édition depuis le PC ; le widget garde son stockage local et marche sans le compagnon |

Sans compagnon : Dot System Monitor, Dot Fans (Sensors), Dot Clock, Dot Calculator, Dot Weather (Open-Meteo direct), Dot Home Assistant (WebSocket direct + jeton), Dot Notes (localStorage par `uniqueId` ; module notes du compagnon en option), Dot Spotify (plugin Media iCUE).

Compilation Windows : `cargo build --release` sous Windows, ou depuis Linux/WSL avec la cible `x86_64-pc-windows-gnu` et le linker `x86_64-w64-mingw32-gcc`. Pas de dépendances externes inutiles ; appels Win32 directs acceptés.

## Navigation entre pages iCUE — décisions

- Aucune API iCUE ne permet de changer de page ni à un widget d’en piloter un autre (vérifié dans la doc officielle et les projets communautaires).
- Gestes natifs : swipe gauche/droite = page suivante/précédente ; swipe haut/bas le long du bord = retour à la page initiale. Jusqu’à 30 pages.
- Plan : un widget launcher (miniatures + noms) sur la **page 1** ; au toucher, il demande au compagnon « page N » ; le compagnon injecte N−1 swipes tactiles (`InjectTouchInput`) sur l’écran de l’Edge. Retour au launcher par le geste natif.
- **À valider** : iCUE accepte-t-il un swipe simulé (tactile ou glisser souris) ? Attention au vol de focus avec la souris.

## État des widgets

- **Dot System Monitor** v1.1.0 : fonctionnel (FPS + 4 capteurs + historique, dot-matrix). Mise en page faite pour L/XL ; **S, M et vertical à refaire**. À migrer sur `sizes.js` du template.
- **Dot Clock** v0.1.2 : codé (S, M, L, XL horizontal ; vertical provisoire). Référence : `widgets/dot-clock/mockups/reference.html`.
- **Dot Notes, Dot Weather, Dot IA, Dot Home, Dot GitHub, Dot Calculator, Dot Spotify** : en conception, maquette de référence dans `widgets/<slug>/mockups/reference.html` (choix de design à valider ; Dot Spotify mis de côté).
- **Dot Audio, Dot Calendar, Dot Launcher** : spécifiés avec mocks.
- Autres : fiche seule (idée).
- **Prochaine étape** : définir la charte graphique (`docs/DESIGN.md`) à partir du mock de charte fourni par Mathod95, puis en faire le template de base de tous les widgets.
