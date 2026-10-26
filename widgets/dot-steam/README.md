# Dot Steam

**Statut :** 🟡 en cours (v0.1.0, XL)

Jeux Steam sur l’Edge : jusqu’à 8 jeux lancés au toucher, dernier jeu joué mis en avant, jeu en cours, téléchargements et amis en jeu. Module de Dot Hub, servi par Dot Companion. Anciennement Dot Launcher.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) : elle charge le vrai rendu du module (`scripts/steam.js`, `styles/steam.css`) avec des données d’exemple, et ses réglages simulés montrent chaque état (en ligne, en jeu, sans téléchargement, Steam fermé).

## Fichiers

- `scripts/steam.js` : le rendu, partagé par le module et la maquette (`DotSteam.mount`).
- `styles/steam.css` : ses styles, préfixés `.dot-steam`.
- `index.html` + `scripts/widget.js` : la page du module, servie sur `/m/steam/` ; elle demande l’état au compagnon toutes les 3 s.

## Réglages (page de réglages du compagnon)

- **Games to show** : liens Steam ou app IDs séparés par des virgules ; vide = les 8 derniers jeux joués.
- **Launch with** : appui long (par défaut), toucher ou double toucher.
- **Cover style** : Color (par défaut) ou Mono.
- **Show friends** et **Steam Web API key** : la clé (créée sur steamcommunity.com/dev/apikey) est gardée chiffrée sur le PC (DPAPI) et n’est jamais renvoyée en clair.
- Couleurs : celles de la carte « Couleurs », communes à tout Dot Hub.

## Données (Dot Companion, `companion/src/steam.rs`)

- Registre Windows : emplacement de Steam (`SteamPath`), jeu en cours (`RunningAppID`), Steam ouvert (`ActiveProcess\pid`).
- `steamapps/libraryfolders.vdf` et `appmanifest_<id>.acf` : jeux installés, téléchargements (pourcentage exact ; débit et temps restant estimés).
- `userdata/<id>/config/localconfig.vdf` : dernier lancement et temps de jeu ; `config/loginusers.vdf` : compte connecté.
- Jaquettes : cache de Steam (`appcache/librarycache`), sinon images publiques du magasin, téléchargées en arrière-plan et gardées dans `%APPDATA%\Xeneon\cache\steam`.
- Amis : API Web Steam (`GetFriendList`, `GetPlayerSummaries`), toutes les 60 s au plus.
- Lancement : `steam://rungameid/<id>`.

## Tailles

- [x] XL (2536 × 696)
- [ ] L, M, S : présentes dans le rendu, à reprendre plus tard

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (v0.3, rendu du module)
- Références de fonctions de l’ancien Dot Launcher (pas au style dot) : [`01-overview.png`](mockups/01-overview.png), [`02-tap-to-play.png`](mockups/02-tap-to-play.png), [`03-themes.png`](mockups/03-themes.png), [`04-matching-set.png`](mockups/04-matching-set.png), [`05-make-it-yours.png`](mockups/05-make-it-yours.png)
