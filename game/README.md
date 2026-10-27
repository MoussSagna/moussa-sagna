# Le jeu

Le combat de Tokyo Underground, écrit une seule fois et partagé par les deux projets du dépôt :

- `../lab/` le met au point (banc d'essai : touches et options d'essai, mannequin, contrôle de l'adversaire) ;
- `../folio/` l'affiche dans l'arène du site (`folio/src/components/GameArena.tsx`).

## Contenu

| Dossier | Rôle |
| --- | --- |
| `src/` | Le moteur, en TypeScript et WebGL, sans React ni dépendance : `stage/StageEngine.ts` (boucle, caméra, coups), les personnages (`hero/`, `rival/`, `dummy/`), l'interface de combat (`hud/`), la cinématique (`cinematic/`), le clavier du joueur (`controls.ts`). |
| `public/assets/` | Ses images (atlas, poses, effets, plans de la cinématique, décor), servies à la racine du site sous `assets/`. Générées par les outils de `../lab/tools/` à partir de `../art/` : ne pas les modifier à la main. |

`game/` n'a pas de `package.json`. Les deux projets l'importent par l'alias `@game` (`vite.config.ts` et `tsconfig`)
et servent ses images : le lab en fait son dossier public, le folio les ajoute à son dossier public (extension
`gamePublic` de son `vite.config.ts`, qui les sert en développement et les recopie au build).

## Vérifier un changement

- Depuis `../lab/` : `npm run build` (vérifie aussi `game/src`), `npm run lint` (aussi sur `game/src`), puis
  regarder le lab à l'écran.
- Depuis `../folio/` : `npm run test` (lance aussi les tests de `game/src`, comme `controls.test.ts`), `npm run build`,
  puis regarder l'arène du site.

Les règles du moteur (une seule boucle, séparation jeu / interface, `options.calm`, assets chargés par `asset()`)
sont dans `../lab/CLAUDE.md`, et son fonctionnement dans `../lab/docs/ARCHITECTURE.md`.
