# Dot ArgoCD

**Statut :** ⚪ idée

Applications Argo CD : santé et synchronisation de chaque application, écarts signalés, synchronisation lancée d’un toucher. Module de Dot Hub, servi par Dot Companion.

## Données

- API REST d’Argo CD (`/api/v1/applications`) avec un jeton d’API (compte Argo CD ayant le droit `apiKey`), gardé chiffré sur le PC.
- Santé (Healthy, Progressing, Degraded, Suspended, Missing) et synchronisation (Synced, OutOfSync) ; action : synchroniser une application (`POST /api/v1/applications/<nom>/sync`).
