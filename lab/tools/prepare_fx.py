"""Prépare les effets dessinés : les bouffées de fumée de la sortie de fin de round, et la planche d'effets de la
frappe au sol.

Usage (depuis lab/) : python3 tools/prepare_fx.py
Lit ../art/fx-smoke.png (plusieurs bouffées côte à côte sur fond vert uni), retire le fond vert, sépare les
bouffées là où une colonne entière est vide, et écrit chacune dans ../game/public/assets/fx/smoke-N.webp, de la plus
petite à la plus grande. Affiche leur taille, reprise dans SMOKE (../game/src/hero/HeroLayer.ts).
Lit aussi ../art/fx-ground-special.png (planche d'effets déjà détourée) et l'écrit telle quelle dans
public/assets/fx/ground-special.webp ; les rectangles de chaque effet sont dans FX (HeroLayer.ts).
Les huit dessins de l'étincelle d'un coup qui touche (../art/fx-hit-N.png), voir `hit`.
Et les douze dessins de l'impact du coup de marteau de l'adversaire (../art/fx-hammer-N.png), voir `hammer`.
Et les 24 dessins de la boule de feu de Moussa (../art/fx-fireball.png, une planche), voir `fireball`.
"""
import numpy as np
from PIL import Image

from prepare_poses import ART, GAME, ROOT, key_green

OUT = GAME / 'public' / 'assets' / 'fx'
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

    hammer()
    hit()
    fireball()


# boule de feu de Moussa : planche de 24 dessins en trois rangées de huit, cases de largeurs inégales séparées par un
# trait vert foncé (colonnes mesurées sur ../art/fx-fireball.png), un numéro dans un rond noir en haut à gauche
FIREBALL = dict(
    rows=[(0, 294), (297, 595), (597, 887)],
    columns=[
        [0, 184, 387, 595, 816, 1041, 1268, 1518, 1774],
        [0, 213, 425, 629, 836, 1066, 1299, 1534, 1774],
        [0, 213, 425, 641, 865, 1081, 1298, 1546, 1774],
    ],
    badge=(62, 58),
    # toile commune ; le cœur blanc (l'avant de la boule) de chaque dessin y est posé en `origin`
    width=320, height=300, origin=(272, 150),
)


def fireball() -> None:
    """Les 24 dessins de la boule de feu (../art/fx-fireball.png) : 1 à 8 elle naît et grossit, 9 à 16 elle vole
    (en boucle), 17 à 24 elle se disperse. Chaque case est détourée, son numéro effacé, et posée sans changer
    d'échelle sur une toile commune, le cœur blanc en `origin`. Écrits dans ../game/public/assets/fx/fireball-N.webp."""
    sheet = np.asarray(Image.open(ART / 'fx-fireball.png').convert('RGB')).copy()
    index = 0
    for (y0, y1), columns in zip(FIREBALL['rows'], FIREBALL['columns']):
        for x0, x1 in zip(columns, columns[1:]):
            index += 1
            # 3 pixels de marge : le trait de séparation reste dehors
            cell = sheet[y0 + 3:y1 - 3, x0 + 3:x1 - 3].copy()
            bw, bh = FIREBALL['badge']
            cell[:bh, :bw] = (0, 255, 0)
            art = key_green(cell)
            art[art[..., 3] == 0] = 0
            # bords des flammes : le rouge mêlé au fond vert y vire au jaune ; la boule n'a que du rouge, du rose et
            # du blanc, où le vert ne dépasse jamais le bleu
            art[..., 1] = np.minimum(art[..., 1], art[..., 2].astype(int) + 12).astype(np.uint8)
            # le cœur : le milieu des pixels presque blancs ; à la fin, quand il n'y en a plus, le plus clair
            light = art[..., :3].astype(int).min(axis=2) * (art[..., 3] > 200)
            white = light > 230
            if white.sum() < 6:
                white = light >= max(1, light.max() - 25)
            ys, xs = np.where(white)
            core = (int(np.median(xs)), int(np.median(ys)))
            canvas = Image.new('RGBA', (FIREBALL['width'], FIREBALL['height']), (0, 0, 0, 0))
            ox, oy = FIREBALL['origin']
            piece = Image.fromarray(art)
            canvas.paste(piece, (ox - core[0], oy - core[1]))
            lost = art[..., 3].sum() - np.asarray(canvas)[..., 3].astype(int).sum()
            canvas.save(OUT / f'fireball-{index}.webp', lossless=True, quality=100, method=6)
            print(f'fireball-{index} : cœur {core}, {"rogné " + str(lost) if lost > 0 else "entier"}')


