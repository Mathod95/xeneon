# Dot Plex

**Statut :** 🔵 en conception

Lectures en cours sur le serveur Plex (qui regarde quoi, progression, qualité), derniers ajouts et « À suivre ». Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Données

- Dot Companion interroge le serveur Plex (adresse locale, par exemple `http://192.168.1.10:32400`) avec le jeton `X-Plex-Token`, gardé sur le PC dans `%APPDATA%\Xeneon\config.json`. Le module ne voit jamais le jeton.
- Routes Plex : `/status/sessions` (lectures en cours), `/library/recentlyAdded`, `/library/onDeck`, affiches réduites par `/photo/:/transcode`.
- Voir toutes les lectures demande le jeton du compte propriétaire du serveur.
- Lectures toutes les 5 s, bibliothèque toutes les 5 min ; la progression avance chaque seconde entre deux lectures.

## Tailles (proposition)

- [ ] XL (2536 × 696) : lectures en cours à gauche (2 au plus), onglets « Recently added » / « On deck » et 4 affiches à droite
- [ ] L (1688 × 696) : même découpage, 3 affiches
- [ ] M (840 × 696) : lectures seules ; 3 affiches quand rien ne joue
- [ ] S (840 × 344) : une lecture, un toucher passe à la suivante, sans libellés ; 5 affiches quand rien ne joue

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
