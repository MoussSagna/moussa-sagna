"""Découpe les illustrations du personnage (garde, transition, marche) en calques pour le moteur.

Usage : python3 tools/prepare_poses.py [--debug dossier]
Lit art/hero-guard.png, hero-step.png, hero-walk.png et hero-walk-pass.png (fond vert uni, 1024 x 1536).
Écrit un atlas par pose dans public/assets/hero/ et src/game/hero/poseData.ts.
Les polygones et les articulations sont tracés à la main pour ces illustrations.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art'
OUT = ROOT / 'public' / 'assets' / 'hero'
DATA = ROOT / 'src' / 'game' / 'hero' / 'poseData.ts'
DEBUG = Path(sys.argv[sys.argv.index('--debug') + 1]) if '--debug' in sys.argv else None
PAD, ATLAS_WIDTH = 8, 2048
W, H = 1024, 1536
WHITE = np.array([242, 238, 238], np.float32)

# Logos de marque à effacer sur les baskets : dans chaque polygone, les pixels sombres deviennent blancs.
LOGOS = dict(
    guard=[[(780, 1345), (822, 1345), (876, 1375), (876, 1403), (838, 1403), (780, 1368)]],
    walkPass=[],
    walk=[[(108, 1293), (136, 1293), (216, 1335), (216, 1359), (180, 1359), (108, 1318)],
          [(765, 1400), (800, 1370), (848, 1370), (848, 1398), (820, 1426), (770, 1432)]],
    step=[],
)

# ---------- marche : deux dessins clés. « near » = côté proche de la caméra, « far » = côté éloigné ----------
BELT = [(340, 668), (480, 668), (560, 658), (605, 656), (700, 640)]
BAND = BELT + [(700, 600), (560, 612), (480, 622), (340, 622)]
# Contact : jambe proche en avant, jambe éloignée en arrière, bras proche en arrière.
WALK = dict(
    joints=dict(
        hip_near=(560, 745), knee_near=(690, 1040), ankle_near=(760, 1320),
        hip_far=(540, 745), knee_far=(350, 1060), ankle_far=(215, 1265),
        shoulder_near=(410, 340), shoulder_far=(650, 400), neck=(590, 280), ribbon=(500, 185), ribbon_low=(222, 595),
    ),
    poly=dict(   # du plus prioritaire au moins prioritaire
        head=[(490, 40), (770, 40), (770, 250), (705, 285), (665, 308), (628, 296), (600, 268), (572, 262), (545, 238), (520, 235), (500, 205)],
        arm_near=[(360, 285), (450, 300), (490, 380), (480, 470), (430, 540), (350, 600), (335, 640), (330, 700), (340, 885), (190, 885), (190, 700), (235, 640), (205, 570), (215, 470), (270, 380)],
        arm_far=[(690, 440), (735, 470), (775, 540), (800, 640), (872, 740), (872, 852), (750, 852), (735, 720), (712, 650), (690, 600)],
        foot_near=[(675, 1310), (712, 1288), (800, 1282), (840, 1300), (1012, 1380), (1012, 1500), (675, 1500)],
        foot_far=[(95, 1262), (100, 1215), (180, 1228), (255, 1240), (275, 1275), (345, 1420), (345, 1500), (40, 1500), (40, 1320)],
        hip=BELT[:4] + [(612, 760), (600, 900), (575, 935), (540, 900), (520, 850), (455, 845), (455, 960), (480, 1000), (490, 1165), (440, 1165), (400, 1050), (380, 940), (350, 930), (330, 860)],
        thigh_near=[(605, 656), (700, 640), (725, 720), (760, 850), (805, 990), (862, 1085), (545, 1078), (505, 1030), (480, 1000), (455, 960), (455, 845), (520, 850), (540, 900), (575, 935), (600, 900), (612, 760)],
        shin_near=[(545, 1078), (862, 1085), (872, 1325), (545, 1325)],
        thigh_far=[(300, 930), (520, 1000), (520, 1050), (436, 1110), (264, 1010)],
        shin_far=[(264, 1010), (436, 1110), (420, 1290), (150, 1290), (150, 1100)],
    ),
    fill=dict(   # zones cachées à reboucher, par calque
        torso=[(410, 300), (480, 300), (500, 480), (480, 640), (350, 650), (345, 560), (380, 440)],
        thigh_near=[(605, 656), (700, 640), (700, 600), (605, 612)], hip=BAND,
        shin_near=[(545, 1078), (862, 1085), (850, 1010), (560, 1005)],
        shin_far=[(264, 1010), (436, 1110), (480, 1060), (310, 960)],
        foot_near=[(675, 1310), (712, 1288), (800, 1282), (840, 1300), (830, 1260), (690, 1265)],
        foot_far=[(110, 1262), (180, 1228), (255, 1240), (275, 1275), (285, 1225), (180, 1195), (110, 1230)],
    ),
    # Cuisses : la partie cachée est une forme arrondie le long de l'os (début, fin, épaisseur).
    capsule=dict(thigh_near=((560, 750), (690, 1040), 210), thigh_far=((540, 755), (350, 1060), 190)),
    knee=dict(thigh_near=((545, 1078), (862, 1085)), thigh_far=((264, 1010), (436, 1110))),
    left=[(0, 100), (500, 100), (500, 235), (450, 250), (360, 285), (270, 380), (215, 470), (205, 570), (235, 640), (195, 700), (190, 885), (160, 1010), (0, 1010)],
    knot=[(380, 120), (505, 120), (505, 235), (380, 235)],
    behind_arm=[(190, 560), (245, 560), (245, 660), (190, 660)],
    ribbon_low=[(40, 540), (215, 560), (240, 640), (200, 700), (40, 700)],
    sash=[(150, 780), (400, 780), (400, 1010), (150, 1010)],
    leftover_far=[(150, 900), (640, 900), (640, 1300), (150, 1300)],
    leftover_near=[(600, 650), (900, 650), (900, 1100), (600, 1100)],
    pelvis=(520, 820),
    pants=[(400, 780), (450, 780), (450, 840), (400, 840)],
    jacket=[(380, 600), (450, 600), (450, 640), (380, 640)],
)
# Appui : jambe proche à la verticale, pied éloigné levé derrière. De la jambe éloignée on ne voit que le pied
# et le bas du pantalon : sa cuisse et son tibia sont des formes pleines, cachées au repos.
PASS_BELT = [(425, 700), (495, 695), (520, 650), (600, 640), (612, 640), (700, 632)]
PASS_BAND = PASS_BELT + [(700, 590), (600, 598), (520, 606), (495, 650), (425, 655)]
PASS = dict(
    joints=dict(
        hip_near=(565, 722), knee_near=(575, 1010), ankle_near=(585, 1310),
        hip_far=(545, 722), knee_far=(681, 1008), ankle_far=(440, 1105),
        shoulder_near=(490, 300), shoulder_far=(660, 360), neck=(595, 240), ribbon=(505, 135), ribbon_low=(318, 640),
    ),
    poly=dict(
        head=[(495, 10), (770, 10), (770, 200), (700, 240), (655, 262), (620, 250), (596, 225), (570, 215), (545, 195), (520, 190), (500, 160)],
        arm_near=[(400, 215), (505, 235), (535, 330), (530, 440), (505, 520), (470, 590), (430, 605), (412, 660), (415, 842), (295, 842), (295, 660), (318, 600), (280, 540), (290, 470), (345, 360)],
        arm_far=[(700, 450), (745, 480), (775, 560), (800, 650), (857, 740), (857, 847), (745, 847), (725, 720), (705, 650), (690, 600), (690, 480)],
        foot_near=[(525, 1300), (560, 1288), (615, 1285), (640, 1295), (850, 1400), (850, 1500), (520, 1500)],
        foot_far=[(330, 1090), (440, 995), (505, 995), (520, 1085), (488, 1105), (492, 1335), (330, 1335)],
        hip=PASS_BELT[:5] + [(625, 700), (640, 800), (660, 900), (600, 900), (590, 820), (500, 790), (480, 800), (470, 900), (440, 1010), (400, 1010), (380, 900), (390, 800)],
        thigh_near=[(612, 640), (700, 632), (720, 700), (700, 900), (690, 1000), (440, 1000), (470, 900), (480, 800), (500, 790), (590, 820), (600, 900), (660, 900), (640, 800), (625, 700)],
        shin_near=[(400, 1000), (700, 1000), (700, 1325), (400, 1325)],
    ),
    fill=dict(
        torso=[(470, 240), (540, 250), (560, 440), (540, 600), (440, 640), (430, 560), (450, 400)],
        thigh_near=[(612, 640), (700, 632), (700, 590), (612, 598)], hip=PASS_BAND,
        shin_near=[(440, 1000), (690, 1000), (690, 940), (450, 940)],
        foot_near=[(525, 1300), (560, 1288), (615, 1285), (640, 1295), (630, 1255), (535, 1260)],
    ),
    capsule=dict(thigh_near=((565, 735), (575, 1010), 200)),
    solid=dict(thigh_far=((545, 740), (681, 1008), 150), shin_far=((681, 1008), (440, 1105), 130)),
    knee=dict(thigh_near=((440, 1000), (690, 1000))),
    left=[(0, 40), (505, 40), (505, 170), (480, 200), (400, 212), (345, 360), (290, 470), (280, 540), (318, 600), (295, 660), (295, 842), (0, 842)],
    knot=[(380, 60), (510, 60), (510, 185), (380, 185)],
    behind_arm=[(275, 600), (330, 600), (330, 690), (275, 690)],
    ribbon_low=[(100, 600), (320, 610), (300, 800), (100, 842)],
    sash=[(100, 845), (480, 845), (480, 1070), (100, 1070)],
    leftover_near=[(600, 640), (900, 640), (900, 1100), (600, 1100)],
    pelvis=(540, 810),
    pants=[(520, 1050), (580, 1050), (580, 1150), (520, 1150)],
    jacket=[(480, 560), (540, 560), (540, 600), (480, 600)],
)
WALK_ORDER = ['ribbons', 'ribbon_low', 'arm_far', 'pelvis', 'foot_far', 'shin_far', 'thigh_far', 'foot_near', 'shin_near', 'thigh_near', 'hip', 'torso', 'head', 'arm_near']
WALK_PARENT = dict(hip='torso', ribbons='head', ribbon_low='torso', arm_far='torso', pelvis='torso', head='torso', arm_near='torso', torso=None,
                   thigh_near='torso', shin_near='thigh_near', foot_near='shin_near', thigh_far='torso', shin_far='thigh_far', foot_far='shin_far')
WALK_PIVOT = dict(hip='hip_near', ribbons='ribbon', ribbon_low='ribbon_low', arm_far='shoulder_far', pelvis='hip_near', head='neck', arm_near='shoulder_near', torso='hip_near',
                  thigh_near='hip_near', shin_near='knee_near', foot_near='ankle_near', thigh_far='hip_far', shin_far='knee_far', foot_far='ankle_far')

# ---------- garde ----------
GUARD_JOINTS = dict(waist=(560, 705), neck=(600, 300), ribbon=(510, 190), ribbon_low=(300, 650))
GUARD_WAIST = [(0, 735), (240, 735), (330, 715), (480, 702), (640, 698), (760, 690), (1024, 690)]
GUARD_HEAD = [(495, 60), (800, 60), (800, 260), (720, 300), (680, 335), (640, 330), (600, 300), (560, 290), (520, 250)]
GUARD_LEFT = [(0, 100), (520, 100), (520, 200), (500, 218), (430, 243), (335, 255), (300, 300), (302, 335), (240, 400), (208, 440), (212, 520), (262, 640), (275, 660), (250, 700), (240, 760), (200, 900), (0, 900)]
GUARD_RIBBON_LOW = [(165, 600), (345, 590), (310, 670), (260, 760), (200, 900), (90, 900), (120, 760)]
GUARD_ORDER = ['ribbons', 'ribbon_low', 'lower', 'upper', 'head']
GUARD_PARENT = dict(ribbons='upper', ribbon_low='upper', lower=None, upper='lower', head='upper')
GUARD_PIVOT = dict(ribbons='ribbon', ribbon_low='ribbon_low', lower='waist', upper='waist', head='neck')


def poly(points) -> np.ndarray:
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(points, np.int32)], 1)
    return m.astype(bool)


FILES = dict(guard='hero-guard.png', step='hero-step.png', walk='hero-walk.png', walkPass='hero-walk-pass.png')


def load(name: str) -> np.ndarray:
    """Charge une illustration, efface les logos des baskets et retire le fond vert."""
    rgb = np.asarray(Image.open(ART / FILES[name]).convert('RGB')).copy()
    assert rgb.shape[:2] == (H, W), name
    for points in LOGOS[name]:
        zone = poly(points)
        dark = zone & (rgb.max(axis=2) < 120)
        dark = cv2.dilate(dark.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & zone
        rgb[dark] = WHITE
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    alpha = 1 - np.clip((g - np.maximum(r, b) - 40) / 150, 0, 1)
    bg = np.array([4, 248, 3], np.float32)
    a = np.maximum(alpha, 0.02)[..., None]
    col = np.clip((f - (1 - a) * bg) / a, 0, 255)
    col[..., 1] = np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]))
    alpha[alpha < 0.06] = 0
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def is_red(art: np.ndarray) -> np.ndarray:
    r, g, b = [art[..., i].astype(int) for i in range(3)]
    return (art[..., 3] > 0) & (r > 110) & (g < 0.45 * r) & (b < 0.5 * r)


def near_red(red: np.ndarray) -> np.ndarray:
    """Le rouge et son trait d'encre : ce qui distingue un ruban d'un bout de veste pris dans le même polygone."""
    return cv2.dilate(red.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)


def fill_hidden(layer: np.ndarray, region: np.ndarray, color: np.ndarray) -> None:
    """Rebouche une zone cachée avec un aplat de la couleur du tissu (matière inventée, sans pli ni trait)."""
    hole = region & (layer[..., 3] < 250)
    a = layer[..., 3:].astype(np.float32) / 255
    mixed = layer[..., :3] * a + color * (1 - a)
    layer[hole, :3] = mixed[hole].astype(np.uint8)
    layer[hole, 3] = 255


def cut_walk(art: np.ndarray, c: dict) -> dict:
    """Découpe un dessin de marche d'après sa configuration (WALK ou PASS)."""
    vis = art[..., 3] > 0
    red = is_red(art)
    names = list(c['poly'])
    label = np.full((H, W), -1, np.int16)
    for i, name in reversed(list(enumerate(names))):
        label[poly(c['poly'][name]) & vis] = i
    # l'écharpe de la hanche part vers la gauche : elle reste avec la hanche, pas avec les rubans du bandeau
    label[red & poly(c['sash']) & (label != names.index('arm_near')) & (label != names.index('foot_far'))] = names.index('hip')
    ribbons = vis & (label < 0) & poly(c['left'])
    ribbons |= red & poly(c['knot']) & (label < 0)
    ribbons |= red & (label == names.index('arm_near')) & poly(c['behind_arm'])
    ribbons &= near_red(red)
    if 'leftover_far' in c:
        label[(label < 0) & ~ribbons & vis & poly(c['leftover_far'])] = names.index('thigh_far')
    # les bouts de lanière qui dépassent de la cuisse proche bougent avec elle
    label[(label < 0) & ~ribbons & vis & poly(c['leftover_near'])] = names.index('thigh_near')
    low = ribbons & poly(c['ribbon_low'])
    layers = {name: art * ((label == i) & ~ribbons)[..., None] for i, name in enumerate(names)}
    layers['ribbons'] = art * (ribbons & ~low)[..., None]
    layers['ribbon_low'] = art * low[..., None]
    layers['torso'] = art * (vis & (label < 0) & ~ribbons)[..., None]

    def cloth(points) -> np.ndarray:
        return np.median(art[poly(points) & ~red & vis][:, :3], axis=0)
    pants = cloth(c['pants'])
    tone = dict(torso=cloth(c['jacket']))
    for name, pts in c['fill'].items():
        fill_hidden(layers[name], poly(pts) & vis, tone.get(name, pants))

    def capsule(start, end, thick) -> np.ndarray:
        shape = np.zeros((H, W), np.uint8)
        cv2.line(shape, start, end, 255, thick, cv2.LINE_AA)
        return shape
    for name, (start, end, thick) in c['capsule'].items():
        fill_hidden(layers[name], (capsule(start, end, thick) > 127) & (vis | (name == 'thigh_far')), pants)
    # membres entièrement cachés sur ce dessin : une forme pleine de la couleur du pantalon
    for name, (start, end, thick) in c.get('solid', {}).items():
        layer = np.zeros((H, W, 4), np.uint8)
        layer[..., :3] = pants
        layer[..., 3] = cv2.GaussianBlur(capsule(start, end, thick), (0, 0), 1.2)
        layers[name] = layer
    # bassin : une masse sombre sous les deux cuisses, pour qu'aucun jour n'apparaisse quand elles s'écartent
    pelvis = np.zeros((H, W, 4), np.uint8)
    mask = np.zeros((H, W), np.uint8)
    cv2.ellipse(mask, c['pelvis'], (130, 120), 0, 0, 360, 255, -1)
    pelvis[..., :3] = pants
    pelvis[..., 3] = cv2.GaussianBlur(mask, (0, 0), 1.2)
    layers['pelvis'] = pelvis
    # la coupe du genou tombe en plein tissu : fondu sur le bord bas des cuisses
    yy, xx = np.mgrid[0:H, 0:W]
    for name, (p0, p1) in c['knee'].items():
        d = np.array(p1, float) - np.array(p0, float)
        n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
        dist = (xx - p0[0]) * n[0] + (yy - p0[1]) * n[1]
        along = ((xx - p0[0]) * d[0] + (yy - p0[1]) * d[1]) / (d @ d)
        fade = np.where((along > -0.1) & (along < 1.1), np.clip(-dist / 16, 0, 1), 1)
        layers[name][..., 3] = (layers[name][..., 3] * fade).astype(np.uint8)
    return {name: layers[name] for name in WALK_ORDER}


