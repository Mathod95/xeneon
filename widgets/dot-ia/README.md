# Dot IA

**Statut :** 🔵 en conception

Limites d’utilisation Claude de deux comptes côte à côte : session de 5 heures et limite hebdomadaire, avec l’heure de remise à zéro.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Un panneau par compte (nom réglable) : pourcentage de session en gros points, barres de points session et hebdo, tokens et sessions du jour.
- Orange à partir de 75 %, rouge à partir de 90 %.
- Toucher un compte ouvre sa vue détail (courbe 24 h, limites), BACK ou retour automatique après 30 s.
- Compte injoignable : « NO DATA » et la raison, jamais de valeur inventée.

## Données

- **À vérifier avant de coder** : claude.ai n’a pas d’API publique documentée pour ces limites. Le widget communautaire « Claude Usage » passe par un compagnon qui lit les identifiants de Claude Code sur le PC.
- Ici : module « ia » du compagnon Rust, une connexion par compte, identifiants chiffrés (DPAPI), jamais dans les réglages iCUE.

## Tailles (proposition)

- [ ] XL : deux panneaux côte à côte
- [ ] L : deux panneaux, chiffre au-dessus des barres
- [ ] M : deux bandeaux l’un sous l’autre
- [ ] S : deux panneaux compacts

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
