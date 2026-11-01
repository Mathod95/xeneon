#!/usr/bin/env python3
"""Fiches de la charte pour les vraies pages du site : docs/design/edge/homePage.html (Dot Page), subPage.html (Dot Companion) et releasePage.html (Dot Release).

Les gabarits de docs/design/ restent la vue générale ; ces fiches montrent les pages telles qu'elles sont, avec leurs
textes et leurs valeurs. La vraie vue est la page elle-même, figée (son HTML et son CSS, les canvas en images, la
Showcase sur sa première vue), et chaque valeur est mesurée sur la page.

    python3 tools/build_site.py      # construit site/
    python3 tools/design_edge.py     # réécrit docs/design/edge/*.html (Playwright nécessaire)

À relancer quand Dot Page ou Dot Companion change.
"""
import functools
import http.server
import json
import pathlib
import re
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "docs" / "design" / "edge"

# ---------------------------------------------------------------- les deux pages et leurs zones
# Chaque zone : son élément (sélecteur, rang), ses éléments numérotés (z.1, z.2…) avec la place de leur pastille (at),
# leur nom dans le squelette (sk), leur description (text) et ce que la mesure ne dit pas (note).
TOP = {"id": "header", "side": "L", "name": "Top", "field": ".top", "sel": [".top", 0],
       "_": "Rangée de 42 px, la marque à gauche, le reste à droite, tout centré verticalement",
       "parts": [
           {"sel": [".top .brand", 0], "sk": "marque", "text": "La marque « ● DOT HUB » à gauche, lien vers Dot Page.", "note": "Lien vers Dot Page"},
           {"sel": [".top .lang", 0], "sk": "FR / EN", "text": "Le choix de langue FR / EN. Français si le navigateur est en français, anglais sinon ; le choix est gardé dans le navigateur.", "note": "Langue choisie en pastille pleine #F2F0E9, texte #080808"},
           {"sel": [".top .ext", 0], "sk": "Companion", "text": "Companion, lien vers la page Dot Companion.", "note": "Survol: texte #F2F0E9, bord #333. Page en cours: pastille pleine #F2F0E9, texte #080808 (aria-current)"},
           {"sel": [".top .ext", 1], "sk": "Releases", "text": "Releases, lien vers Dot Release.", "note": "Comme 1.3"},
           {"sel": [".top .ext", 2], "sk": "GitHub ↗", "text": "GitHub ↗, lien vers le dépôt Mathod95/xeneon (nouvel onglet).", "note": "Comme 1.3, ouvre le dépôt dans un nouvel onglet"},
       ]}


def footer(n, side):
    return {"id": "footer", "side": side, "name": "Footer", "field": ".footer", "sel": [".footer", 0],
            "desc": "Le slogan à gauche, le lien vers le dépôt à droite. Le même sur toutes les pages.",
            "_": "Slogan à gauche, lien à droite, dernière zone de la page",
            "parts": [
                {"sel": [".footer .red", 0], "sk": "slogan", "text": "Le slogan « For Xeneon Edge · Touch · Dot-matrix », en accent."},
                {"sel": [".footer a", 0], "sk": "Mathod95/xeneon", "text": "Le lien Mathod95/xeneon, vers la page GitHub du projet."},
            ]}


