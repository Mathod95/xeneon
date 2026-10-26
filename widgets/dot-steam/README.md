# Dot Steam

**Statut :** 🔵 en conception

Jeux Steam sur l’Edge : jusqu’à 8 jeux lancés au toucher, dernier jeu joué mis en avant, téléchargements en cours et amis en jeu. Module de Dot Hub, servi par Dot Companion. Anciennement Dot Launcher.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Jusqu’à 8 jeux ajoutés par lien Steam ou app ID dans les réglages du compagnon (8 en XL et M, 4 en L et S).
- Déclenchement au choix : appui long (par défaut), toucher ou double toucher (évite les lancements accidentels).
- Jaquettes 600 × 900 en trame de points, depuis le cache local de Steam, sinon le CDN Steam.
- Dernier jeu joué mis en avant en XL et L (capsule large, dernier lancement, temps de jeu).
- Téléchargements et mises à jour en cours (XL, L), amis en jeu (XL).
- Le titre personnalisable du Dot Launcher disparaît : le libellé reste « DOT STEAM », comme dans tous les modules.

## Données

- Fichiers locaux de Steam lus par le compagnon : `steamapps/libraryfolders.vdf`, `appmanifest_<id>.acf` (jeux installés, téléchargements), `userdata/<id>/config/localconfig.vdf` (dernier lancement, temps de jeu).
- Lancement : le compagnon ouvre `steam://rungameid/<id>`.
- Amis : API Web Steam (clé d’API et SteamID64 dans les réglages du compagnon), seulement si le réglage est rempli.

## Tailles (proposition)

- [ ] XL (2536 × 696) : dernier jeu à gauche, 8 jeux en ligne, téléchargements et amis en dessous
- [ ] L (1688 × 696) : dernier jeu, 4 jeux, téléchargements
- [ ] M (840 × 696) : 4 × 2 jeux
- [ ] S (840 × 344) : 4 jeux, sans libellés

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
- Références de fonctions de l’ancien Dot Launcher (pas au style dot) : [`01-overview.png`](mockups/01-overview.png), [`02-tap-to-play.png`](mockups/02-tap-to-play.png), [`03-themes.png`](mockups/03-themes.png), [`04-matching-set.png`](mockups/04-matching-set.png), [`05-make-it-yours.png`](mockups/05-make-it-yours.png)
