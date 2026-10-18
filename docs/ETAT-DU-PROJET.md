# État du projet et reprise du travail

Ce fichier sert à reprendre le travail dans une nouvelle conversation sans rien perdre. Il dit où en est le projet, comment Moussa et Claude travaillent ensemble, et ce qui reste à faire. À mettre à jour à chaque fusion dans `main`.

Dernière mise à jour : 18 octobre 2026, après la fusion de `coup-adversaire` dans `main` (adversaire : enchaînement, coup spécial et sa suite, attaque ultime complète ; Moussa propulsé, écrasé au sol et qui se relève).

## Pour reprendre dans une nouvelle conversation

1. Lire, dans l'ordre : `CLAUDE.md` (racine), ce fichier, puis le `CLAUDE.md` du projet concerné (`lab/` ou `folio/`).
2. Avant de toucher au rendu du lab : `lab/docs/ARCHITECTURE.md`. Avant de toucher à l'arène du folio : `folio/docs/03-ARCHITECTURE-TECHNIQUE.md`, « Architecture réelle ».
3. `git log --oneline -15` donne l'historique récent ; chaque commit du lab commence par « Lab : ».
4. Répondre à Moussa **en français**.
5. **Une seule conversation à la fois sur le dépôt.** Le 15 octobre, deux conversations ont travaillé en parallèle (l'une sur `adversaire-deplacements`, l'autre sur `controle-adversaire`) et se sont recouvertes, jusque dans l'aperçu publié. Avant de commencer : `git fetch` et `git branch -r --sort=-committerdate | head` pour voir s'il existe une branche plus récente que `main`, et lire l'aperçu publié avant de le republier.
6. Pour vérifier le lab image par image, le plus fiable est d'importer `StageEngine` dans la page avec Playwright, de neutraliser `requestAnimationFrame` et d'appeler `frame()` à pas fixes (1/60 s) en déclenchant les commandes à des images précises, puis d'assembler les toiles en une planche. Les toiles des combattants peuvent être retournées en miroir par CSS (changement de côté) : il faut alors les retourner aussi en les assemblant.

## Comment on travaille

- **Les illustrations** : Moussa les génère lui-même avec un autre outil, à partir de prompts que Claude rédige (Claude n'a pas d'outil d'image). Il les envoie dans la conversation ; elles sont rangées dans `art/` (`hero-*.png` pour le personnage, `rival-*`, `dummy-*`, `fx-*`, `cinematic-*`).
- **Le lab d'abord** : chaque nouveauté est mise au point dans `lab/`, sur une branche (un nom court en français : `saut-diagonal`, `focus`…), vérifiée sur des images fixes, commitée et poussée. Les branches s'enchaînent tant que Moussa ne demande pas de fusion.
- **Aperçu publié** : après chaque changement visible, le lab est construit et publié sur l'artifact d'aperçu https://claude.ai/artifact/W8qrKocxNz7HmCC1vMh1W7 (build : `npx vite build --base=./ --outDir <dossier temporaire>/marche --emptyOutDir` depuis `lab/`, puis republier en remplaçant le fichier `assets/index-*.js` et en ajoutant les nouveaux assets).
- **Fusion** : quand Moussa dit « merge dans main » : `git fetch`, `git checkout main`, `git merge --ff-only origin/main`, puis `git merge --no-ff <branche>` avec un message en français, build du lab, `git push origin main`.
- **Report dans le folio** : quand Moussa dit « met à jour le folio », sur une branche `report-lab-…` : suivre « Reporter une nouveauté du lab » dans `folio/README.md`, tests et build, vérification à l'écran, puis fusion dans `main` et push. Mettre à jour la ligne « Dernier état repris » du README du folio.
- **Messages de commit** : en français, terminés par les lignes d'attribution demandées par la session (`Co-Authored-By: …`, `Claude-Session: …`).

## Outils de préparation des images (lab)

Tous dans `lab/tools/`, à lancer depuis `lab/` :

| Script | Produit |
| --- | --- |
| `prepare_poses.py` | Atlas des poses du personnage (`public/assets/hero/`) et `src/game/hero/poseData.ts`. Chaque nouvelle pose s'ajoute dans `SINGLE` (point d'appui). Effacement des logos des baskets : `LOGOS`, `FAINT_LOGOS`, `RED_LOGOS`, `GRAY_LOGOS`. |
| `prepare_rival.py`, `prepare_dummy.py` | Atlas de l'adversaire et du mannequin. |
| `prepare_fx.py` | Fumée (`fx/smoke-1..4`) et planche d'effets de la frappe au sol (`fx/ground-special.webp`). |
| `prepare_cinematic.py` | Plans de la cinématique d'entrée et gros plan du plan de coupe (`cinematic/cutin.webp`). |
| `prepare_stage.py`, `prepare_rig.py` | Décor et rig articulé de la garde et de la marche. |

