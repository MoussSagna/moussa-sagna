# Architecture

## Vue d'ensemble

L'écran du stage empile trois canvas dans un même conteneur, pilotés par une seule boucle.

| Ordre | Plan | Fichier | Technique |
| --- | --- | --- | --- |
| 1 (fond) | Décor | `src/game/stage/StageBackdrop.ts` | WebGL, un shader plein écran |
| 2 | Personnage | `src/game/hero/HeroLayer.ts` | WebGL, un quad par calque de la pose, plus le reflet et l'ombre |
| 3 (devant) | Météo | `src/game/stage/WeatherLayer.ts` | Canvas 2D |

Par-dessus, React affiche le carton de titre et l'étiquette du stage en HTML (`src/components/StageScreen.tsx`).

## La boucle

`StageEngine` (`src/game/stage/StageEngine.ts`) :

1. redimensionne les canvas à la taille du conteneur (densité de pixels plafonnée à 2) ;
2. calcule le temps écoulé et la caméra ;
3. appelle `draw` sur chaque plan, du fond vers l'avant.

La caméra (`Camera` dans `src/game/types.ts`) combine trois mouvements : le travelling d'ouverture (zoom arrière sur 3,6 s), une respiration lente, et la position de la souris. Avec « Réduire les mouvements », seule la souris reste.

## Le décor

Une seule image (`stage.webp`) et une carte (`depth.png`) dont chaque canal porte une information :

- **rouge** : profondeur (0 = loin, 1 = proche). Le shader décale chaque pixel selon sa profondeur, ce qui crée la parallaxe.
- **vert** : le ciel. Les nuages, le halo de la lune et les éclairs n'apparaissent que là.
- **bleu** : les écrans géants. La valeur sert d'identifiant pour désynchroniser leurs animations.

Les lanternes, les néons et le trajet du métro sont positionnés par leurs coordonnées dans l'image, directement dans `src/game/stage/shaders.ts`.

## Le personnage

Le personnage est fait de seize illustrations dans la même vue (trois quarts à profil, tourné vers la droite), découpées en calques et animées en direct : il n'y a ni planche de frames ni animation pré-rendue.

| Pose | Illustration | Rôle |
| --- | --- | --- |
| `guard` | `../art/hero-guard.png` | état neutre : garde, poings levés |
| `step` | `../art/hero-step.png` | pose intermédiaire, affichée un instant entre la garde et la marche |
| `walk` | `../art/hero-walk.png` | marche, jambes et bras articulés |
| `dashForward` | `../art/hero-dash-forward.png` | dash avant, un seul calque |
| `dashBack` | `../art/hero-dash-back.png` | dash arrière, un seul calque |
| `crouchStep` | `../art/hero-crouch-step.png` | mi-descente, affichée un instant entre la garde et l'accroupi |
| `crouch` | `../art/hero-crouch.png` | accroupi, un seul calque |
| `blockStep` | `../art/hero-block-step.png` | passage, affiché un instant entre la garde et la parade debout |
| `block` | `../art/hero-block.png` | parade debout, un seul calque |
| `crouchBlock` | `../art/hero-crouch-block.png` | parade accroupie, un seul calque |
| `jumpStart` | `../art/hero-jump-start.png` | saut : impulsion, au sol |
| `jumpRise` | `../art/hero-jump-rise.png` | saut : montée, corps en extension |
| `jumpPeak` | `../art/hero-jump-peak.png` | saut : sommet et descente, corps regroupé |
| `jumpLand` | `../art/hero-jump-land.png` | saut : réception, au sol |
| `punchStart` | `../art/hero-punch-start.png` | coup de poing léger : bras à mi-course, au démarrage et au retour |
| `punchHit` | `../art/hero-punch-hit.png` | coup de poing léger : bras tendu |

