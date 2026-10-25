# Dot Calculator

**Statut :** 🔵 en conception

Calculatrice tactile : résultat en gros points, expression au-dessus, historique à côté.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, fonctionnelle au toucher et au clavier, avec réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- + − × ÷, %, ±, décimales, DEL, C puis AC ; priorité des opérations respectée.
- Résultat en gros points (police du Dot Clock), taille adaptée à la longueur, 12 chiffres au maximum.
- XL : fonctions √, x², 1/x, π, ANS.
- XL et L : historique, toucher une ligne reprend son résultat ; stockage local par `uniqueId`.
- Clavier physique en plus du tactile (à confirmer avec Dot Keytest).
- Réglages « Decimal separator » (Point / Comma) et « Digit grouping ».

## Données

- Aucune : tout se passe dans le widget, sans compagnon.

## Tailles (proposition)

- [ ] XL : écran à gauche, clavier avec fonctions scientifiques au centre, historique à droite
- [ ] L : écran et historique à gauche, clavier à droite
- [ ] M : écran en haut, clavier en bas
- [ ] S : écran à gauche, clavier compact 5 × 4 à droite
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
