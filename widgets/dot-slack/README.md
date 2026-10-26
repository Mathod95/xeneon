# Dot Slack

**Statut :** 🔵 en conception

Slack sur l’Edge : mentions et messages directs en gros points, canaux non lus, derniers messages qui te concernent, statut et pause des notifications en un toucher. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Mentions et messages directs non lus en gros points (ou tous les non lus, réglage « Count »).
- Les 7 conversations avec des non lus, mentions d’abord ; les 4 derniers messages qui te concernent (expéditeur, canal, texte, heure).
- Un toucher sur un canal ou un message ouvre la conversation dans l’application Slack du PC (`slack://channel?team=…&id=…`).
- Statut en un toucher : Available, Meeting, Lunch, Focus.
- Pause des notifications : un toucher met en pause et change la durée (30 min, 1 h, 2 h), un appui long reprend.
- « Privacy mode » : textes des messages masqués, pour le stream.

## Données

- API Web de Slack via le compagnon, avec un jeton d’utilisateur (`xoxp-…`) d’une application Slack créée dans son espace de travail (accord d’un administrateur parfois demandé). Messages en direct par le Socket Mode (jeton `xapp-…`), sans serveur public. Jetons chiffrés sur le PC.
- Pas de compteur public de non lus : calcul à partir de `last_read` (`conversations.info`) et de l’historique, puis mise à jour en direct. À vérifier.
- Statut : `users.profile.set` ; pause : `dnd.setSnooze` / `dnd.endSnooze`.

## Tailles (proposition)

- [ ] XL (2536 × 696) : mentions, statut et pause à gauche, canaux au centre, messages à droite
- S, M, L : plus tard

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
