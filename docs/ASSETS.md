# Préparer les images

Les scripts de `tools/` demandent Python 3 avec `pillow`, `numpy`, `opencv-python` et `scipy`.

## Ce qu'il faut fournir

**Un personnage**
- une seule image en pied, dans la pose voulue ;
- au moins 1000 px de haut ;
- sur fond transparent, ou à défaut sur un fond clair et uni (le faux damier de transparence fonctionne, un fond sombre non) ;
- les tissus libres (bandeau, lanières) bien détachés du corps.

**Un décor**
- une image large (16:9 environ), sans personnage ni texte incrusté.

## Personnage

Le personnage affiché est le rig en calques de `moussa_rig/`. Trois scripts le préparent, dans cet ordre.

### 1. Calques : `tools/prepare_rig.py`

```bash
python3 tools/prepare_rig.py moussa_rigging_stage/00_MOUSSA_MASTER_UNTOUCHED.png
```

Le script répare une copie du maître, la découpe en 17 calques avec zones de recouvrement, simule la respiration pour contrôler trous et raccords, et écrit le tout dans `moussa_rig/`. L'organisation des calques, les pivots et ce qui reste à faire sont décrits dans `moussa_rig/README.md`. À relancer seulement si l'illustration ou la découpe change.

### 2. Atlas et données : `tools/pack_rig.py`

```bash
python3 tools/pack_rig.py
```

Le script lit `moussa_rig/rig.json` et `moussa_rig/02_calques/`, recadre chaque calque sur sa boîte englobante avec 8 pixels de marge transparente, et écrit :

- `public/assets/hero/rig-atlas.webp` : l'atlas, en WebP sans perte, 2048 × 2048 pour que le moteur puisse générer les mipmaps ;
- `src/game/hero/rigData.ts` : pour chaque calque, sa place dans l'atlas et dans la toile, son parent, son pivot et son mouvement.

`rigData.ts` est généré : pour changer un pivot ou une amplitude, modifier `rig.json` (ou `tools/rig/simulate.py`, qui l'écrit) puis relancer le script.

### 3. Ancrage : `tools/prepare_hero.py`

```bash
python3 tools/prepare_hero.py
```

Le script affiche les mesures à reporter dans `SPRITE`, dans `src/game/hero/HeroLayer.ts`.

`art/hero-source.png` est l'ancienne illustration sur fond clair, utilisée avant le rig. Elle n'est plus lue par aucun script et n'est pas dans le même repère que le maître : elle est resserrée d'environ 5 % en largeur.

## Décor : `tools/prepare_stage.py`

```bash
python3 tools/prepare_stage.py chemin/vers/decor.png
```

Le script écrit `public/assets/stage/stage.webp` et `depth.png`. La carte est **tracée à la main** : le script contient les polygones de chaque plan (ciel, ville, viaduc, temple, cerisier, rambarde, sol) et des écrans, en coordonnées de l'image d'origine (1672 × 941). Un nouveau décor demande de redessiner ces polygones.

Une estimation automatique de la profondeur a été essayée et donnait un résultat trop flou sur une illustration de ce style.

## Rig de marche : `tools/prepare_walk.py`

```bash
python3 tools/prepare_walk.py [--debug dossier]
```

Le script part de `art/hero-walk-source.png`, une illustration de profil sur fond vert uni (1024 × 1536). Il retire le fond, découpe le personnage en 13 calques d'après des polygones tracés à la main, rebouche les zones cachées par des aplats de la couleur du tissu, puis écrit `public/assets/hero/walk-atlas.webp` et `src/game/hero/walkData.ts`. Avec `--debug`, il écrit aussi une planche des calques pour contrôler la découpe.

Pour une nouvelle illustration de profil : fond vert uni sans ombre, jambes écartées qui ne se chevauchent pas sous le genou, mains écartées du corps. Il faut alors retracer `POLY`, `FILL` et `JOINTS` en haut du script.

## Ne pas faire

- Recompresser les cartes en JPEG ou les redimensionner dans un éditeur : chaque canal porte une information précise.
- Recompresser l'atlas avec perte ou modifier `rigData.ts` à la main.
- Utiliser des planches de frames générées par IA telles quelles : les poses diffèrent trop d'une image à l'autre et l'animation tremble.
