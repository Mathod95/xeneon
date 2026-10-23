# Dot Clock

**Statut :** 🟡 en cours (v0.1.1)

Grande horloge dot-matrix : heures et minutes en gros points, deux-points et secondes en couleur d’accent, date et fuseau horaire.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle, réglages simulés et tableau des choix de design.

## Contenu et interactions

- Heures et minutes en gros points (police dot 5 × 7, grasse ou fine), deux-points en couleur d’accent.
- Secondes en petits points, en couleur d’accent ; AM / PM en petits points en mode 12 h.
- Libellés en Fira Code (embarquée, ligatures coupées) : « DOT CLOCK » en haut à gauche, fuseau en haut à droite, date en bas à gauche, texte libre en bas à droite.
- Aucune interaction tactile (`interactive: false`), pour laisser passer les gestes de page de l’Edge.

## Données

- Heure du PC, ou d’un autre fuseau via `Intl.DateTimeFormat`. Aucune source externe, aucun plugin.

## Réglages iCUE

| Groupe | Réglage | Défaut |
|---|---|---|
| Clock | Clock format (24 h / 12 h) | 24 h |
| Clock | AM/PM position (Top / Bottom) | Top |
| Clock | Show seconds | activé |
| Clock | Dot font (Bold / Thin) | Bold |
| Clock | Show unlit dots | activé |
| Clock | Show unlit seconds dots | activé |
| Date and time zone | Time zone (Local + 33 fuseaux) | Local |
| Date and time zone | Time zone label (City, Abbreviation, Offset, City + offset, Custom text, Hidden) | City |
| Date and time zone | Custom time zone label | HOME |
| Date and time zone | Date format (repères YYYY YY MMMM MMM MM M DD D WWWW WWW) | `WWW, MMMM DD, YYYY` |
| Date and time zone | Footer text (vide = masqué) | TIME, SIMPLY. |
| Colors | Accent color (propriété `dotAccentColor`, indépendante du style de page iCUE) | `#10B981` |
| Colors | Lit dot color | `#F2F0E9` |
| Colors | Unlit dot color | `#1C1C1C` |
| Colors | Label color | `#B8B6B0` |

Fond du widget fixe : `#080808`.

## Tailles

- [x] XL (2536 × 696) : heure au centre, secondes et AM/PM à droite, libellés dans les angles
- [x] L (1688 × 696) : même disposition que XL
- [x] M (840 × 696) : HH:MM sur toute la largeur, secondes et AM/PM centrées en dessous
- [x] S (840 × 344) : heure seule, date et fuseau en bas, sans « DOT CLOCK » ni texte libre
- [ ] Vertical : mise en page provisoire calculée, à concevoir

## Notes

- Libellés à 18 px minimum, date à 22 px.
- Le « 1 » gras fait 4 colonnes et il est centré dans une case de 5, pour que l’heure ne bouge pas quand les chiffres changent.
- La taille est détectée sur le rapport largeur / hauteur, ce qui marche aussi dans l’aperçu réduit de l’éditeur iCUE. S et L horizontaux ont le même rapport : ils sont séparés par la hauteur réelle, donc dans l’aperçu réduit un widget L s’affiche avec la mise en page S (sur l’Edge, c’est bien la mise en page L).
- `accentColor` est un nom réservé par iCUE au style de page : le widget utilise `dotAccentColor` pour garder le vert émeraude par défaut.
- L’abréviation du fuseau passe par `en-GB` quand `en-US` ne donne que « GMT+2 » (cas des fuseaux européens).

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (taille réelle S, M, L, XL)
- [`01-overview.png`](mockups/01-overview.png)
