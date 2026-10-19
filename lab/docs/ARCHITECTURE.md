# Architecture

## Vue d'ensemble

L'écran du stage empile six canvas dans un même conteneur, pilotés par une seule boucle.

| Ordre | Plan | Fichier | Technique |
| --- | --- | --- | --- |
| 1 (fond) | Décor | `src/game/stage/StageBackdrop.ts` | WebGL, un shader plein écran |
| 2 | Mannequin | `src/game/dummy/DummyLayer.ts` | WebGL, deux quads (socle, buste) ou un seul (coup reçu), plus le reflet et l'ombre |
| 2 | Adversaire | `src/game/rival/RivalLayer.ts` | WebGL, un quad, plus le reflet et l'ombre. Affiché à la place du mannequin selon `options.opponent` |
| 3 | Personnage | `src/game/hero/HeroLayer.ts` | WebGL, un quad par calque de la pose, plus le reflet et l'ombre |
| 4 | Météo | `src/game/stage/WeatherLayer.ts` | Canvas 2D |
| 5 (devant) | Cinématique | `src/game/cinematic/CinematicLayer.ts` | Canvas 2D : la cinématique d'entrée puis les annonces avant le combat ; placé après le carton de titre HTML pour le recouvrir |

Par-dessus, React affiche le carton de titre et l'étiquette du stage en HTML (`src/components/StageScreen.tsx`).

## La boucle

`StageEngine` (`src/game/stage/StageEngine.ts`) :

1. redimensionne les canvas à la taille du conteneur (densité de pixels plafonnée à 2) ;
2. calcule le temps écoulé et la caméra ;
3. fait avancer le personnage et le mannequin, puis décide si un coup touche (voir « Les coups qui touchent ») ;
4. appelle `draw` sur chaque plan, du fond vers l'avant.

La caméra (`Camera` dans `src/game/types.ts`) combine trois mouvements : le travelling d'ouverture (zoom arrière sur 3,6 s), une respiration lente, et la position de la souris. Avec « Réduire les mouvements », seule la souris reste.

## Le décor

Une seule image (`stage.webp`) et une carte (`depth.png`) dont chaque canal porte une information :

- **rouge** : profondeur (0 = loin, 1 = proche). Le shader décale chaque pixel selon sa profondeur, ce qui crée la parallaxe.
- **vert** : le ciel. Les nuages, le halo de la lune et les éclairs n'apparaissent que là.
- **bleu** : les écrans géants. La valeur sert d'identifiant pour désynchroniser leurs animations.

Les lanternes, les néons et le trajet du métro sont positionnés par leurs coordonnées dans l'image, directement dans `src/game/stage/shaders.ts`.

## Le personnage

Le personnage est fait de vingt-neuf illustrations dans la même vue (trois quarts à profil, tourné vers la droite), découpées en calques et animées en direct : il n'y a ni planche de frames ni animation pré-rendue.

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
| `specialCharge`, `specialThrow`, `specialRecover` | `../art/hero-special-*.png` | attaque spéciale : charge à la hanche, lancer à deux mains, retour |
| `koStagger`, `koFall`, `koAir`, `koDown` | `../art/hero-ko-*.png` | K.O. : il titube, bascule, est projeté en l'air, puis reste au sol |
| `groundCharge`, `groundRise`, `groundPalm` | `../art/hero-ground-*.png` | frappe au sol : main au sol, redressement, paume tendue |
| `kickStart`, `kickHit` | `../art/hero-kick-*.png` | coup de pied, quatrième coup de l'enchaînement : genou armé (démarrage et retour), jambe tendue |
| `exitLean`, `exitCrouch`, `exitGround`, `exitSpring` | `../art/hero-exit-*.png` | sortie de fin de round : il se penche, s'accroupit, pose la main au sol, prêt à bondir |
| `hurt`, `hurtRecover` | `../art/hero-hurt.png`, `../art/hero-hurt-recover.png` | coup encaissé : tête projetée en arrière, puis retour |
| `specialIn1`, `specialIn2`, `specialIn3` | `../art/hero-special-in-*.png` | attaque spéciale : dessins intermédiaires avant la charge, avant le lancer et avant le retour |
| `punchChain1`, `punchChain2` | `../art/hero-punch-chain-*.png` | transitions entre le jab et le direct : le bras avant se replie, puis le bras arrière part |
| `punchMidHit`, `punchMidRecover` | `../art/hero-punch-mid-*.png` | coup de poing moyen : bras tendu, retour |
| `punchHeavyStart`, `punchHeavyHit`, `punchHeavyRecover` | `../art/hero-punch-heavy-*.png` | coup de poing fort : armé, uppercut, retour |

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

