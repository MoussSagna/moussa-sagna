# Architecture technique cible

## Stack

- Vite
- TypeScript en mode strict
- Phaser 3 pour le rendu et la simulation de jeu
- WebGL comme moteur de rendu préféré, avec un fallback Canvas uniquement si nécessaire et documenté
- React pour l'interface de portfolio autour du jeu, lorsque cette interface sera introduite

## Principe de séparation

- **Phaser** : canvas, scène de jeu, caméra, monde, éléments du décor et futurs systèmes de gameplay.
- **React** : navigation du portfolio, pages projets, contenu textuel et composants d'interface.
- Ne pas utiliser React pour simuler la boucle de jeu ou déplacer des sprites à chaque frame.
- Éviter de mélanger les responsabilités entre interface HTML et scène Phaser.

## Résolution de référence

- Résolution logique de départ : `1280 × 720`.
- Le canvas doit s'adapter à la taille disponible sans déformer le ratio de la scène.
- Centrer la scène et gérer proprement les bandes ou le recadrage selon le mode de scale choisi.
- Le comportement doit rester correct sur une fenêtre desktop redimensionnée.

## Structure indicative

Adapter cette structure au dépôt existant au lieu de tout réorganiser sans raison :

```text
src/
  main.ts
  game/
    config.ts
    scenes/
      ArenaScene.ts
    systems/
      # réservé aux systèmes futurs, ne rien ajouter sans besoin actuel
  styles/
    main.css
public/
  assets/
    backgrounds/
    fighters/
docs/
  01-CONTEXTE-PROJET.md
  02-DIRECTION-ARTISTIQUE.md
  03-ARCHITECTURE-TECHNIQUE.md
  04-ROADMAP-ET-PERIMETRE.md
  05-CRITERES-DE-VALIDATION.md
```

Si le projet possède déjà une structure, examiner celle-ci et la préserver autant que possible.

## Responsabilités minimales de l'étape 1

- configuration Vite et TypeScript ;
- configuration Phaser avec rendu WebGL ;
- scène `ArenaScene` ;
- chargement d'un arrière-plan disponible, si l'asset est identifié et correctement référencé ;
- affichage d'une scène minimale et d'un sol/horizon ;
- adaptation à la fenêtre ;
- nettoyage correct des ressources/événements si nécessaire ;
- instructions de lancement et de validation.

## Qualité

- Pas de dépendance inutile.
- Pas de grosse architecture abstraite avant qu'elle soit justifiée.
- Pas de `any` non justifié.
- Pas de chemin d'asset supposé : vérifier les fichiers réellement présents.
- Fournir des messages d'erreur utiles en cas d'asset manquant.
- Ne pas annoncer des tests réussis s'ils n'ont pas été exécutés.

---

# Architecture réelle après le sprint 2

Cette section décrit le code tel qu'il existe. En cas d'écart avec la cible ci-dessus, c'est elle qui fait foi.

## Stack installée

- Vite 8, TypeScript 7 (strict), React 19, React Router 7, Phaser 3.90.
- Polices auto-hébergées via `@fontsource` : Anton (titres) et Chakra Petch (HUD). Le texte courant utilise la
  police système.
- Vitest pour les tests unitaires.
- CSS natif, sans préprocesseur ni bibliothèque d'animation.

## Séparation React / Phaser

- React gère toutes les pages et la navigation. Phaser n'est utilisé que pour l'arène.
- `src/components/ArenaCanvas.tsx` est le seul fichier React qui touche à Phaser. Il crée le jeu au montage via
  `createArenaGame(parent)` (`src/game/config.ts`) et appelle `game.destroy(true)` au démontage. L'effet n'a
  aucune dépendance : un nouveau rendu React ne recrée jamais le moteur.
- `ArenaCanvas` est chargé à la demande (`React.lazy`) depuis la page `/entrainement`. Le fichier Phaser
  (environ 1,2 Mo) n'est donc téléchargé que sur cette page.
