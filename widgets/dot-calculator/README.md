# Dot Calculator

**Statut :** 🔵 en conception

Calculatrice et convertisseur en cinq onglets : CALC, UNITS, MONEY, BASE, TIME. Les nombres s’affichent en gros points.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, fonctionnelle au toucher et au clavier, avec réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- **CALC** : + − × ÷, %, ±, DEL, C puis AC, priorité des opérations ; en XL √, x², 1/x, π, ANS ; historique en XL et L.
- **UNITS** : 15 catégories (longueur, poids, température, volume, surface, vitesse, données, débit, FPS ↔ temps d’image, durée, pression, énergie, puissance, consommation, angle).
- **MONEY** : taux de référence du jour, gratuits et sans clé, gardés pour le hors ligne, date toujours affichée.
- **BASE** : BIN, OCT, DEC, HEX sur des entiers de toute taille, touches A à F, largeur en bits.
- **TIME** : ville principale en gros points, jusqu’à 12 villes, pas de ±15 min / ±1 h, barre des heures de travail.
- Convertisseurs : deux champs, celui qu’on tape entouré ; toucher l’autre inverse le sens ; ↑↓ échange les unités ; liste de toutes les unités (toucher une ligne en fait la cible).
- Clavier physique en plus du tactile (à confirmer avec Dot Keytest).
- Réglages « Decimal separator », « Digit grouping », « Clock format ».

## Données

- Taux de change : source gratuite sans clé à choisir (API de devises sur jsDelivr ou Frankfurter). Permission réseau à déclarer. Pas de compagnon.

## Tailles (proposition)

- [ ] XL : écran ou champs, clavier, historique ou liste sur deux colonnes ; TIME grille de 4 × 3 villes
- [ ] L : même chose plus serrée, liste sur une colonne
- [ ] M : champs et liste à gauche, clavier à droite (BASE : clavier en bas)
- [ ] S : champs à gauche, clavier à droite, sans liste
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.2)
