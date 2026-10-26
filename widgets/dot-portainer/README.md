# Dot Portainer

**Statut :** ⚪ idée

Conteneurs Docker via Portainer : état, CPU et mémoire, stacks, démarrer, arrêter et redémarrer d’un toucher. Module de Dot Hub, servi par Dot Companion.

## Données

- API de Portainer avec une clé d’accès (en-tête `X-API-Key`), gardée chiffrée sur le PC : environnements (`/api/endpoints`), conteneurs par l’API Docker relayée (`/api/endpoints/<id>/docker/containers/json`), stacks (`/api/stacks`).
- Actions : démarrer, arrêter, redémarrer un conteneur.