PAGES = {
    "homePage": {
        "path": "", "title": "Dot Page · anatomie", "h1": "Anatomie de Dot Page",
        "lead": "Dot Page telle qu'elle est aujourd'hui (<code>tools/site/index.html</code>), l'accueil du site et la seule homePage. La vraie vue est la page elle-même, figée sur la première vue de la Showcase ; chaque valeur est mesurée sur la page. La version générale, réutilisable pour d'autres projets, est le gabarit homePage (<code>docs/design/homePage.html</code>).",
        "name": "Dot Page", "tag": "homePage · page actuelle",
        "sub": "Ce que chaque zone contient sur Dot Page, et ses valeurs mesurées sur la page (en français, sur un écran de PC).",
        "zones": [
            dict(TOP, desc="Le même sur toutes les pages, toujours dans cet ordre: la marque à gauche, le reste à droite. Aucun bouton allumé: la marque mène déjà ici."),
            {"id": "hero", "side": "R", "name": "Hero", "field": ".hero", "sel": [".hero", 0],
             "desc": "L'ouverture de la page, centrée: DOT HUB en points, ce que fait le projet, puis ses chiffres clés.",
             "_": "48 px sous l'en-tête",
             "parts": [
                 {"sel": ["#titleDots", 0], "at": "r", "sk": "DOT HUB en points tous les 19 px, HUB en accent", "text": "Le titre en points (<code>#titleDots</code>): « DOT HUB » dessiné en canvas avec la police 5 × 7, HUB en points éteints sur un fond de points d'accent.", "note": "Points tous les 19 px (la largeur suit le texte), 760 px au plus, centré. Points allumés #F2F0E9, fond de HUB en accent #10B981, points de fond #171717, rayon 0,36 × l'écart"},
                 {"sel": [".tagline", 0], "at": "r", "sk": "accroche, séparateur ● en accent", "text": "L'accroche (<code>.tagline</code>): ce que fait le projet, en une ligne.", "note": "Séparateur ● en accent #10B981, .5em de chaque côté"},
                 {"sel": [".stats", 0], "at": "r", "sk": "chiffres clés ×4", "text": "Les chiffres clés (<code>.stats</code>), comptés depuis le README à chaque build: modules, maquettes, etc.", "note": "Nombre en accent #10B981, .5em après le nombre"},
             ]},
            {"id": "showcase", "side": "L", "name": "Showcase", "field": ".showcase", "sel": [".showcase", 0],
             "desc": "La Xeneon Edge simulée: l'accueil de Dot Hub, puis Dot Clock à l'heure du navigateur, puis une vue par maquette. Dot Clock, Dot Audio, Dot Spotify, Dot Bambu Lab, Dot Plex et Dot GitHub tournent en direct (le rendu du module, dans un Shadow DOM) ; les autres sont des captures XL.",
             "_": "Une vue toutes les 5 s, en pause tant que la souris ou le focus clavier est sur l'écran ; un changement à la main relance les 5 s. Seule la vue affichée s'anime",
             "parts": [
                 {"sel": [".showcase .bar h2", 0], "at": "o-r", "sk": "titre", "text": "Le titre « Sur la Xeneon Edge »."},
                 {"sel": [".showcase .hint", 0], "at": "o-l", "sk": "aide", "text": "L'aide: toucher une tuile pour ouvrir le module, ou glisser."},
                 {"sel": [".showcase .edge", 0], "at": "tl", "sk": "écran Xeneon Edge 2560 × 720", "text": "L'écran (<code>.edge</code>): le boîtier, l'écran 2560 × 720 et l'emplacement XL 2536 × 696, ici sur l'accueil de Dot Hub (une tuile par module, ALL MODULES ↓, SETTINGS).", "note": "Écran au format 2560 × 720, fond #000 ; emplacement XL 2536 × 696 à 12 / 12 px, fond #080808, réduit à la largeur de la page"},
                 {"sel": ["#dots", 0], "at": "o-r", "sk": "un point par vue", "text": "Les points: un par vue, celui de la vue affichée allumé.", "note": "Zones tactiles de 32 × 32 px, point de 10 px #2A2A2A, #F2F0E9 pour la vue affichée"},
                 {"sel": ["#where", 0], "at": "o-r", "sk": "nom de la vue, lien", "text": "Le nom de la vue affichée, en accent, lien vers sa page (Dot Hub, Dot Clock…).", "note": "Survol en #F2F0E9"},
                 {"sel": [".showcase .nav", 0], "at": "o-l", "sk": "‹ Dot Hub ›", "text": "Les boutons: ‹ vue précédente, retour à l'accueil (Dot Hub), vue suivante ›."},
             ]},
            {"id": "intro", "side": "R", "name": "About", "field": ".about", "sel": [".about", 0],
             "desc": "Dot Hub en une carte: son identité, ce que c'est, comment ça marche, l'installation, puis les liens.",
             "_": "Le haut est disposé comme une carte de la zone List: le titre en haut, la version en bas, calés sur les 70 px du pictogramme",
             "parts": [
                 {"sel": [".about-head canvas", 0], "at": "t", "sk": "picto", "text": "Le pictogramme de Dot Hub, en points 7 × 7."},
                 {"sel": [".about-head h2", 0], "at": "r", "sk": "titre", "text": "Le titre « Dot Hub »."},
                 {"sel": ["#hubStatus", 0], "at": "r", "sk": "statut", "text": "Le statut, lu dans le README.", "note": "Point à la couleur du statut (voir 5.4)"},
                 {"sel": ["#hubVer", 0], "at": "r", "sk": "version", "text": "La version, lue dans le README."},
                 {"sel": [".about-lead", 0], "at": "r", "sk": "intro", "text": "L'intro: ce qu'est Dot Hub."},
                 {"sel": [".about-k", 0], "at": "r", "sk": "sur-titre", "text": "Le sur-titre « Comment ça marche »."},
                 {"sel": [".about .parts", 0], "at": "tr", "sk": "Dot Hub + Dot Companion", "text": "Les deux parties: Dot Hub (le widget) et Dot Companion (le programme), avec leur rôle en accent ; la seconde mène à la page Dot Companion."},
                 {"sel": [".daily", 0], "at": "r", "sk": "au quotidien", "text": "Au quotidien: ce qu'on fait une fois tout installé."},
                 {"sel": [".about-k", 1], "at": "r", "sk": "sur-titre", "text": "Le sur-titre « Installer »."},
                 {"sel": [".about .steps", 0], "at": "tr", "sk": "étapes ×3", "text": "L'installation en trois étapes numérotées."},
                 {"sel": [".about-links", 0], "at": "r", "sk": "liens", "text": "Les liens: la maquette de Dot Hub (en accent), le téléchargement, la fiche."},
             ]},
            {"id": "list", "side": "L", "name": "List", "field": ".list", "sel": [".list", 0],
             "desc": "« Les dots »: une carte par module du README, dans son ordre, toutes cliquables (la maquette, sinon la fiche sur GitHub). Le contenu d'une carte est détaillé sur la première.",
             "_": "Bord #262626, bord en accent #10B981 au survol",
             "parts": [
                 {"sel": [".list .bar", 0], "at": "r", "sk": "Les dots", "text": "Le bandeau « Les dots »."},
                 {"sel": [".grid .card canvas", 0], "at": "t", "sk": "picto", "text": "Le pictogramme du module."},
                 {"sel": [".grid .card h3", 0], "at": "r", "sk": "titre", "text": "Le nom sans « Dot » (Clock, Audio…), System Monitor raccourci en Monitor."},
                 {"sel": [".grid .card .status", 0], "at": "r", "sk": "statut", "text": "Le statut lu dans le README.", "note": "Couleur du point: en cours #F5B942, spécifié #A78BFA, en conception #5AA9E6, idée #6B6B6B"},
                 {"sel": [".grid .card .ver", 0], "at": "r", "sk": "version", "text": "La version (« -- » sans version)."},
                 {"sel": [".grid .card p", 0], "at": "r", "sk": "description", "text": "La description du README."},
             ],
             "first": ".grid .card", "others": [".grid .card", "carte"]},
            dict(footer(6, "R")),
        ],
    },
    "subPage": {
        "path": "companion/", "title": "Dot Companion · anatomie", "h1": "Anatomie de Dot Companion",
        "lead": "La page Dot Companion telle qu'elle est aujourd'hui (<code>tools/site/companion.html</code>, version 2.0), une subPage. La vraie vue est la page elle-même, figée (la vidéo des réglages sur sa première image) ; chaque valeur est mesurée sur la page. La version générale, réutilisable pour d'autres projets, est le gabarit subPage (<code>docs/design/subPage.html</code>).",
        "name": "Dot Companion", "tag": "subPage · page actuelle",
        "sub": "Ce que chaque zone contient sur Dot Companion, et ses valeurs mesurées sur la page (en français, sur un écran de PC).",
        "zones": [
            dict(TOP, desc="Le même sur toutes les pages, toujours dans cet ordre. Companion est allumé: c'est la page en cours."),
            {"id": "hero", "side": "R", "name": "Hero", "field": ".hero", "sel": [".hero", 0],
             "desc": "L'ouverture de la page, calée à gauche: COMPANION en points, ce qu'il est, puis ses faits.",
             "_": "48 px sous l'en-tête",
             "parts": [
                 {"sel": ["#titleDots", 0], "at": "r", "sk": "COMPANION en points tous les 14 px", "text": "Le titre en points: « COMPANION », police 5 × 7.", "note": "Points tous les 14 px (la largeur suit le texte), 760 px au plus, calé à gauche"},
                 {"sel": [".lede", 0], "at": "r", "sk": "accroche, séparateur ● en accent", "text": "L'accroche: le programme Windows qui fait marcher Dot Hub · local, gratuit, sans compte.", "note": "Séparateur ● en accent #10B981, .5em de chaque côté"},
                 {"sel": [".facts", 0], "at": "r", "sk": "faits ×4", "text": "Les faits: version, Windows 10 · 11, 127.0.0.1, 0 compte à créer.", "note": "Valeur en accent #10B981, .5em après la valeur"},
             ]},
            {"id": "showcase", "side": "L", "name": "Showcase", "field": ".showcase", "sel": [".showcase", 0],
             "desc": "« Sur le PC »: la page de réglages en vidéo, dans le même cadre que l'Edge de Dot Page. Le pointeur ajoute Dot Clock avec « + », puis change quelques réglages. La vidéo est enregistrée par build_site.py dans la maquette du compagnon.",
             "_": "Vidéo en boucle, sans son, image d'attente en premier ; pas de lecture automatique si le système demande moins d'animations",
             "parts": [
                 {"sel": [".showcase .bar h2", 0], "at": "o-r", "sk": "titre", "text": "Le titre « Sur le PC »."},
                 {"sel": [".showcase .hint", 0], "at": "o-l", "sk": "aide", "text": "L'aide: ⚙ SETTINGS, sur l'Edge, ouvre la page de réglages dans le navigateur."},
                 {"sel": [".showcase .edge", 0], "at": "tl", "sk": "vidéo de la page de réglages, 3:2", "text": "La vidéo (<code>.edge .shot video</code>), lien vers la maquette du compagnon.", "note": "Vidéo 1200 × 800 (3:2), arrondi 10 px dans le cadre"},
                 {"sel": [".showcase .where", 0], "at": "o-r", "sk": "lien", "text": "Le lien « Voir la page de réglages → », en accent, centré, vers la maquette du compagnon.", "note": "Survol en #F2F0E9"},
             ]},
            {"id": "intro", "side": "R", "name": "About", "field": ".about", "sel": [".about", 0],
             "desc": "Dot Companion en une carte: son identité, une phrase d'intro, ce qu'il fait, puis l'installation.",
             "_": "Le haut comme sur Dot Page: titre en haut, version en bas, calés sur les 70 px du pictogramme",
             "parts": [
                 {"sel": [".about-head canvas", 0], "at": "t", "sk": "picto", "text": "Le pictogramme, en points 7 × 7."},
                 {"sel": [".about-head h2", 0], "at": "r", "sk": "titre", "text": "Le titre « Dot Companion »."},
                 {"sel": [".about-head .status", 0], "at": "r", "sk": "statut", "text": "Le statut (en cours)."},
                 {"sel": [".about-head .ver", 0], "at": "r", "sk": "version", "text": "La version téléchargeable."},
                 {"sel": [".about-lead", 0], "at": "r", "sk": "intro", "text": "L'intro: il tourne sur le PC, à côté d'iCUE, et Dot Hub lui demande tout ce qu'il affiche."},
                 {"sel": [".about-k", 0], "at": "r", "sk": "sur-titre", "text": "Le sur-titre « Ce qu'il fait »."},
                 {"sel": [".about .parts", 0], "at": "tr", "sk": "parties 2 × 2", "text": "Les quatre parties en 2 × 2: pictogramme à gauche, titre en haut, texte suivi qui passe sous le pictogramme.", "note": "Toutes de la même hauteur"},
                 {"sel": [".about-k", 1], "at": "r", "sk": "sur-titre", "text": "Le sur-titre « Installer »."},
                 {"sel": [".about .steps", 0], "at": "tr", "sk": "étapes ×4, la 1re en accent", "text": "Les quatre étapes: Télécharger ↗ (toute la carte en émeraude, lien vers la dernière release), lancer Dot Companion, ajouter Dot Hub, ajouter ses dots."},
                 {"sel": [".about .note", 0], "at": "r", "sk": "note SmartScreen", "text": "La note SmartScreen, sur une ligne: l'exe n'est pas encore signé.", "note": "Mot clé en jaune #F5B942"},
             ]},
            {"id": "table", "side": "L", "name": "Ce qu'il utilise", "field": ".sec .table-scroll", "sel": [".sec", 0],
             "desc": "Ce que le compagnon utilise, module par module, et s'il contacte Internet.",
             "_": "En-têtes #7D7B76, première colonne en gras",
             "parts": [
                 {"sel": [".sec h2", 0], "at": "r", "sk": "sur-titre", "text": "Le sur-titre « Ce qu'il utilise »."},
                 {"sel": [".table-scroll", 0], "at": "tr", "sk": "tableau: module, ce qu'il utilise, Internet", "text": "Le tableau: Dot Clock, Dot Steam, puis les autres modules (Bientôt)."},
             ]},
            {"id": "list", "side": "R", "name": "Roadmap", "field": ".sec .bullets", "sel": [".sec", 1],
             "desc": "Ce qui est fait et ce qui vient, du plus récent au plus ancien. On y trouve aussi la confidentialité en détail (lignes 0.1.0 et 0.4.0).",
             "parts": [
                 {"sel": [".sec h2", 1], "at": "r", "sk": "Roadmap", "text": "Le sur-titre « Roadmap »."},
                 {"sel": [".bullets li.todo", 0], "at": "r", "sk": "à faire, éteint", "text": "Ce qui reste à faire, éteint, sans version (Exe signé)."},
                 {"sel": [".bullets li.done", 1], "at": "r", "sk": "fait, allumé", "text": "Ce qui est fait, allumé, puce en accent, suivi de sa version."},
                 {"sel": [".bullets .when", 1], "at": "o-r", "sk": "version", "text": "La version en capsule, lien vers Dot Release.", "note": "Survol: capsule pleine #10B981, texte #080808"},
             ]},
            dict(footer(7, "L")),
        ],
    },
    "releasePage": {
        "path": "releases/", "title": "Dot Release · anatomie", "h1": "Anatomie de Dot Release",
        "lead": "Dot Release telle qu'elle est aujourd'hui (<code>tools/site/releases.html</code>, données <code>releases.json</code>), la releasePage du site. La vraie vue est la page elle-même, figée ; chaque valeur est mesurée sur la page. En-tête repris de la charte le 1er novembre 2026 ; le pied de page n'a pas encore la classe .footer. La version générale est le gabarit releasePage (<code>docs/design/releasePage.html</code>).",
        "name": "Dot Release", "tag": "releasePage · page actuelle",
        "sub": "Ce que chaque zone contient sur Dot Release, et ses valeurs mesurées sur la page (en français, sur un écran de PC). Une version = un tag, plus « next » pour ce qui est sur main sans tag.",
        "rename": {"badge": "r-badge"},
        "zones": [
            dict(TOP, desc="Le même sur toutes les pages, toujours dans cet ordre. Releases est allumé: c'est la page en cours."),
            {"id": "hero", "side": "R", "name": "Hero", "field": ".hero", "sel": [".hero", 0],
             "desc": "L'ouverture de la page, calée à gauche: RELEASES en points, puis ce que raconte la page.",
             "_": "48 px sous l'en-tête",
             "parts": [
                 {"sel": ["#titleDots", 0], "at": "r", "sk": "RELEASES en points tous les 14 px", "text": "Le titre en points: « RELEASES », police 5 × 7.", "note": "Points tous les 14 px, calé à gauche"},
                 {"sel": [".lede", 0], "at": "r", "sk": "accroche", "text": "L'accroche: ce qui a changé, version par version."},
             ]},
            {"id": "next", "side": "L", "name": "Prochaine version", "field": ".rel (next)", "sel": ["article.rel", 0],
             "desc": "Ce qui est sur main sans tag (entrée « next » de releases.json). Toujours en premier, avec le lien vers l'exe compilé par les Actions.",
             "parts": [
                 {"sel": ["article.rel:nth-of-type(1) .ver", 0], "at": "t", "sk": "Sur main", "text": "« Sur main » à la place du numéro."},
                 {"sel": ["article.rel:nth-of-type(1) time", 0], "at": "t", "sk": "date", "text": "« pas encore publiée »."},
                 {"sel": ["article.rel:nth-of-type(1) .r-badge", 0], "at": "t", "sk": "Prochaine version", "text": "L'étiquette « Prochaine version », point et texte en jaune.", "note": "Jaune #F5B942"},
                 {"sel": ["article.rel:nth-of-type(1) > h2", 0], "at": "r", "sk": "titre", "text": "Le titre de la version."},
                 {"sel": ["article.rel:nth-of-type(1) .comps", 0], "at": "r", "sk": "composants", "text": "Les composants modifiés depuis la version précédente, avec leur nouvelle version (calculé par la page ; releases.json garde la liste complète)."},
                 {"sel": ["article.rel:nth-of-type(1) .sec", 0], "at": "tr", "sk": "Nouveau", "text": "Nouveau: les lignes ajoutées, titre en émeraude.", "note": "Couleur de la section: Nouveau #10B981, Changé #5AA9E6, Corrigé #F5B942"},
                 {"sel": ["article.rel:nth-of-type(1) .sec", 1], "at": "tr", "sk": "Changé", "text": "Changé, titre en bleu."},
                 {"sel": ["article.rel:nth-of-type(1) .sec", 2], "at": "tr", "sk": "Corrigé", "text": "Corrigé, titre en jaune."},
                 {"sel": ["article.rel:nth-of-type(1) .rel-foot", 0], "at": "r", "sk": "liens", "text": "Les liens: l'exe dans GitHub Actions, les changements depuis le dernier tag."},
             ]},
            {"id": "latest", "side": "L", "name": "Dernière version", "field": ".rel.latest", "sel": ["article.rel", 1],
             "desc": "La dernière version taguée: même squelette, numéro et bord en accent, étiquette « Dernière version ».",
             "_": "Bord #262626 au lieu de #1F1F1F",
             "parts": [
                 {"sel": ["article.rel:nth-of-type(2) .ver", 0], "at": "t", "sk": "version", "text": "Le numéro de version, en accent.", "note": "Bord et texte #10B981"},
                 {"sel": ["article.rel:nth-of-type(2) time", 0], "at": "t", "sk": "date", "text": "La date du tag."},
                 {"sel": ["article.rel:nth-of-type(2) .r-badge", 0], "at": "t", "sk": "Dernière version", "text": "L'étiquette « Dernière version », en accent."},
                 {"sel": ["article.rel:nth-of-type(2) > h2", 0], "at": "r", "sk": "titre", "text": "Le titre de la version."},
                 {"sel": ["article.rel:nth-of-type(2) .comps", 0], "at": "r", "sk": "composants", "text": "Les composants modifiés depuis la version précédente."},
                 {"sel": ["article.rel:nth-of-type(2) .sec", 0], "at": "tr", "sk": "section", "text": "Les sections Nouveau, Changé, Corrigé ; une section vide n'est pas affichée."},
                 {"sel": ["article.rel:nth-of-type(2) .rel-foot", 0], "at": "r", "sk": "liens", "text": "Les liens: changements depuis le tag précédent, téléchargement de la release."},
             ]},
            {"id": "older", "side": "L", "name": "Versions précédentes", "field": ".rel", "sel": ["article.rel", 2],
             "desc": "Les versions plus anciennes, de la plus récente à la plus ancienne, même squelette sans étiquette.",
             "parts": [
                 {"sel": ["article.rel:nth-of-type(3) .ver", 0], "at": "t", "sk": "version", "text": "Le numéro de version."},
                 {"sel": ["article.rel:nth-of-type(3) time", 0], "at": "t", "sk": "date", "text": "La date du tag."},
                 {"sel": ["article.rel:nth-of-type(3) > h2", 0], "at": "r", "sk": "titre", "text": "Le titre de la version."},
                 {"sel": ["article.rel:nth-of-type(3) .comps", 0], "at": "r", "sk": "composants", "text": "Les composants modifiés depuis la version précédente."},
                 {"sel": ["article.rel:nth-of-type(3) .sec", 0], "at": "tr", "sk": "section", "text": "Les sections, comme pour la dernière version."},
                 {"sel": ["article.rel:nth-of-type(3) .rel-foot", 0], "at": "r", "sk": "liens", "text": "Les liens: changements, téléchargement."},
             ],
             "others": ["article.rel:nth-of-type(n+4)", "version"]},
            {"id": "toc", "side": "R", "name": "Liste des versions", "field": ".side .toc", "sel": [".side", 0],
             "desc": "Une entrée par version, à droite, qui reste visible au défilement. La version à l'écran est allumée ; toucher une entrée y descend.",
             "_": "Colonne collée à 24 px du haut au défilement (sticky)",
             "parts": [
                 {"sel": [".side h2", 0], "at": "r", "sk": "Versions", "text": "Le titre « Versions »."},
                 {"sel": [".toc li", 0], "at": "r", "sk": "entrée à l'écran", "text": "L'entrée de la version à l'écran: point et numéro allumés.", "note": "Point #10B981 (aria-current)"},
                 {"sel": [".toc li", 1], "at": "r", "sk": "entrée", "text": "Une autre entrée: numéro, puis date · titre en petit.", "note": "Point #2A2A2A"},
             ]},
            {"id": "footer", "side": "R", "name": "Footer", "field": "footer", "sel": ["footer", 0],
             "desc": "Le slogan à gauche, le lien vers le dépôt à droite. Ici sans la classe .footer des autres pages.",
             "_": "Slogan à gauche, lien à droite, dernière zone de la page",
             "parts": [
                 {"sel": ["footer .red", 0], "sk": "slogan", "text": "Le slogan « For Xeneon Edge · Touch · Dot-matrix », en accent."},
                 {"sel": ["footer a", 0], "sk": "Mathod95/xeneon", "text": "Le lien Mathod95/xeneon, vers la page GitHub du projet."},
             ]},
        ],
    },
}

