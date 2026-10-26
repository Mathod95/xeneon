# Dot Bambu Lab

**Statut :** 🔵 en conception

Suivi d’une imprimante 3D Bambu Lab en réseau local : progression en gros points, fichier, couches, temps restant et heure de fin, températures, AMS, et commandes lampe, pause / reprise et stop. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Données

- Dot Companion se connecte à l’imprimante en MQTT sur TLS (port `8883`, utilisateur `bblp`, mot de passe = code d’accès LAN), sujet `device/<numéro de série>/report`. Une demande `pushall` au démarrage donne l’état complet.
- Champs utilisés : `gcode_state`, `mc_percent`, `mc_remaining_time`, `layer_num`, `total_layer_num`, `subtask_name`, températures buse, plateau et chambre (X1C), vitesse, données AMS (`tray_color`, `tray_type`, `remain`), erreurs HMS.
- Commandes envoyées sur `device/<numéro de série>/request` : pause, reprise, stop, lampe de la chambre.
- Adresse IP, numéro de série et code d’accès restent sur le PC, dans la configuration du compagnon.

## Tailles (proposition)

- [ ] XL (2536 × 696) : progression à gauche, températures au centre, AMS et commandes à droite
- [ ] L (1688 × 696) : progression à gauche ; températures, AMS et commandes à droite
- [ ] M (840 × 696) : progression, températures en ligne, commandes en bas
- [ ] S (840 × 344) : progression, buse et plateau, sans libellés ni commandes

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
