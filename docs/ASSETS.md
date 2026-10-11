# Préparer les images

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

Le script lit `art/hero-guard.png`, `hero-step.png`, `hero-walk.png`, `hero-dash-forward.png` et `hero-dash-back.png`. Pour chacune il retire le fond vert, efface les logos des baskets (`LOGOS`), découpe le personnage d'après des polygones tracés à la main, rebouche les zones cachées par des aplats de la couleur du tissu, et écrit :

- `public/assets/hero/guard.webp`, `step.webp`, `walk.webp`, `dashForward.webp`, `dashBack.webp` : un atlas par pose, en WebP sans perte, de côtés en puissances de deux pour que le moteur puisse générer les mipmaps ;
- `src/game/hero/poseData.ts` : pour chaque pose, ses calques (place dans l'atlas et dans la toile, parent, pivot), ses articulations et son point d'appui.

Avec `--debug`, il écrit aussi une planche des calques de chaque pose pour contrôler la découpe.

Découpe actuelle :

- **garde** : rubans (deux calques), bas du corps, buste, tête ;
- **pose intermédiaire et dashs** : un seul calque chacun (liste `SINGLE`, avec l'aplomb des hanches donné à la main) ;
- **marche** : rubans (deux calques), tête, buste, hanche, bassin, deux bras, et cuisse, tibia et pied pour chaque jambe.

Pour une nouvelle illustration, il faut retracer ses polygones et ses articulations en haut du script, puis contrôler la planche de `--debug`.

`moussa_rig/`, `tools/prepare_rig.py` et `tools/rig/` sont l'ancien rig de face, que le moteur n'utilise plus. `art/hero-source.png` est l'illustration de face d'origine.

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
