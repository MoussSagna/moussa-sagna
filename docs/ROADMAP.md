# Feuille de route

## Fait

- [x] Projet initialisé (Vite, React, TypeScript, Tailwind).
- [x] Stage Tokyo Underground : profondeur, ciel, écrans, lanternes, métro, brume, sol mouillé, pluie, pétales.
- [x] Carton de titre et travelling d'ouverture.
- [x] Personnage en position neutre, animé à partir d'une seule illustration.
- [x] Marche avant et arrière en pas glissé (premier essai, à juger en mouvement).
- [x] Personnage découpé en 17 calques et animé en direct par un rig (respiration, tête, bras, rubans).

## Ensuite

1. **Structure du portfolio** : écran titre, menu principal, puis les sections (projets, parcours, à propos, contact) en HTML par-dessus ou à côté de la scène. Ajouter **Zustand** à ce moment-là pour l'écran courant.
2. **Transitions entre écrans** : séquences chorégraphiées avec **GSAP**.
3. **Autres animations du personnage** : garde, coups, sauts. Le rig en calques le permet, mais ses zones cachées ne sont prolongées que pour une respiration : il faudra les repeindre à la main, séparer les jambes du calque `lower`, et décrire chaque animation par ses propres courbes plutôt que par le seul cycle de respiration.
4. **Sprites et moteur de combat** : à partir de plusieurs personnages et de nombreuses frames, passer le rendu des sprites sur **PixiJS**. Le décor en shader peut rester tel quel.
5. **Adversaire** : un personnage original.
6. **Mobile** : cadrage adapté, commandes tactiles, effets allégés.
7. **Son** : musique et bruitages avec **Howler.js**, démarrés après une action du visiteur.
8. **Mise en ligne** : build statique (`dist/`), déployable sur Vercel, Netlify ou GitHub Pages.

## Questions ouvertes

- Le contenu réel : projets, parcours, liens de contact.
- Français seul, ou français et anglais ?
- Le portfolio doit-il rester lisible sans jouer (accès direct aux sections) ? Recommandé pour les recruteurs pressés.
