# Dot Frametest

Widget de test, pas un widget à publier (hors de `widgets/`, donc ignoré par la CI et par le site). Il vérifie ce qu’un widget iCUE peut faire avec une page web : appels réseau, iframe, clavier, redirection.

## Lancer le test

1. Sous Windows, double-cliquer sur `start-server.bat` : il lance `frametest-server.ps1`, un petit serveur sur `http://localhost:8765/` (écoute seulement sur la machine, sans droits admin). Si le script est bloqué : `Unblock-File .\frametest-server.ps1`.
2. Empaqueter et installer le widget : `icuewidget package tests/dot-frametest/widget`, puis installer `dot-frametest.icuewidget` dans iCUE, en XL.
3. Les tests se lancent seuls ; RUN AGAIN les relance, TEST REDIRECT teste la redirection.

## Résultats sur la Xeneon Edge (version 0.0.6, octobre 2026)

| Test | Résultat |
| --- | --- |
| `fetch` vers `localhost:8765` et `127.0.0.1:8765` | ✅ |
| iframe locale (`localhost`) et distante (GitHub Pages) | ✅ |
| `postMessage` widget ↔ iframe, dans les deux sens | ✅ |
| Toucher dans l’iframe | ✅ (arrive comme souris) |
| Clavier dans un champ du widget | ✅ avec la structure de la Checklist (voir `CLAUDE.md`) |
| Clavier dans un champ de l’iframe, directement | ❌ |
| Clavier dans l’iframe via le pont clavier | ✅ |
| `uniqueId` (lu avec `typeof uniqueId`) | ✅ |
| Redirection vers la page locale, puis retour | ✅ |

Le pont clavier : quand un champ de l’iframe prend le focus, la page envoie `kbd-want` au widget ; le widget donne le focus à son champ invisible `#kb` (ce qui fait prendre le clavier à iCUE) et renvoie le texte (`kbd-text`) et les touches spéciales (`kbd-key`) à l’iframe.
