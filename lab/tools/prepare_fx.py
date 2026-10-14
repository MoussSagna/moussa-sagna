"""Prépare les effets dessinés : les bouffées de fumée de la sortie de fin de round, et la planche d'effets de la
frappe au sol.

Usage (depuis lab/) : python3 tools/prepare_fx.py
Lit ../art/fx-smoke.png (plusieurs bouffées côte à côte sur fond vert uni), retire le fond vert, sépare les
bouffées là où une colonne entière est vide, et écrit chacune dans public/assets/fx/smoke-N.webp, de la plus
petite à la plus grande. Affiche leur taille, reprise dans SMOKE (src/game/hero/HeroLayer.ts).
Lit aussi ../art/fx-ground-special.png (planche d'effets déjà détourée) et l'écrit telle quelle dans
public/assets/fx/ground-special.webp ; les rectangles de chaque effet sont dans FX (HeroLayer.ts).
"""
import numpy as np
from PIL import Image

from prepare_poses import ART, ROOT, key_green

OUT = ROOT / 'public' / 'assets' / 'fx'
PAD = 4


def main() -> None:
    rgb = np.asarray(Image.open(ART / 'fx-smoke.png').convert('RGB')).copy()
    art = key_green(rgb)
    art[art[..., 3] == 0] = 0
    filled = (art[..., 3] > 0).any(axis=0)
    # bouffées : suites de colonnes non vides, les plus étroites (des miettes) sont ignorées
    spans, start = [], None
    for x, on in enumerate(list(filled) + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start > 60:
                spans.append((start, x))
            start = None
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (x0, x1) in enumerate(spans, 1):
        part = art[:, x0:x1]
        ys = np.where((part[..., 3] > 0).any(axis=1))[0]
        crop = np.pad(part[ys.min():ys.max() + 1], ((PAD, PAD), (PAD, PAD), (0, 0)))
        Image.fromarray(crop).save(OUT / f'smoke-{index}.webp', lossless=True, quality=100, method=6)
        print(f'smoke-{index} : {crop.shape[1]} x {crop.shape[0]}')
    sheet = Image.open(ART / 'fx-ground-special.png').convert('RGBA')
    sheet.save(OUT / 'ground-special.webp', lossless=True, quality=100, method=6)
    print(f'ground-special : {sheet.width} x {sheet.height}')


if __name__ == '__main__':
    main()
