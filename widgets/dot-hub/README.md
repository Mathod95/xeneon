# Dot Hub

**Statut :** 🟡 en cours (v0.1.0)

Le widget unique qui regroupe les modules Dot. C’est une coquille iCUE : l’interface est servie par Dot Companion sur le PC et affichée dans une iframe plein cadre.

## Fonctionnement

- Au démarrage, la coquille vérifie que Dot Companion répond sur `127.0.0.1:47800`. Sinon : « COMPANION NOT RUNNING », avec une nouvelle tentative toutes les 4 secondes.
- Chaque Dot Hub posé dans iCUE est une instance, reconnue par son `uniqueId`. Le compagnon retient le module qu’elle affiche et ses réglages.
- Sans module choisi : l’accueil Dot Home. Toucher une tuile choisit le module. Un appui long (1 s) sur un module ramène à l’accueil.
- Réglages sur le PC : `http://127.0.0.1:47800/settings` (nom de l’instance, module, réglages du module, bouton « Identifier »). Les changements s’appliquent tout de suite sur l’Edge.
- Pont clavier : quand un champ de saisie d’un module prend le focus, la coquille garde le clavier dans un champ invisible et lui renvoie le texte (iCUE ne fait pas entrer le clavier dans une iframe).
- Réglage iCUE : « Accent color » (écran d’erreur). Il sert aussi à ce qu’iCUE donne le clavier au widget.

## Modules disponibles

- Clock : le code de `widgets/dot-clock`, servi tel quel ; ses réglages viennent de ses balises `x-icue-property`.

## Tailles

Toutes : l’iframe prend tout l’emplacement, chaque module gère ses tailles.
