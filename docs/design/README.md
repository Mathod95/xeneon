# Charte graphique (DA)

Référence unique pour le style de Dot Hub : les modules sur l’Edge, la page de réglages du compagnon, et les pages web (Dot Page, Dot Release, Dot Companion, maquettes de référence). Toute nouvelle page ou tout nouveau module part d’ici.

> En cours : ce dossier remplace `docs/DESIGN.md`. Les valeurs ci-dessous sont celles déjà en place dans le code (octobre 2026) ; elles seront détaillées fichier par fichier.

## Contenu du dossier (à venir)

| Fichier | Sujet |
|---|---|
| `README.md` | principes, valeurs de base, index (ce fichier) |
| `couleurs.md` | palette, couleurs communes réglables, couleurs de statut |
| `typographie.md` | polices, tailles, capitales espacées, police en points |
| `composants.md` | en-tête, cartes, boutons, puces, tableaux, fond en points, écran de l’Edge simulé |
| `nouvelle-page.md` | créer une nouvelle page web ou une nouvelle maquette, pas à pas |

## Types de pages du site

Pages web du site (GitHub Pages et artefacts). Les écrans de l’Edge et la page de réglages du compagnon seront traités à part.

| Type | Rôle | Pages actuelles |
|---|---|---|
| `homePage` | page d’accueil du site, une seule | Dot Page |
| `subPage` | page générique sous l’accueil : présentation, guide, FAQ… (tout ce qui n’est pas un des autres types) | Dot Companion |
| `modulePage` | maquette de référence : l’Edge simulée, les réglages simulés, le tableau des choix | une par module (`/<slug>/`), et Companion Mockup |
| `releasePage` | les versions : contenu au centre, liste des versions à droite | Dot Release |

`subPage` reste volontairement générale : une nouvelle page qui n’est ni l’accueil, ni une maquette, ni les versions en est une.

Anatomie de chaque type (page générique en vraie vue ou en squelette, zones numérotées et leurs valeurs): `homePage.html`, `subPage.html`, `modulePage.html` et `releasePage.html`, qui partagent `anatomy.css` et `anatomy.js` (bascule, étiquettes, traits, police en points). Publiées en artefacts (Gabarit homePage, subPage, modulePage, releasePage) et sur le site (`/design/<type>/`). Une page de ce dossier qui change: régénérer le site et republier son artefact avec les deux fichiers communs.

Ce README est la référence pour créer une page parfaite: chaque règle validée y est écrite. Le suivi des chantiers (ce qui reste à faire et ce qui est fait, rangé par zone des gabarits) est dans `TODO.md`. Une correction se note dans les deux: la règle ici, le suivi là-bas.

## Principes actés

- **Dot style partout** : chiffres, titres et pictogrammes en points (grille 5 × 7 pour les caractères, 7 × 7 pour les pictogrammes) ; points éteints visibles en gris très sombre.
- **Un seul thème sombre**, pas de thème clair.
- **Une seule couleur d’accent** pour tout Dot Hub, émeraude par défaut, réglable dans la carte « Paramètres globaux » du compagnon (avec Lit dot, Unlit dot et Label).
- **Libellés** en capitales espacées, police monospace ; valeurs en points.
- **Images** (jaquettes, pochettes, affiches) rendues en trame de points.
- **Lisibilité sur l’Edge** : textes ≥ 18 px, zones tactiles ≥ 60 × 60 px.
- **Une mise en page par taille** (S, M, L, XL), jamais un simple redimensionnement. **Jamais de vertical.** Pour l’instant, seul le XL est travaillé.

## Valeurs en place

| Rôle | Valeur |
|---|---|
| Fond | `#080808` |
| Fond en points (pages web, maquettes, réglages) | `radial-gradient(circle, #161616 1.2px, transparent 1.6px)`, trame de 22 px |
| Barre de défilement (pages web, maquettes) | `html { scrollbar-gutter: stable; }`, place toujours réservée, la page ne se décale pas d'une page à l'autre, qu'elle défile ou non |
| Panneau / carte | `#0e0e0e` (pages web), `#121212` (réglages) |
| Bordure fine | `#1f1f1f` à `#262626` |
| Point allumé, texte principal | `#F2F0E9` |
| Point éteint | `#1C1C1C` |
| Libellé | `#B8B6B0` |
| Texte discret | `#7D7B76` |
| Accent (par défaut) | `#10B981` (Émeraude) ; autre couleur proposée : `#ED403B` (Rouge A) |
| Statuts (Dot Page) | en cours `#F5B942`, spécifié `#A78BFA`, en conception `#5AA9E6`, idée `#6B6B6B` |
| Police monospace | Fira Code (libellés, valeurs, boutons) |
| Police de texte | Segoe UI (pages web, texte courant) |

## Tailles d’emplacement XENEON EDGE

| Taille | Emplacement |
|---|---|
| S | 840 × 344 |
| M | 840 × 696 |
| L | 1688 × 696 |
| XL | 2536 × 696 |
