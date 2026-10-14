# Préparer les images

Les chemins sont relatifs à `lab/` et les scripts se lancent depuis `lab/`. Les illustrations sources sont dans `art/`, à la racine du dépôt, pour servir aussi au folio.

Les scripts de `tools/` demandent Python 3 avec `pillow`, `numpy`, `opencv-python` et `scipy`.

## Ce qu'il faut fournir

**Une pose du personnage**
- une seule image en pied, 1024 × 1536, une seule pose ;
- fond vert uni `#00FF00`, sans ombre, sans dégradé ni faux damier, et aucun vert sur le personnage ;
- la même vue que les autres poses (trois quarts à profil, tourné vers la droite) et la même taille de tête ;
- les jambes écartées, qui ne se chevauchent pas sous le genou, et les mains écartées du corps ;
- les rubans du bandeau vers l'arrière, détachés du corps ;
- aucun logo de marque sur les baskets.

**Un décor**
- une image large (16:9 environ), sans personnage ni texte incrusté.

## Personnage : `tools/prepare_poses.py`

```bash
python3 tools/prepare_poses.py [--debug dossier]
```

Le script lit `../art/hero-guard.png`, `hero-step.png`, `hero-walk.png`, `hero-dash-forward.png`, `hero-dash-back.png`, `hero-crouch-step.png`, `hero-crouch.png`, `hero-block-step.png`, `hero-block.png`, `hero-crouch-block.png`, les quatre `hero-jump-*.png` les neuf `hero-punch-*.png`, les six `hero-special-*.png` et les deux `hero-hurt*.png`, les trois `hero-ground-*.png`, les quatre `hero-ko-*.png` et les quatre `hero-exit-*.png` et les deux `hero-kick-*.png`. Les logos rouges sur panneau blanc (`RED_LOGOS`) sont repeints d'après leur voisinage. Pour chacune il retire le fond vert (dont il mesure la teinte dans un coin, parce qu'elle varie d'une image générée à l'autre), efface les logos des baskets (`LOGOS` pour les logos sombres, `FAINT_LOGOS` pour ceux en relief pâle), découpe le personnage d'après des polygones tracés à la main, rebouche les zones cachées par des aplats de la couleur du tissu, et écrit :