def cut_guard(art: np.ndarray) -> dict:
    vis = art[..., 3] > 0
    ribbons = vis & poly(GUARD_LEFT) & near_red(is_red(art))
    low = ribbons & poly(GUARD_RIBBON_LOW)
    body = vis & ~ribbons
    below = poly(GUARD_WAIST + [(1024, 1536), (0, 1536)])
    layers = dict(
        ribbons=art * (ribbons & ~low)[..., None],
        ribbon_low=art * low[..., None],
        lower=art * (body & below)[..., None],
        upper=art * (body & ~below)[..., None],
        # la tête est dessinée une seconde fois par-dessus le buste : elle peut bouger sans laisser de trou
        head=art * (body & poly(GUARD_HEAD))[..., None],
    )
    # le bas du corps se prolonge un peu sous le buste, qui se soulève en respirant
    red = is_red(art)
    pants = np.median(art[poly([(480, 760), (620, 760), (620, 840), (480, 840)]) & ~red & vis][:, :3], axis=0)
    band = cv2.dilate((body & below).astype(np.uint8), np.ones((61, 61), np.uint8)).astype(bool) & body & ~below
    fill_hidden(layers['lower'], band, pants)
    return {name: layers[name] for name in GUARD_ORDER}


def pack(name: str, layers: dict) -> tuple:
    """Range les calques d'une pose dans son atlas. Retourne les rectangles, les positions et la taille."""
    boxes, crops = {}, {}
    for key, layer in layers.items():
        ys, xs = np.where(layer[..., 3] > 0)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = layer[y0:y1, x0:x1].copy()
        crop[crop[..., 3] == 0] = 0
        crops[key] = np.pad(crop, ((PAD, PAD), (PAD, PAD), (0, 0)))
        boxes[key] = (int(x0 - PAD), int(y0 - PAD), int(x1 - x0 + 2 * PAD), int(y1 - y0 + 2 * PAD))
    place, x, y, shelf = {}, 0, 0, 0
    for key in sorted(layers, key=lambda k: -crops[k].shape[0]):
        h, w = crops[key].shape[:2]
        if x + w > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf, 0
        place[key] = (x, y)
        x, shelf = x + w, max(shelf, h)
    print(f'  {name} : hauteur utilisée {y + shelf}')
    height = 1 << (y + shelf - 1).bit_length()
    atlas = np.zeros((height, ATLAS_WIDTH, 4), np.uint8)
    for key, (ax, ay) in place.items():
        h, w = crops[key].shape[:2]
        atlas[ay:ay + h, ax:ax + w] = crops[key]
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    return boxes, place, (ATLAS_WIDTH, height)


