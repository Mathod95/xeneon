# MEMORY.md

Mémoire de travail de Claude sur ce projet : ce que `CLAUDE.md` ne dit pas (préférences fines de Mathod95, leçons apprises, historique des décisions, état des discussions). `CLAUDE.md` reste la référence des règles ; ce fichier sert à reprendre une session sans rien perdre. À compléter à chaque décision ou leçon nouvelle, en gardant les entrées courtes et datées.

## Mathod95

- Mathias (Mathod95), propriétaire du dépôt et de l’Edge. Écrit en français, souvent vite (fautes de frappe : lire l’intention). Attend des réponses **courtes**, sans récapitulatif de chaque étape, et le moins de questions possible (une seule à la fois, en fin de réponse, quand une décision lui revient vraiment).
- Travaille beaucoup par **commentaires sur les artefacts** (claude.ai) : un commentaire = une demande précise sur la zone commentée. Faire la modification dans le dépôt, régénérer, republier, répondre dans le fil (« Fait : … Commité en local (<sha>), pas encore poussé. »), ne pas résoudre le fil.
- Valide ligne par ligne (ex. tableau des choix de Companion Mockup : « 5. validé ! », « 6. OK ! ») : n’écrire « Validé » que quand il l’a dit, avec la date.
- Veut **voir avant de pousser** : il dit « push » ou « push simple sans tag » explicitement.
- Passe sur **VS Code** à partir du 29 octobre 2026 pour suivre les modifications : tout doit vivre dans le dépôt (voir « Artefacts = production » dans `CLAUDE.md`).
- Aime : le style dot partout, la cohérence entre maquette, site et Edge (« maquette = widget »), les maquettes à l’échelle réelle, les décisions notées dans les pages (tableau des choix).
- Dit « tu as fait de l’excellent travail » quand c’est bien ; s’énerve quand on fait plus ou autre chose que demandé.

## Leçons apprises (à ne pas refaire)

- **Ne pas sur-interpréter un commentaire.** « Utilise tout l’espace disponible » voulait dire : disposer les tuiles sur toute la largeur (plus de colonnes), **pas** réduire les cartes. J’avais rendu toutes les cartes compactes : « Je t’ai jamais demandé de resize les cartes en mode compact !!!!!!! ». Faire exactement la demande ; en cas de doute, appliquer l’interprétation la plus littérale et le dire en une ligne.
- **« On touche à rien de ce qui est déjà en place »** : ajouter sans modifier l’existant (ex. défilement automatique de l’Edge de Dot Page).
- Un Python d’édition avec plusieurs `assert` avant l’écriture : si un texte attendu diffère, rien n’est écrit. Relire le texte exact avant de remplacer, et vérifier après.
- Ne jamais lancer `rm -rf` sur un chemin relatif (bloqué par la sécurité) : écraser les fichiers à la place.
- `pkill -f <motif>` peut tuer le shell qui lance la commande (le motif est dans sa propre ligne de commande) : tuer par PID.
- Polices en capture headless : sans Fira Code chargée, les mesures sont fausses ; pour aligner du texte au pixel (Dot Home Assistant), les métriques réelles de Fira Code ont été lues avec fontTools (marge haute −4 px).
- La sandbox ne peut ni joindre l’API GitHub (`api.github.com` bloqué), ni installer la cible Rust Windows : la compilation Windows n’est vérifiée que par la CI ; le code Win32 est vérifié sous Linux avec `cargo check --features check-win`.
- Annoncer un nombre (ex. commits à pousser) seulement après l’avoir compté (`git rev-list --count origin/main..HEAD`).

## Préférences de design notées

