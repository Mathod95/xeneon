# Dot Weather

**Statut :** 🔵 en conception

Météo actuelle, courbe heure par heure et prévisions sur 5 jours, avec pictogrammes et température en points.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Pictogramme 9 × 9 points, température en gros points (police du Dot Clock), condition, maximum / minimum, ressenti.
- Détails : vent, humidité, risque de pluie, UV, lever et coucher du soleil.
- 12 prochaines heures en colonnes de points, risque de pluie en couleur d’accent.
- 5 jours ; toucher un jour affiche sa courbe heure par heure (vue détail hors XL).
- Pictogrammes en blanc ou en couleurs météo, unités °C · km/h ou °F · mph.

## Données

- Open-Meteo, appelé directement par le widget : gratuit pour un usage non commercial, sans clé ni compte, donc sans compagnon. Permission réseau à déclarer.
- Lieu saisi par son nom dans les réglages iCUE, converti par le géocodage d’Open-Meteo.

## Tailles (proposition)

- [ ] XL : météo actuelle à gauche, heure par heure au centre, 5 jours à droite
- [ ] L : météo actuelle à gauche, 5 jours à droite
- [ ] M : météo actuelle en haut, 5 jours en colonnes en bas
- [ ] S : pictogramme, température, condition
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
