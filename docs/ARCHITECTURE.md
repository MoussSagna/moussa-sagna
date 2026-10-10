# Architecture

## Vue d'ensemble

L'écran du stage empile trois canvas dans un même conteneur, pilotés par une seule boucle.

| Ordre | Plan | Fichier | Technique |
| --- | --- | --- | --- |
| 1 (fond) | Décor | `src/game/stage/StageBackdrop.ts` | WebGL, un shader plein écran |
| 2 | Personnage | `src/game/hero/HeroLayer.ts` | WebGL, trois quads (reflet, ombre, personnage) |
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

Une seule illustration (`hero.webp`) est déformée en direct ; il n'y a pas de planche de frames. La carte `hero-map.png` dit quoi bouge :

- **rouge** : tissus libres (bandeau, lanières), qui ondulent de plus en plus fort en s'éloignant du corps ;
- **vert** : haut du corps, pour la respiration ;
- **bleu** : tête, qui suit avec un léger retard.

Les pieds ne bougent pas. Le personnage est placé par `PLACEMENT` et suit la caméra du décor avec la profondeur du sol.

Limite : cette technique ne change pas la pose. Les coups, la marche ou les sauts demanderont de vraies frames ou un squelette (voir la feuille de route).

## Ajouter un plan

1. Créer une classe avec `load(): Promise<boolean>` et `draw(frame, camera, …)`.
2. Lui donner son canvas dans `StageScreen.tsx` et l'ajouter à `StageCanvases`.
3. L'instancier dans `StageEngine` et l'appeler dans `frame`, à sa place dans l'ordre de profondeur.
4. Pour qu'il suive la caméra, convertir une position `P` du décor en position écran avec `((P + profondeur × décalage) − 0,5) × zoom + 0,5`, comme dans `HeroLayer.draw`.

## Si WebGL manque

Le conteneur affiche `stage.webp` en fond CSS. Sans WebGL ou sans les images, le décor reste donc visible mais fixe, et un message l'indique sous l'écran.
