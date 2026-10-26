# Dot Discord

**Statut :** 🔵 en conception

Le salon vocal en cours sur l’Edge : participants avec avatar en points, qui parle, qui a coupé son micro, volume par personne ; micro, son, volumes et raccrocher. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Données

- RPC local du client Discord (canal `discord-ipc-0`), droits `rpc`, `rpc.voice.read`, `rpc.voice.write` : salon en cours, participants, qui parle, réglages voix (micro, son, volumes), volume par participant, quitter ou rejoindre un salon.
- Ces droits sont réservés aux applications approuvées par Discord. Piste : chacun crée sa propre application sur le portail développeur (ID et secret dans les réglages du compagnon), utilisable par son propriétaire. À vérifier avant de développer.
- Repli sans RPC : raccourcis clavier envoyés par le compagnon (micro, son), sans la liste des participants.

## Tailles (proposition)

- [ ] XL (2536 × 696) : 4 × 2 participants à gauche, volumes et 3 commandes à droite
- [ ] L (1688 × 696) : 3 × 2 participants, volumes et commandes à droite
- [ ] M (840 × 696) : 3 × 2 participants, commandes en bas
- [ ] S (840 × 344) : 3 avatars, micro et son, sans libellés

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