`HeroLayer.dash(direction)` affiche la pose de dash et déplace le personnage d'une distance fixe, vite au départ puis en freinant (`DASH` règle la distance et la durée de chaque sens). Pendant le déplacement, deux images fantômes de plus en plus transparentes sont dessinées à ses positions précédentes ; « Réduire les mouvements » les supprime. Pendant le dash, le dessin est aussi déformé par la vitesse, de moins en moins à mesure qu'il freine : étiré et penché dans le sens de la course (`dashMatrix`), avec une traînée de bandes horizontales derrière lui, calculée dans le fragment shader (`uSmear`). « Réduire les mouvements » supprime toute cette déformation. La pose de dash n'a qu'un calque, ce qui permet de la dessiner en transparence sans que des recouvrements apparaissent. À la fin, le personnage revient en garde. Un dash ne peut pas être relancé avant la fin du précédent.

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

**Sauts avant et arrière** : une direction tenue au moment de l'appui sur saut (`StageEngine.jump` transmet `walk`) donne un saut avant ou arrière. Ce sont les mêmes dessins et la même trajectoire verticale ; le corps avance à vitesse constante pendant tout le vol (`JUMP.forward`, `JUMP.back`), sans franchir le bord du stage ni l'adversaire, et s'incline dans le sens du saut, au plus fort en milieu de vol (`JUMP.lean`, `jumpMatrix`).

### Les coups de poing

Il n'y a qu'une touche d'attaque. `HeroLayer.attack()` lance le coup léger depuis la garde ou la marche ; un nouvel appui pendant un coup met en attente le coup suivant de l'enchaînement (`CHAIN`), qui part dès la fin des images actives, à la place de la récupération. Un appui dans les `CHAIN_GRACE` secondes qui suivent le retour en garde poursuit aussi l'enchaînement, pour ne pas avoir à appuyer pendant le quart de seconde du coup ; passé ce délai, ou après toute autre action, l'appui repart du coup léger. L'enchaînement complet : léger, moyen, fort.

`PUNCHES` décrit chaque coup : son minutage, repris d'un jeu de combat à 60 images par seconde, et un dessin par phase.

| Coup | Démarrage | Actif | Récupération | Dessins |
| --- | --- | --- | --- | --- |
| Léger (jab du bras avant) | 4 | 3 | 7 | `punchStart`, `punchHit`, puis `punchStart` à nouveau |
| Fort (uppercut du bras avant) | 11 | 6 | 20 | `punchHeavyStart`, `punchHeavyHit`, `punchHeavyRecover` |
| Moyen (direct du bras arrière) | 6 | 4 | 11 | `punchChain1` et `punchChain2` (trois images chacun), `punchMidHit`, `punchMidRecover` |

Montage des dessins :

- **Léger** : illustrations entières, calées pour que le pied arrière tombe sur celui de la garde. Le pied avant fait un petit pas glissé.
- **Moyen, impact** : illustration entière, calée sur le pied avant de la garde. Le pied arrière pivote sur sa pointe et les hanches tournent.
- **Fort** : illustrations entières, calées sur le pied avant de la garde comme le direct.
- **Transitions** : illustrations entières. Le pied avant y glisse de sa place du jab à celle du direct.
- **Moyen, retour** : seulement le haut du corps, posé sur les jambes de la garde (`ON_GUARD_LEGS` dans `tools/prepare_poses.py`). Les jambes sautent donc en sortant de l'impact ; ce dessin reste à refaire en corps entier.

L'enchaînement fait se suivre quatre illustrations en un quart de seconde. C'est une exception assumée à la règle « une animation = une illustration » : ce sont des poses franchement différentes d'un coup rapide, pas des dessins proches en boucle.

Le champ `reach` donne la portée de chaque coup, `height` sa hauteur : c'est ce qui décide s'il touche le mannequin. `App.tsx` déclenche l'attaque avec J ou le bouton « Attaquer ».

### L'attaque spéciale

`HeroLayer.special()` lance une boule de feu, depuis la garde ou la marche (`SPECIAL` règle les durées, les tailles et la vitesse). Le personnage enchaîne six dessins, listés avec leur durée dans `SPECIAL.steps` : un intermédiaire, la charge, mains jointes à la hanche, un intermédiaire, le lancer, bras tendus, un intermédiaire, puis le retour. Il ne peut rien faire d'autre avant la fin.

La boule de feu n'est pas une image : elle est entièrement calculée par `FIRE_FRAGMENT` (`src/game/hero/shaders.ts`), avec un cœur presque blanc, un corps orangé puis rouge, des flammes qui ondulent et une queue en vol. Elle grossit dans les mains pendant la charge, en suivant la position des mains de chaque dessin (`hands`), part des mains au dessin marqué `launch`, traverse le stage et explose sur le mannequin (ou disparaît au bord si elle le manque). Une lueur aplatie la suit sur le sol. Elle vit indépendamment du personnage, et il ne peut y en avoir qu'une à la fois. « Réduire les mouvements » atténue l'ondulation des flammes.

Les illustrations ont les mains vides et aucun éclairage d'effet : une lueur peinte sur le personnage resterait figée pendant que la boule s'éloigne. `App.tsx` déclenche l'attaque avec L ou le bouton « Spécial ».