Toute nouvelle pose demande aussi une échelle dans `POSE_SCALE` (`lab/src/game/hero/HeroLayer.ts`), mesurée sur la taille de la tête ou la longueur des baskets par rapport à la garde : sans elle, le personnage change de taille en changeant de dessin.

## Ce que fait le lab aujourd'hui

Touches : flèches ou ZQSD, J attaque, L boule de feu, I attaque spéciale au sol, O K.O., P fin de round, K le mannequin attaque, Échap passe l'intro. Plus de boutons sous la scène. La case « Contrôler l'adversaire » donne les flèches à l'adversaire (← avance, deux appuis rapides vers Moussa le téléportent, dans son dos au corps à corps, → recule (deux appuis rapides : téléportation en arrière), ↓ pare, Entrée frappe) ; Moussa se joue alors avec Q D, S, Z, Espace et les touches d'attaque.

- Stage Tokyo Underground animé (pluie, pétales, néons, reflets).
- Cinématique d'entrée en six plans (Moussa puis l'adversaire), « Face your destiny », « Round 1 », « Fight! ».
- Garde, marche, dashs, accroupi, parade, sauts (sur place, avant, arrière).
- Enchaînement à une touche : léger, moyen, fort (uppercut), coup de pied. L'enchaînement ne continue que si le coup touche ; l'attaque spéciale annule la récupération.
- Boule de feu (shader).
- Attaque spéciale au sol : mise au point figée avec zoom, ruée, rafale de dix coups au hasard, trois coups lourds qui font trembler l'écran, plan de coupe, charge, frappe de la paume, gros impact.
- Mannequin et adversaire original : impacts, arrêt sur image, étincelles, secousse ; l'adversaire encaisse et peut parer.
- Adversaire (nouveau modèle aux proportions de Moussa) : il se déplace en lévitation au ras du sol (un dessin par sens, une pose de passage, sans fondu), garde seul ses distances, ou se joue aux flèches. Dash avant et arrière en téléportation, à la manière de Doom ; au corps à corps, la téléportation le fait passer dans le dos de Moussa et les combattants changent de côté en restant face à face (affichage retourné en miroir, commandes dans le sens de l'écran).
- Coups de l'adversaire (case « Contrôler l'adversaire » : Entrée enchaîne, Maj coup spécial ; touches globales K attaque, M coup spécial, N attaque ultime) :
  - enchaînement de cinq coups, qui n'avance que si le coup touche, annulable à tout moment par le coup spécial ;
  - coup spécial (coup de pied avec traînée d'énergie, explosion et secousse), et sa suite en coup de poing si l'on rappuie quand il touche ;
  - attaque ultime : mise au point sur lui pendant qu'il charge, téléportation devant Moussa, uppercut en deux coups (Moussa soulevé puis propulsé hors de l'écran), charge et envol à toute vitesse (traînée de super vitesse, impact au sol, forte secousse), Moussa retombe et rebondit, l'adversaire retombe sur lui d'un coup de poing, plan de coupe sur son gros plan (bande violette), coup de marteau à deux mains avec une immense colonne d'énergie au premier plan et une secousse verticale, puis bond en arrière pendant que Moussa se relève et reprend sa garde.
