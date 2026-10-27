# Consignes pour travailler dans `folio/`

Le folio est le portfolio de Moussa Sagna qui sera mis en ligne : des pages React, et l'arène sur `/entrainement`, qui affiche le jeu de `../game/` (le même que le lab, sans report). Les consignes communes sont dans le `CLAUDE.md` à la racine du dépôt, et celles du jeu dans `../game/README.md` et `../lab/CLAUDE.md`. Lire la seconde moitié de `docs/03-ARCHITECTURE-TECHNIQUE.md` (« Architecture réelle ») avant de toucher à l'arène.

Tous les chemins ci-dessous sont relatifs à `folio/`, et toutes les commandes se lancent depuis `folio/`.

## Commandes

- `npm run dev` : développement (sert aussi les images de `../game/public/`).
- `npm run typecheck` : TypeScript strict, sur le site et sur `../game/src`.
- `npm run test` : Vitest. Les tests couvrent les données (`src/data/`) et la logique pure du jeu (`../game/src/**/*.test.ts`).
- `npm run build` : typecheck puis build Vite ; les images du jeu sont recopiées dans `dist/`. Doit passer avant tout commit.

Il n'y a pas de script de lint.

## Règles du projet

- **Le jeu vient de `../game/`** : moteur, personnages, coups, interface de combat, cinématique et leurs images. Ne pas les réécrire ni les copier ici : un changement de jeu se fait dans `../game/`, mis au point dans le lab, et arrive tel quel dans l'arène. Il s'importe par l'alias `@game` (`vite.config.ts`, `tsconfig.json`).
- **Séparation React / jeu** : React gère les pages et la navigation, le jeu uniquement l'arène. `src/components/GameArena.tsx` est le seul fichier qui crée le moteur (`StageEngine`) : il crée ses canvas, le lance au montage et le détruit au démontage. Ne pas simuler la boucle de jeu en React.
- **Jeu chargé à la demande** : `GameArena` est importé avec `React.lazy` depuis la page de l'arène. Ne pas importer le moteur (`@game/stage/…`, les personnages) depuis une autre page ou un composant partagé ; seuls les petits modules sans rendu (`@game/controls`, `@game/gl` pour `asset`) peuvent servir ailleurs.
- **Une seule boucle** : le moteur possède son `requestAnimationFrame`. Rien d'autre ne s'anime dans l'arène.
- **Clavier** : branché par `bindPlayerKeys` (`../game/src/controls.ts`), seulement les touches d'un combat. Il n'écoute qu'une fois la partie lancée (après l'écran de chargement). Les touches d'essai du lab (O, P, K, M, N, mannequin, contrôle de l'adversaire) n'ont pas leur place sur le site.
- **Logique pure à part** : ce qui se calcule sans rendu vit dans des fichiers sans dépendance au DOM ni au WebGL et a ses tests.
- **TypeScript** : `strict`, `verbatimModuleSyntax` (utiliser `import type` pour les types) et `noImplicitOverride`. Pas de `any` non justifié. Le code de `../game/src` est vérifié avec ces mêmes règles.
- **Contenus** : tout le texte du site est dans `src/data/` (celui de l'arène dans `src/data/arena.ts`) ; le jeu écrit ses propres textes (cinématique, barres, annonces). `null` ou une liste vide veut dire « à fournir » et s'affiche comme tel ; ne pas inventer de contenu pour combler un vide.
- **Styles** : CSS natif. Couleurs, polices et espacements uniquement via les jetons de `src/styles/main.css` (la palette du jeu y a ses jetons `--game-*`).
- **Accessibilité** : respecter `prefers-reduced-motion`, en CSS comme dans le jeu (`options.calm`, que `GameArena` règle d'après le système). Le contour de focus clavier doit rester visible : les boutons sont inclinés par `transform: skew`, pas découpés par `clip-path`.
- **Assets** : les chemins du site sont déclarés dans `src/assets.ts` et doivent correspondre à un fichier présent dans `public/`. Les images du jeu sont dans `../game/public/assets/` et chargées par `asset()` (`@game/gl`). Rien n'est chargé depuis un autre site ; les polices sont auto-hébergées (`@fontsource`, y compris Barlow Semi Condensed pour le jeu).
- **Dépendances** : n'en ajouter que lorsqu'une page en a réellement besoin.

## Vérifier un changement de rendu

Lancer `npm run dev` (ou `npm run build && npm run preview`), ouvrir la page et regarder réellement l'écran. Pour l'arène, attendre la fin de l'écran de chargement, passer l'intro (Échap), puis essayer la marche, un dash et un enchaînement. Dans le navigateur de test sans carte graphique, le jeu est très lent : voir « Vérifier à l'écran » dans `../docs/ETAT-DU-PROJET.md` ; le plus fiable pour juger une animation reste le lab, image par image. Dire clairement ce qui a été vérifié à l'œil et ce qui ne l'a pas été.

## Pièges connus

- **Images du jeu** : `vite.config.ts` ajoute `../game/public/` comme second dossier public (extension `gamePublic`) : servi en développement, recopié dans `dist/` au build. Ses chemins (`assets/hero/…`, `assets/rival/…`, `assets/loading/…`) ne doivent pas croiser ceux de `public/assets/` (`backgrounds/`, `fighters/`).
- **Poids** : les images du jeu pèsent environ 114 Mo et sont toutes chargées avant le combat (jauge de l'écran de chargement). À compresser avant la mise en ligne.
- **Tests du jeu** : ils vivent dans `../game/src` mais se lancent d'ici. `tsconfig.json` les exclut de la vérification de types (le paquet `vitest` n'est pas visible depuis `../game/`).
- **Plein écran** : le bouton dans le coin de l'arène et la touche F (`useFullscreen`, `src/pages/Training.tsx`) mettent `.arena-frame__screen` en plein écran ; le jeu y garde son 16:9, centré. Le bouton rend le focus après le clic, sinon Espace (parer) le réactiverait. Absent si le navigateur ne sait pas mettre un élément en plein écran (iPhone).
- **Tactile** : l'arène n'a pas de commandes au doigt ; elle se joue au clavier.
- **Animation d'entrée de page** : elle ne joue que sur l'opacité de `<main>`. Un `transform` à cet endroit casse les décors en position fixe.
- **`PROMPT-AGENT.md`** est le prompt du premier sprint, terminé. Ses interdictions (pas de React, pas de personnage animé) ne s'appliquent plus.
- **`docs/02-DIRECTION-ARTISTIQUE.md` et `../docs/DIRECTION_ARTISTIQUE.md`** ne donnent pas exactement la même palette. Le site suit aujourd'hui les jetons de `src/styles/main.css` ; l'écart reste à trancher.
- **Adversaire** : Shigaraki, le personnage original du lab (`challenger` dans `src/data/fighters.ts`). Son portrait et son personnage en pied (`public/assets/fighters/challenger/`) sont générés à partir des images du jeu (gros plan du plan de coupe, écran de chargement). Son nom est aussi celui d'un personnage de *My Hero Academia* : à garder en tête avant la mise en ligne. Ne pas y mettre un personnage d'un autre éditeur : voir le `CLAUDE.md` de la racine.
- **Sources des portraits** : `stance.webp`, `portrait.webp` et les expressions de `public/assets/fighters/moussa/` sont découpés dans une planche qui n'est pas dans `../art/` (`references/planche-moussa-transparente.png`, gardée en local). C'est un autre dessin que `../art/hero-source.png`.
- **Logo des baskets** : il n'est pas encore effacé sur la pose intermédiaire du jeu (`step`), affichée un bref instant. À corriger dans le lab avant la mise en ligne.