### La cinématique d'entrée

`CinematicLayer` (`src/game/cinematic/CinematicLayer.ts`) joue au chargement et à chaque « Rejouer l'intro », avant le combat. Six plans illustrés plein cadre (`../art/cinematic-*.png`, préparés par `tools/prepare_cinematic.py`), trois pour Moussa puis trois pour l'adversaire :

1. **Le temple vide** : la caméra descend de la lune vers l'esplanade.
2. **Un pétale passe devant l'objectif** : il traverse l'écran en tournant et le recouvre entièrement à mi-course, au moment de la coupe vers Moussa en pied, sur lequel la caméra s'approche.
3. **Le gros plan**, après un éclair blanc, avec son nom qui glisse sur une bande rouge.
4. **L'adversaire de dos face à la ville**, après une coupe en diagonale (une bande sombre bordée de rouge qui balaie l'écran).
5. **L'adversaire de plus près**, en coupe franche.
6. **L'adversaire qui se retourne avec un sourire**, après un éclair blanc, avec son carton venu de la droite. Il n'a pas encore de nom : le carton affiche « ??? ».

Tout le mouvement est fait par le code : cadrage et zoom de chaque plan (`SHOTS`), lueur de la lune qui pulse, lanternes qui vacillent (positions repérées par le script), pluie, pétales, bandes noires de cinéma. Chaque plan déclare dans `SHOTS` sa fin, son mouvement de caméra, sa transition d'arrivée (`enter`) et son éventuel carton de nom ; les durées des transitions et des annonces sont dans `TIMELINE`.

Tant que les plans recouvrent l'écran, `StageEngine` ne dessine pas le stage. Ensuite, un éclair blanc ramène au stage, dont le travelling d'ouverture commence, et les annonces s'enchaînent par-dessus : « Face your destiny », « Round 1 », « Fight! ». Le personnage ne répond à aucune commande avant le « Fight! ». Le bouton « Passer » (ou Échap) saute les plans illustrés et mène directement aux annonces ; `StageEngine.onCinematic` prévient React pour l'afficher ou le masquer.

« Réduire les mouvements » fixe la caméra sur le cadrage d'arrivée de chaque plan, remplace le pétale qui traverse par un fondu rose et la coupe en diagonale par un fondu au noir, adoucit les éclairs et supprime la secousse du « Fight! ».

### Le K.O.

