# TODO de la charte

Suivi des chantiers de la charte: ce qui reste à faire (`- [ ]`) et ce qui est fait (`- [x]`, avec la date), rangé par zone. Les sections reprennent les noms des zones des quatre gabarits (`homePage.html`, `subPage.html`, `modulePage.html`, `releasePage.html`), avec entre parenthèses les types de pages concernés. Une zone sans entrée n'a rien en attente. La règle qui en sort va dans `README.md`, la référence pour créer une page.

## `.top` · En-tête (homePage, subPage, modulePage, releasePage)

Même rendu sur les trois pages (marque « ● MATHOD » sur le site, « ● DOT HUB » dans les gabarits, sélecteur FR / EN, boutons `.ext` dans l'ordre Companion, Releases, GitHub ↗), mais le code est recopié six fois: `tools/site/index.html`, `companion.html`, `releases.html` et les trois gabarits.

Écarts voulus (à garder):

- homePage: la marque est un simple texte (`span`), pas de bouton « ← Accueil », aucun bouton allumé.
- subPage et releasePage: la marque est un lien vers l'accueil, bouton « ← Accueil » en plus, bouton de la page en cours allumé (`aria-current="page"`).

À faire:

- [x] Marque « ● MATHOD » remplacée par « ● DOT HUB » dans les quatre gabarits (30 octobre 2026). Règle dans `README.md`.
- [ ] Reporter « ● DOT HUB » sur les trois pages du site (`index.html`, `companion.html`, `releases.html`).
- [x] modulePage: le même `.top` que les trois autres types de pages ajouté en zone 1 du gabarit (30 octobre 2026), avec ses valeurs du site (Segoe UI, Fira Code) et non celles de la maquette (IBM Plex). Aucune pastille allumée: une maquette n'est pas une page du menu. L'ancien « En-tête » de la modulePage devient « Présentation ». Règle dans `README.md`.
- [ ] Ajouter ce `.top` en haut des 19 maquettes de référence (`widgets/*/mockups/reference.html`, `companion/mockups/reference.html`), liens compris (accueil, Companion, Releases, GitHub).
- [ ] `index.html`: `.top` n'a pas `flex-wrap: wrap`, l'en-tête ne passe pas à la ligne sur un écran étroit comme sur les deux autres pages.
- [ ] `releases.html`: `.topr` n'a pas `justify-content: flex-end`, les boutons passés à la ligne se calent à gauche au lieu de rester à droite comme sur `companion.html`.
- [ ] `index.html`: le sélecteur FR / EN obtient son rendu par `.chip` (règle générale) puis `.lang .chip` (surcharge), alors que les sous-pages le définissent directement. Même rendu, à unifier.
- [ ] Gabarits: `.mini .top` et `.mini .topr` n'ont ni `flex-wrap` ni `justify-content: flex-end` (sans effet à taille fixe, à aligner quand même).
- [ ] Regrouper l'en-tête dans un fichier commun (proposé: `tools/site/top.css`), inséré par `build_site.py` dans les trois pages et repris par les gabarits.

## `#titleDots` · Titre en points (homePage, subPage, releasePage)

## `.tagline` / `.lede` · Accroche (homePage / subPage, releasePage)

- [ ] Même rôle, deux noms de classe: `.tagline` sur la homePage (17 à 24 px), `.lede` sur les sous-pages (15 à 19 px). Choisir un nom (la différence de taille peut rester).
- [ ] `.lede`: limitée à `70ch` sur `companion.html`, sans limite sur `releases.html`.

## `.stats` · Chiffres clés (homePage)

## `.edge-sec` · Vitrine (homePage)

## `.hubsec` · Présentation (homePage)

## `#list .grid` · Liste (homePage)

## `.facts` · Faits (subPage)

## `.cta` · Actions (subPage)

## `.sec .cards` · Section en cartes (subPage)

## `.steps + .note` · Section en étapes (subPage)

## `.table-scroll` · Section en tableau (subPage)

## `.list` · Section en liste (subPage)

## `header` · Présentation (modulePage)

- [ ] Sur-titre différent selon les maquettes: « Module Dot Hub · … » (Dot Apps, Dot Audio, Dot Bambu Lab, Dot Discord, Dot Gmail, Dot Home Assistant, Dot Plex, Dot Slack, Dot Steam), « Widget iCUE · … » (Dot Calculator, Dot Clock, Dot GitHub, Dot Home, Dot IA, Dot Notes, Dot Spotify, Dot Weather, et Dot Hub, pour qui c'est juste), « Programme Windows · … » (Companion Mockup, juste aussi). Passer les huit modules en « Module Dot Hub ». Le gabarit utilise déjà « Module Dot Hub ».

## `.tag + .sizebar` · Repère et tailles (modulePage)

## `.frame` · Écran du module (modulePage)

## `.settings` · Réglages simulés (modulePage)

## `figcaption` · Légende (modulePage)

## `table` · Choix de design (modulePage)

## `section` · Sections annexes (modulePage)

## `.rel (next)` · Prochaine version (releasePage)

## `.rel.latest` · Dernière version (releasePage)

## `.rel` · Versions précédentes (releasePage)

## `.side .toc` · Liste des versions (releasePage)

## `footer` · Pied de page (homePage, subPage, releasePage)

## Socle commun (toutes les pages)

- [x] Barre de défilement (30 octobre 2026): une page longue (avec barre) était décalée de 15 px par rapport à une page courte (sans barre), la mise en page bougeait en passant d'une page à l'autre. Corrigé avec `html { scrollbar-gutter: stable; }` sur les 3 pages du site, les 4 gabarits (`anatomy.css`), les 18 maquettes de module et la maquette du compagnon, vérifié dans Chromium sur les 26 pages. Règle ajoutée dans `README.md` et dans le socle commun des gabarits.
- [ ] Les maquettes de module (modulePage) ont leur propre socle: IBM Plex Mono et IBM Plex Sans, contenu de 1480 px au plus, 40 px entre les zones, alors que les autres pages sont en Fira Code et Segoe UI, sur 1240 px avec 48 px d'écart. Décider si les maquettes rejoignent le socle du site. Le gabarit `modulePage` reprend pour l'instant leurs valeurs telles quelles.
