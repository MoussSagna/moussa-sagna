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

Le personnage est fait de trois illustrations dans la même vue (trois quarts à profil, tourné vers la droite), découpées en calques et animées en direct : il n'y a ni planche de frames ni animation pré-rendue.

| Pose | Illustration | Rôle |
| --- | --- | --- |
| `guard` | `art/hero-guard.png` | état neutre : garde, poings levés |
| `step` | `art/hero-step.png` | pose intermédiaire, affichée un instant entre la garde et la marche |
| `walk` | `art/hero-walk.png` | marche, jambes et bras articulés |

- **Données** : `tools/prepare_poses.py` retire le fond vert, efface les logos des baskets, découpe chaque illustration, range ses calques dans un atlas (`guard.webp`, `step.webp`, `walk.webp`) et génère `src/game/hero/poseData.ts` (calques, articulations, point d'appui).
- **Dessin** : `HeroLayer` dessine un quad par calque, du fond vers le premier plan. Le vertex shader applique la matrice du calque ; le fragment shader retrouve le pixel d'origine dans la toile (1024 × 1536) et y ajoute l'ondulation des rubans, nulle à la racine et maximale à la pointe.
- **Alignement** : chaque pose a un point d'appui (milieu des pieds, ligne des semelles). Les trois sont posés au même endroit du sol, placé par `PLACEMENT`, et suivent la caméra du décor avec la profondeur du sol.
- **Reflet et ombre** : le personnage entier est d'abord dessiné une fois dans une texture hors écran, qui sert au reflet.

### La garde

`guardMatrices` (`src/game/hero/poseRig.ts`) : le corps se tasse légèrement vers la ligne du sol (les semelles ne bougent pas), le buste respire en s'agrandissant autour de la taille, la tête et les rubans suivent avec un retard. La tête est un calque dessiné une seconde fois par-dessus le buste, ce qui lui permet de bouger sans laisser de trou. `GUARD` règle les durées et les amplitudes ; « Réduire les mouvements » les ramène à 35 %.

### La marche

`walkMatrices` calcule la pose pour une phase du cycle. Chaque cheville suit une trajectoire par rapport à la hanche : elle recule au sol à vitesse constante, puis revient en l'air. La cuisse et le tibia sont placés par cinématique inverse (deux os, genou vers l'avant). Le pied a son propre angle : talon qui se pose, pied à plat, talon qui se lève. Le bassin monte quand une jambe passe à la verticale, le buste se penche un peu et les bras balancent à l'opposé des jambes.

Le corps avance à `WALK_SPEED`, la vitesse exacte du pied posé, pour que les appuis ne patinent pas. Jouer le cycle à l'envers donne la marche arrière. `GAIT` règle la durée du cycle, la foulée, la levée des pieds et le balancement des bras.

### Les changements d'état

`HeroLayer.update` ne saute jamais directement de la garde à la marche : il affiche la pose `step` pendant `STEP_SECONDS`, puis la pose d'arrivée. Ce sont des coupes franches entre trois dessins proches, comme dans une animation dessinée, sans fondu. `StageEngine.walk` reçoit la direction (1, -1 ou 0) ; `App.tsx` la pilote au clavier et avec deux boutons à maintenir.

### Limites

- Les membres de la marche sont des pièces rigides qui tournent : les plis du pantalon ne se redessinent pas et le genou marque un angle quand il plie.
- Les parties cachées (haut de la cuisse éloignée, buste sous le bras) sont des aplats sans détail.
- Il manque une illustration du milieu du pas (jambes qui se croisent), le moment où le découpage est le plus faible.
- En garde, les jambes et les bras ne sont pas articulés.

## Ajouter un plan

1. Créer une classe avec `load(): Promise<boolean>` et `draw(frame, camera, …)`.
2. Lui donner son canvas dans `StageScreen.tsx` et l'ajouter à `StageCanvases`.
3. L'instancier dans `StageEngine` et l'appeler dans `frame`, à sa place dans l'ordre de profondeur.
4. Pour qu'il suive la caméra, convertir une position `P` du décor en position écran avec `((P + profondeur × décalage) − 0,5) × zoom + 0,5`, comme dans `HeroLayer.draw`.

## Si WebGL manque

Le conteneur affiche `stage.webp` en fond CSS. Sans WebGL ou sans les images, le décor reste donc visible mais fixe, et un message l'indique sous l'écran.
