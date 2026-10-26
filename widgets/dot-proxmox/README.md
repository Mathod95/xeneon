# Dot Proxmox

**Statut :** ⚪ idée

Nœuds et machines Proxmox VE : CPU, mémoire et stockage, VM et conteneurs démarrés ou arrêtés, démarrer et arrêter d’un toucher. Module de Dot Hub, servi par Dot Companion.

## Données

- API de Proxmox VE (`https://<hôte>:8006/api2/json`) avec un jeton d’API (`PVEAPIToken=utilisateur@royaume!id=secret`), gardé chiffré sur le PC.
- Nœuds (`/nodes`), VM et conteneurs LXC (`/nodes/<nœud>/qemu`, `/lxc`), stockage ; actions : démarrer, arrêter proprement, arrêter.
