# Dot Audio

**Statut :** 🔵 spécifié

Volume général, mixeur par application, coupure de tous les micros, changement de périphérique, lecture en cours et égaliseur.

## Contenu et interactions

- Sortie : volume en grands chiffres dot, barre de points, bouton mute, sélecteur de périphérique.
- Micro : bouton rond avec anneau de niveau en direct ; un tap coupe tous les micros (pas seulement celui par défaut), état MUTED en rouge.
- Mixeur : un fader en points par application (initiale, valeur, nom, bouton mute).
- Lecture en cours : pochette en trame de points, titre, artiste, précédent / lecture / suivant.
- Sélecteur de périphérique en panneau superposé (sortie et micro).
- Égaliseur.
- Thèmes de couleur (rouge, orange, bleu, crème).

## Données

- Lecture en cours : plugin iCUE Media.
- Volume, mixeur, micros, périphériques : compagnon (API audio Windows). Suivre les changements faits dans Windows en direct.
- Compatible Discord, Sonar, Wave Link, Voicemeeter.
- Égaliseur : Windows n’en a pas de global, s’appuyer sur un outil comme Equalizer APO via le compagnon.

## Tailles

- [ ] S · M · L · XL (voir `mockups/06-layouts.png`)

## Mocks

- [`01-overview.png`](mockups/01-overview.png)
- [`02-personalisation.png`](mockups/02-personalisation.png)
- [`03-mixer.png`](mockups/03-mixer.png)
- [`04-mic-mute.png`](mockups/04-mic-mute.png)
- [`05-device-switching.png`](mockups/05-device-switching.png)
- [`06-layouts.png`](mockups/06-layouts.png)
