# Dot Audio

**Statut :** 🔵 en conception

Volume général, coupure de tous les micros, mixeur par application, égaliseur, changement de périphérique et lecture en cours. Module de Dot Hub, servi par Dot Companion.

La référence visuelle est [`mockups/reference.html`](mockups/reference.html) (à ouvrir dans un navigateur) : maquette en taille réelle S, M, L, XL, réglages simulés et tableau des choix de design, tous encore à valider.

## Contenu et interactions

- Sortie : volume en gros chiffres dot (le % en accent), barre de points réglable en glissant, bouton mute ; nom du périphérique au-dessus, un toucher ouvre le choix des périphériques.
- Micro : bouton rond avec anneau de niveau en direct ; un tap coupe tous les micros (pas seulement celui par défaut), état ALL MICS MUTED en rouge.
- Mixeur : un fader en points par application (valeur, niveau en direct, nom, bouton mute), réglable en glissant.
- Égaliseur : 10 bandes de 31 Hz à 16 kHz, −12 à +12 dB, préréglages.
- Lecture en cours (XL) : pochette en trame de points, titre, artiste, précédent / lecture / suivant.
- Choix des périphériques : panneau par-dessus le module, sorties et micros.
- Couleurs communes de Dot Companion à la place des thèmes (rouge, orange, bleu, crème).

## Données

- Volume, mixeur, niveaux, micros, périphériques : compagnon (API audio Windows : `IAudioEndpointVolume`, `IAudioSessionManager2`, `IAudioMeterInformation`). Suivre les changements faits dans Windows en direct.
- Lecture en cours : plugin iCUE Media, relayé par la coquille de Dot Hub.
- Compatible Discord, Sonar, Wave Link, Voicemeeter (vus comme des applications du mixeur).
- Égaliseur : Windows n’en a pas de global ; le compagnon écrit un filtre `GraphicEQ` dans la configuration d’Equalizer APO (à installer à part).

## Tailles (proposition)

- [ ] XL (2536 × 696) : sortie et micro à gauche, mixeur ou égaliseur au centre, lecture en cours à droite
- [ ] L (1688 × 696) : sortie et micro, mixeur ou égaliseur
- [ ] M (840 × 696) : sortie, mute et micro en haut, mixeur court en bas
- [ ] S (840 × 344) : volume, barre, mute et micro, sans libellés

## Mocks

- [`reference.html`](mockups/reference.html) : maquette de référence (proposition v0.1)
- Références de fonctions du cahier des charges : [`01-overview.png`](mockups/01-overview.png), [`02-personalisation.png`](mockups/02-personalisation.png), [`03-mixer.png`](mockups/03-mixer.png), [`04-mic-mute.png`](mockups/04-mic-mute.png), [`05-device-switching.png`](mockups/05-device-switching.png), [`06-layouts.png`](mockups/06-layouts.png)
