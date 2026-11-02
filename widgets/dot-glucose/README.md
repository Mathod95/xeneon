# Dot Glucose

**Statut :** 🔵 en conception

Glycémie en direct d’un capteur FreeStyle Libre (2 ou 3) : la valeur en gros points avec sa tendance, la courbe des dernières heures avec la plage cible, le temps dans la cible sur 24 h.

Le rendu est dans `scripts/glucose.js` et `styles/glucose.css`, chargés par la maquette de référence et, quand il sera codé, par le module servi par le compagnon. La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette XL, réglages simulés et tableau des choix de design, tous encore à valider.

Pour garder un œil sur sa glycémie pendant qu’on est au PC : ce n’est pas un outil médical, les alarmes et les décisions de traitement restent celles du lecteur ou du téléphone.

## Tailles

- [ ] S (840 × 344)
- [ ] M (840 × 696)
- [ ] L (1688 × 696)
- [x] XL (2536 × 696) : valeur, tendance, état et chiffres à gauche, courbe à droite

## Contenu et interactions

- Glycémie en gros points (police 5 × 7), flèche de tendance 7 × 7 (baisse rapide, baisse, stable, hausse, hausse rapide), unité.
- Couleur selon la plage : allumée dans la cible, jaune si haute, rouge si basse (fixes, quelle que soit la couleur d’accent).
- État en toutes lettres (« IN RANGE · STEADY ») et plage cible.
- Courbe en points des 3, 6, 12 ou 24 dernières heures, plage cible marquée, dernière mesure cerclée ; un toucher change la durée.
- En bas : temps dans la cible sur 24 h, moyenne sur 24 h, jours restants du capteur.
- États sans valeur : mesure de plus de 15 min, capteur en mise en route, LibreLinkUp injoignable (jamais de valeur inventée).

## Données

- **LibreLinkUp** (outil de partage de FreeStyle), par Dot Companion : dans l’appli LibreLink, on invite un compte LibreLinkUp, et le compagnon s’y connecte comme l’appli. Dernière valeur (à peu près toutes les minutes), tendance, courbe des 12 dernières heures (un point toutes les 15 min), fin du capteur. Marche pour le Libre 2 et le Libre 3.
- Adresse et mot de passe saisis dans la page de réglages du compagnon, chiffrés sur le PC (DPAPI), jamais renvoyés en clair.
- API non officielle : elle peut changer, le compagnon devra alors être mis à jour. LibreView (rapports) n’a pas de données en direct.

## Réglages iCUE

| Groupe | Réglage | Défaut |
|---|---|---|
| Glucose | Units (mg/dL, mmol/L) | mg/dL |
| Glucose | Target range (70–180, 70–140, 80–200 mg/dL) | 70–180 |
| Glucose | Graph (3, 6, 12, 24 h) | 12 h |
| Colors | Show unlit dots, Accent, Lit, Unlit, Label color | couleurs communes |

## Maquette

- [`mockups/reference.html`](mockups/reference.html) : maquette XL et tableau des choix de design.

## Questions ouvertes

- Libre 2 ou Libre 3 : les deux passent par LibreLinkUp, à confirmer avec le capteur réel.
- Afficher aussi un rappel des alarmes du téléphone (seuils bas et haut) ?
