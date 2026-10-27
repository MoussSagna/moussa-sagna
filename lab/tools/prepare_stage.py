"""Prépare le décor : efface le titre incrusté et écrit la carte de profondeur.

Usage : python3 tools/prepare_stage.py decor.png
Écrit ../game/public/assets/stage/stage.webp et depth.png.

La carte est tracée à la main : les polygones ci-dessous sont en pixels de
l'image d'origine (1672 x 941) et valent pour le stage Tokyo Underground.
Canaux de depth.png : rouge = profondeur, vert = ciel, bleu = écrans.
"""
import sys
from pathlib import Path

import cv2
import numpy as np

OUT = Path(__file__).resolve().parent.parent.parent / 'game' / 'public' / 'assets' / 'stage'
TITLE_BOX = (38, 28, 392, 132)  # titre incrusté en haut à gauche, à effacer (None pour ne rien effacer)

SKY = [(560, 0), (1480, 0), (1380, 60), (1255, 125), (1125, 160), (1150, 205), (1200, 240), (1200, 258), (1140, 262),
       (1060, 240), (1060, 215), (1000, 212), (1000, 140), (970, 140), (968, 212), (935, 215), (935, 240), (872, 262),
       (835, 262), (835, 300), (790, 308), (787, 235), (757, 226), (720, 228), (700, 240), (700, 300), (660, 235),
       (640, 232), (625, 160), (600, 155), (600, 40), (560, 40)]
VIADUCT = [(430, 215), (700, 300), (1000, 400), (1190, 455), (1190, 540), (1000, 500), (700, 420), (430, 350)]
# (polygone, identifiant) : l'identifiant désynchronise les animations des écrans
SCREENS = [
    ([(547, 137), (594, 123), (594, 262), (547, 258)], 0.30),
    ([(720, 240), (756, 228), (756, 315), (720, 318)], 0.45),
    ([(774, 348), (820, 323), (820, 368), (774, 372)], 0.60),
    ([(1157, 330), (1183, 330), (1183, 415), (1157, 415)], 0.75),
    ([(1195, 302), (1212, 302), (1212, 385), (1195, 385)], 0.75),
    ([(962, 326), (1135, 268), (1137, 440), (1052, 472), (962, 400)], 1.00),
]


def main(path: str) -> None:
    image = cv2.imread(path)
    H, W = image.shape[:2]
    if TITLE_BOX:
        x0, y0, x1, y1 = TITLE_BOX
        mask = np.zeros((H, W), np.uint8)
        mask[y0:y1, x0:x1] = 255
        clean = cv2.inpaint(image, mask, 9, cv2.INPAINT_TELEA)
        soft = cv2.GaussianBlur(mask, (0, 0), 8)[..., None] / 255.0
        image = (clean * (1 - soft) + cv2.GaussianBlur(clean, (0, 0), 6) * soft).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT / 'stage.webp'), image, [cv2.IMWRITE_WEBP_QUALITY, 88])

    def poly(target: np.ndarray, points, value: float) -> None:
        cv2.fillPoly(target, [np.array(points, np.int32)], float(value))

    # profondeur, du plus lointain au plus proche
    depth = np.full((H, W), 0.03, np.float32)
    depth[120:600, 430:1250] = 0.15                      # ville
    poly(depth, SKY, 0.03)                               # ciel et lune
    poly(depth, VIADUCT, 0.32)
    for x0, y0, x1, y1 in ((520, 330, 600, 620), (790, 430, 850, 620), (880, 440, 920, 620)):
        depth[y0:y1, x0:x1] = 0.32                       # piles du viaduc
    poly(depth, [(1090, 470), (1130, 420), (1250, 330), (1130, 170), (1250, 120), (1380, 60), (1480, 0), (1672, 0), (1672, 640), (1090, 640)], 0.55)  # temple
    poly(depth, [(0, 0), (540, 0), (500, 200), (470, 230), (470, 640), (0, 640)], 0.60)  # pilier de gauche
    depth[585:690, :] = 0.62                             # rambarde
    depth[230:410, 315:410] = 0.68                       # lanterne de gauche
    depth[150:335, 1525:1615] = 0.72                     # lanterne de droite
    poly(depth, [(0, 110), (120, 120), (220, 170), (330, 260), (390, 420), (380, 500), (270, 560), (150, 640), (0, 640)], 0.75)  # cerisier
    poly(depth, [(1470, 345), (1600, 345), (1672, 420), (1672, 680), (1420, 680), (1450, 520), (1480, 500)], 0.80)  # statue
    rows = np.arange(680, H)
    depth[680:H, :] = (0.62 + (rows - 680) / (H - 680) * 0.38)[:, None]  # sol
    depth = cv2.GaussianBlur(depth, (0, 0), 9)

    sky = np.zeros((H, W), np.float32)
    poly(sky, SKY, 1.0)
    sky = cv2.GaussianBlur(sky, (0, 0), 4)

    screens = np.zeros((H, W), np.float32)
    for points, ident in SCREENS:
        poly(screens, points, ident)
    viaduct = np.zeros((H, W), np.float32)
    poly(viaduct, VIADUCT, 1.0)
    screens[(viaduct > 0) & (screens > 0.9)] = 0         # le viaduc cache le bas du grand écran

    maps = np.dstack([screens, sky, depth])              # ordre BGR d'OpenCV : R = profondeur
    cv2.imwrite(str(OUT / 'depth.png'), (cv2.resize(maps, (W // 2, H // 2), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8))
    print('écrit :', OUT / 'stage.webp', OUT / 'depth.png')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