BASE = ("<b>Socle commun</b>: fond #080808 avec la trame de points de 22 px, place de la barre de défilement toujours réservée, "
        "contenu centré de 1240 px au plus, 48 px entre les zones, une seule couleur d'accent (émeraude #10B981), un seul thème sombre. "
        "Fira Code pour les libellés et les valeurs, Segoe UI pour le texte.")

# ---------------------------------------------------------------- dans la page : zones, mesures, page figée
ANNOTATE = """
([spec, rename]) => {
  const pick = s => document.querySelectorAll(s[0])[s[1]];
  // classes de la page qui portent le nom d'une classe de l'anatomie (.badge…)
  Object.entries(rename || {}).forEach(([a, b]) => document.querySelectorAll('.' + a).forEach(e => e.classList.replace(a, b)));
  document.querySelectorAll('h1#title').forEach(h => h.remove());    // titre caché pour les lecteurs d'écran
  spec.forEach((z, i) => {
    const el = pick(z.sel); if (!el) throw new Error('zone ' + z.id);
    el.dataset.zone = z.id; el.dataset.name = z.name;
    const b = document.createElement('span'); b.className = 'badge'; b.textContent = i + 1; el.prepend(b);
    (z.parts || []).forEach((p, j) => {
      const e = pick(p.sel); if (!e) throw new Error('élément ' + (i + 1) + '.' + (j + 1));
      e.dataset.part = (i + 1) + '.' + (j + 1); if (p.at) e.dataset.partAt = p.at; e.dataset.sk = p.sk;
    });
    if (z.first) pick([z.first, 0]).classList.add('first');
    if (z.others) document.querySelectorAll(z.others[0]).forEach((e, k) => { if (k) e.dataset.sk = z.others[1]; });
  });
}
"""