def anchor(art: np.ndarray) -> tuple:
    """Milieu des appuis et ligne des semelles : le point que le moteur pose sur le sol."""
    solid = art[..., 3] > 128
    sole = int(np.where(solid.any(axis=1))[0].max())
    xs = np.where(solid[sole - 60:sole + 1].any(axis=0))[0]
    return int((xs.min() + xs.max()) // 2), sole


def debug_sheet(name: str, layers: dict) -> None:
    tiles = []
    for key, layer in layers.items():
        f = layer.astype(np.float32)
        a = f[..., 3:] / 255
        t = (np.array([70, 110, 200], np.float32) * (1 - a) + f[..., :3] * a).astype(np.uint8)
        t = cv2.resize(t, (W // 3, H // 3), interpolation=cv2.INTER_AREA)
        cv2.putText(t, key, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
        tiles.append(t)
    tiles += [np.zeros_like(tiles[0])] * (-len(tiles) % 7)
    Image.fromarray(np.vstack([np.hstack(tiles[i:i + 7]) for i in range(0, len(tiles), 7)])).save(DEBUG / f'{name}.png')


def main() -> None:
    arts = {name: load(name) for name in FILES}
    poses = dict(
        guard=(cut_guard(arts['guard']), GUARD_PARENT, GUARD_PIVOT, GUARD_JOINTS),
        step=(dict(body=arts['step']), dict(body=None), dict(body='center'), dict(center=(512, 768))),
        walk=(cut_walk(arts['walk'], WALK), WALK_PARENT, WALK_PIVOT, WALK['joints']),
        walkPass=(cut_walk(arts['walkPass'], PASS), WALK_PARENT, WALK_PIVOT, PASS['joints']),
    )
    blocks = []
    for name, (layers, parent, pivot, joints) in poses.items():
        boxes, place, size = pack(name, layers)
        order = list(layers)
        ax, ay = anchor(arts[name])
        rows = []
        for key in order:
            px, py = joints[pivot[key]]
            up = order.index(parent[key]) if parent[key] else -1
            rows.append(f"      {{ name: '{key}', parent: {up}, pivot: [{px}, {py}], box: [{', '.join(map(str, boxes[key]))}], atlas: [{place[key][0]}, {place[key][1]}] }},")
        points = '\n'.join(f"      {k}: [{v[0]}, {v[1]}] as Point," for k, v in joints.items())
        blocks.append(f"""  {name}: {{
    file: 'hero/{name}.webp',
    atlasSize: [{size[0]}, {size[1]}] as Point,
    /** Milieu des appuis et ligne des semelles, en pixels de la toile. */
    anchor: [{ax}, {ay}] as Point,
    joints: {{
{points}
    }},
    layers: [
{chr(10).join(rows)}
    ] as PoseLayer[],
  }},""")
        print(f'{name} : atlas {size[0]} x {size[1]}, {(OUT / (name + ".webp")).stat().st_size / 1024:.0f} Ko, ancrage ({ax}, {ay})')
        if DEBUG:
            DEBUG.mkdir(parents=True, exist_ok=True)
            debug_sheet(name, layers)
    DATA.write_text(f"""// Fichier généré par tools/prepare_poses.py à partir des illustrations de art/. Ne pas modifier à la main.

export type Point = [number, number]

export interface PoseLayer {{
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  pivot: Point
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: Point
}}

/** Toile commune à toutes les poses, en pixels des illustrations. */
export const CANVAS: Point = [{W}, {H}]

/** Les poses du personnage, chacune découpée en calques du fond vers le premier plan. */
export const POSES = {{
{chr(10).join(blocks)}
}}
""")


if __name__ == '__main__':
    main()
