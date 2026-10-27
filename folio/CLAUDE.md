# Consignes pour travailler dans `folio/`

Le folio est le portfolio de Moussa Sagna qui sera mis en ligne : des pages React, et une arène Phaser sur `/entrainement`. Les consignes communes sont dans le `CLAUDE.md` à la racine du dépôt. Lire la seconde moitié de `docs/03-ARCHITECTURE-TECHNIQUE.md` (« Architecture réelle ») avant de toucher à l'arène.

Tous les chemins ci-dessous sont relatifs à `folio/`, et toutes les commandes se lancent depuis `folio/`.

## Commandes

- `npm run dev` : développement.
- `npm run typecheck` : TypeScript strict.
- `npm run test` : Vitest. Les tests couvrent les données (`src/data/`) et la logique pure du jeu (`src/game/**/*.test.ts`).
- `npm run build` : typecheck puis build Vite. Doit passer avant tout commit.

Il n'y a pas de script de lint.

## Règles du projet

- **Séparation React / Phaser** : React gère les pages et la navigation, Phaser uniquement l'arène. `src/components/ArenaCanvas.tsx` est le seul fichier React qui touche à Phaser : il crée le jeu au montage et le détruit au démontage. Ne pas simuler la boucle de jeu en React.
- **Phaser chargé à la demande** : `ArenaCanvas` est importé avec `React.lazy` depuis la page de l'arène. Ne jamais importer `phaser` (sauf `import type`) depuis une autre page ou un composant partagé : le fichier pèse environ 1,2 Mo.
- **Une seule boucle, un seul contexte WebGL** : tout ce qui s'anime dans l'arène passe par `ArenaScene.update`. Pas de `requestAnimationFrame` ni de second canvas à côté de Phaser.
- **De React vers la scène** : l'arène n'a plus de boutons, elle se joue au clavier, lu directement par la scène. Si une commande doit un jour venir de React, la passer par le registre du jeu (`game.registry`), jamais en recréant le moteur.
- **Logique pure à part** : ce qui se calcule sans Phaser (caméra, état du personnage, double appui) vit dans des fichiers sans import de `phaser` et a ses tests.
- **Résolution logique** : 1280 × 720, mode `Scale.FIT`. Les positions dans la scène s'expriment dans cet espace ou en fraction de l'écran.
- **TypeScript** : `verbatimModuleSyntax` (utiliser `import type` pour les types) et `noImplicitOverride` (`override update()` dans une scène). Pas de `any` non justifié.
- **Contenus** : tout le texte du site est dans `src/data/`. `null` ou une liste vide veut dire « à fournir » et s'affiche comme tel ; ne pas inventer de contenu pour combler un vide.
- **Styles** : CSS natif. Couleurs, polices et espacements uniquement via les jetons de `src/styles/main.css`.
- **Accessibilité** : respecter `prefers-reduced-motion`, en CSS comme dans la scène (`calm`). Le contour de focus clavier doit rester visible : les boutons sont inclinés par `transform: skew`, pas découpés par `clip-path`.
- **Assets** : les chemins partagés sont déclarés dans `src/assets.ts` et doivent correspondre à un fichier présent dans `public/`. Rien n'est chargé depuis un autre site ; les polices sont auto-hébergées (`@fontsource`).
- **Dépendances** : n'en ajouter que lorsqu'une page en a réellement besoin.

## Vérifier un changement de rendu

