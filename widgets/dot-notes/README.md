# Dot Notes

**Statut :** 🔵 en conception

Listes à cocher et notes libres, saisies directement sur l’écran, avec un onglet par liste.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Saisie directe sur le widget, comme le widget Checklist de Corsair : champ « Add item », crayon pour renommer, collage de plusieurs éléments (lignes, « ; » ou « | »).
- Onglets : une vue par liste (TODAY, WORK, HOME…) dans le même widget, + pour en créer, toucher l’onglet actif pour le renommer.
- Onglet de type note libre : toucher le texte pour l’écrire.
- Lignes : poignée pour réordonner, case 5 × 5 points, crayon, croix (masquable).
- Compteur fait / total en gros points, « Hold to clear done » pour supprimer les éléments faits.

## Données

- Stockage local du widget, sous l’identifiant `uniqueId` qu’iCUE donne à chaque widget posé : une liste par widget et par page.
- Les touches viennent du clavier de Windows (physique, tactile ou « Clavier virtuel » d’iCUE) : à confirmer avec le widget de test Dot Keytest.
- En option, module « notes » du compagnon : sauvegarde dans un fichier sur le PC, partage entre widgets, édition depuis le PC.

## Tailles (proposition)

- [ ] XL : compteur à gauche, onglets en haut, liste sur 2 colonnes
- [ ] L : même disposition, plus serrée
- [ ] M : onglets, barre de points, liste sur une colonne
- [ ] S : onglet actif, liste sur 2 colonnes
- [ ] Vertical : à concevoir

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.2)
