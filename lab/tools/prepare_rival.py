"""Prépare les illustrations de l'adversaire pour le moteur.

Usage (depuis lab/) : python3 tools/prepare_rival.py
Lit, dans art/ à la racine du dépôt, les rival-*.png (fond vert uni, 1024 x 1536, personnage tourné vers la gauche).
Écrit une image par pose dans public/assets/rival/, sur une toile de 1024 x 2048 (le dessin occupe le haut).
Le point posé au sol et les réglages de chaque pose sont dans src/game/rival/RivalLayer.ts.
"""
import numpy as np
from PIL import Image

from prepare_poses import ART, H, ROOT, W, key_green

OUT = ROOT / 'public' / 'assets' / 'rival'
# largeur, en pixels, de l'estompage d'un dessin coupé par le bord droit de l'illustration
EDGE_FADE = 140
# dessins dont la botte d'appui est coupée par le bord droit : pas d'estompage
NO_EDGE_FADE = {'smash-raise', 'smash-swing', 'smash-hit', 'fx-trail-1', 'fx-trail-2', 'fx-trail-3', 'fx-burst', 'fx-ring', 'ult-ready', 'ult-charge-1', 'ult-charge-2', 'special2-ready', 'special2-cock', 'special2-punch', 'special2-hit', 'ult-power', 'ult-crouch-1', 'ult-crouch-2', 'ult-crouch-3', 'ult-fly', 'ult-land', 'hammer-raise', 'hammer-swing', 'hammer-hit', 'hammer-end', 'hop-1', 'hop-2', 'hop-3', 'hop-4', 'hop-5', 'hop-6', 'hop-7', 'hop-8', 'ko-1', 'ko-2', 'ko-3', 'ko-4', 'ko-5'}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(ART.glob('rival-*.png')):
        image = Image.open(path).convert('RGB')
        # illustration en largeur (personnage allongé) : réduite à la largeur de la toile et posée en bas, sur un fond
        # du même vert
        if image.size == (H, W):
            canvas = Image.new('RGB', (W, H), image.getpixel((4, 4)))
            canvas.paste(image.resize((W, W * W // H), Image.LANCZOS), (0, H - W * W // H))
            image = canvas
        rgb = np.asarray(image).copy()
        assert rgb.shape[:2] == (H, W), path.name
        name = path.stem.removeprefix('rival-')
        art = key_green(rgb)
        # dessin coupé par le bord droit de l'illustration (traits de vitesse, pan du manteau) : on l'estompe
        # sur les dernières colonnes, pour qu'il ne s'arrête pas sur une ligne droite
        # sauf quand c'est la botte d'appui qui touche le bord (coup de marteau) : l'estomper la ferait disparaître
        if (art[:, -1, 3] > 128).sum() > 20 and name not in NO_EDGE_FADE:
            ramp = np.clip(np.arange(W)[::-1] / EDGE_FADE, 0, 1) ** 1.5
            art[..., 3] = (art[..., 3] * ramp[None, :]).astype(np.uint8)
            art[..., :3] = (art[..., :3] * ramp[None, :, None]).astype(np.uint8)
        art[art[..., 3] == 0] = 0
        # côtés en puissances de deux, pour les mipmaps
        atlas = np.zeros((2048, W, 4), np.uint8)
        atlas[:H] = art
        name = path.stem.removeprefix('rival-')
        Image.fromarray(atlas).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
        solid = art[..., 3] > 128
        ys, xs = np.where(solid)
        low = np.where(solid[ys.max() - 150:].any(axis=0))[0]
        print(f'{name} : x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, appuis x {low.min()}-{low.max()}')
        for y in range(300, 1300, 100):
            # une pose baissée n'a rien sur les premières lignes
            if solid[y].any():
                print(f'    y {y} : bord gauche {np.where(solid[y])[0].min()}')


if __name__ == '__main__':
    main()
