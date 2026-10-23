# Dot Spotify

**Statut :** 🔵 en conception

Lecture en cours : pochette en trame de points, titre, artiste, album, et commandes précédent / lecture-pause / suivant.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Données

- Plugin iCUE Media (`widgetbuilder.mediadataprovider:Media:1.1`) : titre, artiste, album, pochette (PNG en base64), état lecture / pause ; commandes précédent, lecture / pause, suivant. Pas besoin du compagnon.
- Le plugin ne donne **ni la position ni la durée** du morceau : pas de barre de progression possible avec lui seul.
- Le plugin lit le lecteur actif de Windows (Spotify, navigateur, autres lecteurs) sans dire lequel.
- Plus tard, en option : API Web Spotify pour la progression, la bibliothèque et les playlists (compte Spotify et jeton, sans doute via le compagnon ; le contrôle de lecture par l’API demande un compte Premium).

## Tailles (proposition)

- [ ] XL (2536 × 696) : pochette 600 px à gauche, texte au centre, commandes à droite
- [ ] L (1688 × 696) : pochette à gauche, texte puis commandes en dessous
- [ ] M (840 × 696) : pochette 320 px et texte côte à côte, commandes centrées en bas
- [ ] S (840 × 344) : pochette 248 px, titre, artiste et commandes, sans libellés
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
