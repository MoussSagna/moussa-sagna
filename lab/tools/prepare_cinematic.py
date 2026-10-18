"""Prépare les plans de la cinématique d'entrée.

Usage (depuis lab/) : python3 tools/prepare_cinematic.py [--debug dossier]
Lit, dans art/ à la racine du dépôt, cinematic-temple.png (le temple vide), cinematic-hero.png (Moussa en pied
devant le temple), cinematic-closeup.png (gros plan) et les trois cinematic-rival-*.png (l'adversaire de dos, de
plus près, puis qui se retourne), illustrations plein cadre d'environ 1670 x 941. Lit aussi cinematic-cutin.png
(gros plan de Moussa qui charge, sur fond vert) : son fond est retiré et il est écrit en cutin.webp, avec sa
transparence, pour le plan de coupe de la frappe au sol.
Efface le logo des baskets du plan en pied, puis écrit les six plans en WebP dans public/assets/cinematic/.
Affiche aussi la position des lanternes de chaque plan, reprise à la main dans src/game/cinematic/CinematicLayer.ts.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent    # le dossier lab/
ART = ROOT.parent / 'art'
OUT = ROOT / 'public' / 'assets' / 'cinematic'
DEBUG = Path(sys.argv[sys.argv.index('--debug') + 1]) if '--debug' in sys.argv else None

# Logos de marque sur les baskets : dans chaque rectangle (x0, y0, x1, y1), serré autour du logo, les pixels
# rouges ou sombres (le logo et son contour) sont repeints d'après le panneau clair qui l'entoure.
LOGOS = {'hero': [(679, 817, 701, 843), (941, 819, 958, 843)]}


def erase_logos(rgb: np.ndarray, boxes: list) -> np.ndarray:
    mask = np.zeros(rgb.shape[:2], np.uint8)
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    red = ((r > 120) & (r - g > 60) & (r - b > 40)) | (np.maximum(np.maximum(r, g), b) < 90)
    for x0, y0, x1, y1 in boxes:
        zone = np.zeros_like(mask, bool)
        zone[y0:y1, x0:x1] = True
        mask[zone & red] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    return cv2.inpaint(rgb, mask, 3, cv2.INPAINT_TELEA)


def lanterns(rgb: np.ndarray) -> list:
    """Taches lumineuses orangées assez grandes : les lanternes, dont le moteur fait vaciller la lueur."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hot = ((hsv[..., 0] < 22) & (hsv[..., 1] > 90) & (hsv[..., 2] > 235)).astype(np.uint8)
    hot = cv2.morphologyEx(hot, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    count, _, stats, centers = cv2.connectedComponentsWithStats(hot)
    found = []
    for i in range(1, count):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 120:
            continue
        found.append((int(centers[i][0]), int(centers[i][1]), int(max(stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]))))
    return sorted(found)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ['temple', 'hero', 'closeup', 'rival-wide', 'rival-back', 'rival-turn']:
        rgb = np.asarray(Image.open(ART / f'cinematic-{name}.png').convert('RGB')).copy()
        if name in LOGOS:
            rgb = erase_logos(rgb, LOGOS[name])
        Image.fromarray(rgb).save(OUT / f'{name}.webp', quality=90, method=6)
        print(f'{name} : {rgb.shape[1]} x {rgb.shape[0]}, {(OUT / (name + ".webp")).stat().st_size / 1024:.0f} Ko')
        print('  lanternes :', lanterns(rgb))
        if DEBUG and name in LOGOS:
            DEBUG.mkdir(parents=True, exist_ok=True)
            Image.fromarray(rgb[790:860, 640:980]).resize((1360, 280), Image.NEAREST).save(DEBUG / f'{name}-baskets.png')
    cut_in()


def cut_in() -> None:
    """Les gros plans des plans de coupe (Moussa, puis l'adversaire) : fond vert retiré, transparence gardée."""
    from prepare_poses import key_green
    for name in ['cutin', 'cutin-rival']:
        rgb = np.asarray(Image.open(ART / f'cinematic-{name}.png').convert('RGB')).copy()
        art = key_green(rgb)
        art[art[..., 3] == 0] = 0
        Image.fromarray(art).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
        print(f'{name} : {art.shape[1]} x {art.shape[0]}, {(OUT / (name + ".webp")).stat().st_size / 1024:.0f} Ko')


if __name__ == '__main__':
    main()