- Coups reçus et parés par Moussa (sans recul).
- Fin de round (il se baisse et disparaît dans la fumée) et K.O. (quatre dessins, « K.O. », round suivant).

## Ce que le folio a repris

État au commit `8456faf` du lab : cinématique d'entrée, garde, marche, dashs, accroupi, parade, sauts sur place, avant et arrière (sans l'inclinaison du corps, que `HeroRig.show` ne sait pas afficher), enchaînement léger, moyen, fort, coup de pied.

Pas encore repris (demande du travail de rendu dans Phaser) : boule de feu, attaque spéciale au sol et ses effets, effet de vitesse des dashs, mannequin, impacts, adversaire en combat (avec sa lévitation, ses téléportations et le changement de côté), coups reçus, fin de round, K.O.

Les fusions du 16 et du 18 octobre ne touchent que l'adversaire, absent de l'arène du folio : il n'y avait rien à reprendre pour Moussa (`HeroLayer.mirror` sert au changement de côté ; les nouvelles poses de Moussa, propulsé, écrasé au sol et relevé, ne servent qu'à l'attaque ultime de l'adversaire). Le folio garde ses boutons sous l'arène : le lab les a retirés, mais sur le site ils servent au tactile.

## Limites connues et prochaines pistes

- **Adversaire** : son coup encaissé est encore dessiné sur l'ancien modèle (il détonne à côté de la nouvelle garde). Il ne se téléporte et n'attaque seul que si un joueur le contrôle (ou avec les touches K, M, N). Son attaque ultime ne retire pas encore de vie : il n'y a pas de barres de vie. En reculant par téléportation, les traits de vitesse du dessin partent dans le sens du déplacement (il faudrait un dessin dédié).
- **Changement de côté** : seul l'adversaire peut passer dans le dos de Moussa ; Moussa se retourne d'un coup, sans animation de demi-tour.
- **Prochaine grosse étape possible** : faire entrer l'adversaire dans l'arène du folio (affichage, lévitation, téléportations, changement de côté), puis les coups qui touchent.
- **K.O.** : pas d'animation pour se relever ; il réapparaît en garde.
- **Rafale de l'attaque spéciale** : le corps saute un peu d'un coup à l'autre, les dessins n'ont pas le même point d'appui.
- **Logos des baskets** : effacés sur les nouvelles poses, mais quelques zones floues restent visibles de près ; pas encore effacé sur `hero-step.png`. À revoir avant la mise en ligne.
- **Folio** : reporter le reste du lab, poser la structure du portfolio (menu, sections), le son, le mobile, la mise en ligne. Voir `lab/docs/ROADMAP.md` et `folio/docs/04-ROADMAP-ET-PERIMETRE.md`.

## Vérifier à l'écran

- Lab : `npx vite --port 5201` depuis `lab/` ; folio : `npx vite --port 5202 --strictPort` depuis `folio/`. Les captures se font avec Playwright et Chromium (`/opt/pw-browsers`), avec `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- Dans ce navigateur sans carte graphique, le jeu tourne à environ 4 images par seconde et une capture d'écran prend plus d'une seconde : un coup entier peut se jouer entre deux captures. Pour figer le temps, installer l'horloge de Playwright avant d'ouvrir la page (`await page.clock.install()`), puis la faire avancer par petits pas (`await page.clock.runFor(100)`) entre les appuis et les captures. L'intro, même passée avec Échap, demande alors environ 45 s d'horloge avant « Fight! ».
- Toujours dire à Moussa ce qui a été vu à l'œil et ce qui ne l'a pas été (les mouvements eux-mêmes ne se jugent qu'en jouant).
