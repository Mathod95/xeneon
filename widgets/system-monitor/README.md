# System Monitor

**Statut :** 🟡 en cours (v1.1.0)

FPS du jeu en cours et 4 capteurs matériels (CPU, GPU) en direct, avec historique consultable au toucher.

## Contenu et interactions

- Compteur FPS dot-matrix, nom du jeu détecté, min / moyenne / max, mini-courbe sur 1 min.
- 4 cartes capteurs (CPU package, CPU load, GPU temp, GPU load par défaut), chacune avec mini-courbe.
- Toucher une carte affiche son historique dans le panneau de droite ; « View FPS history » revient aux FPS.
- Engrenage : durée d’historique 1 / 5 / 15 min.

## Données

- Plugin iCUE `widgetbuilder.fpsdataprovider:Fps:1.0` : FPS et processus au premier plan.
- Plugin iCUE `widgetbuilder.sensorsdataprovider:Sensors:1.0` : valeurs, unités et noms des capteurs.
- Dans iCUE : uniquement des données réelles (`--` si absentes). Dans un navigateur : aperçu simulé.

## Tailles

- [ ] S : grand compteur FPS + liste compacte des 4 capteurs, sans courbes
- [ ] M : FPS en haut, cartes capteurs 2 × 2 en dessous
- [x] L : mock d’origine (FPS · capteurs · historique)
- [x] XL : idem L, à enrichir (historique plus large ou 2ᵉ rangée de capteurs)
- [ ] Vertical

## Notes

- Mise en page actuelle pensée pour L ; S, M et vertical à refaire (voir tailles).
- Le capteur « CPU load » par défaut peut tomber sur un capteur GPU selon le PC (réglable dans iCUE).

## Mocks

- [`01-overview.png`](mockups/01-overview.png)