- Fond de toutes les pages et maquettes = fond en points de Dot Page (demandé le 28 octobre 2026 : « seul Dot Page possède un fond d’écran… répliquer le fond sur tous les artefacts »).
- Pas de logos de marques dessinés par Claude ; ses propres fichiers peuvent être intégrés.
- Dot Page (29 octobre 2026) : étapes d’installation centrées verticalement (rond numéroté à gauche, au milieu de la hauteur) ; pas de filtres sur « Les modules » ; chiffres clés « 1 WIDGET · 1 COMPANION » en premier (« companion » gardé en français aussi) ; l’Edge simulée défile seule toutes les 5 s.
- Dot Release : titre « RELEASES » aligné à gauche ; versions au centre, liste à droite (inspiré de https://dcb.mathod.fr/regles/releases).
- Page de réglages du compagnon (28 octobre 2026) :
  - XL seulement, pas de boutons de taille ;
  - carte DOT HUB fixe en premier, titrée « Dot Hub » ; pas de SETTINGS dans les aperçus ; pas de puces Edge gauche / droite ni de texte d’aide sous l’écran ;
  - « + » ajoute une page **sans titre** : l’écran et, après « ● DOT ▾ » et le choix d’un module, ses réglages au style des maquettes ;
  - carte « Couleurs » renommée **« Paramètres globaux »** (couleurs + « Lancer Dot Companion au démarrage de Windows » + mise à jour).
- Companion Mockup : vue « Fenêtre » retirée (plus de console depuis 0.5.0) ; texte d’en-tête sur toute la largeur.
- Nommage des types de pages du site : `homePage`, `subPage` (général, choisi plutôt que `infoPage` : « dans sa globalité c’est une subPage »), `modulePage`, `releasePage`.
- Dossier de la charte : `docs/design/` (choisi par Claude, accepté).

## Dot Home Assistant (en pause depuis le 28 octobre 2026)

- Il a surtout des **lumières** et des **capteurs température / humidité**.
- Barre des favoris : validée (« nickel »).
- Carte lumière : pictogramme ampoule ; nom puis pièce **alignés sur le haut du pictogramme** (pas centrés) ; barre d’intensité sous le pictogramme ; deux boutons en points **3 × 3** (5 allumés, 4 éteints aux angles) pour la couleur et la « température », empilés à droite sur la ligne du pictogramme, séparés par une ligne de points invisible ; **compacte : 153 px de haut, 3 empilées en XL**.
- Carte capteur : thermomètre ; température et humidité côte à côte en **un seul bloc centré**, chaque valeur centrée au-dessus de son libellé.
- Maquette de référence : une colonne de 3 lumières, une colonne de 2 capteurs. Section « Cartes » : toutes les cartes à l’échelle de la maquette, sur toute la largeur (6 colonnes comme en XL) ; groupes de lumières, automatisations, mises à jour, services, autres entités (prise, volet, serrure, scène, thermostat, puissance, CO₂) en **240 px**. **Seules les lumières sont compactes.**

## Dot Steam

- Choix validés : 8 derniers jeux joués par défaut, trois modes de lancement (appui long par défaut), amis dès la v1, jaquettes Color par défaut, une seule couleur d’accent pour tout Dot Hub, vue Playing validée.
- v0.2.0 à essayer sur le vrai PC ; capture réelle de la v0.1.0 gardée en bas de la maquette (demande de Mathod95, « pour garder un vrai visuel »).
- Reste à choisir : le rendu de jaquette par défaut (Dots, Solid dots, Fine dots, image derrière une grille).

## Dot Companion : historique

- 0.1 (26 octobre) : premier compagnon avec Dot Clock. 0.2 : couleurs communes. 0.3 : bouton SETTINGS (ouvre les réglages sur le PC). 0.4 : Dot Steam 0.1.0, secrets DPAPI (dernière release, v0.4.0).
- 0.5.0 (28 octobre, sur `main`, pas tagué) : lignes 5 à 8 du tableau de Companion Mockup codées (icône, menu, démarrage avec Windows, mise à jour depuis l’app), puis pages de Dot Hub (« Bah oui je veux que tu codes tout correctement sans rien omettre ! »).
- Mise à jour depuis l’app testée de bout en bout sous Linux avec une fausse release (`DOT_UPDATE_URL`) : ancien processus remplacé par un nouveau `--updated`, `.old.exe` supprimé.
- Pages testées avec le vrai compagnon et Playwright : ajout par « + » dans les réglages et sur l’Edge, réglages enregistrés, retrait, synchronisation réglages ↔ Edge, reprise d’une config 0.4.
- Questions posées et répondues : SmartScreen (l’exe non signé déclenche l’avertissement ; pistes MSIX / Microsoft Store ou signature SignPath, ligne 9 à valider) ; « Dot Terminal » (simple question, rien ajouté) ; seul le compagnon change souvent, la coquille Dot Hub (iCUE) très rarement.

## Historique des décisions (résumé)

- 23 octobre 2026 : début ; widgets autonomes, Dot System Monitor, Dot Clock v0.1.x, charte provisoire.
- 25 octobre : site GitHub Pages (Dot Page) avec Edge simulée ; tests clavier / iframes sur l’Edge (Dot Frametest) ; décision d’architecture (Dot Hub + compagnon).
- 26 octobre : Dot Hub seul widget iCUE, chaque `dot-xxx` devient un module ; jamais de vertical ; focus XL ; libellé « ● DOT … » à la même place ; nombreuses maquettes (Plex, Bambu Lab, Home Assistant, Discord, Steam ex-Launcher, Audio, Apps, Gmail ex-Mail, Slack) ; un module par service (Homelab découpé) ; Dot Steam codé (v0.1, v0.2) ; releases v0.1.0 à v0.4.0 le même jour (v0.4.0 = Dot Steam 0.1.0 ; Dot Steam 0.2.0 est sur `main`, pour la prochaine).
- 28 octobre : Dot Release ; fond en points partout ; Dot Home Assistant (cartes) puis pause ; Dot Companion (présentation + maquette) ; réglages avec l’Edge en direct ; compagnon 0.5.0 ; pages de Dot Hub ; push sans tag de 32 commits.
- 29 octobre : retouches de Dot Page par commentaires ; vue Fenêtre retirée ; début de la DA des pages du site (`docs/design/`, types de pages) ; `CLAUDE.md` complété (artefacts = production, registre) ; ce fichier.

## Questions ouvertes

- Quand taguer v0.5.0 (après essai de l’exe sur le PC).
- Lignes 9, 10, 11 de Companion Mockup.
- DA : par quoi commencer (socle commun ou un type de page) ; fichiers `couleurs.md`, `typographie.md`, `composants.md`, `nouvelle-page.md`.
- Composant de réglages commun aux maquettes et au compagnon (proposé).
- Registre des artefacts en fichier + commande de régénération (proposé, en attente).
- Dot Home vs Dot Hub (voir `CLAUDE.md`, « À traiter plus tard »).

## Sécurité

- Un jeton GitHub a été collé en clair dans la conversation (octobre 2026) : il a été conseillé à Mathod95 de le révoquer et d’en créer un nouveau. Ne jamais le recopier nulle part.