Lancer `npm run build && npm run preview` (ou `npm run dev`), ouvrir la page et regarder réellement l'écran. Dans le navigateur de test sans carte graphique, le jeu est très lent : piloter l'horloge de Playwright (voir « Vérifier à l'écran » dans `../docs/ETAT-DU-PROJET.md`). Pour l'arène, essayer la marche dans les deux sens et un dash. Dire clairement ce qui a été vérifié à l'œil et ce qui ne l'a pas été.

## Pièges connus

- **Textures d'un `Shader` Phaser** : Phaser les repasse par défaut en mode `REPEAT`, que WebGL 1 refuse pour une image dont les côtés ne sont pas des puissances de deux. `STAGE_TEXTURE_DATA` (`src/game/stage/shaders.ts`) force `CLAMP_TO_EDGE` ; sans lui le décor est noir.
- **Mipmaps partagées** : les atlas du personnage servent à la fois aux images et au shader des rubans. `RIBBON_TEXTURE_DATA` (`src/game/hero/shaders.ts`) doit garder le même filtrage que `render.mipmapFilter` dans `src/game/config.ts`, sinon le personnage scintille.
- **Fichiers générés dans le lab** : `src/game/hero/poseData.ts` et les atlas de `public/assets/fighters/moussa/poses/` viennent de `../lab/` (script `../lab/tools/prepare_poses.py`, illustrations de `../art/`). Ne pas les modifier ici : corriger dans le lab, puis reporter. La marche à suivre est dans `README.md`, « Reporter une nouveauté du lab ».
- **`poseRig.ts`** est recopié tel quel du lab. Un réglage d'animation se change dans le lab d'abord.
- **Atlas et mémoire vidéo** : seules la garde et la marche ont leurs propres objets Phaser. Les autres poses partagent quelques images dont la texture change, parce que `HeroAtlases` retire de la carte graphique les atlas les moins récemment utilisés (les garder tous fait perdre le contexte WebGL). Ne jamais créer d'objet Phaser lié durablement à l'atlas d'une autre pose : il pointerait vers une texture retirée.
- **Cinématique d'entrée** : `src/game/cinematic/cinematic.ts` est repris du lab ; un réglage (durées, cadrages, transitions) se change dans le lab d'abord, puis se reporte. Elle se dessine dans une `CanvasTexture` mise à jour à chaque image : ne pas lui ajouter de canvas ni de boucle à côté de Phaser.
- **Nouvelle action** : ses poses doivent être déclarées dans `ACTION_POSES` (`ArenaScene.ts`), sinon l'action peut partir avant que ses images soient arrivées.
- **Touches de l'arène** : `src/game/input.ts` annule l'effet habituel des touches qu'il utilise (les flèches et Espace ne font plus défiler la page), sauf en saisie de texte et sauf Espace sur un bouton qui a le focus. À garder en tête avant d'ajouter une touche.
- **Saut avant et arrière** : le lab penche le corps par un cisaillement ; le folio ne le reprend pas tant que `HeroRig.show` ne sait pas l'afficher.
- **Échelle des poses** : `POSE_SCALE`, dans `src/game/hero/HeroRig.ts`, ramène chaque pose à la taille de tête de la garde. À reporter pour chaque nouvelle pose.
- **Transformations du rig** : `HeroRig.show` suppose des rotations et des mises à l'échelle sans cisaillement, ce qui est vrai des matrices actuelles de `poseRig.ts`. Une transformation avec cisaillement ne s'afficherait pas correctement.
- **Carte `depth.png`** : chaque canal porte une information. Ne pas la recompresser ni la redimensionner.
- **Animation d'entrée de page** : elle ne joue que sur l'opacité de `<main>`. Un `transform` à cet endroit casse les décors en position fixe.
- **`PROMPT-AGENT.md`** est le prompt du premier sprint, terminé. Ses interdictions (pas de React, pas de personnage animé) ne s'appliquent plus.
- **`docs/02-DIRECTION-ARTISTIQUE.md` et `../docs/DIRECTION_ARTISTIQUE.md`** ne donnent pas exactement la même palette. Le site suit aujourd'hui les jetons de `src/styles/main.css` ; l'écart reste à trancher.
- **Adversaire** : Shigaraki, le personnage original du lab (`challenger` dans `src/data/fighters.ts`). Son portrait et son personnage en pied (`public/assets/fighters/challenger/`) sont générés à partir des images du lab (gros plan du plan de coupe, écran de chargement). Dans l'arène, il se tient en garde à sa place et encaisse les coups (`src/game/rival/rivalState.ts`, dessiné par `ArenaScene.drawRival`) ; ses poses (`public/assets/fighters/challenger/poses/`) sont les images du lab (`../lab/public/assets/rival/`) recadrées à 1024 × 1536 et compressées, et `RIVAL_POSES` reprend leurs points d'appui et échelles de `RivalLayer` : à reporter si le lab les change. Son inclinaison quand il est touché est une rotation autour de ses pieds (le lab utilise un cisaillement, que les images Phaser ne savent pas faire). Son nom est aussi celui d'un personnage de *My Hero Academia* : à garder en tête avant la mise en ligne. Ne pas y mettre un personnage d'un autre éditeur : voir le `CLAUDE.md` de la racine.
- **Plein écran** : le bouton dans le coin de l'arène et la touche F (`useFullscreen`, `src/pages/Training.tsx`) mettent `.arena-frame__screen` en plein écran ; Phaser (mode FIT) y garde le 16:9. Le bouton rend le focus après le clic, sinon Espace (parer) le réactiverait. Absent si le navigateur ne sait pas mettre un élément en plein écran (iPhone).
- **Sources des portraits** : `stance.webp`, `portrait.webp` et les expressions de `public/assets/fighters/moussa/` sont découpés dans une planche qui n'est pas dans `../art/` (`references/planche-moussa-transparente.png`, gardée en local). C'est un autre dessin que `../art/hero-source.png`.
- **Logo des baskets** : il n'est pas encore effacé sur la pose intermédiaire (`step.webp`), affichée un bref instant. À corriger dans le lab avant la mise en ligne.
