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

- Les constantes `SPRITE` de `src/game/hero/HeroLayer.ts` décrivent l'illustration actuelle. Si elle change, relancer `tools/prepare_hero.py` et reporter les valeurs qu'il affiche.
- `src/game/hero/rigData.ts` et `public/assets/hero/rig-atlas.webp` sont générés par `tools/pack_rig.py` à partir de `moussa_rig/rig.json`. Ne pas les modifier à la main.
- `AMPLITUDE` (dans `HeroLayer.ts`) ne doit pas dépasser 1 : au-delà, les calques du rig sortent de leurs zones de recouvrement et des trous apparaissent. Voir `moussa_rig/README.md`.
- Ne pas retoucher `moussa_rig/00_maitre/` ni `moussa_rig/02_calques/` à la main : ils sont produits par `tools/prepare_rig.py`.
- `rigMatrices` (`src/game/hero/rig.ts`) est le portage de `matrices()` de `tools/rig/simulate.py`. Si l'un change, l'autre doit suivre.
- La carte `depth.png` encode plusieurs informations par canal de couleur. Ne pas la recompresser en JPEG ni la redimensionner à la main.
- La marche utilise un second rig, de profil (`art/hero-walk-source.png`). Ses polygones de découpe et ses articulations, dans `tools/prepare_walk.py`, sont tracés à la main pour cette illustration : une autre image demande de les retracer.
- Les personnages d'autres éditeurs (Ryu, M. Bison…) sont protégés : pour un site public, préférer des adversaires originaux.