# étincelle d'un coup qui touche : toile commune, point d'impact en `origin`
HIT = dict(width=448, height=448, origin=(96, 224))


def hit() -> None:
    """Les huit dessins de l'étincelle d'un coup qui touche (../art/fx-hit-N.png, petites images à la même échelle) :
    détourés et posés sur une toile commune, sans changer d'échelle. Le premier (une étoile) est centré sur le point
    d'impact ; les suivants (la gerbe, puis l'onde qui part vers la droite) y ont leur bord gauche. Écrits dans
    ../game/public/assets/fx/hit-N.webp."""
    for index in range(1, 9):
        rgb = np.asarray(Image.open(ART / f'fx-hit-{index}.png').convert('RGB')).copy()
        # les bords des images portent parfois un trait sombre (fin de la capture) : repeints en vert
        rgb[:8] = rgb[-8:] = rgb[:, :8] = rgb[:, -8:] = (0, 255, 0)
        art = key_green(rgb)
        art[art[..., 3] == 0] = 0
        ys, xs = np.where(art[..., 3] > 0)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = Image.fromarray(art[y0:y1, x0:x1])
        ox, oy = HIT['origin']
        left = ox - crop.width // 2 if index == 1 else ox - 12
        canvas = Image.new('RGBA', (HIT['width'], HIT['height']), (0, 0, 0, 0))
        canvas.paste(crop, (left, oy - crop.height // 2))
        canvas.save(OUT / f'hit-{index}.webp', lossless=True, quality=100, method=6)
        print(f'hit-{index} : {crop.width} x {crop.height}')


# impact du coup de marteau de l'adversaire : toile commune, pied de la colonne au même point
# (assez grande pour rester nette une fois très agrandie à l'écran)
HAMMER = dict(width=1480, height=1080, ground=(740, 1070), tall=1000)


def hammer() -> None:
    """Les douze dessins de l'impact du coup de marteau (../art/fx-hammer-N.png, en hauteur ou en largeur, à des
    échelles différentes) : détourés, ramenés à la même hauteur de colonne (`tall`, sans dépasser la largeur de la
    toile) et posés avec le pied de la colonne lumineuse en `ground`, dans ../game/public/assets/fx/hammer-N.webp."""
    for index in range(1, 13):
        rgb = np.asarray(Image.open(ART / f'fx-hammer-{index}.png').convert('RGB')).copy()
        art = key_green(rgb)
        art[art[..., 3] == 0] = 0
        solid = art[..., 3] > 0
        ys, xs = np.where(solid)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        # pied de la colonne : le milieu des pixels presque blancs du bas
        low = art[y1 - (y1 - y0) // 4:y1]
        white = (low[..., :3].min(axis=2) > 225) & (low[..., 3] > 200)
        foot = int(np.median(np.where(white)[1])) if white.any() else (x0 + x1) // 2
        k = HAMMER['tall'] / (y1 - y0)
        half = max(foot - x0, x1 - foot)
        k = min(k, (HAMMER['width'] / 2 - 4) / half)
        crop = Image.fromarray(art[y0:y1, x0:x1])
        crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
        canvas = Image.new('RGBA', (HAMMER['width'], HAMMER['height']), (0, 0, 0, 0))
        gx, gy = HAMMER['ground']
        canvas.paste(crop, (round(gx - (foot - x0) * k), gy - crop.height))
        canvas.save(OUT / f'hammer-{index}.webp', quality=90, method=6)
        print(f'hammer-{index} : échelle {k:.2f}, {(OUT / f"hammer-{index}.webp").stat().st_size / 1024:.0f} Ko')


if __name__ == '__main__':
    main()
