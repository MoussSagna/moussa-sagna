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

Moussa vient lui aussi de `lab/`. Il n'y a ni planche de frames ni animation pré-rendue : vingt-cinq illustrations
dans la même vue (trois quarts, tourné vers la droite) sont découpées en calques et animées en direct.

Il se tient en garde, marche, dashe, s'accroupit, pare debout ou accroupi, saute sur place, en avant ou en
arrière, et enchaîne trois coups de poing et un coup de pied. Il n'a pas d'adversaire : les coups et la parade ne touchent rien.

| Fichier | Rôle |
|---|---|
| `src/game/hero/poseData.ts` | Calques, articulations et point d'appui de chaque pose. **Généré dans le lab**, ne pas modifier à la main. |
| `src/game/hero/poseRig.ts` | Calcul des poses : respiration de la garde et des poses tenues, marche par cinématique inverse. Recopié tel quel du lab. |
| `src/game/hero/heroState.ts` | État du personnage et tous ses réglages (durées, distances, minutage des coups). Sans Phaser, testé. |
| `src/game/hero/HeroAtlases.ts` | Téléchargement des atlas et limite de ceux gardés en mémoire vidéo. |
| `src/game/hero/HeroRig.ts` | Dessin : un objet Phaser par calque pour la garde et la marche, quelques images partagées pour les autres poses. |
| `src/game/hero/shaders.ts` | Shader des rubans : déplacement nul à la racine, maximal à la pointe. |
| `src/game/input.ts` | Clavier de l'arène. |
| `src/game/controls.ts` | Clés du registre Phaser par lesquelles React transmet les commandes des boutons. |

### Commandes

| Action | Clavier | Bouton |
|---|---|---|
| Marcher | maintenir ← → ou Q D (A en QWERTY) | maintenir « Reculer » ou « Avancer » |
| Dasher | deux appuis sur la même direction en moins de 260 ms | deux appuis sur le même bouton |
| S'accroupir | maintenir ↓ ou S | maintenir « S'accroupir » |
| Parer | maintenir Espace | maintenir « Parer » |
| Sauter | ↑ ou Z (W en QWERTY) ; avec ← ou → maintenu, saut arrière ou avant | « Sauter », avec « Reculer » ou « Avancer » maintenu |
| Attaquer | J : un appui pour le coup léger, puis un nouvel appui pendant chaque coup pour enchaîner le moyen, le fort et le coup de pied | « Attaquer » |

Le clavier est lu par la scène (`ArenaKeyboard`) ; les boutons passent par le registre du jeu. Tant que l'arène
est affichée, les touches de l'arène n'ont plus leur effet dans la page : les flèches haut et bas et Espace ne
la font pas défiler. Deux exceptions : une saisie de texte, et Espace sur un bouton ou une case qui a le focus.

### États

- **Marche** : la garde et la marche sont séparées par une pose intermédiaire de 0,09 s. Le corps avance à la
  vitesse exacte du pied posé, pour que les appuis ne patinent pas.
- **Dash** : une pose fixe qui glisse sur une distance fixe, vite au départ puis en freinant (`DASH`). Deux
  images fantômes de plus en plus transparentes la suivent ; elles disparaissent avec les animations réduites.
- **Accroupi et parade** : maintenus. Une pose de passage s'affiche un instant entre la garde et l'accroupi, et
  entre la garde et la parade debout ; la parade accroupie se prend et se quitte sans passage. Accroupi ou en
  parade, le personnage ne se déplace pas. Ces poses tenues respirent d'un bloc.
- **Saut** : depuis la garde ou la marche ; vertical, ou vers l'avant ou l'arrière si une direction est tenue
  au moment de l'appui (`JUMP.forward`, `JUMP.back` : le corps avance à vitesse constante pendant le vol, sans
  sortir du stage). Le lab penche aussi le corps dans le sens du saut ; le folio ne reprend pas cette
  inclinaison, parce que `HeroRig.show` ne sait pas afficher un cisaillement. Quatre dessins (impulsion, montée, corps regroupé,
  réception) ; la hauteur est calculée (`JUMP`) et le dessin est déformé en continu autour des pieds. Pendant le
  vol, l'ombre rétrécit et le reflet s'éloigne des pieds en s'estompant.
- **Coups de poing** : une seule touche. `PUNCHES` donne le minutage de chaque coup, repris d'un jeu de combat
  à 60 images par seconde, et un dessin par phase. Un nouvel appui pendant le coup léger met le coup moyen en
  attente, puis pendant le coup moyen le coup fort (un uppercut), puis pendant le fort le coup de pied haut, dernier
  coup de l'enchaînement : chacun part à la fin des images actives, à la
  place de la récupération. Un appui dans les `CHAIN_GRACE` secondes qui suivent le retour en garde poursuit
  aussi l'enchaînement. Sans adversaire dans l'arène, l'enchaînement ne dépend pas de toucher, contrairement
  au lab.

Dash, saut et coup ne partent que de la garde ou de la marche.

### Chargement et mémoire vidéo