FREEZE = """
async () => {
  const wrap = document.querySelector('.wrap');
  // la Showcase de Dot Page : seulement la première vue (l'accueil de Dot Hub)
  const strip = document.getElementById('strip');
  if (strip) { [...strip.children].slice(1).forEach(p => p.remove()); strip.style.transform = 'translateX(0px)'; }
  // canvas : leur image, redessinée par anatomy.js (data-img)
  wrap.querySelectorAll('canvas').forEach(cv => {
    try { cv.dataset.img = cv.toDataURL('image/png'); } catch (e) {}
    delete cv.dataset.pic; delete cv.dataset.title;
  });
  // vidéo : sa première image seulement
  for (const v of wrap.querySelectorAll('video')) {
    if (v.poster) {
      const blob = await (await fetch(v.poster)).blob();
      v.poster = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
    }
    v.removeAttribute('src'); v.removeAttribute('autoplay'); v.pause();
  }
  // numéros courts : anatomy.js les complète (1.1, 1.2…)
  wrap.querySelectorAll('[data-part]').forEach(e => { e.dataset.part = e.dataset.part.split('.')[1]; });
  wrap.querySelectorAll('a, button').forEach(e => e.setAttribute('tabindex', '-1'));
  wrap.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  wrap.className = 'pw'; wrap.removeAttribute('id');
  return { html: wrap.outerHTML, css: document.querySelector('head style, style').textContent };
}
"""


