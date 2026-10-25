# Dot Home

**Statut :** 🔵 en conception

Widget d’accueil de la page 1 : une tuile par widget Dot, un toucher emmène sur la bonne page iCUE.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Tuiles : pictogramme 7 × 7 points, nom, numéro de page, info en direct en option.
- Toucher une tuile : « GOING TO PAGE N » avec une barre de points par page traversée.
- Bouton EDIT sur le widget : − / + pour le numéro de page, × pour retirer, + ADD pour ajouter.
- Compagnon absent : « COMPANION NOT RUNNING » et le nombre de glissements à faire à la main.

## Données

- Aucune API iCUE ne permet de changer de page : le module « pages » du compagnon simule N − 1 glissements sur l’Edge (voir `CLAUDE.md`, navigation entre pages).
- **À valider en premier** : qu’iCUE accepte un glissement simulé. Sinon, Dot Home ne sert que de sommaire.
- Configuration des tuiles dans le stockage local du widget (`uniqueId`).

## Tailles (proposition)

- [ ] XL : 2 rangées de 5 tuiles
- [ ] L : 2 rangées de 4
- [ ] M : 3 rangées de 2
- [ ] S : 4 tuiles sur une rangée

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
