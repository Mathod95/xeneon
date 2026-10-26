# Dot Gmail

**Statut :** 🔵 en conception

Non lus Gmail en gros points, par catégorie (Primary, Social, Promotions, Updates), et les derniers messages avec ouvrir dans Gmail, marquer comme lu et archiver. Un ou plusieurs comptes. Module de Dot Hub, servi par Dot Companion. Anciennement Dot Mail.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Nombre de non lus en gros points (99+ au-delà), toute la boîte ou Primary seulement (réglage « Count »).
- Quatre catégories avec leur nombre ; un toucher filtre la liste.
- 5 derniers messages : non lu, expéditeur, objet, début du message, heure. Un toucher affiche : ouvrir dans Gmail sur le PC, marquer comme lu, archiver.
- Nouveau message : arrivée animée en haut de la liste, point du libellé qui clignote.
- « Privacy mode » : expéditeurs et objets masqués, pour le stream.
- Plusieurs comptes : un toucher sur l’adresse passe au suivant.

## Données

- Compagnon en IMAP sur `imap.gmail.com:993` avec un mot de passe d’application Google (validation en deux étapes requise), stocké chiffré sur le PC, jamais dans les réglages iCUE.
- Extensions IMAP de Gmail : catégories (`X-GM-RAW`), libellés, identifiant de conversation (pour ouvrir le bon fil dans Gmail). Nouveaux messages avec `IDLE`.
- API Gmail (OAuth) possible, mais une application Google en mode test reçoit des jetons qui expirent au bout de 7 jours.

## Tailles (proposition)

- [ ] XL (2536 × 696) : non lus et catégories à gauche, 5 messages à droite
- S, M, L : plus tard

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