`StageEngine.knockOut()` (touche O ou bouton « K.O. ») met le personnage hors de combat, pour tester sa défaite : arrêt sur image et secousse, puis `HeroLayer.knockOut()` enchaîne trois dessins (il titube, bascule en arrière, est projeté en l'air sur une courbe) en reculant, et le dessin au sol (`KO`). À la chute, la caméra tremble, de la fumée et des cailloux jaillissent (les mêmes que la fin de round, plus petits) et `CinematicLayer.showKO` affiche « K.O. ». Après `KO.total` secondes, il revient en garde et le round suivant est annoncé. Pendant le K.O., il ne peut être ni touché ni commandé.

`../art/hero-ko-down.png` est l'illustration fournie, plus large que les autres : réduite à 0,85 et posée sur une toile de 1024 × 1536, ce que `POSE_SCALE` compense.

### La fin de round

`StageEngine.endRound()` (touche P ou bouton « Fin du round ») lance `HeroLayer.exit()`. Le personnage enchaîne ses quatre dessins de sortie (`EXIT.steps`), puis bondit hors de l'écran par le haut avec le dessin du saut étiré et deux images fantômes. Au départ du bond, sept bouffées de fumée dessinées (`../art/fx-smoke.png`, découpées par `tools/prepare_fx.py`) surgissent au sol en grossissant, s'écartent, montent un peu et s'effacent (`SMOKE`), et des cailloux sont projetés en l'air (`PEBBLES`). Les bouffées sont dessinées avec le programme du reflet, chacune sur sa propre unité de texture à partir de `SMOKE_UNIT`.

Quand la fumée est retombée (`exitDone`), le moteur ramène le personnage en garde à sa place de départ et `CinematicLayer.startRound` annonce « Round 2 » puis « Fight! » ; le personnage ne répond qu'au « Fight! ». Pendant la sortie, il ne peut pas être touché. « Réduire les mouvements » retire les images fantômes et les cailloux.

### La frappe au sol

Seconde attaque spéciale (`HeroLayer.groundSpecial()`, touche I ou bouton « Spécial 2 »), depuis la garde ou la marche. Le personnage se baisse et pose la main au sol : le jeu se fige le temps d'une mise au point (`FOCUS_SECONDS`), où la caméra zoome et se recentre vers lui (`FOCUS` dans `StageEngine`, recentrage partiel pour ne pas déformer le décor), le décor s'assombrit et des traits de vitesse convergent vers lui sur un vignettage rouge (`CinematicLayer.focus`). Puis il se rue sur l'adversaire avec le dessin du dash avant, une traînée et des images fantômes (`GROUND.rushSpeed`), puis enchaîne une rafale de dix coups très rapides (`FLURRY`) : direct léger, moyen, uppercut et coup de pied, dans un ordre tiré au hasard à chaque attaque, sans répéter deux fois le même de suite. Elle se termine par trois coups plus lents et plus lourds, toujours les mêmes (`HEAVY` : direct, uppercut, coup de pied), qui explosent sur la cible et font trembler l'écran. Chaque coup touche une fois, avec son étincelle, une étoile et une entaille dessinées au point d'impact, un court arrêt sur image et une petite secousse. Il finit par la frappe au sol : il pose la main au sol pour charger, se redresse et frappe de la paume en avançant encore un peu, puis revient (`GROUND.steps`). La paume touche une fois ; le corps avance de `GROUND.advance` sans franchir le bord ni l'adversaire.

À partir de la charge, le décor, l'adversaire et la météo sont assombris par un filtre CSS (`StageEngine.dimmed`) : seul le personnage reste éclairé. Quand la charge commence, le combat se fige le temps d'un plan de coupe (`CinematicLayer.cutIn`, `CUT_IN_SECONDS`) : une bande inclinée s'ouvre au milieu de l'écran sur un gros plan de Moussa qui charge (`../art/cinematic-cutin.png`, détouré par `tools/prepare_cinematic.py`), qui glisse lentement devant des traits de vitesse, puis se referme et la frappe part.

Les effets sont des morceaux d'une planche dessinée (`../art/fx-ground-special.png`, rectangles dans `FX`), dessinés par un petit programme qui lit un rectangle de la texture (`SPRITE_FRAGMENT`) : pendant la charge, un anneau d'énergie rouge derrière le personnage et des cailloux arrachés sous sa main ; à la frappe, une onde en croissant et un éclair devant la paume, de la poussière derrière lui. L'anneau bat comme un cœur tant que la charge dure, et un second jaillissement de cailloux précède la frappe. À l'impact, la frappe explose sur la cible (en plus de l'étincelle), l'écran flashe en blanc puis en rouge (`CinematicLayer.impactFlash`), l'arrêt sur image est long et la secousse plus forte que pour un coup normal (`GROUND.power` au-delà de 1). L'énergie clignote entre le dessin et son miroir. « Réduire les mouvements » arrête le clignotement et atténue les effets.

### Le mannequin

`DummyLayer` (`src/game/dummy/DummyLayer.ts`) est une cible fixe, posée sur le même plan du sol que le personnage. Ses deux illustrations (`../art/dummy-idle.png`, `../art/dummy-hit.png`) sont rangées côte à côte dans un seul atlas par `tools/prepare_dummy.py`.

Au repos, le dessin est coupé en deux rectangles : le socle, immobile, et le buste avec son ressort, qui bascule autour du pied du ressort. Quand il reçoit un coup (`hit(power)`), il affiche le dessin du coup reçu pendant l'arrêt sur image et un instant après, puis le buste au repos repart penché et oscille comme un ressort amorti jusqu'à se redresser (`HIT` règle l'inclinaison, la fréquence et l'amortissement). « Réduire les mouvements » ramène l'oscillation à 35 %.

### L'adversaire

`RivalLayer` (`src/game/rival/RivalLayer.ts`) est l'adversaire, un personnage original tourné vers la gauche. Il a sa garde (pose neutre, main ouverte levée), sa marche, sa parade et son coup encaissé (`../art/rival-*.png`, préparées par `tools/prepare_rival.py`), un dessin par pose, chacun avec son point posé au sol et son échelle (`POSES`). La garde et la marche sont agrandies de 10 % : il dépasse Moussa d'une demi-tête. La parade et le coup encaissé sont encore les anciens dessins, à refaire au nouveau modèle. Il respire en s'étirant depuis le sol et, quand il encaisse un coup, il affiche le dessin du coup reçu puis celui du retour, en penchant légèrement en arrière comme un ressort (`HIT`). Il n'attaque pas encore.

**Son déplacement** est une lévitation (`FLOAT`, `float`) : il ne marche pas, il s'élève légèrement et glisse. Un seul dessin par sens (`floatForward` penché vers l'avant pour avancer, `floatBack` droit pour reculer), animé en continu par le moteur : accélération et freinage en douceur, montée à `FLOAT.height` (il rase le sol), flottement sinusoïdal, inclinaison dans le sens du déplacement, ombre qui rétrécit et reflet qui pâlit. Il se repose en garde à l'arrêt. Au décollage, au changement de sens et pendant qu'il se repose, un dessin de passage (`floatStart`, droit, en l'air) s'affiche `FLOAT.bridge` secondes ; les dessins s'enchaînent sans fondu (un fondu rendait le personnage transparent un instant). Démarrage et arrêt sont rapides (`accel`, `rise`, `land`). Ces dessins sont calés sur le ceinturon de la garde, pour que le buste ne saute pas. Une première version en pas chassés, à quatre dessins qui alternaient, a été abandonnée : elle saccadait.

**Son dash avant** est une téléportation (`TELEPORT`, `teleport`), à la manière de Doom : il se baisse (`teleportCrouch`), s'efface dans un trait de vitesse (`teleportStreak`), disparaît un instant en laissant une image rémanente qui s'étire et s'estompe, réapparaît `TELEPORT.distance` plus loin (sans traverser Moussa, avec une marge, car baissé sa main dépasse), dans le trait de vitesse puis baissé, et se relève (`teleportRise`). Un coup l'interrompt. Son dash arrière est la même téléportation, en s'éloignant de Moussa de la même distance (sans sortir du stage, sans changement de côté). Pour l'instant, seul le joueur qui le contrôle peut les déclencher (deux appuis rapides vers Moussa, ou à l'opposé).

**Changement de côté.** Au corps à corps (`TELEPORT.cross`), la téléportation l'emmène dans le dos de Moussa. Le combat se calcule toujours comme si Moussa était à gauche et regardait vers la droite : quand les combattants changent de côté, `StageEngine` retourne en miroir l'affichage de leurs plans (`mirrored`, `setMirrored`, CSS `scaleX(-1)` sur les toiles du mannequin, de l'adversaire et de Moussa) et inverse la parallaxe horizontale qu'il leur passe. `HeroLayer.mirror` retourne toutes les positions de Moussa (x devient 1 - x) pour qu'il reste à la même place à l'écran, et l'adversaire se place derrière lui (`RivalLayer.landBehind`, qui pousse Moussa s'il n'y a pas la place près du bord, `HeroLayer.placeAt`). Les commandes restent dans le sens de l'écran : le moteur multiplie les directions demandées par `side` (1, ou -1 quand ils ont changé de côté). Tout revient à l'endroit à chaque nouveau round.

**Son enchaînement** (`MOVES`, `attack`, `strike`) : le coup de poing — mise en place (`punchReady`), bras armé (`punchWindup`), le bras part (`punchReach`), poing tendu (`punchHit`, la seule étape où il peut toucher), puis retour — et, sur un nouvel appui pendant le coup de poing, le coup de pied haut (`kickChamber`, `kickRaise`, `kickHit`), qui part à la fin des images actives à la place du retour, puis, sur un troisième appui, le coup de marteau (`smashRaise`, `smashSwing`, `smashHit`) : poing levé au-dessus de la tête et abattu vers le sol, plus lourd, qui touche bas ; enfin, sur un quatrième appui, l'uppercut (`upperCrouch`, `upperRise`, `upperHit`), qui touche haut ; et pour finir, sur un cinquième appui, le coup de pied de face (`pushReady`, `pushChamber`, `pushHit`), de dos, genou monté puis jambe tendue. Ces trois illustrations sont dessinées plus petit : leur échelle est de 1,4.

**Son attaque ultime** (`MOVES.ultimate`, `ultimate`, touche N) : mains tendues (`ultReady`), l'énergie se forme (`ultCharge1`) puis grossit (`ultCharge2`). Au moment où elle grossit (`takeFocus`), `StageEngine` lance la même mise au point que pour la frappe au sol de Moussa, mais centrée sur lui (`focusOn`, `FOCUS.rivalHeight`) : combat figé, zoom, lignes de vitesse, et tout sauf lui assombri (`rivalDimmed`, `ultimateActive`, jusqu'à la fin de l'attaque). Puis il se téléporte à travers l'écran juste devant Moussa (étapes `vanish` et `warp` : image rémanente au départ), frappe d'un uppercut (mêmes dessins que l'uppercut de son enchaînement : accroupi, bras armé figé 0,35 s qui touche une première fois, puis envoi qui retouche ; chaque étape active touche une fois, `landedStep`). Le premier coup porte `launch: 'pop'` : Moussa, dans le dessin `launch`, décolle un peu du sol et reste suspendu (`POP`). Le second porte `launch: 'fly'` : il est propulsé hors du haut de l'écran depuis cette hauteur (`LAUNCH`) ; il reste hors de l'écran (`LAUNCH.away`). S'il pare, ni l'un ni l'autre. Ensuite l'adversaire libère son énergie de face (`ultPower`), se baisse en la chargeant (`ultCrouch1` à `ultCrouch3`) et s'envole en un éclair (0,12 s) hors du haut de l'écran (`ultFly`, étape `takeoff`, `TAKEOFF`), avec une forte secousse de l'écran et une traînée de super vitesse (`fxStreak`, dessinée pleine pendant le décollage puis estompée pendant l'étape `trail`, alors qu'il a déjà disparu). Par-dessus, l'impact au sol du décollage éclate puis retombe en onze dessins (`fxGround1` à `fxGround11`, `GROUND_FX`, 0,055 s chacun), là où il s'est envolé. Une fois sorti (`takeTakeoff`), il reste hors de l'écran (`away`) et renvoie Moussa au sol : `HeroLayer.slam` le fait retomber du haut de l'écran en accélérant (`slamFall`), s'écraser (`slamDown`, avec cailloux, fumée et une forte secousse via `takeSlamImpact`), puis rebondir et rester un instant suspendu près du sol (`slamBounce`, réglages dans `SLAM`). Dès que Moussa flotte après le rebond (`slamHanging`), l'adversaire retombe sur lui (`dive`, dessin `ultLand`) à la vitesse de l'envol, dans la même traînée de super vitesse, et le frappe du poing : à l'impact (`takeDiveImpact`), forte secousse, et Moussa est recloué au sol (`HeroLayer.pin`, dessin `slamDown`). Pendant ce coup, Moussa reste au premier plan, devant l'adversaire. Il reste un instant sur son coup (`DIVE.hold`), puis le combat se fige pour son plan de coupe (`takeHammerCutIn`, `CinematicLayer.cutIn('rival')` : son gros plan `cutin-rival.webp` sur une bande violette, `RIVAL_CUT_IN`). Ensuite, le coup de marteau à deux mains (`HAMMER` : `hammerRaise`, `hammerSwing`, `hammerHit`, `hammerEnd`), placé pour que ses poings tombent sur Moussa ; à l'impact (`takeHammerImpact`), éclair, secousse verticale qui rebondit de moins en moins fort pendant l'explosion (`QUAKE`, dans `StageEngine`) et colonne d'énergie en douze dessins (`CinematicLayer.blast`, `BLAST`), dessinée par la cinématique pour passer devant les deux combattants, à l'endroit où frappent ses poings (`hammerX`, placé par `StageEngine` avec la même caméra, dans `blastAt`). Son gros plan est centré, le bord gauche de l'illustration estompé (`fadeLeft`). À la fin du coup (`takeFinish`), il fait un bond en arrière d'un peu plus qu'un dash (`HOP` : `hop1` à `hop8`, accroupi, en l'air, réception, redressé ; hauteur et déplacement pendant les dessins en l'air), et Moussa se relève (`HeroLayer.standUp`, `GETUP` : il reste un instant au sol, puis `getupSit`, `getupKneel`, `getupRise`, `getupGuard`) avant de reprendre sa garde : le combat continue, sans changer de round.

**Son coup spécial** (`MOVES.special`, `special`), hors enchaînement : pose (`specialStance`), amorçage (`specialChamber`), amorçage chargé d'énergie (`specialCharge`), coup de pied (`specialKick`), puis retour à l'amorçage. Pendant le coup de pied, une traînée d'énergie (`fxTrail1` à `fxTrail3`, découpés dans la planche d'effets fournie par Moussa) grandit en trois dessins puis s'estompe, son cœur calé sur la semelle ; quand le coup touche ou est paré (`land`), l'anneau (`fxRing`) et l'explosion (`fxBurst`) éclatent au même endroit (`FX`). Touche M, ou Maj quand on le contrôle. Si l'on rappuie quand le coup de pied a touché (`landedStep`), il enchaîne sa suite (`MOVES.special2`) : un coup de poing chargé (`special2Ready`, `special2Cock`, `special2Punch`, `special2Hit`) avec la même traînée d'énergie, la même explosion et la même secousse. À l'impact, l'écran tremble fortement (`takeImpact`, secousse de 2,2 comme la frappe au sol de Moussa). Il annule n'importe quel coup de l'enchaînement (`specialQueued`) : demandé pendant un coup, il part à la fin des images actives (tout de suite si elles sont passées), à la place de la suite, qu'il prend en priorité sur le coup suivant. Les dessins du coup de poing sont calés sur le centre de sa botte arrière, ceux du coup de pied sur la botte d'appui ; leur échelle ramène la distance du haut des cheveux au ceinturon à celle de la garde (la longueur des bottes puis la tête seule faisaient rapetisser le personnage). Il avance très légèrement pendant chaque coup (`advance`), sans traverser Moussa. Il le lance avec K (comme le mannequin) ou, quand on le contrôle, avec Entrée. Un coup reçu l'interrompt.

**Son comportement** (case « L'adversaire se déplace », `options.rivalMoves`) : il garde Moussa entre deux distances (`RANGE`, en plus de sa distance minimale `gap`). Trop loin, il avance ; trop près, il recule, sans dépasser `RANGE.maxX`. Il marche jusqu'au milieu de l'intervalle avant de s'arrêter. Il ne bouge pas avant le « Fight », ni en parade, et revient à sa place à chaque nouveau round (`reset`). `StageEngine` lui transmet la position de Moussa (`heroX`) à chaque image.

Tant que `options.rivalBlocks` est vrai (case « L'adversaire pare »), il passe en parade par un dessin de passage. Un coup ou une boule de feu qui l'atteint en parade est paré : `Opponent.hit` retourne vrai, l'étincelle est bleue, l'arrêt sur image deux fois plus court, la secousse plus faible et il penche à peine. Un coup paré permet quand même de poursuivre l'enchaînement, comme un coup porté.

Le mannequin et l'adversaire suivent la même interface, `Opponent` (`src/game/opponent.ts`) : position, surface du corps, distance minimale, `hit`, `attack`, `strike`. `StageEngine` ne connaît que cette interface et affiche celui que désigne `options.opponent` (case « Mannequin d'entraînement » dans `App.tsx`).

### Les coups qui touchent

C'est `StageEngine.resolveHits` qui arbitre, à chaque image :

- **Le personnage ne traverse pas le mannequin** : `HeroLayer.wall` reçoit la position la plus avancée permise (`DummyLayer.gap`), respectée par la marche et les dashs.
- **Un coup de poing touche** si, pendant ses images actives, sa portée (`HeroLayer.strike`) atteint la surface du mannequin (`DummyLayer.surface`). Un coup ne touche qu'une fois.
- **La boule de feu touche** quand son avant atteint cette surface : elle explose et disparaît (`HeroLayer.burst`).

Un coup qui touche déclenche quatre choses : le mannequin réagit, une étincelle part du point d'impact, le combat se fige un instant, et la caméra tremble. Chaque coup a sa puissance (`power`) et sa durée d'arrêt (`stop`), dans `PUNCHES` et `SPECIAL`.

- **Arrêt sur image** : pendant `stop` secondes, le personnage et le mannequin reçoivent une image de durée nulle et une horloge figée ; le décor, la météo et les étincelles continuent. Un appui sur la touche d'attaque pendant l'arrêt est bien retenu pour l'enchaînement.
- **Étincelle** : calculée par `SPARK_FRAGMENT` (`src/game/hero/shaders.ts`), une étoile à huit branches et une onde de choc. L'explosion de la boule de feu y ajoute une boule qui se dilate et s'éteint, avec un éclair au sol. `IMPACT` règle durées et tailles. Elles sont dessinées par `HeroLayer`, sur le plan du personnage, donc par-dessus le mannequin.
- **Secousse** : `SHAKE` dans `StageEngine`, proportionnelle à la puissance du coup. Elle déplace tous les plans ensemble.

« Réduire les mouvements » supprime la secousse, divise l'arrêt sur image par deux et atténue les étincelles.

### Les coups reçus

Le mannequin peut attaquer, pour tester (`DummyLayer.attack()`, touche K ou bouton « Le mannequin attaque ») : un coup de tête fait avec son dessin au repos. Il se penche en arrière, se détend vers l'avant et reste un instant au bout de sa course, où il peut toucher (`ATTACK`). Un coup reçu pendant qu'il s'arme interrompt son attaque.

Si sa tête atteint l'avant du corps du personnage (`HeroLayer.front`), `HeroLayer.takeHit` décide :

- **Coup encaissé** : tout ce que faisait le personnage est interrompu. Il affiche `hurt` puis `hurtRecover` sur place, sans être repoussé (`HURT.push` à zéro), et ne peut rien faire avant la fin (`HURT`). Étincelle rouge, arrêt sur image et secousse complets.
- **Coup paré** : s'il est en parade, debout ou accroupi, il garde sa pose sans reculer, et la parade tient encore un instant même si la touche est relâchée (`GUARD_HIT`). L'étincelle est bleue, l'arrêt sur image est deux fois plus court et la secousse plus faible.

Toucher conditionne aussi la suite de l'enchaînement :

- **Un coup dans le vide ne s'enchaîne pas** : le coup suivant ne part que si le coup en cours a touché. Sinon il va au bout de sa récupération, et l'appui suivant relance le coup léger.
- **Annulation par l'attaque spéciale** : la touche d'attaque spéciale pressée pendant un coup est retenue ; si le coup touche, la boule de feu part dès la fin de ses images actives, à la place de la récupération. Dans le vide, l'appui est perdu.

### Les changements d'état

`HeroLayer.update` ne saute jamais directement de la garde à la marche : il affiche la pose `step` pendant `STEP_SECONDS`, puis la pose d'arrivée. Ce sont des coupes franches entre trois dessins proches, comme dans une animation dessinée, sans fondu. `StageEngine.walk` reçoit la direction (1, -1 ou 0) ; `App.tsx` la pilote au clavier et avec deux boutons à maintenir.

### Limites

- Les membres de la marche sont des pièces rigides qui tournent : les plis du pantalon ne se redessinent pas et le genou marque un angle quand il plie.
- Les parties cachées (haut de la cuisse éloignée, buste sous le bras) sont des aplats sans détail.
- La marche n'utilise volontairement qu'un seul dessin. Un essai à trois dessins clés (branche `marche-poses`) a été abandonné : d'une illustration générée à l'autre, les plis, les rubans et les proportions changent, et chaque bascule se voyait comme une saccade.
- En garde, les jambes et les bras ne sont pas articulés.
- L'accroupi est un dessin entier qui respire d'un bloc : ni les bras, ni la tête, ni les rubans ne bougent séparément.
- Chaque pose a son atlas. Les images sont toutes téléchargées au démarrage (environ 26 Mo), mais seules les `MAX_ATLASES` dernières poses utilisées sont gardées en mémoire vidéo : un atlas y pèse 10 à 20 Mo, et les garder tous (plus de 250 Mo) faisait perdre le contexte WebGL. En contrepartie, la première image d'une pose pas encore utilisée peut arriver avec un léger retard.
- Le saut est fait de dessins fixes : rien ne bouge dans le dessin pendant le vol, rubans compris.
- Le mannequin est dessiné derrière le personnage : quand il se penche pour frapper, sa tête passe derrière lui au lieu de le recouvrir.
- Le personnage n'a qu'un dessin de coup encaissé, debout : touché accroupi ou en l'air, il se retrouve debout au sol. La parade ne protège pas encore selon la hauteur du coup, et ses poses de passage (`blockStep`) ne parent pas.
- Le mannequin n'a qu'un dessin de coup reçu, le même pour un coup léger au buste et un uppercut à la tête, et la zone de frappe est une simple distance : un coup porté en sautant ou accroupi toucherait de la même façon.
- Les dashs sont une pose fixe qui glisse : rien ne bouge dans le dessin pendant le déplacement. Le premier des deux appuis lance brièvement la pose intermédiaire de la marche avant que le dash parte.

Quand Moussa encaisse un coup, il alterne deux dessins d'un coup à l'autre : le coup encaissé habituel (`hurt` puis `hurtRecover`), et plié au ventre (`hurtGut`, `HeroLayer.gut`).

Quand un coup touche (ceux de Moussa comme ceux de l'adversaire), l'étincelle est dessinée : huit dessins (`fx/hit-N.webp`, `HIT_FX` dans `HeroLayer`), une étoile puis une onde qui part dans le sens du coup (vers la gauche quand c'est Moussa qui encaisse). Les parades et les explosions gardent l'étincelle calculée par le shader.

## L'interface de combat

`HudLayer` (`src/game/hud/`) tient et dessine les barres, à la manière de Street Fighter 6, Moussa à gauche et l'adversaire à droite. Elle se dessine sur la toile de la cinématique (`CinematicLayer.hud`), sous les annonces et les plans de coupe, et seulement quand les plans de l'intro ne couvrent plus l'écran.

- **Vie**, en haut, de part et d'autre du numéro de round : ancrée au centre, elle perd par l'extérieur ; la part perdue s'efface d'abord en rouge, puis rattrape la vie. Un coup retire `DAMAGE.perPower` × sa puissance (`StageEngine`) ; la retombée et le coup de marteau de l'attaque ultime de l'adversaire retirent `DAMAGE.dive` et `DAMAGE.hammer`. Seul l'adversaire a une vie, pas le mannequin.
- **Super**, en bas, depuis les bords : elle se remplit à chaque coup donné ou reçu, brille quand elle est pleine (« SUPER MAX ») et se vide quand l'attaque ultime part (`useSuper`). Pour les essais, l'attaque ultime ne demande pas encore une barre pleine.
- **Drive**, juste sous la super : quatre blocs. Une parade en coûte ; la jauge se recharge seule après un instant ; vide, elle passe en surchauffe (« BURNOUT », grise) jusqu'à être pleine. Réglages dans `HUD`.
- **K.O.** : à zéro, Moussa tombe K.O. (le K.O. habituel) ; s'il tombe à zéro pendant l'attaque ultime, il reste au sol à la fin au lieu de se relever. L'adversaire à zéro : « K.O. », il bascule en arrière, décolle un peu, retombe et reste allongé (`RivalLayer.knockOut`, `KO_FALL` : `ko1` à `ko5`, secousse quand il touche le sol), puis round suivant (`DAMAGE.koSeconds`). Les vies reviennent au plein à chaque round ; le super est gardé.

## Ajouter un plan

1. Créer une classe avec `load(): Promise<boolean>` et `draw(frame, camera, …)`.
2. Lui donner son canvas dans `StageScreen.tsx` et l'ajouter à `StageCanvases`.
3. L'instancier dans `StageEngine` et l'appeler dans `frame`, à sa place dans l'ordre de profondeur.
4. Pour qu'il suive la caméra, convertir une position `P` du décor en position écran avec `((P + profondeur × décalage) − 0,5) × zoom + 0,5`, comme dans `HeroLayer.draw`.

## Si WebGL manque

Le conteneur affiche `stage.webp` en fond CSS. Sans WebGL ou sans les images, le décor reste donc visible mais fixe, et un message l'indique sous l'écran.
