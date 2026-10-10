# Architecture

## Vue d'ensemble

L'écran du stage empile trois canvas dans un même conteneur, pilotés par une seule boucle.

| Ordre | Plan | Fichier | Technique |
| --- | --- | --- | --- |
| 1 (fond) | Décor | `src/game/stage/StageBackdrop.ts` | WebGL, un shader plein écran |
| 2 | Personnage | `src/game/hero/HeroLayer.ts` | WebGL, un quad par calque du rig, plus le reflet et l'ombre |
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

Le personnage est un rig de 17 calques (voir `moussa_rig/README.md`), animé en direct : il n'y a ni planche de frames ni animation pré-rendue.

- **Données** : `tools/pack_rig.py` range les calques dans un atlas (`rig-atlas.webp`) et génère `src/game/hero/rigData.ts` à partir de `moussa_rig/rig.json`, qui reste la seule source des pivots et du mouvement.
- **Transformations** : `rigMatrices` (`src/game/hero/rig.ts`) calcule une matrice par calque à chaque image. C'est le portage de `matrices()` de `tools/rig/simulate.py`, qui sert de référence : cycle de 4 secondes, tout en sinus, phase propre à chaque calque. Un calque en mode `matrix` hérite de toute la transformation de son parent ; en mode `point`, il suit seulement le déplacement de son pivot.
- **Dessin** : un quad par calque, du fond vers le premier plan. Le vertex shader applique la matrice ; le fragment shader retrouve le pixel d'origine dans la toile du rig (1024 × 1536) et y ajoute l'ondulation des rubans, nulle à la racine et maximale à la pointe.
- **Reflet et ombre** : le personnage entier est d'abord dessiné une fois dans une texture hors écran, qui sert au reflet. Dessiner les calques un par un à 20 % d'opacité ferait apparaître leurs zones de recouvrement.

`AMPLITUDE` (dans `HeroLayer.ts`) règle l'ampleur du mouvement. Elle est plafonnée à 1 : au-delà, les calques sortent de leurs zones de recouvrement et des trous apparaissent. « Réduire les mouvements » la ramène à 0,35.

À l'arrêt, les pieds ne bougent pas. Le personnage est placé par `PLACEMENT` et suit la caméra du décor avec la profondeur du sol.

### La marche

La marche est un pas glissé. Les deux jambes sont dans le seul calque `lower`, déformé dans le fragment shader. La carte `hero-legs.png`, dans le repère de la toile du rig, donne le poids de chaque jambe (rouge = jambe arrière, vert = jambe avant) : 0 à la hanche, 1 à la cheville et sur tout le pied, qui reste donc rigide.

`HeroLayer.update` fait avancer un cycle (`WALK` règle la durée, la foulée, la levée du pied et la flexion du genou, en pixels de la toile) : chaque pied avance en l'air pendant une moitié du cycle, puis recule au sol pendant l'autre. Le corps avance exactement de ce que le pied au sol recule, ce qui évite que les pieds patinent. Jouer le cycle à l'envers donne la marche arrière.

Le balancement vertical et l'inclinaison du buste sont une transformation appliquée à la racine du rig : tous les calques qui dépendent du bassin la suivent, et le calque `lower` l'applique lui-même partout sauf sur les pieds. Les pointes des rubans traînent derrière.

`StageEngine.walk` reçoit la direction (1, -1 ou 0) ; `App.tsx` la pilote au clavier et avec deux boutons à maintenir.

Limites : les jambes sont pliées, pas redessinées, donc la foulée doit rester courte. Les rubans `rb_hip` et `rb_right` suivent le bassin, pas la cuisse sur laquelle ils reposent. Les coups et les sauts demanderont de nouvelles poses du rig, avec des zones cachées repeintes (voir la feuille de route).

## Ajouter un plan

1. Créer une classe avec `load(): Promise<boolean>` et `draw(frame, camera, …)`.
2. Lui donner son canvas dans `StageScreen.tsx` et l'ajouter à `StageCanvases`.
3. L'instancier dans `StageEngine` et l'appeler dans `frame`, à sa place dans l'ordre de profondeur.
4. Pour qu'il suive la caméra, convertir une position `P` du décor en position écran avec `((P + profondeur × décalage) − 0,5) × zoom + 0,5`, comme dans `HeroLayer.draw`.

## Si WebGL manque

Le conteneur affiche `stage.webp` en fond CSS. Sans WebGL ou sans les images, le décor reste donc visible mais fixe, et un message l'indique sous l'écran.
