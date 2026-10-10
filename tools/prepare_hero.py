"""Prépare le personnage : détourage, marge, carte de mouvement.

Usage : python3 tools/prepare_hero.py image.png
Écrit public/assets/hero/hero.webp, hero-map.png et hero-legs.png, puis affiche les mesures
à reporter dans SPRITE (src/game/hero/HeroLayer.ts).

Les réglages ci-dessous sont en pixels de l'image d'origine et valent pour
l'illustration actuelle (1024 x 1536). Ils sont à revoir pour une autre image.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import median_filter

GLOVES = [(250, 640, 445, 885), (765, 650, 900, 870)]  # exclus de l'ondulation
SHOES_TOP = 1240          # sous cette ligne, rien n'ondule
SHOULDERS_Y, HIPS_Y = 380, 690   # la respiration va de 1 (épaules) à 0 (hanches)
HEAD = (610, 135, 170)    # centre x, centre y, rayon
CHEST = (600, 450)        # centre du torse
# Jambes : hanche, genou, cheville. « back » est la jambe arrière (à gauche à l'écran), « front » la jambe avant.
LEG_BACK = [(500, 770), (395, 1070), (320, 1310)]
LEG_FRONT = [(700, 770), (765, 1070), (840, 1310)]
LEG_SPLIT_X = 600         # limite entre les deux jambes
LEG_FADE = (780, 920)     # au-dessus, le bassin ne suit pas les jambes
PAD_LEFT, PAD_TOP, PAD_RIGHT, PAD_BOTTOM = 110, 60, 60, 12
OUTPUT_HEIGHT = 1100
OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'hero'


def cut_out(rgb: np.ndarray) -> np.ndarray:
    """Le fond est la zone claire et peu saturée reliée aux bords de l'image."""
    mx, mn = rgb.max(axis=2).astype(int), rgb.min(axis=2).astype(int)
    light = ((mx > 170) & ((mx - mn) < 26)).astype(np.uint8)
    padded = cv2.copyMakeBorder(light, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=1)
    _, labels = cv2.connectedComponents(padded, 4)
    background = (labels == labels[0, 0])[1:-1, 1:-1]
    fg = cv2.morphologyEx((~background).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    _, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    alpha = np.where(labels == 1 + int(np.argmax(stats[1:, 4])), 255, 0).astype(np.uint8)
    alpha = cv2.erode(alpha, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    return cv2.GaussianBlur(alpha, (0, 0), 0.8)


def main(path: str) -> None:
    rgb = np.asarray(Image.open(path).convert('RGB'))
    alpha = cut_out(rgb)
    ys, xs = np.where(alpha > 40)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    c = np.zeros((y1 - y0 + PAD_TOP + PAD_BOTTOM, x1 - x0 + PAD_LEFT + PAD_RIGHT, 4), np.uint8)
    c[PAD_TOP:PAD_TOP + y1 - y0, PAD_LEFT:PAD_LEFT + x1 - x0] = np.dstack([rgb, alpha])[y0:y1, x0:x1]
    tx = lambda x: x - x0 + PAD_LEFT
    ty = lambda y: y - y0 + PAD_TOP
    H, W = c.shape[:2]
    R, G, B, A = [c[:, :, i].astype(int) for i in range(4)]
    opaque = A > 128
    red = opaque & (R > 70) & (R > 1.7 * G) & (R > 1.7 * B)
    body = opaque & ~red

    # bords gauche et droit du corps (hors tissus rouges), ligne par ligne
    left, right = np.full(H, np.nan), np.full(H, np.nan)
    for y in range(H):
        row = body[y].astype(np.uint8)
        if row.sum() < 30:
            continue
        runs = np.where(np.convolve(row, np.ones(30), 'valid') >= 28)[0]
        if len(runs):
            left[y], right[y] = runs[0], runs[-1] + 30

    def smooth(v: np.ndarray) -> np.ndarray:
        ok = ~np.isnan(v)
        return median_filter(np.interp(np.arange(H), np.where(ok)[0], v[ok]), size=41, mode='nearest')

    left, right = smooth(left), smooth(right)
    X = np.arange(W)[None, :].astype(float)
    Y = np.arange(H)[:, None].astype(float)
    # tissus libres : le poids grandit avec la distance au corps
    cloth = np.maximum(np.clip((left[:, None] - 6 - X) / 260.0, 0, 1), np.clip((X - right[:, None] - 6) / 200.0, 0, 1) * 0.45)
    for gx0, gy0, gx1, gy1 in GLOVES:
        cloth[int(ty(gy0)):int(ty(gy1)), int(tx(gx0)):int(tx(gx1))] = 0
    cloth[int(ty(SHOES_TOP)):] = 0
    cloth = cv2.GaussianBlur(cloth.astype(np.float32), (0, 0), 10)

    def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
        t = np.clip((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)

    breath = np.broadcast_to(1 - smoothstep(ty(SHOULDERS_Y), ty(HIPS_Y), Y), (H, W)).astype(np.float32)
    hx, hy, hr = HEAD
    head = np.exp(-(((X - tx(hx)) / hr) ** 2 + ((Y - ty(hy)) / hr) ** 2)).astype(np.float32)

    # étire les couleurs sous le bord adouci pour éviter un liseré clair
    colour = c[:, :, :3]
    inner = c[:, :, 3] > 200
    blur = cv2.blur(np.where(inner[..., None], colour, 0).astype(np.float32), (7, 7))
    weight = cv2.blur(inner.astype(np.float32), (7, 7))[..., None]
    c[:, :, :3] = np.where(inner[..., None], colour, np.where(weight > 0.01, blur / np.maximum(weight, 0.01), colour)).astype(np.uint8)

    scale = OUTPUT_HEIGHT / H
    w, h = int(round(W * scale)), int(round(H * scale))
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(c).resize((w, h), Image.LANCZOS).save(OUT / 'hero.webp', quality=92, method=6)
    maps = (np.clip(np.dstack([cloth, breath, head]), 0, 1) * 255).astype(np.uint8)
    Image.fromarray(cv2.resize(maps, (w // 2, h // 2), interpolation=cv2.INTER_AREA)).save(OUT / 'hero-map.png')

    # jambes : poids 0 à la hanche, 1 à la cheville et sur tout le pied (le pied reste rigide)
    def leg_weight(joints) -> np.ndarray:
        pts = [np.array([tx(x), ty(y)], float) for x, y in joints]
        lengths = [np.linalg.norm(pts[i + 1] - pts[i]) for i in range(2)]
        best_d = np.full((H, W), 1e9)
        best_s = np.zeros((H, W))
        start = 0.0
        for i in range(2):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = ((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / (ab @ ab)
            if i == 0:
                t = np.clip(t, 0, 1)
            else:
                t = np.clip(t, 0, None)  # au-delà de la cheville : le pied
            d = np.hypot(X - (a[0] + ab[0] * np.clip(t, 0, 1)), Y - (a[1] + ab[1] * np.clip(t, 0, 1)))
            s_here = (start + np.clip(t, 0, 1) * lengths[i]) / sum(lengths)
            closer = d < best_d
            best_d = np.where(closer, d, best_d)
            best_s = np.where(closer, s_here, best_s)
            start += lengths[i]
        return smoothstep(0.05, 0.95, best_s) * smoothstep(ty(LEG_FADE[0]), ty(LEG_FADE[1]), Y)

    side = smoothstep(tx(LEG_SPLIT_X) - 6, tx(LEG_SPLIT_X) + 6, X)   # 0 = jambe arrière, 1 = jambe avant
    legs = np.dstack([leg_weight(LEG_BACK) * (1 - side), leg_weight(LEG_FRONT) * side, np.zeros((H, W))])
    legs = cv2.GaussianBlur(legs.astype(np.float32), (0, 0), 5)
    Image.fromarray(cv2.resize((np.clip(legs, 0, 1) * 255).astype(np.uint8), (w // 2, h // 2), interpolation=cv2.INTER_AREA)).save(OUT / 'hero-legs.png')

    feet = np.where(opaque[int(ty(SHOES_TOP + 60)):].any(axis=0))[0]
    print('SPRITE = {', f'width: {w}, height: {h},',
          f'anchorX: {(feet.min() + feet.max()) / 2 / W:.4f},', f'feetY: {ty(y1 - 1) / H:.4f},',
          f'chestY: {ty(CHEST[1]) / H:.4f},', f'centerX: {tx(CHEST[0]) / W:.4f}', '}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
