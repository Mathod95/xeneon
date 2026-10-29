# CLAUDE.md

Contexte du projet pour Claude Code. À lire avant toute modification. Ce fichier doit suffire pour reprendre le projet depuis n’importe où (VS Code, Cowork, nouvelle session) : le tenir à jour à chaque décision. **Lire aussi `MEMORY.md`** (préférences fines de Mathod95, leçons apprises, historique des décisions, questions ouvertes) et le compléter à chaque décision ou leçon nouvelle.

## Le projet

**Dot Hub** : collection de modules pour l’écran tactile **CORSAIR XENEON EDGE** (2560 × 720, 14,5"), tous dans un même **style dot-matrix** (« Dot style »), affichés par **un seul widget iCUE** (Dot Hub) et servis par **un seul programme Windows** (Dot Companion, en Rust). Propriétaire : Mathod95 (Mathias). Dépôt : https://github.com/Mathod95/xeneon. Langue de travail : **français** (docs, commits, échanges). **Tout le contenu affiché sur l’Edge est en anglais** : `lang="en"`, textes affichés, libellés et groupes des réglages iCUE, nom et description du `manifest.json`. Le site (Dot Page…) est en français et en anglais.

La liste des modules et leur description est dans `README.md`. Chaque module a sa fiche dans `widgets/<slug>/README.md` et ses mocks dans `widgets/<slug>/mockups/`.

## Façon de travailler avec Mathod95

- Ne pas poser de questions : avancer avec des choix raisonnables et les signaler en une ligne. Réponses courtes, en français.
- Quand il ajoute un module : mettre à jour le tableau du `README.md` (colonnes Name, Description ; ne pas y répéter « style dot-matrix », déjà dit en tête, et garder les colonnes alignées) et créer `widgets/<slug>/` avec sa fiche et ses mocks.
- Arborescence montrée en n’affichant que le premier niveau des widgets.
- **Git** : commits directement sur `main`, en français, style du dépôt « Sujet : ce qui change » (pas de préfixe `feat:` / `fix:`). **Ne jamais pousser sans validation explicite de Mathod95** : commiter en local, montrer ce qui change, attendre son accord. Un push sans tag suffit pour tester (la CI compile l’exe) ; un tag `v*` seulement quand il le demande (voir « Versions et releases »).
- **Jeton GitHub** : jamais écrit dans un fichier, ni dans la config Git, ni dans un commit. S’il en fournit un, il ne sert qu’en ligne de commande, au moment du push, et la sortie est masquée.
- **Logos de marques** : ne pas les dessiner ni les reproduire. Un fichier fourni par Mathod95 peut être intégré tel quel.
- **Secrets** (clés d’API, jetons) : chiffrés sur le PC (DPAPI) par le compagnon, jamais dans les réglages iCUE, jamais renvoyés en clair (masque `••••••••`).
- Ne jamais supprimer un dossier de travail ou d’artefact avec `rm -rf` sur un chemin relatif : écraser les fichiers à la place.
- **Commentaires sur un artefact** : faire la modification dans le dépôt, régénérer, republier, puis répondre dans le fil du commentaire (pas de résolution du fil sans sa demande).
- Les mocks fournis peuvent ne pas être au style dot : ce sont des références de fonctionnalités, le style est toujours à refaire en dot-matrix.

## Artefacts = production

Les artefacts (pages publiées sur claude.ai, privées) sont la vitrine de référence. **Ils sont toujours générés depuis le dépôt**, jamais modifiés à la main : une demande sur un artefact → modification du fichier source → régénération → republication à la même adresse. La GitHub Page est construite par le même script à chaque push : artefact, site et Edge restent identiques (sauf les liens entre pages, qui pointent vers les artefacts dans un cas, vers le site dans l’autre). Tant qu’un commit n’est pas poussé, l’artefact peut avoir un temps d’avance sur la GitHub Page.

Fichiers générés : `site/` (ignoré par Git) ou un dossier de travail ; ils ne sont pas commités (copies, 3,6 Mo pour Dot Page avec ses captures).

Les artefacts appartiennent au compte claude.ai de la session VS Code (recréés le 29 octobre 2026, les anciennes adresses publiées depuis un autre compte ne sont plus suivies). Publier depuis un autre compte crée de nouvelles adresses, à reporter alors ici et dans `build_site.py`.

### Registre

| Artefact | Type de page | Adresse | Source dans le dépôt | Fichier à publier |
|---|---|---|---|---|
| Dot Page | `homePage` | https://claude.ai/artifact/9LuRfha2bygFfup1GQk4mB | `tools/site/index.html` + `README.md` + fiches + `tools/site/modules.en.json` | `build_site.py --fragment <fichier>` |
| Dot Companion | `subPage` | https://claude.ai/artifact/DG6Y5j5NTaRhcXrUPyYzbQ | `tools/site/companion.html` | `build_site.py --companion-fragment <fichier>` |
| Dot Release | `releasePage` | https://claude.ai/artifact/2FPiRAKZ1qtuiTxjnDyUJh | `tools/site/releases.html` + `releases.json` | `build_site.py --releases-fragment <fichier>` |
| Companion Mockup | `modulePage` | https://claude.ai/artifact/BdvnCbdBqsspXWnYNLXA9d | `companion/mockups/reference.html` (charge la vraie `companion/web/settings.html`, `home.html`, `hub/module.js`) | `build_site.py --companion-mockup <dossier>` (page + fichiers) |
| Gabarit homePage | `subPage` (charte) | https://claude.ai/artifact/Hr7w7CoyhY3ViCRQpZkMYz | `docs/design/homePage.html` (anatomie d’une homePage, vraie vue et squelette) | le fichier tel quel (site: `/design/homepage/`) |
| Dot Hub | `modulePage` | https://claude.ai/artifact/WRmQrPJQqjq6igmpVkMc61 | `widgets/dot-hub/mockups/reference.html` (+ fichiers de Dot Clock) | dossier `site/dot-hub/` |
| Dot Clock | `modulePage` | https://claude.ai/artifact/BEWYw6DnjPqLf5fcqCiwMR | `widgets/dot-clock/mockups/reference.html` + `scripts/`, `styles/`, `resources/` | dossier `site/dot-clock/` |
| Dot Steam | `modulePage` | https://claude.ai/artifact/32wdKcfDbSCTtraduMR2wm | `widgets/dot-steam/mockups/reference.html` + fichiers du module | dossier `site/dot-steam/` |
| Dot Home Assistant | `modulePage` | https://claude.ai/artifact/AWvhLH7JJNJJp4hZHyXNHx | `widgets/dot-homeassistant/mockups/reference.html` | `site/dot-homeassistant/index.html` |
| Dot Apps | `modulePage` | https://claude.ai/artifact/H1iERAQjuQjsBimhPLzMm4 | `widgets/dot-apps/mockups/reference.html` | `site/dot-apps/index.html` |
| Dot Audio | `modulePage` | https://claude.ai/artifact/Q6v78rrtfAS9tqs275ouuc | `widgets/dot-audio/mockups/reference.html` | `site/dot-audio/index.html` |
| Dot Bambu Lab | `modulePage` | https://claude.ai/artifact/A2oAdA65PQqtXuWbCJpnvz | `widgets/dot-bambulab/mockups/reference.html` | `site/dot-bambulab/index.html` |
| Dot Calculator | `modulePage` | https://claude.ai/artifact/EboRTHFchYmVniJJisxrL5 | `widgets/dot-calculator/mockups/reference.html` | `site/dot-calculator/index.html` |
| Dot Discord | `modulePage` | https://claude.ai/artifact/Pfi98XxP5HzSVRPStqo8BR | `widgets/dot-discord/mockups/reference.html` | `site/dot-discord/index.html` |
| Dot GitHub | `modulePage` | https://claude.ai/artifact/61bUnmTQvzorfxa78QRfgh | `widgets/dot-github/mockups/reference.html` | `site/dot-github/index.html` |
| Dot Gmail | `modulePage` | https://claude.ai/artifact/LdhLcGYcvyb7JKXoKRbh8Z | `widgets/dot-gmail/mockups/reference.html` | `site/dot-gmail/index.html` |
| Dot Home | `modulePage` | https://claude.ai/artifact/2iMP2wLHqkSsnMc8gkyeMm | `widgets/dot-home/mockups/reference.html` | `site/dot-home/index.html` |
| Dot IA | `modulePage` | https://claude.ai/artifact/WfN55SzJM6BmbdsMHhrLMa | `widgets/dot-ia/mockups/reference.html` | `site/dot-ia/index.html` |
| Dot Notes | `modulePage` | https://claude.ai/artifact/KDzEwfsf9spdysedns4ivd | `widgets/dot-notes/mockups/reference.html` | `site/dot-notes/index.html` |
| Dot Plex | `modulePage` | https://claude.ai/artifact/KecpPioLvYHpXqdjLGwMzY | `widgets/dot-plex/mockups/reference.html` | `site/dot-plex/index.html` |
| Dot Slack | `modulePage` | https://claude.ai/artifact/BTpWBDwL1HamdpezWkS9yq | `widgets/dot-slack/mockups/reference.html` | `site/dot-slack/index.html` |
| Dot Spotify | `modulePage` | https://claude.ai/artifact/VdWjfo71YmvJjSgxKR1nUy | `widgets/dot-spotify/mockups/reference.html` | `site/dot-spotify/index.html` |
| Dot Weather | `modulePage` | https://claude.ai/artifact/8L2VETdyiSuvhTxJoiGTRU | `widgets/dot-weather/mockups/reference.html` | `site/dot-weather/index.html` |

- `python3 tools/build_site.py` (sans option) écrit tout le site dans `site/` : `site/<slug>/` est exactement le dossier de l’artefact du module (la page `index.html` sans `<base href="../">`, plus les fichiers du module qu’elle charge ; ignorer `preview.jpg`). Un module qui charge un autre module (Dot Hub → Dot Clock) a ses fichiers dans `site/<slug>/<autre-slug>/`.
- Les adresses des quatre pages du site sont aussi dans `build_site.py` (`ARTIFACT_PAGE`, `ARTIFACT_RELEASE`, `ARTIFACT_COMPANION`, `ARTIFACT_COMPANION_MOCKUP`) pour que leurs boutons se répondent ; les tenir identiques à ce registre.
- Nouvel artefact : l’ajouter ici (et dans `build_site.py` si c’est une page du site).
- **Ordre de publication** : la dernière publication s’ouvre chez Mathod95, il doit rester sur ce sur quoi on travaille. Module : Dot Page d’abord, puis le module. Compagnon : maquette, présentation, puis Dot Page et Dot Release.
- **Après chaque modification d’un `dot-xxx`** (maquette, fiche, code) : régénérer et republier Dot Page aussi, pour qu’elle reste iso au dépôt.
- Voir le site en local (VS Code) : `python3 tools/build_site.py` puis `python3 -m http.server -d site` et ouvrir http://127.0.0.1:8000/ (Playwright est nécessaire pour les captures de l’Edge simulée ; sans lui, le site se construit sans aperçus).

## Organisation

```
CLAUDE.md                règles et contexte (ce fichier)
MEMORY.md                mémoire de travail : préférences, leçons, historique, questions ouvertes
widgets/dot-hub/         le seul widget iCUE : la coquille de Dot Hub (manifest.json)
widgets/<slug>/          un module de Dot Hub (index.html servi par le compagnon, scripts/, styles/, resources/), sans manifest.json
  README.md              fiche : statut, contenu, données, tailles, notes, mocks
  mockups/               maquette de référence (reference.html) et mocks (exclus du paquet)
templates/widget/        modèle de départ d’un module, avec détection des 4 tailles (scripts/sizes.js)
docs/design/             charte graphique, DA (référence unique, en cours ; index : README.md, types de pages du site)
docs/SPEC-TEMPLATE.md    fiche type d’un module
tools/build_site.py      génère le site GitHub Pages (`site/`) et les fichiers des artefacts
tools/site/              pages du site : index.html (Dot Page), companion.html, releases.html + releases.json, modules.en.json
scripts/                 new-widget, package-widgets (.sh et .ps1)
tests/dot-frametest/     widget de test (réseau, iframe, clavier, redirection) + serveur PowerShell ; hors CI
companion/               Dot Companion (Rust) : src/, web/ (accueil, réglages, hub/module.js), mockups/ (Companion Mockup), README.md (routes)
.github/workflows/       build.yml (paquet Dot Hub, release sur tag), companion.yml (exe Windows), docs.yml (GitHub Pages)
```

### Le site (GitHub Pages)

https://mathod95.github.io/xeneon/, généré par `python3 tools/build_site.py` et déployé par `docs.yml` à chaque push sur `main`. Le README et les fiches sont la source. Types de pages (détail dans `docs/design/README.md`) : `homePage` (Dot Page, une seule), `subPage` (page générique sous l’accueil : Dot Companion aujourd’hui, guides ou FAQ demain), `modulePage` (maquettes de référence, `/<slug>/`, et Companion Mockup, `/dot-companion/`), `releasePage` (Dot Release, `/releases/`).

- **Dot Page** (`tools/site/index.html`) : en-tête (FR / EN, Companion, Releases, GitHub), titre DOT HUB en points, chiffres clés (1 widget, 1 companion, modules, maquettes, en cours), Xeneon Edge simulée (accueil de Dot Hub puis une page par maquette, captures XL faites avec Playwright ; défilement automatique toutes les 5 s, pause au survol et au focus clavier), bloc Dot Hub (ce que c’est, installation en 3 étapes), puis une carte par module (sans filtres). Bilingue (bouton FR / EN, choix gardé dans le navigateur, `?lang=en`) : descriptions anglaises des modules dans `tools/site/modules.en.json`, à mettre à jour quand une description du README change. Dot Hub est présenté à part, pas dans « Les modules ».
- **Dot Release** (`tools/site/releases.html`, données `releases.json`) : versions de la plus récente à la plus ancienne au centre, titre RELEASES à gauche, liste des versions à droite. Une entrée par tag, plus `next` pour ce qui est sur `main` sans tag ; lignes Nouveau / Changé / Corrigé en français et en anglais. **À chaque commit qui change le produit** (Dot Hub, compagnon, modules), ajouter la ligne dans `next`.
- **Dot Companion** (`tools/site/companion.html`) : présentation du compagnon (ce qu’il fait, installation, ce qu’il utilise module par module, confidentialité, la suite). Décrit la version téléchargeable (0.4.0) : à mettre à jour au tag v0.5.0 (plus de fenêtre, icône, mise à jour depuis l’app, pages).
- **Companion Mockup** (`companion/mockups/reference.html`, base = racine du dépôt) : vues « Réglages · navigateur » (la vraie page de réglages avec une API simulée, mêmes routes que `main.rs`) et « Zone de notification · 0.5.0 » (icône et menu), puis le tableau des choix (lignes 1 à 8 validées, 9 à 11 à valider). **À garder iso quand le compagnon change** (routes simulées comprises).

## Format des widgets iCUE

- Spécification officielle : https://docs.elgato.com/icue/widgets/ — la consulter en cas de doute.
- CLI officiel Corsair : `npm install -g icuewidget-cli` (paquet publié par Corsair-Labs). `icuewidget validate <dossier>` puis `icuewidget package <dossier>` (le paquet est écrit à côté du dossier). Version utilisée en CI : 0.4.48.
- `manifest.json` : `author` = Mathod95, `id` = `com.mathod95.<slug>` (lettres, chiffres, points, tirets uniquement), `supported_devices` type `dashboard_lcd`, `min_app_version` 5.47, `interactive: true`, `required_plugins` selon les besoins.
- `index.html` : tout le `<head>` doit être du **XML strict** (balises auto-fermées, pas de `<` ni `&` bruts). CSS et JS dans des fichiers séparés.
- Réglages : balises `<meta name="x-icue-property" …>` (types utilisés : `color`, `switch`, `combobox`, `textfield`, `sensors-combobox`) et groupes dans `<script type="application/json" id="x-icue-groups">`. Dans un module, ces balises décrivent ses réglages : le compagnon en génère la page de réglages, et `hub/module.js` pose les valeurs dans des variables globales du même nom puis appelle `icueEvents.onDataUpdated`, comme iCUE.
- Plugins iCUE (accès `window.plugins.<Nom>`, appels asynchrones par `requestId` + signal `asyncResponse`, événements `plugin<Nom>Events.onInitialized` et drapeau `plugin<nom>_initialized`) :
  - `widgetbuilder.sensorsdataprovider:Sensors:1.0` — capteurs (températures, charges, ventilateurs, pompe, batterie des appareils CORSAIR).
  - `widgetbuilder.fpsdataprovider:Fps:1.0` — FPS et processus au premier plan.
  - Également disponibles : Media (lecture en cours), Liens (ouvrir une URL), notifications, Stream Deck, actions d’appareil.
- **Saisie au clavier** (vérifié sur l’Edge avec Dot Frametest et Dot Typetest, octobre 2026) : toucher l’Edge ne donne pas le clavier à iCUE ; iCUE ne le prend que quand un champ de la page du widget reçoit le focus. Il faut la structure de la Checklist Corsair : `"features": ["sensor-screen"]` dans `supported_devices`, `<meta name="x-icue-interactive" />` (plus `x-icue-restrictions` et `x-icue-widget-group`) dans le `<head>`, un `translation.json`, au moins une `x-icue-property`, et `icueEvents = {…}` sans `var` ni `window.`. Sans ça, les touches partent dans la dernière fenêtre active de Windows.
- **Réseau et iframes** (même test) : `fetch` vers `localhost` et `127.0.0.1` avec permission et port, iframe locale ou distante (GitHub Pages), `postMessage` dans les deux sens et toucher dans l’iframe fonctionnent (le toucher arrive comme souris). Le clavier n’entre **pas** dans une iframe : le widget garde le focus dans un champ invisible et renvoie les touches à l’iframe (pont clavier, voir Dot Frametest 0.0.6). `uniqueId` se lit avec `typeof uniqueId`, pas sur `window`. La redirection du widget vers une page locale, puis le retour, fonctionnent aussi. Détail des résultats : `tests/dot-frametest/README.md`. Le widget est un fichier local (`%APPDATA%\Corsair\CUE5\html_widgets\…`), moteur QtWebEngine 6.9.3.

## Règles de conception (détail dans docs/design/)

- **Dot style partout** : chiffres, titres et pictogrammes en points (police 5 × 7 dessinée en canvas, voir `widgets/dot-system-monitor/scripts/widget.js`, fonction `drawDots` ; pictogrammes 7 × 7). Un seul thème sombre. Fond `#080808` ; sur les pages web, les maquettes et la page de réglages, trame de points `radial-gradient(circle, #161616 1.2px, transparent 1.6px)` de 22 px (toute nouvelle page la reprend).
- **Une seule couleur d’accent** pour tout Dot Hub, émeraude `#10B981` par défaut (autre proposée : Rouge A `#ED403B`). Couleurs communes réglées une fois dans le compagnon (carte « Paramètres globaux ») : `dotAccentColor`, `litDotColor` (`#F2F0E9`), `unlitDotColor` (`#1C1C1C`), `labelColor` (`#B8B6B0`) ; elles passent avant les réglages de chaque module. Polices : Fira Code (libellés, valeurs), Segoe UI (texte des pages web).
- **Maquette = widget (une seule source)** : le rendu d’un module vit dans ses propres fichiers (`scripts/<nom>.js` qui expose `mount(scène, { size, settings, now })`, `styles/<nom>.css` aux classes préfixées). Le module servi par le compagnon et la maquette de référence les chargent tous les deux. La maquette ne garde que l’habillage (titre, réglages simulés, tableau) et passe au rendu ses réglages simulés sous les noms des propriétés. Dans le dépôt, `mockups/reference.html` porte `<base href="../">` pour trouver les fichiers du module ; `build_site.py` les copie à côté pour le site et l’artefact. Fait pour Dot Clock et Dot Steam ; à faire pour les autres quand ils seront codés.
- **Le code doit toujours être iso aux maquettes de référence** : mêmes tailles d’emplacement, mêmes positions, mêmes valeurs CSS. Reprendre leur CSS et leur logique de rendu plutôt que de réinventer une mise en page. Toute différence voulue est signalée.
- **Libellé « ● DOT XXXX » toujours au même endroit et à la même taille**, dans tous les modules et maquettes : point de 10 px en couleur d’accent à 56 px du bord gauche et 51 px du haut, texte Fira Code 18 px (interligne 24 px, capitales espacées .2em) à 80 px du bord gauche et 44 px du haut. Rien d’autre dans ce coin. Repère : Dot Clock. **Pour l’instant appliqué en XL seulement.**
- **Pour l’instant, on ne travaille que le format XL** (maquettes, code, corrections, compagnon). Les tailles S, M et L existantes restent telles quelles et seront reprises plus tard.
- **Un module par service** : pas de module fourre-tout (Dot Homelab a été découpé en Dot Radarr, Dot Sonarr, Dot Seerr…).
- **Une mise en page par taille**, pas de simple mise à l’échelle :

| Taille | Emplacement |
|---|---|
| S | 840 × 344 |
| M | 840 × 696 |
| L | 1688 × 696 |
| XL | 2536 × 696 |

**Jamais de vertical** : uniquement ces quatre tailles, rien d’autre n’est conçu ni codé.

  `templates/widget/scripts/sizes.js` pose `data-size` (s/m/l/xl) sur `<html>`, d’après le rapport largeur / hauteur (l’aperçu de l’éditeur iCUE est réduit) ; S et L horizontaux sont séparés par la hauteur.
- Ne pas nommer une propriété `accentColor`, `textColor` ou `backgroundColor` si sa valeur par défaut doit s’appliquer : iCUE les remplace par le style de page tant que « Style personnalisé » est désactivé.
- Textes ≥ 18 px, zones tactiles ≥ 60 × 60 px.
- **Sur l’Edge, jamais de données simulées** : afficher `--` ou un état explicite (« NO GAME DETECTED », « STEAM NOT FOUND »). Les données d’exemple n’existent que dans les maquettes.

## Architecture (décisions du 25 au 29 octobre 2026)

- **Dot Hub est le seul widget iCUE** : chaque `dot-xxx` est un module de Dot Hub, sans `manifest.json`, jamais empaqueté seul. Un seul paquet à installer, une seule configuration (dans le compagnon).
- Dot Hub = une **coquille iCUE** minimale (`widgets/dot-hub`) + une **interface web servie par le compagnon** : la coquille ouvre `http://127.0.0.1:47800/i/<uniqueId>`.
  - La coquille a la structure de la Checklist (clavier), fait le **pont clavier**, transmet `uniqueId`, la taille de l’emplacement et les données des plugins iCUE (capteurs, FPS, Media), qui ne sont accessibles que dans la coquille.
  - **Tout passe par le compagnon, ou rien** (règle de Mathod95, 27 octobre 2026) : jamais d’interface de module intégrée dans le paquet Dot Hub. La coquille ne contient que l’écran d’attente, l’écran d’erreur (« COMPANION NOT RUNNING ») et le pont clavier.
- **Pages** (0.5.0, 28 octobre 2026) : une page = un module ajouté avec « + » et ses réglages. Les pages sont **communes à tous les Dot Hub** ; on peut ajouter le même module deux fois avec des réglages différents.
  - Sur l’Edge, l’accueil (`companion/web/home.html`, libellé « DOT HUB ») montre une tuile par page puis une carte « + » (choisir un module ajoute une page et l’ouvre ; tuile « ← » pour revenir). Toucher une tuile ouvre la page. Appui long (1 s) ou toucher « ● DOT … » : retour à l’accueil. Bouton « ⚙ SETTINGS » : le compagnon ouvre `http://127.0.0.1:47800/settings` dans le navigateur du PC.
  - Chaque Dot Hub (`uniqueId`) garde la page qu’il affiche et la rouvre au lancement d’iCUE. Une page retirée renvoie à l’accueil les Dot Hub qui l’affichaient.
  - Page de réglages (`companion/web/settings.html`) : carte « Paramètres globaux » (couleurs communes, démarrage avec Windows, mise à jour), carte **DOT HUB** (l’accueil en direct, XL, sans SETTINGS), puis une carte par page sans titre : l’écran en direct et les réglages du module au style des maquettes (générés depuis ses `x-icue-property`), « Valeurs par défaut » et « Retirer la page ». Les changements faits sur l’Edge apparaissent dans la page (et inversement) en quelques secondes.
  - Configuration d’avant 0.5.0 (un module et des réglages par Dot Hub) reprise automatiquement en pages au premier démarrage.
- Les fiches `widgets/<slug>/` et leurs maquettes restent la référence de design de chaque module.

## Navigation entre pages iCUE

- Aucune API iCUE ne permet de changer de page ni à un widget d’en piloter un autre (vérifié dans la doc officielle et les projets communautaires).
- Gestes natifs : swipe gauche/droite = page suivante/précédente ; swipe haut/bas le long du bord = retour à la page initiale. Jusqu’à 30 pages.
- Avec Dot Hub, le changement de page iCUE n’est plus nécessaire (pages internes, voir « Architecture »). L’ancien plan (le compagnon simule des swipes avec `InjectTouchInput`) est abandonné.

## Le compagnon (Dot Companion, Rust)

Détail des routes et du fonctionnement : `companion/README.md`. **Un seul programme Rust pour Windows**, qui écoute **uniquement sur 127.0.0.1:47800** (requêtes refusées si l’en-tête `Host` n’est pas local). Il sert l’accueil, la page de réglages et chaque module (`/m/<id>/`, dossiers des modules intégrés dans l’exe), garde la configuration dans `%APPDATA%\Xeneon\config.json` et donne les accès que iCUE ne donne pas.

- **0.5.0** (sur `main`, pas encore tagué ; dernière release : v0.4.0) :
  - plus de fenêtre console : icône en points 4 × 4 dans la zone de notification (`src/tray.rs`, Win32 écrit à la main) ; clic gauche = réglages ; clic droit = menu (version et nombre de Dot Hub connectés, Ouvrir les réglages, Identifier les Dot Hub, Démarrer avec Windows, mise à jour, Quitter) ; port déjà pris → message Windows ;
  - démarrage avec Windows (clé `HKCU\…\Run`, activé à la première ouverture) ;
  - mise à jour depuis l’app (`src/update.rs`) : compare sa version à la dernière release GitHub (au démarrage puis toutes les 24 h), télécharge `dot-companion.exe`, vérifie `dot-companion.exe.sha256`, renomme l’exe en cours en `.old.exe`, relance avec `--updated`, supprime l’ancien au démarrage suivant. Fonctionne à partir de la première release taguée qui contient le fichier SHA-256 (la 0.4.0 doit être remplacée à la main une fois) ;
  - pages de Dot Hub (voir « Architecture »).
- Modules servis aujourd’hui : Dot Clock, Dot Steam (`src/steam.rs`).
- Secrets des modules chiffrés avec DPAPI (`SECRET_KEYS` dans `main.rs`), masqués dans les réponses.
- Essais hors Windows : `cargo run` dans `companion/` (configuration dans `~/.config/Xeneon/`), `cargo test`, `cargo check --features check-win` (vérifie le code Win32 de l’icône sous Linux), `DOT_UPDATE_URL` (remplace l’API GitHub pour tester la mise à jour), `DOT_STEAM_PATH` et `DOT_STEAM_REGISTRY` (faux dossier Steam). La cible Windows se compile dans la CI (`companion.yml`), ou sous Windows avec `cargo build --release`.

Modules du compagnon prévus :

| Module | Widgets | Rôle |
|---|---|---|
| audio | Dot Audio | volume, mixeur par app, mute de tous les micros, périphériques par défaut (API audio Windows) ; égaliseur via Equalizer APO |
| hub | Dot Hub | sert l’interface web de Dot Hub et de ses modules, la configuration (fichier + page de réglages sur le PC), les pages (un module ajouté avec « + » et ses réglages, communes à tous les Dot Hub) et la page affichée par chaque instance (`uniqueId` → page) |
| apps | Dot Apps | lancer des programmes |
| bambulab | Dot Bambu Lab | MQTT TLS en réseau local (IP + code d’accès) |
| discord | Dot Discord | RPC local (accès réservé aux apps approuvées) ; repli : raccourcis clavier |
| battery | Dot Battery | casque Logitech via HID++ (sans G HUB), Bluetooth via Windows |
| network | Dot Network | ping ICMP, débit, speedtest |
| slack | Dot Slack | API Web de Slack (jeton d’utilisateur `xoxp-…`) et Socket Mode (`xapp-…`) : non lus, mentions, statut, pause des notifications |
| gmail | Dot Gmail | IMAP Gmail (mot de passe d’application) : non lus par catégorie, derniers messages, lu / archiver |
| homelab | Dot Plex, Dot Radarr, Dot Sonarr, Dot Seerr, Dot qBittorrent, Dot Proxmox, Dot Portainer, Dot ArgoCD | un sous-module par application auto-hébergée, jetons et clés d’API chiffrés sur le PC |
| kubernetes | Dot Kubernetes | kubeconfig du PC, API du cluster (nœuds, pods, déploiements) |
| ics | Dot Calendar (repli) | récupérer les ICS si le serveur bloque l’accès direct |
| ia | Dot IA | limites d’utilisation Claude de plusieurs comptes (session 5 h, hebdo) ; source à vérifier (pas d’API publique documentée) |
| github | Dot GitHub | contributions (GraphQL), pull requests, notifications et runs Actions (REST) ; token classique chiffré ; ouvre les pages GitHub dans le navigateur du PC |
| notes | Dot Notes | notes et listes enregistrées dans un fichier (`%APPDATA%\Xeneon\notes.json`), partagées entre instances, modifiables depuis le PC |
| steam | Dot Steam | fichiers locaux de Steam (bibliothèques, `appmanifest`, `localconfig.vdf`, jaquettes en cache) ; lancement `steam://rungameid/<id>`, pages `steam://open/<page>`, statut `steam://friends/status/<statut>` ; amis et statut via l’API Web Steam (clé + SteamID64) ; avatar `config/avatarcache` |
| homeassistant | Dot Home Assistant | API WebSocket de Home Assistant (jeton longue durée) : états et appels de services |

Sans compagnon : rien. Tous les modules passent par le compagnon, même ceux qui n’ont besoin d’aucun accès Windows (Weather, Calculator, Notes…), puisqu’il sert leur interface. Les données iCUE (capteurs, FPS, Media) sont relayées par la coquille de Dot Hub. Pas de dépendances externes inutiles ; appels Win32 directs acceptés.

## Versions et releases

- Un tag `v*` (SemVer, `0.x` : le chiffre du milieu monte pour les nouveautés) crée la release GitHub : `build.yml` joint le paquet `.icuewidget` de Dot Hub, `companion.yml` joint `dot-companion.exe` et `dot-companion.exe.sha256`.
- Push sans tag : `companion.yml` compile quand même l’exe (artefact du run, onglet Actions) dès que `companion/`, `widgets/dot-clock/` ou `widgets/dot-steam/` change ; `docs.yml` publie le site. Ajouter un module servi par le compagnon → l’ajouter aux chemins de `companion.yml`.
- Au moment du tag : dans `tools/site/releases.json`, `next` devient la version taguée (date, composants) ; mettre à jour `Cargo.toml` (version du compagnon, et `Cargo.lock`, la CI compile en `--locked`), la page Dot Companion et l’état ci-dessous.
- Releases : v0.1.0 à v0.4.0. Prochaine : v0.5.0 (compagnon 0.5.0, pages, Dot Steam 0.2).

## État des modules

- **Dot Hub** (coquille 0.4.0) + **Dot Companion 0.5.0** : voir « Architecture » et « Le compagnon ». L’exe Windows est compilé par GitHub Actions, à tester sur le PC (icône, menu, démarrage, pages, reprise de la configuration).
- **Dot Clock** v0.1.3 : codé (S, M, L, XL). Référence : `widgets/dot-clock/mockups/reference.html`.
- **Dot Steam** v0.2.0 (à essayer sur le PC) : codé en XL ; noms longs, 4 rendus de jaquettes (Cover render), téléchargements (`StateFlags`, dossier `downloading`), panneau Downloads ou Profile, amis (clé d’API Steam). Lit les réglages de sa page (`?page=`). Reste : choisir le rendu de jaquette par défaut.
- **Dot System Monitor** v1.1.0 : fonctionnel (FPS + 4 capteurs + historique). Mise en page faite pour L/XL ; **S et M à refaire**. À migrer sur `sizes.js` du template et en module de Dot Hub.
- **Dot Home Assistant** : en conception, **en pause**. Maquette avec une colonne de 3 lumières et une colonne de 2 capteurs ; section Cartes : lumière compacte (153 px de haut, 3 empilées en XL ; nom et pièce calés en haut du pictogramme, barre d’intensité, boutons couleur et température en points 3 × 3 à droite), capteur température / humidité (valeurs en un bloc centré, chaque valeur centrée sur son libellé), groupes, automatisations, mises à jour, services et autres entités en 240 px. **Seules les lumières sont compactes.**
- **Dot Notes, Dot Weather, Dot IA, Dot Home, Dot GitHub, Dot Calculator, Dot Spotify, Dot Plex, Dot Bambu Lab, Dot Discord, Dot Audio, Dot Apps, Dot Gmail, Dot Slack** : en conception, maquette de référence (choix à valider ; Dot Spotify mis de côté).
- **Dot Calendar** : spécifié avec mocks.
- Autres : fiche seule (idée).

## En cours

- **DA des pages du site** (`docs/design/`) : dossier créé, valeurs en place notées, quatre types de pages définis (`homePage`, `subPage`, `modulePage`, `releasePage`). À venir : `couleurs.md`, `typographie.md`, `composants.md`, `nouvelle-page.md` (créer une nouvelle page pas à pas). Pour l’instant, seules les pages du site sont traitées (pas l’Edge ni les réglages du compagnon).

## À traiter plus tard (rappels de Mathod95)

- **Réglages : une seule source** : les réglages simulés des maquettes de module sont écrits à la main, alors que la page de réglages du compagnon génère les siens depuis les `x-icue-property`. Prévu : un composant de réglages commun, chargé par les maquettes et par le compagnon.
- **Registre des artefacts en fichier** (`tools/artifacts.json`) et commande pour régénérer tous les artefacts d’un coup (proposé, pas fait ; le registre est pour l’instant dans ce fichier).
- **Companion Mockup** : lignes 9 (avertissement Windows / SmartScreen : MSIX ou signature SignPath), 10 (charte de la page de réglages) et 11 (réglages avec l’Edge en direct, codé) à valider.
- **Dot Home et Dot Hub en double** (noté le 26 octobre 2026) : la maquette `widgets/dot-home/mockups/reference.html` date de l’ancien plan (pages iCUE, « GOING TO PAGE N », glissements simulés, bouton EDIT) et n’a pas la carte « + », alors que l’accueil réel est `companion/web/home.html`. Proposition : Dot Home devient l’écran d’accueil de Dot Hub (fiche, ligne du README et carte de Dot Page retirées), rendu de l’accueil dans un fichier partagé (`home.js` + `home.css`) chargé par le compagnon et par la maquette Dot Hub, et reprise des bonnes idées de l’ancienne maquette (infos en direct sur les tuiles, plus de 10 tuiles, ordre des tuiles dans les réglages). En attente de la décision de Mathod95.
