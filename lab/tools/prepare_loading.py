"""Prépare l'écran de chargement.

Usage (depuis lab/) : python3 tools/prepare_loading.py
Lit, dans art/ à la racine du dépôt, loading-bg.png (le fond, 1672 x 941), loading-hero.png et loading-rival.png
(les deux combattants en pied, sur fond vert uni, 1024 x 1536). Efface les logos des baskets de Moussa, retire le
fond vert, recadre au plus juste et écrit le tout dans public/assets/loading/.
"""
import cv2
import numpy as np
from PIL import Image

from prepare_poses import ART, ROOT, key_green

OUT = ROOT / 'public' / 'assets' / 'loading'
# logos rouges sur le panneau blanc des baskets : les pixels rouges sont repeints d'après leur voisinage
RED_LOGOS = [(784, 1362, 850, 1418), (95, 1362, 118, 1396)]
# petits logos clairs sur la languette noire des deux baskets : les pixels clairs sont repeints d'après le noir
LIGHT_LOGOS = [(832, 1312, 872, 1338), (158, 1298, 190, 1328)]


def inpaint(rgb: np.ndarray, boxes: list, pick) -> np.ndarray:
    for x0, y0, x1, y1 in boxes:
        zone = rgb[y0:y1, x0:x1].astype(int)
        mask = np.zeros(rgb.shape[:2], np.uint8)
        mask[y0:y1, x0:x1][pick(zone)] = 255
        mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
        rgb = cv2.inpaint(rgb, mask, 4, cv2.INPAINT_TELEA)
    return rgb


def fighter(name: str, logos: bool) -> None:
    rgb = np.asarray(Image.open(ART / f'loading-{name}.png').convert('RGB')).copy()
    if logos:
        rgb = inpaint(rgb, RED_LOGOS, lambda z: (z[..., 0] > 80) & (z[..., 0] - z[..., 1] > 35) & (z[..., 0] - z[..., 2] > 25))
        rgb = inpaint(rgb, LIGHT_LOGOS, lambda z: z.min(axis=2) > 130)
    art = key_green(rgb)
    art[art[..., 3] == 0] = 0
    ys, xs = np.where(art[..., 3] > 0)
    crop = art[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
    Image.fromarray(crop).save(OUT / f'{name}.webp', quality=90, method=6)
    print(f'{name} : {crop.shape[1]} x {crop.shape[0]}, {(OUT / (name + ".webp")).stat().st_size / 1024:.0f} Ko')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    background = Image.open(ART / 'loading-bg.png').convert('RGB')
    background.save(OUT / 'bg.webp', quality=86, method=6)
    print(f'bg : {background.width} x {background.height}, {(OUT / "bg.webp").stat().st_size / 1024:.0f} Ko')
    fighter('hero', True)
    fighter('rival', False)


if __name__ == '__main__':
    main()
