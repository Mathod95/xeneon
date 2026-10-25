# Dot GitHub

**Statut :** 🔵 en conception

Graphe de contributions en points, série en cours, et trois onglets : pull requests, notifications et runs GitHub Actions.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Graphe de contributions, une colonne par semaine, 5 niveaux ; couleurs « Accent » (par défaut) ou « GitHub ».
- Série en cours en gros points (police du Dot Clock), total sur 12 mois, contributions du jour, plus longue série, dépôt le plus actif.
- Onglets PRS (mes PR et reviews demandées), INBOX (notifications non lues), ACTIONS (derniers runs).
- Toucher une ligne : le compagnon ouvre la page GitHub dans le navigateur du PC. Aucune action depuis le widget.
- Statut : accent réussi, rouge échec, ambre en cours, blanc review demandée ou non lu.

## Données

- API GitHub (GraphQL pour le calendrier, REST pour PR, notifications et Actions), appelée par le module `github` du compagnon.
- Token saisi dans le compagnon, chiffré (DPAPI). L’API des notifications n’accepte pas les tokens fine-grained : token classique en lecture (`notifications`, `read:user`, `repo` pour les dépôts privés). À vérifier.

## Tailles (proposition)

- [ ] XL : graphe 12 mois et statistiques à gauche, onglets à droite
- [ ] L : graphe 8 mois et statistiques à gauche, onglets à droite
- [ ] M : trois compteurs en haut, graphe 6 mois en bas ; un compteur ouvre sa liste
- [ ] S : graphe 6 mois et série à gauche, compteurs à droite
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
