# Dot Home Assistant

**Statut :** 🟡 en cours (v0.1.0)

Pilotage de la maison depuis l’Edge : une carte par entité Home Assistant, posée sur une grille, un onglet par pièce. Lumières (marche / arrêt, intensité), prises, volets, thermostat, serrure, capteurs et scènes. Module de Dot Hub, servi par Dot Companion.

Codé en XL (2 novembre 2026), à essayer sur le PC. Le rendu est dans `scripts/homeassistant.js` et `styles/homeassistant.css`, chargés par la page du module (`index.html` et `scripts/widget.js`, servis par le compagnon), par la maquette de référence et par Dot Page : la maquette montre exactement ce qui tourne sur l’Edge. Le compagnon parle à Home Assistant dans `companion/src/homeassistant.rs`.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : écran XL, réglages simulés (dont « Grille » et « Édition »), toutes les cartes et le tableau des choix de design.

## Données

- Dot Companion lit Home Assistant par son API REST, avec un jeton d’accès longue durée (profil Home Assistant → Sécurité → Jetons d’accès longue durée) : `GET /api/states` toutes les 2 s ; pièces et appareils (température et humidité d’un même capteur réunies en une carte) par `POST /api/template` et intégrations par `GET /api/config/config_entries/entry`, toutes les 60 s. Un fil par Home Assistant, arrêté après 10 min sans affichage.
- Commandes : `POST /api/services/<domaine>/<service>`, limitées à une liste (lumières, interrupteurs, volets, thermostat, serrure, scènes, scripts, automatisations, mises à jour) ; l’entité doit exister.
- Les requêtes passent par curl (fourni avec Windows) ; le jeton, chiffré (DPAPI) dans la configuration du compagnon, passe par l’entrée standard de curl, jamais sur la ligne de commande, et n’est jamais envoyé au module.
- Services : les intégrations (chargée, erreur, arrêtée). Les modules complémentaires (API Supervisor) ne sont pas encore lus.

## Réglages (page de réglages du compagnon)

| Réglage | Valeur par défaut |
|---|---|
| Home Assistant URL | vide (`http://homeassistant.local:8123`) |
| Long-lived access token | vide, chiffré sur le PC |
| Show rooms | activé |
| Show unlit dots | activé |
| Couleurs | celles de la carte « Paramètres globaux » |

La disposition des cartes (`haLayout`, caché) se règle sur l’aperçu de la page : glisser une carte, S / M / L pour sa taille, × pour la retirer. « + » sur une case libre (ou toucher une carte) ouvre le formulaire de la carte : l’entité (toutes celles de Home Assistant, rangées par appareil, avec une recherche), son nom (pré-rempli), son icône, sa taille, ce qu’elle montre (« Show ») et « Touch control », avec l’aperçu de la carte. Une disposition par onglet ; sans disposition, les cartes se rangent d’elles-mêmes.

Toute entité peut avoir sa carte : celles qui ne sont ni lumière, interrupteur, volet, thermostat, serrure, scène ou automatisation (capteur binaire, personne, météo, lecteur, capteur texte…) affichent leur état.

## Tailles

- [x] XL (2536 × 696) : grille de 6 colonnes × 6 rangées
- [ ] L (1688 × 696) : grille de 4 colonnes (rendu prêt, à vérifier)
- [ ] M (840 × 696) : grille de 2 colonnes (rendu prêt, à vérifier)
- [ ] S (840 × 344) : « Too small » pour l’instant

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (v0.1), sur le rendu du module