- **Données** : `tools/prepare_poses.py` retire le fond vert, efface les logos des baskets, découpe chaque illustration, range ses calques dans un atlas par pose et génère `src/game/hero/poseData.ts` (calques, articulations, point d'appui).
- **Dessin** : `HeroLayer` dessine un quad par calque, du fond vers le premier plan. Le vertex shader applique la matrice du calque ; le fragment shader retrouve le pixel d'origine dans la toile (1024 × 1536) et y ajoute l'ondulation des rubans, nulle à la racine et maximale à la pointe.
- **Alignement** : chaque pose a un point d'appui (milieu des pieds, ligne des semelles). Toutes sont posées au même endroit du sol, placé par `PLACEMENT`, et suivent la caméra du décor avec la profondeur du sol. `POSE_SCALE` agrandit autour de ce point les poses dessinées plus petit que la garde, pour que la tête garde la même taille.
- **Reflet et ombre** : le personnage entier est d'abord dessiné une fois dans une texture hors écran, qui sert au reflet.

### La garde

`guardMatrices` (`src/game/hero/poseRig.ts`) : le corps se tasse légèrement vers la ligne du sol (les semelles ne bougent pas), le buste respire en s'agrandissant autour de la taille, la tête et les rubans suivent avec un retard. La tête est un calque dessiné une seconde fois par-dessus le buste, ce qui lui permet de bouger sans laisser de trou. `GUARD` règle les durées et les amplitudes ; « Réduire les mouvements » les ramène à 35 %.

### La marche

`walkMatrices` calcule la pose pour une phase du cycle. Chaque cheville suit une trajectoire par rapport à la hanche : elle recule au sol à vitesse constante, puis revient en l'air. La cuisse et le tibia sont placés par cinématique inverse (deux os, genou vers l'avant). Le pied a son propre angle : talon qui se pose, pied à plat, talon qui se lève. Le bassin monte quand une jambe passe à la verticale, le buste se penche un peu et les bras balancent à l'opposé des jambes.

Le corps avance à `WALK_SPEED`, la vitesse exacte du pied posé, pour que les appuis ne patinent pas. Jouer le cycle à l'envers donne la marche arrière. `GAIT` règle la durée du cycle, la foulée, la levée des pieds et le balancement des bras.

### Les dashs

`HeroLayer.dash(direction)` affiche la pose de dash et déplace le personnage d'une distance fixe, vite au départ puis en freinant (`DASH` règle la distance et la durée de chaque sens). Pendant le déplacement, deux images fantômes de plus en plus transparentes sont dessinées à ses positions précédentes ; « Réduire les mouvements » les supprime. La pose de dash n'a qu'un calque, ce qui permet de la dessiner en transparence sans que des recouvrements apparaissent. À la fin, le personnage revient en garde. Un dash ne peut pas être relancé avant la fin du précédent.

`App.tsx` déclenche un dash quand la même direction est pressée deux fois en moins de `DOUBLE_TAP_MS`, au clavier ou sur les boutons.

### L'accroupi

Tant que `StageEngine.crouch` est vrai, le personnage passe de la garde à la pose `crouchStep` pendant `CROUCH_STEP_SECONDS`, puis reste en `crouch` ; il fait le chemin inverse quand on relâche. Accroupi, il ne marche pas et ne dashe pas. S'il marchait, il repasse d'abord par la garde. La pose `crouch` respire : `crouchMatrix` tasse à peine tout le dessin vers le sol, semelles fixes.

`App.tsx` maintient l'accroupi avec la flèche bas, S ou le bouton « S'accroupir ».

### La parade

Tant que `StageEngine.block` est vrai, le personnage pare. Debout, il passe par la pose `blockStep` pendant `BLOCK_STEP_SECONDS` avant de tenir `block`, et fait le chemin inverse au relâchement. Accroupi, il passe directement de `crouch` à `crouchBlock` et retour, sans pose de passage : les deux dessins sont très proches. En parade, il ne marche pas et ne dashe pas. Les poses tenues (`crouch`, `block`, `crouchBlock`) respirent d'un bloc grâce à `heldMatrix`.

Il n'y a pas encore d'adversaire : la parade se déclenche à la main, avec Espace ou le bouton « Parer ». Elle devra plus tard se prendre en reculant au moment d'un coup.

### Le saut

`HeroLayer.jump()` lance un saut vertical sur place, depuis la garde ou la marche. Il enchaîne quatre dessins, un par phase (`JUMP` règle les durées et la hauteur) : l'impulsion au sol, la montée, le corps regroupé à partir de `JUMP.tuck` du vol et jusqu'à la retombée, puis la réception au sol avant le retour en garde. Ce sont des changements de pose francs, à des moments où la silhouette change vraiment, et non une alternance de dessins proches.