- `ArenaScene` affiche le décor animé décrit plus bas. Le canvas s'adapte à son conteneur 16:9 grâce au mode
  `Scale.FIT`.
- `src/assets.ts` centralise les chemins d'assets partagés entre React et Phaser.

## Décor animé de l'arène

Le décor vient de `lab/`, le moteur WebGL d'essai du dépôt, où il tourne sur un moteur écrit à la main. Il a été
porté dans la scène Phaser : une seule boucle (celle de Phaser), un seul contexte WebGL.

| Fichier | Rôle |
|---|---|
| `src/game/stage/shaders.ts` | Shader du décor, dessiné par un objet `Shader` Phaser qui couvre toute la scène. |
| `src/game/stage/camera.ts` | Calcul de la caméra : travelling d'ouverture de 3,6 s, respiration lente, pointeur. |
| `src/game/stage/Weather.ts` | Pluie, ronds dans l'eau et pétales, dessinés dans un `Graphics` Phaser. |
| `src/game/scenes/ArenaScene.ts` | Charge les deux images, pilote le shader et la météo à chaque image. |

- Le shader lit deux images : `stage.webp` et la carte `depth.png`. Dans la carte, le rouge donne la profondeur
  (parallaxe), le vert délimite le ciel (nuages, halo de la lune, éclairs) et le bleu repère les écrans géants.
- Les lanternes, les néons et le trajet du métro sont placés par leurs coordonnées dans l'image, en dur dans le
  shader. Un autre décor demande de les repositionner et de redessiner la carte.
- Ordre des plans : décor (0), reflet du personnage (1), ombre (2), images fantômes du dash (3), personnage (4),
  météo (100).
- Si le système demande de réduire les animations (`prefers-reduced-motion`), la caméra ne garde que le suivi du
  pointeur, les éclairs et les parasites des écrans disparaissent, et la météo est allégée.
- Sans WebGL, ou si `depth.png` ne se charge pas, la scène retombe sur l'ancien affichage : image fixe et ligne
  de sol.
- Phaser remet par défaut les textures d'un `Shader` en mode `REPEAT`, que WebGL 1 refuse pour une image dont les
  côtés ne sont pas des puissances de deux. `STAGE_TEXTURE_DATA` force `CLAMP_TO_EDGE` ; sans lui le décor est
  noir.

Non repris de `lab/` : le carton de titre « Stage », le bouton pour rejouer l'intro et les cases
Pluie / Pétales / Réduire les mouvements.

## Personnage jouable

Moussa vient lui aussi de `lab/`. Il n'y a ni planche de frames ni animation
pré-rendue : cinq illustrations dans la même vue (trois quarts, tourné vers la droite) sont découpées en
calques et animées en direct.

| Fichier | Rôle |
|---|---|
| `src/game/hero/poseData.ts` | Calques, articulations et point d'appui de chaque pose. **Généré**, ne pas modifier à la main. |
| `src/game/hero/poseRig.ts` | Calcul des poses : respiration de la garde, marche par cinématique inverse. Repris tel quel. |
| `src/game/hero/heroState.ts` | État du personnage : garde, pose intermédiaire de 0,09 s, marche, dash, double appui, bords de l'arène. |
| `src/game/hero/HeroRig.ts` | Un objet Phaser par calque. Calques rigides : images de l'atlas. Rubans : shader d'ondulation. |
| `src/game/hero/shaders.ts` | Shader des rubans : déplacement nul à la racine, maximal à la pointe. |
| `src/game/controls.ts` | Clé du registre Phaser par laquelle React transmet la direction demandée. |

- **Assets** : `public/assets/fighters/moussa/poses/guard.webp`, `walk.webp` (2048 × 2048), `step.webp`,
  `dashForward.webp` et `dashBack.webp` (1024 × 2048), en WebP sans perte, environ 4,1 Mo au total. Ils sont produits dans `lab/` par
  `lab/tools/prepare_poses.py`, à partir des illustrations de `art/` à la racine du dépôt. Ne pas les recompresser avec perte.
