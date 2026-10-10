"""Découpe l'illustration de profil en calques articulés pour la marche.

Usage : python3 tools/prepare_walk.py [--debug dossier]
Lit art/hero-walk-source.png (fond vert uni), écrit public/assets/hero/walk-atlas.webp
et src/game/hero/walkData.ts. Les polygones sont tracés à la main pour cette illustration.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art' / 'hero-walk-source.png'
ATLAS = ROOT / 'public' / 'assets' / 'hero' / 'walk-atlas.webp'
DATA = ROOT / 'src' / 'game' / 'hero' / 'walkData.ts'
DEBUG = Path(sys.argv[sys.argv.index('--debug') + 1]) if '--debug' in sys.argv else None
PAD, ATLAS_WIDTH = 8, 2048
W, H = 1024, 1536

# Articulations, en pixels de l'illustration. « near » = côté proche (jambe avant, bras arrière).
JOINTS = dict(
    hip_near=(610, 800), knee_near=(735, 1050), ankle_near=(800, 1310),
    hip_far=(590, 800), knee_far=(410, 1085), ankle_far=(215, 1270),
    shoulder_near=(480, 390), shoulder_far=(670, 450), neck=(650, 270), ribbon=(548, 200),
)

# Polygones de découpe, du plus prioritaire au moins prioritaire.
POLY = dict(
    head=[(530, 60), (850, 60), (850, 285), (715, 272), (692, 288), (648, 300), (612, 282), (590, 262), (560, 250), (540, 215), (548, 150)],
    arm_near=[(445, 315), (525, 350), (545, 450), (528, 545), (478, 612), (440, 655), (396, 668), (400, 720), (400, 790), (402, 905), (290, 905), (236, 822), (268, 700), (322, 642), (292, 570), (318, 440), (380, 360)],
    arm_far=[(706, 522), (760, 540), (805, 635), (965, 770), (968, 915), (835, 915), (775, 762), (745, 692), (714, 657), (706, 600)],
    foot_near=[(690, 1282), (745, 1302), (850, 1294), (885, 1276), (1024, 1380), (1024, 1500), (690, 1500)],
    foot_far=[(130, 1200), (192, 1205), (236, 1268), (302, 1268), (330, 1500), (10, 1500), (10, 1270)],
    hip=[(430, 772), (470, 766), (500, 800), (560, 792), (640, 762), (668, 748), (650, 800), (628, 880), (612, 960), (600, 1015), (560, 1012), (525, 1100), (500, 1100), (440, 965), (425, 900)],
    thigh_near=[(430, 772), (470, 766), (500, 800), (560, 792), (640, 762), (700, 738), (745, 700), (800, 790), (870, 1000), (885, 1090), (790, 1100), (772, 1112), (722, 1112), (700, 1092), (625, 1085), (612, 1018), (560, 1012), (525, 1100), (500, 1100), (440, 965), (425, 900)],
    shin_near=[(612, 1080), (900, 1080), (900, 1300), (612, 1300)],
    thigh_far=[(300, 960), (445, 960), (620, 1020), (486, 1150), (334, 1020)],
    shin_far=[(334, 1020), (486, 1150), (420, 1290), (180, 1290), (150, 1100)],
)
# Zones cachées à reboucher, par calque.
FILL = dict(
    torso=[(450, 330), (540, 350), (562, 600), (560, 700), (440, 745), (432, 640), (428, 560), (432, 430)],
    ribbons=[(322, 575), (300, 640), (262, 760), (232, 850), (256, 862), (290, 780), (326, 662), (338, 600)],
    thigh_near=[(430, 772), (470, 766), (500, 800), (560, 792), (640, 762), (700, 738), (745, 700), (735, 660), (640, 715), (560, 745), (500, 752), (455, 725), (425, 735)],
    hip=[(430, 772), (470, 766), (500, 800), (560, 792), (640, 762), (700, 738), (745, 700), (735, 660), (640, 715), (560, 745), (500, 752), (455, 725), (425, 735)],
    shin_near=[(625, 1085), (700, 1092), (722, 1112), (772, 1112), (790, 1100), (885, 1090), (875, 1020), (640, 1015)],
    shin_far=[(334, 1020), (486, 1150), (530, 1100), (390, 975)],
    foot_near=[(690, 1282), (745, 1302), (850, 1294), (885, 1276), (870, 1250), (720, 1255)],
    foot_far=[(130, 1200), (192, 1205), (236, 1268), (302, 1268), (300, 1230), (215, 1180), (140, 1170)],
)
# Cuisses : la partie cachée est une forme arrondie le long de l'os, de la hanche au genou (début, fin, épaisseur).
CAPSULE = dict(thigh_near=((610, 805), (735, 1050), 200), thigh_far=((590, 810), (410, 1085), 180))
ORDER = ['ribbons', 'arm_far', 'pelvis', 'foot_far', 'shin_far', 'thigh_far', 'foot_near', 'shin_near', 'thigh_near', 'hip', 'torso', 'head', 'arm_near']
PARENT = dict(hip='torso', ribbons='head', arm_far='torso', pelvis='torso', head='torso', arm_near='torso', torso=None,
              thigh_near='torso', shin_near='thigh_near', foot_near='shin_near', thigh_far='torso', shin_far='thigh_far', foot_far='shin_far')
PIVOT = dict(hip='hip_near', ribbons='ribbon', arm_far='shoulder_far', pelvis='hip_near', head='neck', arm_near='shoulder_near', torso='hip_near',
             thigh_near='hip_near', shin_near='knee_near', foot_near='ankle_near', thigh_far='hip_far', shin_far='knee_far', foot_far='ankle_far')


def poly(points) -> np.ndarray:
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 1)
    return m.astype(bool)


def key_green(rgb: np.ndarray) -> np.ndarray:
    """Retire le fond vert : alpha d'après l'excès de vert, puis couleur débarrassée du vert qui bave."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    excess = g - np.maximum(r, b)
    alpha = 1 - np.clip((excess - 40) / 150, 0, 1)
    bg = np.array([4, 248, 3], np.float32)
    a = np.maximum(alpha, 0.02)[..., None]
    col = np.clip((f - (1 - a) * bg) / a, 0, 255)
    col[..., 1] = np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]))
    alpha[alpha < 0.06] = 0
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def fill_hidden(layer: np.ndarray, region: np.ndarray, color: np.ndarray) -> None:
    """Rebouche une zone cachée avec un aplat de la couleur du tissu (matière inventée, sans pli ni trait)."""
    hole = region & (layer[..., 3] < 250)
    a = layer[..., 3:].astype(np.float32) / 255
    mixed = layer[..., :3] * a + color * (1 - a)
    layer[hole, :3] = mixed[hole].astype(np.uint8)
    layer[hole, 3] = 255