- `public/assets/hero/guard.webp`, `step.webp`, `walk.webp`, `dashForward.webp`, `dashBack.webp`, `crouchStep.webp`, `crouch.webp`, `blockStep.webp`, `block.webp`, `crouchBlock.webp`, `jumpStart.webp`, `jumpRise.webp`, `jumpPeak.webp`, `jumpLand.webp`, `punchStart.webp`, `punchHit.webp`, `punchChain1.webp`, `punchChain2.webp`, `punchHeavyStart.webp`, `punchHeavyHit.webp`, `punchHeavyRecover.webp`, `punchMidHit.webp`, `punchMidRecover.webp` : un atlas par pose, en WebP sans perte, de côtés en puissances de deux pour que le moteur puisse générer les mipmaps ;
- `src/game/hero/poseData.ts` : pour chaque pose, ses calques (place dans l'atlas et dans la toile, parent, pivot), ses articulations et son point d'appui.

Avec `--debug`, il écrit aussi une planche des calques de chaque pose pour contrôler la découpe.

Découpe actuelle :

- **garde** : rubans (deux calques), bas du corps, buste, tête ;
- **pose intermédiaire, dashs, mi-descente, accroupi, parades et saut** : un seul calque chacun (liste `SINGLE`, avec l'aplomb des hanches donné à la main) ;
- **marche** : rubans (deux calques), tête, buste, hanche, bassin, deux bras, et cuisse, tibia et pied pour chaque jambe.
- **coup de poing léger** : un seul calque par dessin, calé sur le pied arrière de la garde (valeur dans `SINGLE`).
- **coup de poing moyen** : le haut du corps de l'illustration, posé sur les jambes et le ruban de hanche de la garde (`ON_GUARD_LEGS`, d'après la position de la boucle de ceinture).

Pour une nouvelle illustration, il faut retracer ses polygones et ses articulations en haut du script, puis contrôler la planche de `--debug`.

`moussa_rig/`, `tools/prepare_rig.py` et `tools/rig/` sont l'ancien rig de face, que le moteur n'utilise plus. `../art/hero-source.png` est l'illustration de face d'origine.

## Mannequin : `tools/prepare_dummy.py`

```bash
python3 tools/prepare_dummy.py
```

Le script lit `../art/dummy-idle.png` (au repos) et `../art/dummy-hit.png` (coup reçu), retire le fond vert et écrit `public/assets/dummy/dummy.webp` : les deux dessins côte à côte, chacun sur sa toile de 1024 × 1536. Les deux illustrations doivent avoir le socle exactement au même endroit, et le mannequin tourné vers la gauche. Les rectangles du socle et du buste, le pivot du ressort et le point posé au sol sont dans `ATLAS`, en haut de `src/game/dummy/DummyLayer.ts` : à reprendre si l'illustration change.

## Fumée : `tools/prepare_fx.py`

```bash
python3 tools/prepare_fx.py
```

Le script lit `../art/fx-smoke.png` (des bouffées côte à côte sur fond vert, de la plus petite à la plus grande), retire le fond vert, sépare les bouffées aux colonnes vides et écrit `public/assets/fx/smoke-1.webp` à `smoke-4.webp`. Il recopie aussi `../art/fx-ground-special.png` (planche d'effets déjà détourée) en `public/assets/fx/ground-special.webp`. Leurs tailles, qu'il affiche, sont reprises dans `SMOKE` (`src/game/hero/HeroLayer.ts`).

## Cinématique : `tools/prepare_cinematic.py`

```bash
python3 tools/prepare_cinematic.py [--debug dossier]
```

Le script lit `../art/cinematic-temple.png`, `cinematic-hero.png`, `cinematic-closeup.png` et les trois `cinematic-rival-*.png` (illustrations plein cadre, environ 1670 × 941), efface le logo des baskets du plan en pied (rectangles `LOGOS`, serrés autour de chaque logo) et écrit les six plans, plus le gros plan du plan de coupe (`../art/cinematic-cutin.png`, fond vert retiré, en `cutin.webp` avec sa transparence), en WebP dans `public/assets/cinematic/`. Il affiche aussi les taches lumineuses de chaque plan : les positions des lanternes reprises à la main dans `SHOTS` (`src/game/cinematic/CinematicLayer.ts`). Avec `--debug`, il écrit un agrandissement des baskets pour contrôler l'effacement.

## Adversaire : `tools/prepare_rival.py`

```bash
python3 tools/prepare_rival.py
```

Le script lit tous les `../art/rival-*.png` (personnage tourné vers la gauche, mêmes contraintes que les poses du personnage), retire le fond vert et écrit une image par pose dans `public/assets/rival/`. Il affiche aussi l'étendue des appuis et le bord avant du corps, qui servent à régler le point posé au sol, `surface` et `gap` dans `src/game/rival/RivalLayer.ts`.

## Décor : `tools/prepare_stage.py`

```bash
python3 tools/prepare_stage.py chemin/vers/decor.png
```

Le script écrit `public/assets/stage/stage.webp` et `depth.png`. La carte est **tracée à la main** : le script contient les polygones de chaque plan (ciel, ville, viaduc, temple, cerisier, rambarde, sol) et des écrans, en coordonnées de l'image d'origine (1672 × 941). Un nouveau décor demande de redessiner ces polygones.

Une estimation automatique de la profondeur a été essayée et donnait un résultat trop flou sur une illustration de ce style.

## Ne pas faire

- Recompresser les cartes en JPEG ou les redimensionner dans un éditeur : chaque canal porte une information précise.
- Recompresser un atlas avec perte ou modifier `poseData.ts` à la main.
- Mélanger des poses dessinées sous des angles différents : le personnage saute à chaque changement d'état.
- Utiliser des planches de frames générées par IA telles quelles : les poses diffèrent trop d'une image à l'autre et l'animation tremble.
