# Dot Apps

**Statut :** 🔵 en conception

Lanceur d’applications Windows : une grille d’icônes en trame de points, un toucher pour ouvrir, groupes en onglets, point sous les applications déjà ouvertes. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Jusqu’à 16 applications en 8 × 2, choisies dans les réglages du compagnon (menu Démarrer, applications du Store, ou chemin libre : programme, raccourci, dossier, fichier, adresse web).
- Vraies icônes des applications, passées en points (Mono ou Color).
- Lancement au toucher (par défaut) ou à l’appui long.
- Point en accent sous les applications ouvertes ; un toucher ramène une application ouverte au premier plan (à vérifier, Windows limite ce droit).
- Groupes en onglets (All, puis les groupes créés dans les réglages), masquables.

## Données

- Compagnon : liste des applications (menu Démarrer, `shell:AppsFolder`), extraction des icônes, lancement (`ShellExecute`), liste des processus pour les applications ouvertes.

## Tailles (proposition)

- [ ] XL (2536 × 696) : groupes en onglets, 8 × 2 applications
- S, M, L : plus tard

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
