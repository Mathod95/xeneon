# System Monitor

**Statut :** 🟡 en cours (v1.1.0)
**Dossier :** `widgets/system-monitor`

## But
Afficher en direct les FPS du jeu en cours et 4 capteurs matériels, avec un historique consultable au toucher. Style dot-matrix.

## Tailles
- [ ] S (840 × 344) — à refaire : grand compteur FPS + liste compacte des 4 capteurs, sans courbes
- [ ] M (840 × 696) — à refaire : FPS en haut, cartes capteurs 2 × 2 en dessous
- [x] L (1688 × 696) — maquette d’origine : FPS · capteurs · historique
- [x] XL (2536 × 696) — idem L ; à enrichir (historique plus large ou 2ᵉ rangée de capteurs)
- [ ] Vertical — à décider

## Contenu et interactions
- Compteur FPS dot-matrix, nom du jeu détecté, min / moyenne / max, mini-courbe sur 1 min.
- 4 cartes capteurs (CPU package, CPU load, GPU temp, GPU load par défaut) avec mini-courbe.
- Toucher une carte affiche son historique dans le panneau de droite ; « View FPS history » revient aux FPS.
- Engrenage : durée d’historique 1 / 5 / 15 min.

## Données
- Plugin `widgetbuilder.fpsdataprovider:Fps:1.0` : FPS et nom du processus au premier plan.
- Plugin `widgetbuilder.sensorsdataprovider:Sensors:1.0` : valeurs, unités, noms des capteurs.
- Dans iCUE, uniquement des données réelles. Ouvert dans un navigateur : aperçu avec données simulées.

## Réglages iCUE
- Capteurs 1 à 4 (liste des capteurs du PC).
- Couleur d’accent, du texte, du fond.

## Maquette
Mock d’origine réalisé avec ChatGPT (format L).

## Questions ouvertes
- Le capteur « CPU load » par défaut peut tomber sur un capteur GPU selon le PC.
- Prise en charge de l’orientation verticale ?