def scope_css(css, rename=None):
    """CSS de la page, rangé sous .mini : variables sur .mini, html/body et @media retirés, classes renommées."""
    out, i = [], 0
    for a, b in (rename or {}).items():
        css = re.sub(r"\." + a + r"(?![\w-])", "." + b, css)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    while i < len(css):
        j = css.find("{", i)
        if j < 0:
            break
        sel = css[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0)
            k += 1
        body = css[j:k]
        i = k
        if sel.startswith("@media"):
            continue
        if sel.startswith("@"):
            out.append(sel + " " + body)
            continue
        sels = []
        for s in sel.split(","):
            s = s.strip()
            if s in ("html", "body"):
                continue
            if s == ":root":
                sels.append(".mini")
            elif s == ".wrap":
                sels.append(".mini .pw")
            else:
                sels.append(".mini " + s)
        if sels:
            out.append(", ".join(sels) + " " + body)
    return "\n".join(out)


# ---------------------------------------------------------------- valeurs : même rédaction que les gabarits
def n(v):
    v = str(v)
    f = float(v) if re.match(r"^-?[\d.]+$", v) else None
    if f is None:
        return v
    return (str(int(f)) if f == int(f) else ("%.1f" % f).rstrip("0").rstrip(".")).replace(".", ",")