- **Commandes** : flèches gauche et droite, ou Q et D (A en QWERTY), lues par la scène ; boutons « Reculer » et
  « Avancer » à maintenir, transmis par `ArenaCanvas` via le registre du jeu. Deux appuis sur la même direction
  en moins de 260 ms (`DOUBLE_TAP_MS`) lancent un dash, au clavier comme aux boutons.
- **Dash** : une pose fixe qui glisse sur une distance fixe, vite au départ puis en freinant (`DASH`). Deux
  images fantômes de plus en plus transparentes la suivent ; elles disparaissent avec les animations réduites.
- **Échelle des poses** : les illustrations ne sont pas toutes dessinées à la même taille. `POSE_SCALE`, dans
  `HeroRig.ts`, agrandit chaque pose autour de ses pieds pour garder la taille de tête de la garde. À mesurer
  pour chaque nouvelle image.
- **Alignement** : les trois poses sont posées au même point du sol et suivent la caméra du décor. Le corps
  avance à la vitesse exacte du pied posé, pour que les appuis ne patinent pas.
- **Reflet et ombre** : le reflet est un second exemplaire du rig, retourné sous les pieds, écrasé de moitié et
  à 20 % d'opacité. Là où deux calques se recouvrent, il est un peu plus dense : c'est une approximation de
  `lab/`, qui rend d'abord le personnage dans une texture.
- **Mipmaps** : `render.mipmapFilter` est activé dans `src/game/config.ts` pour les atlas. `RIBBON_TEXTURE_DATA`
  doit garder le même filtrage, car le shader des rubans partage la texture avec les images.
- **Animations réduites** : la respiration de la garde tombe à 35 % de son amplitude.

Limites reprises de `lab/` : les membres de la marche sont des pièces rigides (le genou marque un
angle), les zones cachées sont des aplats, et en garde les jambes et les bras ne sont pas articulés. Rien ne
bouge dans le dessin pendant un dash, et le premier des deux appuis amorce brièvement la marche avant que le
dash parte. La marche n'utilise volontairement qu'un seul dessin : faire alterner plusieurs illustrations dans
une même animation se voit comme une saccade.

État repris : `lab/` au commit `16fb13e` (11 octobre 2026). Toute nouvelle pose doit garder la même vue et la même taille de tête, sinon
le personnage saute au changement d'état.

## Routage

- `BrowserRouter`, avec des adresses lisibles (`/projets/racine-eyewear`).
- Conséquence pour l'hébergement : le serveur doit renvoyer `index.html` pour toute adresse inconnue
  (réécriture SPA). Sans cela, recharger une page interne donne une erreur 404.
- L'intro n'est montrée d'office qu'à la première visite (mémorisée dans `localStorage`) ; elle reste accessible
  sur `/intro`.

## Données

Tous les contenus sont dans `src/data/`. Une valeur `null` ou une liste vide signifie « à fournir » et s'affiche
comme telle. Voir `06-CONTENUS-A-FOURNIR.md`.

## Styles

- `main.css` : jetons (couleurs, polices, espacements), base, décor, animations, `prefers-reduced-motion`.
- `components.css` : en-tête, menu mobile, boutons, panneaux HUD, portraits, visuels de projet, cadre de l'arène.
- `pages.css` : mise en page de chaque écran, écrite mobile d'abord. Le passage en disposition desktop se fait
  à 960 px.

## Décisions à connaître

- Les boutons et cartes sont inclinés par `transform: skew` plutôt que découpés par `clip-path`, pour que le
  contour de focus clavier reste visible.
- L'animation d'entrée de page ne joue que sur l'opacité de `<main>` : un `transform` à cet endroit casserait
  les décors en position fixe.
- Le rouge des boutons pleins est `#D4142D` (et non `#F51F3B`) pour garder un contraste suffisant avec le texte
  blanc.
