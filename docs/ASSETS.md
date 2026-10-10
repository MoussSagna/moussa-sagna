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

## Personnage : `tools/prepare_hero.py`

```bash
python3 tools/prepare_hero.py chemin/vers/image.png
```

Le script :

1. détoure le personnage (le fond est la zone claire reliée aux bords de l'image) ;
2. ajoute une marge pour que le bandeau puisse onduler sans être coupé ;
3. calcule la carte de mouvement (`hero-map.png`) ;
4. écrit `public/assets/hero/hero.webp` et `hero-map.png` ;
5. affiche les mesures à reporter dans `SPRITE`, dans `src/game/hero/HeroLayer.ts`.

Deux réglages sont propres à l'illustration actuelle et sont à revoir pour une autre image : les rectangles des gants (exclus de l'ondulation) et les hauteurs des hanches, des épaules et de la tête, en haut du script.

## Décor : `tools/prepare_stage.py`

```bash
python3 tools/prepare_stage.py chemin/vers/decor.png
```

Le script écrit `public/assets/stage/stage.webp` et `depth.png`. La carte est **tracée à la main** : le script contient les polygones de chaque plan (ciel, ville, viaduc, temple, cerisier, rambarde, sol) et des écrans, en coordonnées de l'image d'origine (1672 × 941). Un nouveau décor demande de redessiner ces polygones.

Une estimation automatique de la profondeur a été essayée et donnait un résultat trop flou sur une illustration de ce style.

## Ne pas faire

- Recompresser les cartes en JPEG ou les redimensionner dans un éditeur : chaque canal porte une information précise.
- Utiliser des planches de frames générées par IA telles quelles : les poses diffèrent trop d'une image à l'autre et l'animation tremble.