def ftext(t):
    if not t:
        return []
    o = [f"{t['font']} {n(t['size'])} px", "interligne " + (n(t['lh'].replace(' px', '')) + " px" if t['lh'] != "normal" else "normal")]
    if t['weight'] == "700":
        o.append("gras")
    elif t['weight'] != "400":
        o.append("graisse " + t['weight'])
    if t['ls']:
        o.append("espacement " + t['ls'])
    if t['upper']:
        o.append("capitales")
    o.append(t['color'])
    if t['ellipsis']:
        o.append("une ligne, coupée par « … »")
    if t['align'] == "center":
        o.append("centré")
    if t['align'] in ("right", "end"):
        o.append("calé à droite")
    return o


def fpad(p):
    t, r, b, l = p
    if t == r == b == l:
        return f"marge {n(t)} px"
    if t == b and r == l:
        return f"marge {n(t)} × {n(r)} px"
    return "marge " + " / ".join(n(x) for x in p) + " px"


def fbox(b, size=False):
    o = []
    if b.get('pad'):
        o.append(fpad(b['pad']))
    if b.get('border'):
        br = b['border']
        o.append(f"bord {n(br['w'])} px {br['color']}" + (" en pointillés" if br['style'] == "dashed" else "") + (" en haut" if b.get('borderTopOnly') else ""))
    if b.get('borderBottom'):
        o.append("trait " + b['borderBottom'] + " en dessous")
    if b.get('borderLeft'):
        o.append("trait " + b['borderLeft'] + " à gauche")
    if b.get('radius'):
        r = b['radius']
        o.append("arrondi " + (n(r[0]) + " px" if len(set(r)) == 1 else " / ".join(n(x) for x in r) + " px"))
    if b.get('bg'):
        o.append("fond " + b['bg'])
    if b.get('bgimg') and 'linear-gradient' in b['bgimg']:
        o.append("fond en dégradé")
    if b.get('layout') == "grid" and b.get('cols', 1) > 1:
        g = b['gap']
        o.append(f"{b['cols']} colonnes, écart " + (n(g[0]) + " px" if g[0] == g[1] else f"{n(g[0])} px entre les lignes, {n(g[1])} px entre les colonnes"))
    elif b.get('layout') == "grid" and b['gap'][0] not in ("0", "normal"):
        o.append(f"{n(b['gap'][0])} px entre les éléments")
    elif b.get('layout', '').startswith("flex"):
        g, col = b['gap'], b['layout'].endswith("column")
        gv = g[0] if col else g[1]
        o.append((("empilés, " if col else "en ligne, ") + f"écart {n(gv)} px") if gv not in ("0", "normal") else ("empilés" if col else "en ligne"))
        if b.get('justify') == "space-between":
            o.append("calés en haut et en bas" if col else "répartis aux deux bouts")
        if b.get('justify') in ("flex-end", "end"):
            o.append("calés à droite")
        if b.get('justify') == "center":
            o.append("centrés")
    if b.get('maxw'):
        o.append(f"{n(b['maxw'])} px de large au plus")
    if size:
        o.append(f"{b['w']} × {b['h']} px")
    return o


