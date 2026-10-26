# Dot Companion

Programme Windows qui sert Dot Hub. Il écoute uniquement sur `127.0.0.1:47800`.

- `src/main.rs` : serveur HTTP, configuration (`%APPDATA%\Xeneon\config.json`), API des instances.
- `web/` : accueil Dot Home (`home.html`), page de réglages (`settings.html`), script ajouté à chaque module (`hub/module.js`).
- Modules : le dossier d’un widget est intégré tel quel dans l’exécutable (pour l’instant `widgets/dot-clock`), servi sur `/m/<id>/`.

## Routes

| Route | Rôle |
| --- | --- |
| `GET /i/<uniqueId>` | point d’entrée de la coquille : redirige vers le module de l’instance, ou l’accueil |
| `GET /home`, `GET /settings` | accueil (dans le widget) et réglages (dans le navigateur du PC) |
| `GET /m/<id>/…` | fichiers d’un module |
| `GET /api/health`, `GET /api/modules`, `GET /api/instances` | état, modules, instances |
| `GET` / `PUT` / `DELETE /api/instance/<uniqueId>` | lire, modifier (`module`, `name`, `settings`), oublier une instance |
| `POST /api/instance/<uniqueId>/identify` | affiche le nom de l’instance sur l’Edge |
| `GET /api/steam/state?uid=<uniqueId>` | Dot Steam : jeux (choisis ou 8 derniers joués), jeu en cours, téléchargements, amis |
| `GET /api/steam/art/<appid>/<portrait\|wide>` | Dot Steam : jaquette (cache de Steam, sinon magasin Steam, téléchargée en arrière-plan) |
| `POST /api/steam/launch/<appid>` | Dot Steam : lance le jeu (`steam://rungameid/<appid>`) |
| `POST /api/open-settings` | ouvre la page de réglages dans le navigateur par défaut du PC (bouton « SETTINGS » de l’accueil ; un appel toutes les 3 s au plus) |
| `GET` / `PUT /api/theme` | couleurs communes à tous les modules (`dotAccentColor`, `litDotColor`, `unlitDotColor`, `labelColor`) ; elles passent avant les réglages de chaque instance |

Les requêtes dont l’en-tête `Host` n’est pas `127.0.0.1:47800` ou `localhost:47800` sont refusées.

## Compiler

- GitHub Actions (`.github/workflows/companion.yml`) compile `dot-companion.exe` sous Windows à chaque push qui touche le compagnon ou Dot Clock ; l’exe est dans les artefacts du workflow, et joint aux releases `v*`.
- En local : `cargo build --release --manifest-path companion/Cargo.toml`.

Pour l’instant c’est une fenêtre console : la fermer arrête le compagnon. L’icône dans la zone de notification et le démarrage avec Windows viendront ensuite.
