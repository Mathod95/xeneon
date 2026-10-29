# Dot Companion

Programme Windows qui sert Dot Hub. Il écoute uniquement sur `127.0.0.1:47800`.

- `src/main.rs` : serveur HTTP, configuration (`%APPDATA%\Xeneon\config.json`), API des pages et des Dot Hub.
- `web/` : accueil Dot Home (`home.html`), page de réglages (`settings.html`), script ajouté à chaque module (`hub/module.js`).
- Modules : le dossier d’un widget est intégré tel quel dans l’exécutable (pour l’instant `widgets/dot-clock` et `widgets/dot-steam`), servi sur `/m/<id>/`.
- `mockups/reference.html` : maquette de référence (la vraie page de réglages avec une API simulée, l’icône de la zone de notification et son menu). Présentation pour les utilisateurs : `tools/site/companion.html` (Dot Page, `/companion/`).

## Routes

| Route | Rôle |
| --- | --- |
| `GET /i/<uniqueId>` | point d’entrée de la coquille : redirige vers la page affichée par ce Dot Hub (`/m/<module>/?uid=…&page=…`), ou l’accueil |
| `GET /home`, `GET /settings` | accueil (dans le widget) et réglages (dans le navigateur du PC) |
| `GET /m/<id>/…` | fichiers d’un module |
| `GET /api/health`, `GET /api/modules`, `GET /api/instances` | état, modules, Dot Hub connus |
| `GET /api/pages` · `POST /api/pages` | pages de Dot Hub dans l’ordre des tuiles de l’accueil (`[{ id, module, name, settings, version }]`, secrets masqués) ; `POST { "module": "<id>" }` en ajoute une à la fin |
| `GET` / `PUT` / `DELETE /api/page/<id>` | lire, modifier (`{ "settings": { … } }`), retirer une page (les Dot Hub qui l’affichaient reviennent à l’accueil) |
| `GET` / `PUT` / `DELETE /api/instance/<uniqueId>` | un Dot Hub : sa page affichée (`page`, `module`, `settings`, `version`), `connected` ; `PUT { "page": "<id>" \| null }` ; oublier |
| `POST /api/instance/<uniqueId>/identify` | affiche le nom du Dot Hub sur l’Edge |
| `GET /api/steam/state?uid=<uniqueId>&page=<id>` | Dot Steam : jeux (choisis ou 8 derniers joués), jeu en cours, téléchargements, amis |
| `GET /api/steam/art/<appid>/<portrait\|wide>` | Dot Steam : jaquette (cache de Steam, sinon magasin Steam, téléchargée en arrière-plan) |
| `POST /api/steam/launch/<appid>` | Dot Steam : lance le jeu (`steam://rungameid/<appid>`) |
| `GET /api/steam/avatar` | Dot Steam : avatar du compte connecté (cache de Steam) |
| `POST /api/steam/open/<downloads\|library\|friends>` | Dot Steam : ouvre cette page de Steam (`steam://open/…`) |
| `POST /api/steam/status/<online\|away\|invisible\|offline>` | Dot Steam : change le statut (`steam://friends/status/…`) |
| `POST /api/open-settings` | ouvre la page de réglages dans le navigateur par défaut du PC (bouton « SETTINGS » de l’accueil ; un appel toutes les 3 s au plus) |
| `GET` / `PUT /api/startup` | démarrage avec Windows (`{ supported, enabled }` ; `PUT { "enabled": true\|false }`) : valeur « Dot Companion » de `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, activée à la première ouverture |
| `GET /api/update` · `POST /api/update/check` · `POST /api/update/install` | mise à jour depuis l’app : `{ current, latest, available, checked, checking, installing, error }` ; l’installation télécharge l’exe de la dernière release GitHub, vérifie son SHA-256, se remplace et redémarre |
| `GET` / `PUT /api/theme` | couleurs communes à tous les modules (`dotAccentColor`, `litDotColor`, `unlitDotColor`, `labelColor`) ; elles passent avant les réglages de chaque page |

## Pages

Une page = un module ajouté avec « + » et ses réglages. Les pages sont communes à tous les Dot Hub : l’accueil de l’Edge en montre une tuile chacune, puis une carte « + » ; la page de réglages montre la carte DOT HUB (le même accueil, en direct) puis une carte par page (l’écran en direct et les réglages du module). Chaque Dot Hub garde la page qu’il affiche (il la rouvre au lancement d’iCUE). On peut ajouter le même module deux fois, avec des réglages différents.

Reprise d’une configuration d’avant 0.5.0 (module et réglages par Dot Hub) : au démarrage, chaque Dot Hub devient une page (une seule par module et réglages identiques), qu’il continue d’afficher.

Les requêtes dont l’en-tête `Host` n’est pas `127.0.0.1:47800` ou `localhost:47800` sont refusées.

## Compiler

- GitHub Actions (`.github/workflows/companion.yml`) compile `dot-companion.exe` sous Windows à chaque push qui touche le compagnon ou Dot Clock ; l’exe est dans les artefacts du workflow, et joint aux releases `v*`.
- En local : `cargo build --release --manifest-path companion/Cargo.toml`.

Depuis 0.5.0, plus de fenêtre console : le compagnon tourne en arrière-plan avec une icône en points dans la zone de notification (clic gauche : réglages ; clic droit : menu avec Identifier les Dot Hub, Démarrer avec Windows, mise à jour, Quitter). Il démarre avec Windows (activé à la première ouverture) et cherche une nouvelle release au démarrage puis une fois par jour.

Mise à jour : la release `v*` doit contenir `dot-companion.exe` et `dot-companion.exe.sha256` (le workflow les joint). L’exe en cours est renommé `dot-companion.old.exe`, le nouveau lancé avec `--updated` (il attend que le port se libère), l’ancien supprimé au démarrage suivant. `DOT_UPDATE_URL` remplace l’URL de l’API GitHub pour tester.

Le code Win32 de l’icône (`src/tray.rs`) se vérifie hors Windows : `cargo check --features check-win --manifest-path companion/Cargo.toml`.