def fbefore(x):
    if not x:
        return []
    if x['content'].startswith("counter"):
        return [f"numéro dans un rond de {n(x['w'])} px {x['bg'] or ''}".strip()]
    if x['content'] in ('""', "''"):
        return [f"précédé d'un point de {n(x['w'])} px" + (f" {x['bg']}" if x['bg'] else " à la couleur du statut")]
    return []


def line(it):
    head = f"<b>{it['label']}</b> <code>{it['sel']}</code>"
    v = ftext(it['text']) + fbefore(it.get('before')) + fbox(it['box'], size=bool(it.get('canvas')) or bool(it['box'].get('border')))
    if it.get('canvas'):
        v = [x for x in v if not re.match(r"^\d+ × \d+ px$", x)] + [f"dessin en points de {it['canvas']} px"]
    out = head + (": " + ", ".join(v) if v else "")
    for sb in it.get('subs', []):
        sv = ftext(sb['text']) + fbefore(sb.get('before')) + fbox(sb['box'])
        if sb['sel'] == "canvas" or not sv:
            continue
        out += f" · <code>{sb['sel']}</code>: " + ", ".join(sv)
    return out


def rule(z, spec):
    notes = {p_i: p.get("note") for p_i, p in enumerate(spec.get("parts", []))}
    z['items'].sort(key=lambda it: int(it['label'].split('.')[1]))
    ens = fbox(z['box'])
    for st in z['structs']:
        sv = fbox(st['box']) + ftext(st['text'])
        if sv:
            ens.append(f"<code>{st['sel']}</code>: " + ", ".join(sv))
    e = "<b>Ensemble</b> " + "; ".join(ens)
    if spec.get("_"):
        e += (". " if ens else "") + spec["_"]
    lines = ["<b>Valeurs:</b>", e]
    for it in z['items']:
        k = int(it['label'].split('.')[1]) - 1
        l = line(it)
        if notes.get(k):
            l += ". " + notes[k]
        lines.append(l)
    return "<br>".join(lines)


