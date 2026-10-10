"""Prépare la carte des jambes du personnage et mesure son ancrage.

Usage : python3 tools/prepare_hero.py [moussa_rig/01_base/master_repaired.png]
Écrit public/assets/hero/hero-legs.png, puis affiche les mesures à reporter dans SPRITE
(src/game/hero/HeroLayer.ts).

Tout est exprimé dans la toile du rig (1024 x 1536, repère du maître). Les réglages
ci-dessous valent pour l'illustration actuelle et sont à revoir pour une autre image.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOES_TOP = 1232          # sous cette ligne, il n'y a plus que les chaussures
# Jambes : hanche, genou, cheville. « back » est la jambe arrière (à gauche à l'écran), « front » la jambe avant.
LEG_BACK = [(512, 761), (398, 1062), (317, 1303)]
LEG_FRONT = [(722, 761), (786, 1062), (862, 1303)]
LEG_SPLIT_X = 615         # limite entre les deux jambes
LEG_FADE = (771, 911)     # au-dessus, le bassin ne suit pas les jambes
OUT = ROOT / 'public' / 'assets' / 'hero'


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main(path: Path) -> None:
    alpha = np.asarray(Image.open(path).convert('RGBA'))[:, :, 3]
    H, W = alpha.shape
    opaque = alpha > 128
    X = np.arange(W)[None, :].astype(float)
    Y = np.arange(H)[:, None].astype(float)

    # jambes : poids 0 à la hanche, 1 à la cheville et sur tout le pied (le pied reste rigide)
    def leg_weight(joints) -> np.ndarray:
        pts = [np.array(p, float) for p in joints]
        lengths = [np.linalg.norm(pts[i + 1] - pts[i]) for i in range(2)]
        best_d = np.full((H, W), 1e9)
        best_s = np.zeros((H, W))
        start = 0.0
        for i in range(2):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = ((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / (ab @ ab)
            d = np.hypot(X - (a[0] + ab[0] * np.clip(t, 0, 1)), Y - (a[1] + ab[1] * np.clip(t, 0, 1)))
            s_here = (start + np.clip(t, 0, 1) * lengths[i]) / sum(lengths)
            closer = d < best_d
            best_d = np.where(closer, d, best_d)
            best_s = np.where(closer, s_here, best_s)
            start += lengths[i]
        return smoothstep(0.05, 0.95, best_s) * smoothstep(LEG_FADE[0], LEG_FADE[1], Y)

    side = smoothstep(LEG_SPLIT_X - 6, LEG_SPLIT_X + 6, X)   # 0 = jambe arrière, 1 = jambe avant
    legs = np.dstack([leg_weight(LEG_BACK) * (1 - side), leg_weight(LEG_FRONT) * side, np.zeros((H, W))])
    legs = cv2.GaussianBlur(legs.astype(np.float32), (0, 0), 5)
    OUT.mkdir(parents=True, exist_ok=True)
    half = cv2.resize((np.clip(legs, 0, 1) * 255).astype(np.uint8), (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    Image.fromarray(half).save(OUT / 'hero-legs.png')

    ys = np.where(opaque.any(axis=1))[0]
    feet = np.where(opaque[SHOES_TOP + 60:].any(axis=0))[0]
    print('SPRITE = {', f'width: {W}, height: {H},',
          f'anchorX: {(feet.min() + feet.max()) / 2 / W:.4f},', f'feetY: {ys.max() / H:.4f},',
          f'bodyHeight: {(ys.max() - ys.min() + 1) / H:.4f}', '}')


if __name__ == '__main__':
    if len(sys.argv) > 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]) if len(sys.argv) == 2 else ROOT / 'moussa_rig' / '01_base' / 'master_repaired.png')
