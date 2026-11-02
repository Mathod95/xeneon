# Dot Bambu Lab

**Statut :** 🟡 en cours (v0.1.0)

Suivi d’une imprimante 3D Bambu Lab en réseau local : progression en gros points, fichier, couches, temps restant et heure de fin, températures, AMS, et commandes lampe, pause / reprise et stop. Module de Dot Hub, servi par Dot Companion.

Codé en XL (1er novembre 2026), à essayer sur le PC. Le rendu est dans `scripts/bambulab.js` et `styles/bambulab.css`, chargés par la page du module (`index.html` et `scripts/widget.js`, servis par le compagnon) et par la maquette de référence : la maquette montre exactement ce qui tourne sur l’Edge. Le compagnon parle à l’imprimante dans `companion/src/bambulab.rs`.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette XL, réglages simulés et tableau des choix de design, validés le 1er novembre 2026 pour un P1S en réseau local.

## Données

- Dot Companion se connecte à l’imprimante en MQTT sur TLS (port `8883`, utilisateur `bblp`, mot de passe = code d’accès LAN), sujet `device/<numéro de série>/report`. Une demande `pushall` au démarrage donne l’état complet.
- Champs utilisés : `gcode_state`, `mc_percent`, `mc_remaining_time`, `layer_num`, `total_layer_num`, `subtask_name`, températures buse, plateau et chambre (X1C), vitesse, données AMS (`tray_color`, `tray_type`, `remain`), erreurs HMS.
- Commandes envoyées sur `device/<numéro de série>/request` : pause, reprise, stop, lampe de la chambre.
- Adresse IP, numéro de série et code d’accès restent sur le PC, dans la configuration du compagnon.

## Réglages iCUE

| Réglage | Défaut |
|---|---|
| Printer IP address (LAN) | vide |
| Printer serial number | vide (le modèle en est déduit : `01P` P1S, `00M` X1C, `039` A1…) |
| LAN access code (chiffré sur le PC) | vide |
| Show AMS | activé |
| Show unlit dots, couleurs | couleurs communes |

## Tailles (proposition)

- [x] XL (2536 × 696) : progression à gauche, températures au centre, AMS et commandes à droite
- [ ] L (1688 × 696) : progression à gauche ; températures, AMS et commandes à droite
- [ ] M (840 × 696) : progression, températures en ligne, commandes en bas
- [ ] S (840 × 344) : progression, buse et plateau, sans libellés ni commandes

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
