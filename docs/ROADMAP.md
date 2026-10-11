# Feuille de route

## Fait

- [x] Projet initialisé (Vite, React, TypeScript, Tailwind).
- [x] Stage Tokyo Underground : profondeur, ciel, écrans, lanternes, métro, brume, sol mouillé, pluie, pétales.
- [x] Carton de titre et travelling d'ouverture.
- [x] Personnage en position neutre, animé à partir d'une seule illustration.
- [x] Garde, pose intermédiaire et marche dans la même vue, à partir de trois illustrations découpées en calques (à juger en mouvement).
- [x] Dash avant et dash arrière au double appui, avec images fantômes (à juger en mouvement).
- [ ] Illustration du milieu du pas (jambes qui se croisent) pour assouplir la marche.
- [ ] Pose de transition dessinée (trois quarts) entre la face et le profil.
- [x] Ancien rig de face en 17 calques (`moussa_rig/`), remplacé dans le stage par les poses de trois quarts.

## Ensuite

1. **Structure du portfolio** : écran titre, menu principal, puis les sections (projets, parcours, à propos, contact) en HTML par-dessus ou à côté de la scène. Ajouter **Zustand** à ce moment-là pour l'écran courant.
2. **Transitions entre écrans** : séquences chorégraphiées avec **GSAP**.
3. **Autres animations du personnage** : accroupi, saut, coups, touché, et une pose d'élan et de réception pour les dashs. Une illustration par état, toujours dans la même vue, découpée par `tools/prepare_poses.py`.
4. **Sprites et moteur de combat** : à partir de plusieurs personnages et de nombreuses frames, passer le rendu des sprites sur **PixiJS**. Le décor en shader peut rester tel quel.
5. **Adversaire** : un personnage original.
6. **Mobile** : cadrage adapté, commandes tactiles, effets allégés.
7. **Son** : musique et bruitages avec **Howler.js**, démarrés après une action du visiteur.
8. **Mise en ligne** : build statique (`dist/`), déployable sur Vercel, Netlify ou GitHub Pages.

## Questions ouvertes

- Le contenu réel : projets, parcours, liens de contact.
- Français seul, ou français et anglais ?
- Le portfolio doit-il rester lisible sans jouer (accès direct aux sections) ? Recommandé pour les recruteurs pressés.