- **Assets** : vingt atlas dans `public/assets/fighters/moussa/poses/`, en WebP sans perte, environ 17 Mo au
  total. Ils sont produits dans `lab/` par `lab/tools/prepare_poses.py`, à partir des illustrations de `art/` à
  la racine du dépôt. Ne pas les recompresser avec perte.
- **Ordre de chargement** : la garde, la pose intermédiaire et la marche d'abord (environ 2,9 Mo), après quoi
  le personnage apparaît. Les autres poses arrivent ensuite en arrière-plan, action par action
  (`ACTION_POSES` dans `ArenaScene.ts`). Une action n'est acceptée que lorsque toutes ses images sont arrivées.
- **Mémoire vidéo** : un atlas y pèse 10 à 20 Mo une fois décompressé, et les garder tous (plus de 250 Mo) fait
  perdre le contexte WebGL sur les appareils modestes. `HeroAtlases` n'ajoute une image au gestionnaire de
  textures de Phaser qu'au moment de l'afficher, et en retire les moins récemment utilisées au-delà de six. La
  garde et la marche restent toujours en mémoire : leurs rubans sont dessinés par des shaders qui gardent une
  référence à la texture. La première image d'une pose pas encore affichée peut donc arriver avec un léger
  retard.
- **Images partagées** : c'est pour pouvoir retirer un atlas que les poses autres que la garde et la marche
  n'ont pas leurs propres objets Phaser. Une image au repos reçoit la texture vide de Phaser, pour ne jamais
  pointer vers un atlas retiré.

### Dessin

- **Alignement** : toutes les poses sont posées au même point du sol et suivent la caméra du décor.
- **Échelle des poses** : les illustrations ne sont pas toutes dessinées à la même taille. `POSE_SCALE`, dans
  `HeroRig.ts`, agrandit ou réduit une pose autour de ses pieds pour garder la taille de tête de la garde. À
  reporter du lab pour chaque nouvelle image.
- **Reflet et ombre** : le reflet est un second exemplaire du rig, retourné sous les pieds, écrasé de moitié et
  à 20 % d'opacité. Là où deux calques se recouvrent, il est un peu plus dense : c'est une approximation de
  `lab/`, qui rend d'abord le personnage dans une texture.
- **Mipmaps** : `render.mipmapFilter` est activé dans `src/game/config.ts` pour les atlas. `RIBBON_TEXTURE_DATA`
  doit garder le même filtrage, car le shader des rubans partage la texture avec les images.
- **Animations réduites** : la respiration et la déformation du saut tombent à 35 % de leur amplitude.

### Limites

Reprises de `lab/` : les membres de la marche sont des pièces rigides (le genou marque un angle), les zones
cachées sont des aplats, et en garde les jambes et les bras ne sont pas articulés. Rien ne bouge dans le dessin
pendant un dash, un saut ou une pose tenue, rubans compris. Le premier des deux appuis d'un dash amorce
brièvement la marche. Le retour du coup moyen pose le haut du corps sur les jambes de la garde : les jambes
sautent en sortant de l'impact.

Une animation continue n'utilise qu'un seul dessin : faire alterner plusieurs illustrations proches se voit
comme une saccade. L'enchaînement de coups est l'exception assumée par le lab, parce que ses poses sont
franchement différentes.

État repris : `lab/` au commit `75c9232` (11 octobre 2026). Toute nouvelle pose doit garder la même vue et la
même taille de tête, sinon le personnage saute au changement d'état.

## Cinématique d'entrée

À l'ouverture de l'arène, une cinématique présente Moussa puis son adversaire, avant « Face your destiny », « Round 1 » et « Fight! ». Elle est reprise du lab : `src/game/cinematic/cinematic.ts` est une copie adaptée de `../lab/src/game/cinematic/CinematicLayer.ts`, sans dépendance à Phaser, qui dessine en Canvas 2D (plans, caméra, pluie, pétales, lanternes, transitions, cartons, annonces). Les plans sont les WebP de `public/assets/cinematic/`, repris du lab.

- **Dans la scène** : `ArenaScene` charge les plans, crée une `CanvasTexture` de la taille de la scène et une image par-dessus tout (`CINEMATIC_DEPTH`). À chaque image, la cinématique avance et se redessine dans cette texture ; il n'y a ni second canvas ni seconde boucle. Elle suit le temps réel même si l'affichage ralentit (pas plafonné à 0,05 s comme le combat).
- **Commandes** : le personnage ne répond à rien avant le « Fight! » (`can` et `walkDirection`). Échap ou le bouton « Passer l'intro » sautent les plans ; « Rejouer l'intro » la relance (`CONTROLS.skipCinematic`, `CONTROLS.replayCinematic`).
- **Textes** : dans `src/data/cinematic.ts`. Le carton de Moussa reprend le nom et le titre de `PROFILE` ; l'adversaire, sans nom, garde « ??? ».
- **Sans ses plans** (un fichier manquant), la cinématique ne joue pas et l'arène s'ouvre directement.
- « Réduire les animations » fixe la caméra, remplace le pétale et la coupe en diagonale par des fondus et adoucit les éclairs.

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
