# Consignes pour travailler sur ce dépôt

Portfolio de Moussa Sagna sous forme de jeu de combat 2D (style Guilty Gear Strive). Lire `docs/ARCHITECTURE.md` avant de toucher au rendu.

## Commandes

- `npm run dev` : développement
- `npm run build` : `tsc -b` puis build Vite. Doit passer avant tout commit.
- `npm run lint` : oxlint. Zéro avertissement.

Il n'y a pas encore de tests automatisés.

## Règles du projet

- **Langue** : interface et documentation en français, avec les accents. Noms de code (variables, fichiers, types) en anglais.
- **Séparation jeu / interface** : `src/game/` ne dépend pas de React. React (`src/components/`) crée les canvas, instancie le moteur dans un `useEffect` et le détruit au démontage.
- **Une seule boucle, une seule caméra** : `StageEngine` possède le `requestAnimationFrame` et calcule la caméra ; chaque plan reçoit `FrameInfo` et `Camera`. Ne pas ajouter de seconde boucle.
- **TypeScript** : `erasableSyntaxOnly` est actif, donc pas d'`enum` ni de propriétés déclarées dans les paramètres de constructeur.
- **Dépendances** : n'en ajouter que lorsqu'un écran en a réellement besoin (voir la feuille de route).
- **Couleurs et polices** : uniquement via les jetons `@theme` de `src/index.css`.
- **Accessibilité** : respecter l'option « Réduire les mouvements » (`options.calm`) dans tout nouvel effet, et `prefers-reduced-motion` pour les animations CSS.
- **Assets** : les images vivent dans `public/assets/` et sont chargées avec `asset('dossier/fichier')`. Rien n'est chargé depuis un autre site, sauf les polices Google.

## Vérifier un changement de rendu

Lancer `npm run build && npm run preview`, ouvrir la page et regarder réellement l'écran. Un build qui passe ne prouve pas que le rendu est bon. Dire clairement ce qui a été vérifié à l'œil et ce qui ne l'a pas été.

## Pièges connus

- `src/game/hero/poseData.ts` et les atlas de `public/assets/hero/` sont générés par `tools/prepare_poses.py` à partir des illustrations de `art/`. Ne pas les modifier à la main.
- Les polygones de découpe et les articulations, en haut de `tools/prepare_poses.py`, sont tracés à la main pour les illustrations actuelles : une autre image demande de les retracer.
- Toutes les poses du personnage doivent garder la même vue (trois quarts à profil, tourné vers la droite) et la même taille de tête. Une pose dans une autre vue fait sauter le personnage au changement d'état.
- Les illustrations générées portent parfois un logo de marque sur les baskets : `LOGOS`, dans `tools/prepare_poses.py`, l'efface. À vérifier pour chaque nouvelle image.
- `moussa_rig/` est l'ancien rig de face. Le moteur ne l'utilise plus ; il est gardé comme source pour un éventuel écran de présentation.
- La carte `depth.png` encode plusieurs informations par canal de couleur. Ne pas la recompresser en JPEG ni la redimensionner à la main.
- Les personnages d'autres éditeurs (Ryu, M. Bison…) sont protégés : pour un site public, préférer des adversaires originaux.