def page_html(name, P, snap, zones):
    css = scope_css(snap["css"], P.get("rename"))
    data = [{k: z[k] for k in ("id", "side", "name", "field", "desc")} | {"parts": [p["text"] for p in z["parts"]], "rule": r} for z, r in zones]
    anatomy = "window.ANATOMY = { native: 1320, zones: " + json.dumps(data, ensure_ascii=False, indent=1).replace("</", "<\\/") + " };"
    return f"""<title>{P['title']}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap">
<link rel="stylesheet" href="../anatomy.css">
<!-- Généré par tools/design_edge.py depuis la page construite (site/{P['path']}) : ne pas modifier à la main. -->
<style>
/* CSS de la page, rangé sous .mini */
{css}
/* squelette : la première carte garde son contour, ses éléments sont nommés un par un */
.mini.sk .card.first {{ visibility: visible; border: 1px dashed #3a3a38; background: transparent; }}
</style>

<div class="wrap">
  <div class="a-top">
    <span class="a-brand">DOT HUB</span>
    <span class="a-crumb">Charte · pages actuelles</span>
  </div>

  <div class="a-head">
    <h1>{P['h1']}</h1>
    <p class="a-lead">{P['lead']}</p>
  </div>

  <div class="a-bar">
    <p class="a-name">{P['name']} <span class="a-tag">{P['tag']}</span></p>
    <div class="a-switch" role="group" aria-label="Vue">
      <button type="button" data-view="real" aria-pressed="true">Vraie vue</button>
      <button type="button" data-view="skeleton" aria-pressed="false">Squelette</button>
    </div>
  </div>

  <div class="a-diag" id="diag">
    <svg class="a-leaders" id="leaders" aria-hidden="true"></svg>
    <div class="a-pins is-left" id="pinsL"></div>
    <div class="a-stage" id="stage">
      <div class="mini" id="mini" aria-hidden="true">
        {snap['html']}
      </div>
    </div>
    <div class="a-pins" id="pinsR"></div>
  </div>

  <div class="a-sub">
    <h2>Les zones</h2>
    <p>{P['sub']}</p>
  </div>
  <ol class="a-list" id="list"></ol>

  <p class="a-base">{BASE}</p>
</div>

<script>
{anatomy}
</script>
<script src="../anatomy.js"></script>
"""


def main():
    from playwright.sync_api import sync_playwright
    extract = (pathlib.Path(__file__).parent / "design_extract.js").read_text(encoding="utf-8")
    handler = functools.partial(type("Q", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=str(SITE))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for name, P in PAGES.items():
                page = browser.new_page(viewport={"width": 1400, "height": 1000})
                page.goto("http://127.0.0.1:%d/%s?lang=fr" % (srv.server_address[1], P["path"]))
                page.wait_for_timeout(1500)
                page.evaluate("() => { const b = document.getElementById('homeBtn'); if (b) b.click(); }")
                page.wait_for_timeout(600)
                spec = [{"id": z["id"], "name": z["name"], "sel": z["sel"], "parts": [{"sel": p["sel"], "at": p.get("at"), "sk": p["sk"]} for p in z["parts"]],
                         "first": z.get("first"), "others": z.get("others")} for z in P["zones"]]
                page.evaluate(ANNOTATE, [spec, P.get("rename", {})])
                page.evaluate("() => { document.querySelector('.wrap').id = 'mini'; }")
                measured = page.evaluate(extract)
                snap = page.evaluate(FREEZE)
                page.close()
                zones = [(z, rule(m, z)) for z, m in zip(P["zones"], measured)]
                (OUT / (name + ".html")).write_text(page_html(name, P, snap, zones), encoding="utf-8")
                print(name, "->", OUT / (name + ".html"))
            browser.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