La hauteur est calculée par le moteur : une montée (`JUMP.rise`) puis une retombée plus courte (`JUMP.fall`), deux demi-paraboles qui se rejoignent au sommet. Le dessin regroupé couvre presque tout le vol (la montée en extension ne dure que le tout début) et il est déformé en continu autour des pieds : tassé pendant l'impulsion, étiré à pleine vitesse, à sa forme au sommet, écrasé à la réception. C'est cette déformation, et non le changement de dessin, qui donne le mouvement ; « Réduire les mouvements » l'atténue. Pendant le vol, l'ombre rétrécit et le reflet s'éloigne des pieds en s'estompant. Le saut ne peut pas être dirigé ni interrompu.

`App.tsx` le déclenche avec la flèche haut, Z (W sur un clavier QWERTY) ou le bouton « Sauter ».

### Le coup de poing léger

`HeroLayer.punch()` lance un jab debout, depuis la garde ou la marche. Son minutage (`PUNCH`) reprend celui d'un jab de jeu de combat à 60 images par seconde : 4 images de démarrage, 3 actives, 7 de récupération, soit moins d'un quart de seconde. Le dessin `punchStart` sert au démarrage et à la récupération, `punchHit` pendant les images actives. Le coup ne peut pas être interrompu ni enchaîné avant la fin.

Les deux dessins sont calés sur la boucle de ceinture de la garde, pas sur les pieds : le buste reste en place, et les pieds s'écartent le temps du coup, parce que les illustrations ont une garde plus large.

Il n'y a pas encore d'adversaire, donc pas de zone de frappe : `PUNCH.reach` note seulement la portée du poing pour plus tard. `App.tsx` déclenche le coup avec J ou le bouton « Poing ».

### Les changements d'état

`HeroLayer.update` ne saute jamais directement de la garde à la marche : il affiche la pose `step` pendant `STEP_SECONDS`, puis la pose d'arrivée. Ce sont des coupes franches entre trois dessins proches, comme dans une animation dessinée, sans fondu. `StageEngine.walk` reçoit la direction (1, -1 ou 0) ; `App.tsx` la pilote au clavier et avec deux boutons à maintenir.

### Limites

- Les membres de la marche sont des pièces rigides qui tournent : les plis du pantalon ne se redessinent pas et le genou marque un angle quand il plie.
- Les parties cachées (haut de la cuisse éloignée, buste sous le bras) sont des aplats sans détail.
- La marche n'utilise volontairement qu'un seul dessin. Un essai à trois dessins clés (branche `marche-poses`) a été abandonné : d'une illustration générée à l'autre, les plis, les rubans et les proportions changent, et chaque bascule se voyait comme une saccade.
- En garde, les jambes et les bras ne sont pas articulés.
- L'accroupi est un dessin entier qui respire d'un bloc : ni les bras, ni la tête, ni les rubans ne bougent séparément.
- Chaque pose a son atlas, mais un seul est lié à la fois (celui de la pose affichée) : le nombre de poses ne dépend plus des unités de texture du navigateur. En contrepartie, tous les atlas sont chargés au démarrage, soit environ 14 Mo d'images à télécharger.
- Le saut est fait de dessins fixes : rien ne bouge dans le dessin pendant le vol, rubans compris.
- Les dashs sont une pose fixe qui glisse : rien ne bouge dans le dessin pendant le déplacement. Le premier des deux appuis lance brièvement la pose intermédiaire de la marche avant que le dash parte.

## Ajouter un plan

1. Créer une classe avec `load(): Promise<boolean>` et `draw(frame, camera, …)`.
2. Lui donner son canvas dans `StageScreen.tsx` et l'ajouter à `StageCanvases`.
3. L'instancier dans `StageEngine` et l'appeler dans `frame`, à sa place dans l'ordre de profondeur.
4. Pour qu'il suive la caméra, convertir une position `P` du décor en position écran avec `((P + profondeur × décalage) − 0,5) × zoom + 0,5`, comme dans `HeroLayer.draw`.

## Si WebGL manque

Le conteneur affiche `stage.webp` en fond CSS. Sans WebGL ou sans les images, le décor reste donc visible mais fixe, et un message l'indique sous l'écran.
