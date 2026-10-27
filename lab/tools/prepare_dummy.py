"""Prépare le mannequin d'entraînement pour le moteur.

Usage (depuis lab/) : python3 tools/prepare_dummy.py
Lit, dans art/ à la racine du dépôt, dummy-idle.png et dummy-hit.png (fond vert uni, 1024 x 1536).
Écrit ../game/public/assets/dummy/dummy.webp : les deux dessins côte à côte, le repos à gauche, le coup reçu à droite.
Les rectangles des calques sont décrits dans ../game/src/dummy/DummyLayer.ts.
"""
from pathlib import Path

import numpy as np
from PIL import Image

from prepare_poses import ART, GAME, H, ROOT, W, key_green

OUT = GAME / 'public' / 'assets' / 'dummy'


def main() -> None:
    # côtés en puissances de deux, pour les mipmaps
    atlas = np.zeros((2048, 2048, 4), np.uint8)
    for index, name in enumerate(['dummy-idle.png', 'dummy-hit.png']):
        rgb = np.asarray(Image.open(ART / name).convert('RGB')).copy()
        assert rgb.shape[:2] == (H, W), name
        art = key_green(rgb)
        art[art[..., 3] == 0] = 0
        ys, xs = np.where(art[..., 3] > 0)
        print(f'{name} : x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}')
        atlas[:H, index * W:(index + 1) * W] = art
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(OUT / 'dummy.webp', lossless=True, quality=100, method=6)


if __name__ == '__main__':
    main()
