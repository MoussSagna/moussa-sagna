# Feuille de route

## Fait

- [x] Projet initialisé (Vite, React, TypeScript, Tailwind).
- [x] Stage Tokyo Underground : profondeur, ciel, écrans, lanternes, métro, brume, sol mouillé, pluie, pétales.
- [x] Carton de titre et travelling d'ouverture.
- [x] Personnage en position neutre, animé à partir d'une seule illustration.

## Ensuite

1. **Structure du portfolio** : écran titre, menu principal, puis les sections (projets, parcours, à propos, contact) en HTML par-dessus ou à côté de la scène. Ajouter **Zustand** à ce moment-là pour l'écran courant.
2. **Transitions entre écrans** : séquences chorégraphiées avec **GSAP**.
3. **Autres animations du personnage** : marche, garde, coups. La déformation d'une image ne suffit plus ; il faut soit des frames dessinées et cohérentes, soit un squelette (Spine, Live2D). À décider selon les illustrations disponibles.
4. **Sprites et moteur de combat** : à partir de plusieurs personnages et de nombreuses frames, passer le rendu des sprites sur **PixiJS**. Le décor en shader peut rester tel quel.
5. **Adversaire** : un personnage original.
6. **Mobile** : cadrage adapté, commandes tactiles, effets allégés.
7. **Son** : musique et bruitages avec **Howler.js**, démarrés après une action du visiteur.
8. **Mise en ligne** : build statique (`dist/`), déployable sur Vercel, Netlify ou GitHub Pages.

## Questions ouvertes

- Le contenu réel : projets, parcours, liens de contact.
- Français seul, ou français et anglais ?
- Le portfolio doit-il rester lisible sans jouer (accès direct aux sections) ? Recommandé pour les recruteurs pressés.
