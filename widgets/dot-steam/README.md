# Dot Steam

**Statut :** 🟡 en cours (v0.2.0)

Jeux Steam sur l’Edge : jusqu’à 8 jeux lancés au toucher, dernier jeu joué mis en avant, jeu en cours, téléchargements (ou ton profil et ton statut) et amis en jeu. Module de Dot Hub, servi par Dot Companion. Anciennement Dot Launcher.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) : elle charge le vrai rendu du module (`scripts/steam.js`, `styles/steam.css`) avec des données d’exemple, et ses réglages simulés montrent chaque état (en ligne, en jeu, sans téléchargement, Steam fermé). Elle compare aussi les rendus des jaquettes et garde la capture réelle de la v0.1.0 ([`real-pc-v0.1.0.png`](mockups/real-pc-v0.1.0.png)).

## Fichiers

- `scripts/steam.js` : le rendu, partagé par le module et la maquette (`DotSteam.mount`).
- `styles/steam.css` : ses styles, préfixés `.dot-steam`.
- `index.html` + `scripts/widget.js` : la page du module, servie sur `/m/steam/` ; elle demande l’état au compagnon toutes les 3 s.

## Réglages (page de réglages du compagnon)

- **Games to show** : liens Steam ou app IDs séparés par des virgules ; vide = les 8 derniers jeux joués.
- **Launch with** : appui long (par défaut), toucher ou double toucher.
- **Cover style** : Color (par défaut) ou Mono.
- **Cover render** : Dots (taille des points selon la lumière), Solid dots, Fine dots (deux fois plus serrés) ou Image behind a dot grid, avec **Dot grid opacity** (40 à 85 %).
- **Show game names** et **Long names** : nom trop long coupé et qui défile au survol ou à l’appui (par défaut), ou qui défile en continu.
- **Bottom panel** : Downloads (par défaut ; un toucher ouvre la page des téléchargements de Steam) ou My profile and status (avatar, pseudo, boutons Online, Away, Invisible, Offline).
- **Show friends** et **Steam Web API key** : la clé (créée sur steamcommunity.com/dev/apikey) est gardée chiffrée sur le PC (DPAPI) et n’est jamais renvoyée en clair.
- Couleurs : celles de la carte « Couleurs », communes à tout Dot Hub.

## Données (Dot Companion, `companion/src/steam.rs`)

- Registre Windows : emplacement de Steam (`SteamPath`), jeu en cours (`RunningAppID`), Steam ouvert (`ActiveProcess\pid`).
- `steamapps/libraryfolders.vdf` et `appmanifest_<id>.acf` : jeux installés, téléchargements (état d’après `StateFlags` : en cours 256 ou 1048576, en pause 512, sinon en attente). Pendant un téléchargement, la taille de `steamapps/downloading/<id>` donne une progression et un débit à jour (Steam n’écrit le manifeste que de temps en temps) ; débit et temps restant estimés.
- `userdata/<id>/config/localconfig.vdf` : dernier lancement et temps de jeu, statut voulu ; `config/loginusers.vdf` : compte connecté et pseudo ; `config/avatarcache/<SteamID64>.png` : avatar.
- Jaquettes : cache de Steam (`appcache/librarycache`), sinon images publiques du magasin, téléchargées en arrière-plan et gardées dans `%APPDATA%\Xeneon\cache\steam`.
- Amis : API Web Steam (`GetFriendList`, `GetPlayerSummaries`), toutes les 60 s au plus.
- Lancement : `steam://rungameid/<id>` ; téléchargements : `steam://open/downloads` ; statut : `steam://friends/status/<statut>` (avec une clé d’API, le statut affiché vient de l’API ; Invisible y apparaît comme Offline, le compagnon retient celui choisi sur l’Edge).

## Tailles

- [x] XL (2536 × 696)
- [ ] L, M, S : présentes dans le rendu, à reprendre plus tard

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (v0.4, rendu du module)
- [`real-pc-v0.1.0.png`](mockups/real-pc-v0.1.0.png) : capture réelle de la v0.1.0 sur l’Edge
- Références de fonctions de l’ancien Dot Launcher (pas au style dot) : [`01-overview.png`](mockups/01-overview.png), [`02-tap-to-play.png`](mockups/02-tap-to-play.png), [`03-themes.png`](mockups/03-themes.png), [`04-matching-set.png`](mockups/04-matching-set.png), [`05-make-it-yours.png`](mockups/05-make-it-yours.png)
