# Dot Home Assistant

**Statut :** 🔵 en conception

Pilotage de la maison depuis l’Edge : une tuile par entité Home Assistant, rangées par pièce. Lumières (marche / arrêt, intensité), prises, volets, thermostat, serrure, capteurs et scènes. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Données

- Dot Companion ouvre l’API WebSocket de Home Assistant (`ws://<adresse>:8123/api/websocket`) avec un jeton d’accès longue durée, s’abonne aux changements d’état et appelle les services (`light.turn_on`, `climate.set_temperature`, `cover.open_cover`, `lock.unlock`…).
- Adresse, jeton et liste des entités à afficher se règlent dans la page de réglages du compagnon et restent sur le PC. Le module ne voit jamais le jeton.
- Les pièces viennent des zones de Home Assistant ; l’onglet « Favorites » montre une sélection.

## Tailles (proposition)

- [ ] XL (2536 × 696) : pièces en onglets, 6 × 2 tuiles
- [ ] L (1688 × 696) : pièces en onglets, 4 × 2 tuiles
- [ ] M (840 × 696) : pièces en onglets, 2 × 3 tuiles en ligne
- [ ] S (840 × 344) : 4 tuiles favorites, sans libellés ni onglets

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
