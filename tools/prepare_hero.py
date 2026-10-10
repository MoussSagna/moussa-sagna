"""Mesure l'ancrage du personnage de face dans la toile du rig.

Usage : python3 tools/prepare_hero.py [moussa_rig/01_base/master_repaired.png]
Affiche les mesures à reporter dans SPRITE (src/game/hero/HeroLayer.ts).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOES_TOP = 1232          # sous cette ligne, il n'y a plus que les chaussures


def main(path: Path) -> None:
    alpha = np.asarray(Image.open(path).convert('RGBA'))[:, :, 3]
    H, W = alpha.shape
    opaque = alpha > 128
    ys = np.where(opaque.any(axis=1))[0]
    feet = np.where(opaque[SHOES_TOP + 60:].any(axis=0))[0]
    print('SPRITE = {', f'width: {W}, height: {H},',
          f'anchorX: {(feet.min() + feet.max()) / 2 / W:.4f},', f'feetY: {ys.max() / H:.4f},',
          f'bodyHeight: {(ys.max() - ys.min() + 1) / H:.4f}', '}')


if __name__ == '__main__':
    if len(sys.argv) > 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]) if len(sys.argv) == 2 else ROOT / 'moussa_rig' / '01_base' / 'master_repaired.png')