def main() -> None:
    src = np.asarray(Image.open(SOURCE).convert('RGB'))
    assert src.shape[:2] == (H, W)
    art = key_green(src)
    vis = art[..., 3] > 0
    r, g, b = [art[..., i].astype(int) for i in range(3)]
    red = vis & (r > 110) & (g < 0.45 * r) & (b < 0.5 * r)

    label = np.full((H, W), -1, np.int16)
    names = list(POLY)
    for i, name in reversed(list(enumerate(names))):
        label[poly(POLY[name]) & vis] = i
    # les rubans : tout ce qui est rouge à gauche du corps, y compris les brins pris dans un polygone voisin
    left = poly([(0, 100), (548, 100), (548, 215), (520, 250), (440, 318), (378, 360), (316, 440), (290, 570), (320, 642), (266, 700), (240, 822), (300, 880), (300, 1010), (0, 1010)])
    wide = poly([(0, 100), (548, 100), (548, 215), (520, 250), (470, 318), (420, 400), (420, 1010), (0, 1010)])
    ribbons = vis & (label < 0) & (left | (wide & red) | poly([(0, 100), (300, 100), (300, 1010), (0, 1010)]))
    arm = label == names.index('arm_near')
    ribbons |= red & arm & (poly([(250, 520), (335, 520), (335, 650), (250, 650)]) | poly([(300, 300), (425, 300), (425, 375), (300, 375)]))
    ribbons |= red & poly([(380, 150), (552, 150), (552, 215), (380, 260)])
    label[red & (label == names.index('thigh_far')) & poly([(300, 930), (455, 930), (455, 1040), (300, 1040)])] = names.index('hip')
    label[(label < 0) & ~ribbons & vis & poly([(300, 940), (640, 940), (640, 1300), (300, 1300)])] = names.index('thigh_far')
    layers = {}
    for i, name in enumerate(names):
        m = (label == i) & ~ribbons
        layers[name] = art * m[..., None]
    layers['ribbons'] = art * ribbons[..., None]
    rest = vis & (label < 0) & ~ribbons
    layers['torso'] = art * rest[..., None]

    def cloth(points) -> np.ndarray:
        return np.median(art[poly(points) & ~red & vis][:, :3], axis=0)
    pants = cloth([(480, 860), (560, 860), (560, 960), (480, 960)])
    tone = dict(torso=cloth([(450, 620), (540, 620), (540, 700), (450, 700)]), ribbons=np.median(art[ribbons & red][:, :3], axis=0))
    for name, pts in FILL.items():
        fill_hidden(layers[name], poly(pts) & vis, tone.get(name, pants))
    for name, (start, end, thick) in CAPSULE.items():
        shape = np.zeros((H, W), np.uint8)
        cv2.line(shape, start, end, 1, thick, cv2.LINE_AA)
        fill_hidden(layers[name], shape.astype(bool) & (vis | (name == 'thigh_far')), pants)
    # bassin : une masse sombre sous les deux cuisses, pour qu'aucun jour n'apparaisse quand elles s'écartent
    pelvis = np.zeros((H, W, 4), np.uint8)
    mask = np.zeros((H, W), np.uint8)
    cv2.ellipse(mask, (585, 880), (135, 125), 0, 0, 360, 255, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
    pelvis[..., :3] = pants
    pelvis[..., 3] = mask
    layers['pelvis'] = pelvis
    # la coupe du genou tombe en plein tissu : fondu sur le bord bas des cuisses
    for name, (p0, p1) in dict(thigh_near=((625, 1085), (885, 1090)), thigh_far=((334, 1020), (486, 1150))).items():
        d = np.array(p1, float) - np.array(p0, float)
        n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
        yy, xx = np.mgrid[0:H, 0:W]
        dist = (xx - p0[0]) * n[0] + (yy - p0[1]) * n[1]
        along = ((xx - p0[0]) * d[0] + (yy - p0[1]) * d[1]) / (d @ d)
        fade = np.clip(-dist / 16, 0, 1)
        fade = np.where((along > -0.1) & (along < 1.1), fade, 1)
        if name == 'thigh_near':
            fade = np.where(poly([(700, 1085), (722, 1112), (772, 1112), (790, 1095), (790, 1000), (700, 1000)]), 1, fade)
        layers[name][..., 3] = (layers[name][..., 3] * fade).astype(np.uint8)

    boxes, crops = {}, {}
    for name in ORDER:
        a = layers[name][..., 3] > 0
        ys, xs = np.where(a)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = layers[name][y0:y1, x0:x1].copy()
        crop[crop[..., 3] == 0] = 0
        crops[name] = np.pad(crop, ((PAD, PAD), (PAD, PAD), (0, 0)))
        boxes[name] = (int(x0 - PAD), int(y0 - PAD), int(x1 - x0 + 2 * PAD), int(y1 - y0 + 2 * PAD))
    place, x, y, shelf = {}, 0, 0, 0
    for name in sorted(ORDER, key=lambda n: -crops[n].shape[0]):
        h, w = crops[name].shape[:2]
        if x + w > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf, 0
        place[name] = (x, y)
        x, shelf = x + w, max(shelf, h)
    atlas_height = 1 << (y + shelf - 1).bit_length()
    atlas = np.zeros((atlas_height, ATLAS_WIDTH, 4), np.uint8)
    for name, (ax, ay) in place.items():
        h, w = crops[name].shape[:2]
        atlas[ay:ay + h, ax:ax + w] = crops[name]
    Image.fromarray(atlas).save(ATLAS, lossless=True, quality=100, method=6)

    sole_near = int(np.where((layers['foot_near'][..., 3] > 128).any(axis=1))[0].max())
    sole_far = int(np.where((layers['foot_far'][..., 3] > 128).any(axis=1))[0].max())
    head_top = int(np.where(vis.any(axis=1))[0].min())
    rows = []
    for name in ORDER:
        px, py = JOINTS[PIVOT[name]]
        parent = ORDER.index(PARENT[name]) if PARENT[name] else -1
        rows.append(f"    {{ name: '{name}', parent: {parent}, pivot: [{px}, {py}], box: [{', '.join(map(str, boxes[name]))}], atlas: [{place[name][0]}, {place[name][1]}] }},")
    joints = '\n'.join(f"    {k}: [{v[0]}, {v[1]}] as [number, number]," for k, v in JOINTS.items())
    DATA.write_text(f"""// Fichier généré par tools/prepare_walk.py à partir de art/hero-walk-source.png. Ne pas modifier à la main.

export interface WalkLayer {{
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  pivot: [number, number]
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: [number, number]
}}

/** Le personnage de profil, découpé pour la marche : calques du fond vers le premier plan. */
export const WALK_RIG = {{
  canvas: [{W}, {H}] as [number, number],
  atlasSize: [{ATLAS_WIDTH}, {atlas_height}] as [number, number],
  /** Bas de la semelle de chaque chaussure et sommet du crâne, en pixels de la toile. */
  soleNear: {sole_near},
  soleFar: {sole_far},
  headTop: {head_top},
  joints: {{
{joints}
  }},
  layers: [
{chr(10).join(rows)}
  ] as WalkLayer[],
}}
""")
    print(f'atlas {ATLAS_WIDTH} x {atlas_height}, {ATLAS.stat().st_size / 1024:.0f} Ko ; semelles {sole_near} / {sole_far}, sommet {head_top}')

    if DEBUG:
        DEBUG.mkdir(parents=True, exist_ok=True)
        rng = np.random.RandomState(4)
        over = np.zeros((H, W, 3), np.float32) + 40
        for name in ORDER:
            L = layers[name].astype(np.float32)
            a = L[..., 3:] / 255
            tint = rng.randint(60, 255, 3).astype(np.float32)
            over = over * (1 - a) + (0.55 * L[..., :3] + 0.45 * tint) * a
        Image.fromarray(over.astype(np.uint8)).save(DEBUG / 'calques.png')
        tiles = []
        for name in ORDER:
            L = layers[name].astype(np.float32)
            a = L[..., 3:] / 255
            t = (np.array([70, 110, 200], np.float32) * (1 - a) + L[..., :3] * a).astype(np.uint8)
            t = cv2.resize(t, (W // 3, H // 3), interpolation=cv2.INTER_AREA)
            cv2.putText(t, name, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
            tiles.append(t)
        tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 7)
        Image.fromarray(np.vstack([np.hstack(tiles[i:i + 7]) for i in range(0, len(tiles), 7)])).save(DEBUG / 'planche.png')


if __name__ == '__main__':
    main()
