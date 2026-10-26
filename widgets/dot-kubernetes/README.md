# Dot Kubernetes

**Statut :** ⚪ idée

Cluster Kubernetes : nœuds prêts, pods par état, redémarrages et déploiements incomplets, par namespace. Module de Dot Hub, servi par Dot Companion.

## Données

- Le compagnon lit le kubeconfig du PC (`%USERPROFILE%\.kube\config`, contexte au choix) et interroge l’API du cluster : nœuds, pods, déploiements.
- À vérifier : les kubeconfig qui passent par un programme d’authentification externe (`exec`, par exemple pour les clusters cloud).
