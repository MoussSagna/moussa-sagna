"""Découpe les illustrations du personnage (garde, transition, marche) en calques pour le moteur.

Usage (depuis lab/) : python3 tools/prepare_poses.py [--debug dossier]
Lit, dans art/ à la racine du dépôt, hero-guard.png, hero-step.png, hero-walk.png, hero-dash-forward.png, hero-dash-back.png,
hero-crouch-step.png, hero-crouch.png, hero-block-step.png, hero-block.png, hero-crouch-block.png les quatre hero-jump-*.png les neuf hero-punch-*.png, les six hero-special-*.png, les deux hero-hurt*.png, les trois hero-ground-*.png, les quatre hero-ko-*.png, les quatre hero-exit-*.png et les deux hero-kick-*.png
(fond vert uni, 1024 x 1536).
Écrit un atlas par pose dans public/assets/hero/ et src/game/hero/poseData.ts.
Les polygones et les articulations sont tracés à la main pour ces illustrations.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent    # le dossier lab/
ART = ROOT.parent / 'art'                        # les illustrations sont à la racine du dépôt, communes au lab et au folio
OUT = ROOT / 'public' / 'assets' / 'hero'
DATA = ROOT / 'src' / 'game' / 'hero' / 'poseData.ts'
DEBUG = Path(sys.argv[sys.argv.index('--debug') + 1]) if '--debug' in sys.argv else None
PAD = 8
W, H = 1024, 1536
WHITE = np.array([242, 238, 238], np.float32)

# Logos de marque à effacer sur les baskets : dans chaque polygone, les pixels sombres deviennent blancs.
LOGOS = dict(
    exitLean=[[(693, 1338), (722, 1348), (752, 1354), (774, 1346), (779, 1366), (762, 1389), (738, 1385), (697, 1362)]],
    guard=[[(780, 1345), (822, 1345), (876, 1375), (876, 1403), (838, 1403), (780, 1368)]],
    walk=[[(108, 1293), (136, 1293), (216, 1335), (216, 1359), (180, 1359), (108, 1318)],
          [(765, 1400), (800, 1370), (848, 1370), (848, 1398), (820, 1426), (770, 1432)]],
    step=[],
    crouchStep=[],
    crouch=[],
    blockStep=[],
    block=[],
    crouchBlock=[],
    jumpStart=[],
    jumpRise=[],
    jumpPeak=[],
    punchStart=[[(34, 1262), (58, 1262), (58, 1308), (34, 1308)]],
    punchHit=[[(32, 1242), (58, 1242), (58, 1292), (32, 1292)]],
    punchChain1=[],
    specialCharge=[],
    specialIn1=[],
    specialIn2=[],
    specialIn3=[],
    specialThrow=[],
    specialRecover=[],
    punchHeavyStart=[],
    punchHeavyHit=[],
    punchHeavyRecover=[],
    punchChain2=[],
    punchMidHit=[],
    punchMidRecover=[],
    jumpLand=[[(155, 1275), (195, 1285), (200, 1325), (165, 1325)]],
    dashForward=[],
    dashBack=[],
)
# Logos en relief, tracés en traits pâles sur le blanc : dans chaque polygone, tout pixel clair devient blanc.
# Logos rouges sur un panneau blanc : dans chaque rectangle (x0, y0, x1, y1), serré autour du logo, les pixels
# rouges et leur contour sombre sont repeints d'après leur voisinage.
RED_LOGOS = dict(groundCharge=[(770, 1145, 840, 1200)], groundRise=[(775, 1160, 840, 1210)], groundPalm=[(770, 1140, 840, 1195)],
                 kickStart=[(420, 1312, 498, 1374), (640, 726, 684, 786)],
                 kickHit=[(316, 1308, 373, 1354), (876, 390, 910, 420)])
# Logos gris ou noirs sur un panneau blanc : dans chaque rectangle, serré autour du logo, les pixels gris ou
# sombres peu colorés sont repeints d'après le blanc qui les entoure.
GRAY_LOGOS = dict(koStagger=[(185, 1262, 255, 1320), (825, 1300, 890, 1365)], koFall=[(305, 1250, 375, 1320), (810, 1170, 885, 1235)],
                  koAir=[(812, 540, 858, 606), (868, 550, 905, 610)], koDown=[(818, 1212, 872, 1265)],
                  launch=[(222, 1186, 262, 1254), (617, 1176, 648, 1240)],
                  slamFall=[(850, 510, 886, 596), (812, 1060, 900, 1100)], slamDown=[(800, 940, 826, 990), (845, 1400, 910, 1438)],
                  slamBounce=[(822, 1178, 890, 1225), (790, 1410, 855, 1445)])
# Logos clairs sur le col noir de la basket : dans chaque rectangle, les pixels clairs sont repeints d'après le noir qui les entoure.
DARK_LOGOS = dict(slamFall=[(875, 985, 925, 1020)], slamDown=[(855, 1352, 885, 1380)], slamBounce=[(855, 1135, 880, 1158), (796, 1365, 818, 1386)])
FAINT_LOGOS = dict(jumpStart=[[(150, 1228), (188, 1226), (204, 1262), (205, 1296), (150, 1296)]],
                   punchStart=[[(740, 1300), (800, 1300), (800, 1345), (740, 1345)]],
                   punchHit=[[(740, 1288), (800, 1288), (800, 1340), (740, 1340)]])
# Poses en un seul calque : le point d'appui horizontal est donné à la main (l'aplomb des hanches).
SINGLE = dict(step=None, dashForward=560, dashBack=360, crouchStep=None, crouch=None, blockStep=None, block=None, crouchBlock=None,
              jumpStart=None, jumpRise=520, jumpPeak=520, jumpLand=None,
              # jab : calé pour que le pied arrière tombe sur celui de la garde ; le pied avant fait son petit pas
              punchStart=483, punchHit=475,
              # direct : corps entier, calé sur le pied avant de la garde ; le pied arrière pivote sur place
              punchMidHit=518,
              # transitions jab -> direct : le pied avant glisse de sa place du jab à celle du direct
              punchChain1=495, punchChain2=500,
              # coup fort : calé sur le pied avant, comme le direct
              punchHeavyStart=518, punchHeavyHit=526, punchHeavyRecover=518,
              # attaque spéciale : calée sur le pied avant
              specialCharge=526, specialThrow=534, specialRecover=518,
              specialIn1=524, specialIn2=524, specialIn3=524,
              # coup encaissé : calé sur le pied avant
              hurt=524, hurtRecover=524,
              # rafale de coups de pied : calée sur le pied arrière de la garde, qui sert d'appui (dessins 1,17 fois plus petits)
              # frappe au sol : calée sur le milieu des pieds
              groundCharge=515, groundRise=509, groundPalm=496,
              # K.O. : calé sur le milieu des pieds, puis sur le milieu du corps en l'air et au sol
              koStagger=600, koFall=600, koAir=520, koDown=500,
              # sortie de fin de round : calée sur le milieu des deux pieds, qui bougent d'un dessin à l'autre
              exitLean=517, exitCrouch=541, exitGround=496, exitSpring=500,
              # coup de pied : calé sur l'aplomb des hanches, comme la garde, pour que le corps ne saute pas
              kickStart=465, kickHit=410,
              # propulsé par l'attaque ultime de l'adversaire : calé sur le milieu du corps, comme le K.O. en l'air
              launch=470,
              # écrasé au sol par l'attaque ultime : calé sur le milieu du corps
              slamFall=520, slamDown=500, slamBounce=490)
# Coups donnés depuis la garde : le haut du corps vient de l'illustration du coup, les jambes restent celles de la
# garde, pour que les pieds ne bougent pas. Valeur : décalage qui amène la boucle de ceinture du coup sur celle de
# la garde (557, 693).
ON_GUARD_LEGS = dict(punchMidRecover=(-13, 68))

# ---------- marche : articulations et polygones. « near » = côté proche (jambe avant, bras arrière) ----------
WALK_JOINTS = dict(
    hip_near=(560, 745), knee_near=(690, 1040), ankle_near=(760, 1320),
    hip_far=(540, 745), knee_far=(350, 1060), ankle_far=(215, 1265),
    shoulder_near=(410, 340), shoulder_far=(650, 400), neck=(590, 280), ribbon=(500, 185), ribbon_low=(222, 595),
)
BELT = [(340, 668), (480, 668), (560, 658), (605, 656), (700, 640)]
WALK_POLY = dict(   # du plus prioritaire au moins prioritaire
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
)
BAND = BELT + [(700, 600), (560, 612), (480, 622), (340, 622)]
WALK_FILL = dict(   # zones cachées à reboucher, par calque
    torso=[(410, 300), (480, 300), (500, 480), (480, 640), (350, 650), (345, 560), (380, 440)],
    thigh_near=[(605, 656), (700, 640), (700, 600), (605, 612)], hip=BAND,
    shin_near=[(545, 1078), (862, 1085), (850, 1010), (560, 1005)],
    shin_far=[(264, 1010), (436, 1110), (480, 1060), (310, 960)],
    foot_near=[(675, 1310), (712, 1288), (800, 1282), (840, 1300), (830, 1260), (690, 1265)],
    foot_far=[(110, 1262), (180, 1228), (255, 1240), (275, 1275), (285, 1225), (180, 1195), (110, 1230)],
)
# Cuisses : la partie cachée est une forme arrondie le long de l'os (début, fin, épaisseur).
WALK_CAPSULE = dict(thigh_near=((560, 750), (690, 1040), 210), thigh_far=((540, 755), (350, 1060), 190))
WALK_KNEE = dict(thigh_near=((545, 1078), (862, 1085)), thigh_far=((264, 1010), (436, 1110)))
WALK_ORDER = ['ribbons', 'ribbon_low', 'arm_far', 'pelvis', 'foot_far', 'shin_far', 'thigh_far', 'foot_near', 'shin_near', 'thigh_near', 'hip', 'torso', 'head', 'arm_near']
WALK_PARENT = dict(hip='torso', ribbons='head', ribbon_low='torso', arm_far='torso', pelvis='torso', head='torso', arm_near='torso', torso=None,
                   thigh_near='torso', shin_near='thigh_near', foot_near='shin_near', thigh_far='torso', shin_far='thigh_far', foot_far='shin_far')
WALK_PIVOT = dict(hip='hip_near', ribbons='ribbon', ribbon_low='ribbon_low', arm_far='shoulder_far', pelvis='hip_near', head='neck', arm_near='shoulder_near', torso='hip_near',
                  thigh_near='hip_near', shin_near='knee_near', foot_near='ankle_near', thigh_far='hip_far', shin_far='knee_far', foot_far='ankle_far')
WALK_LEFT = [(0, 100), (500, 100), (500, 235), (450, 250), (360, 285), (270, 380), (215, 470), (205, 570), (235, 640), (195, 700), (190, 885), (160, 1010), (0, 1010)]
WALK_RIBBON_LOW = [(40, 540), (215, 560), (240, 640), (200, 700), (40, 700)]

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


FILES = dict(guard='hero-guard.png', step='hero-step.png', walk='hero-walk.png', dashForward='hero-dash-forward.png', dashBack='hero-dash-back.png',
             crouchStep='hero-crouch-step.png', crouch='hero-crouch.png',
             blockStep='hero-block-step.png', block='hero-block.png', crouchBlock='hero-crouch-block.png',
             jumpStart='hero-jump-start.png', jumpRise='hero-jump-rise.png', jumpPeak='hero-jump-peak.png', jumpLand='hero-jump-land.png',
             punchStart='hero-punch-start.png', punchHit='hero-punch-hit.png',
             punchHeavyStart='hero-punch-heavy-start.png', punchHeavyHit='hero-punch-heavy-hit.png', punchHeavyRecover='hero-punch-heavy-recover.png',
             specialIn1='hero-special-in-1.png', specialIn2='hero-special-in-2.png', specialIn3='hero-special-in-3.png',
             specialCharge='hero-special-charge.png', specialThrow='hero-special-throw.png', specialRecover='hero-special-recover.png',
             hurt='hero-hurt.png', hurtRecover='hero-hurt-recover.png',
             exitLean='hero-exit-lean.png', exitCrouch='hero-exit-crouch.png', exitGround='hero-exit-ground.png', exitSpring='hero-exit-spring.png',
             kickStart='hero-kick-start.png', kickHit='hero-kick-hit.png',
             koStagger='hero-ko-stagger.png', koFall='hero-ko-fall.png', koAir='hero-ko-air.png', koDown='hero-ko-down.png', launch='hero-launch.png',
             slamFall='hero-slam-fall.png', slamDown='hero-slam-down.png', slamBounce='hero-slam-bounce.png',
             groundCharge='hero-ground-charge.png', groundRise='hero-ground-rise.png', groundPalm='hero-ground-palm.png',
             punchChain1='hero-punch-chain-1.png', punchChain2='hero-punch-chain-2.png', punchMidHit='hero-punch-mid-hit.png', punchMidRecover='hero-punch-mid-recover.png')


def load(name: str) -> np.ndarray:
    """Charge une illustration, efface les logos des baskets et retire le fond vert."""
    image = Image.open(ART / FILES[name]).convert('RGB')
    # illustration en largeur (personnage allongé) : réduite à la largeur de la toile et posée en bas
    if image.size == (H, W):
        # le fond ajouté reprend le vert de l'illustration, pour être détouré avec lui
        canvas = Image.new('RGB', (W, H), image.getpixel((4, 4)))
        canvas.paste(image.resize((W, W * W // H), Image.LANCZOS), (0, H - W * W // H))
        image = canvas
    rgb = np.asarray(image).copy()
    assert rgb.shape[:2] == (H, W), name
    for points in LOGOS.get(name, []):
        zone = poly(points)
        dark = zone & (rgb.max(axis=2) < 120)
        dark = cv2.dilate(dark.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & zone
        rgb[dark] = WHITE
    for x0, y0, x1, y1 in RED_LOGOS.get(name, []):
        r, g, b = [rgb[y0:y1, x0:x1, i].astype(int) for i in range(3)]
        mark = ((r > 110) & (r - g > 50) & (r - b > 40)) | (np.maximum(np.maximum(r, g), b) < 70)
        mask = np.zeros(rgb.shape[:2], np.uint8)
        mask[y0:y1, x0:x1][mark] = 255
        mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
        rgb = cv2.inpaint(rgb, mask, 4, cv2.INPAINT_TELEA)
    for x0, y0, x1, y1 in GRAY_LOGOS.get(name, []):
        zone = rgb[y0:y1, x0:x1].astype(int)
        mark = (zone.max(axis=2) < 215) & (zone.max(axis=2) - zone.min(axis=2) < 45)
        mask = np.zeros(rgb.shape[:2], np.uint8)
        mask[y0:y1, x0:x1][mark] = 255
        mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
        rgb = cv2.inpaint(rgb, mask, 4, cv2.INPAINT_TELEA)
    for x0, y0, x1, y1 in DARK_LOGOS.get(name, []):
        mask = np.zeros(rgb.shape[:2], np.uint8)
        mask[y0:y1, x0:x1][rgb[y0:y1, x0:x1].max(axis=2) > 120] = 255
        mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
        rgb = cv2.inpaint(rgb, mask, 4, cv2.INPAINT_TELEA)
    for points in FAINT_LOGOS.get(name, []):
        zone = poly(points)
        rgb[zone & (rgb.max(axis=2) > 150)] = WHITE
    return key_green(rgb)


def key_green(rgb: np.ndarray) -> np.ndarray:
    """Retire le fond vert d'une illustration et retourne l'image avec sa transparence."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    # le vert du fond varie d'une image générée à l'autre : on le mesure dans un coin plutôt que de le supposer
    bg = np.median(f[4:60, 4:60].reshape(-1, 3), axis=0).astype(np.float32)
    full = bg[1] - max(bg[0], bg[2]) - 12
    alpha = 1 - np.clip((g - np.maximum(r, b) - 40) / (full - 40), 0, 1)
    a = np.maximum(alpha, 0.02)[..., None]
    col = np.clip((f - (1 - a) * bg) / a, 0, 255)
    col[..., 1] = np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]))
    alpha[alpha < 0.06] = 0
    # poussières : un pixel isolé du fond suffit à agrandir le rectangle d'un calque jusqu'au bord de l'image
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), connectivity=8)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] < 30:
            alpha[labels == i] = 0
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


def cut_walk(art: np.ndarray) -> dict:
    vis = art[..., 3] > 0
    red = is_red(art)
    names = list(WALK_POLY)
    label = np.full((H, W), -1, np.int16)
    for i, name in reversed(list(enumerate(names))):
        label[poly(WALK_POLY[name]) & vis] = i
    # l'écharpe de la hanche part vers la gauche : elle reste avec la hanche, pas avec les rubans du bandeau
    sash = red & poly([(150, 780), (400, 780), (400, 1010), (150, 1010)]) & (label != names.index('arm_near'))
    label[sash] = names.index('hip')
    ribbons = vis & (label < 0) & poly(WALK_LEFT)
    ribbons |= red & poly([(380, 120), (505, 120), (505, 235), (380, 235)]) & (label < 0)
    ribbons |= red & (label == names.index('arm_near')) & poly([(190, 560), (245, 560), (245, 660), (190, 660)])
    ribbons &= near_red(red)
    label[(label < 0) & ~ribbons & vis & poly([(150, 900), (640, 900), (640, 1300), (150, 1300)])] = names.index('thigh_far')
    # les bouts de lanière qui dépassent de la cuisse avant bougent avec elle
    label[(label < 0) & ~ribbons & vis & poly([(600, 650), (900, 650), (900, 1100), (600, 1100)])] = names.index('thigh_near')
    low = ribbons & poly(WALK_RIBBON_LOW)
    layers = {name: art * ((label == i) & ~ribbons)[..., None] for i, name in enumerate(names)}
    layers['ribbons'] = art * (ribbons & ~low)[..., None]
    layers['ribbon_low'] = art * low[..., None]
    layers['torso'] = art * (vis & (label < 0) & ~ribbons)[..., None]

    def cloth(points) -> np.ndarray:
        return np.median(art[poly(points) & ~red & vis][:, :3], axis=0)
    pants = cloth([(400, 780), (450, 780), (450, 840), (400, 840)])
    tone = dict(torso=cloth([(380, 600), (450, 600), (450, 640), (380, 640)]))
    for name, pts in WALK_FILL.items():
        fill_hidden(layers[name], poly(pts) & vis, tone.get(name, pants))
    for name, (start, end, thick) in WALK_CAPSULE.items():
        shape = np.zeros((H, W), np.uint8)
        cv2.line(shape, start, end, 1, thick, cv2.LINE_AA)
        fill_hidden(layers[name], shape.astype(bool) & (vis | (name == 'thigh_far')), pants)
    # bassin : une masse sombre sous les deux cuisses, pour qu'aucun jour n'apparaisse quand elles s'écartent
    pelvis = np.zeros((H, W, 4), np.uint8)
    mask = np.zeros((H, W), np.uint8)
    cv2.ellipse(mask, (520, 820), (130, 120), 0, 0, 360, 255, -1)
    pelvis[..., :3] = pants
    pelvis[..., 3] = cv2.GaussianBlur(mask, (0, 0), 1.2)
    layers['pelvis'] = pelvis
    # la coupe du genou tombe en plein tissu : fondu sur le bord bas des cuisses
    yy, xx = np.mgrid[0:H, 0:W]
    for name, (p0, p1) in WALK_KNEE.items():
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


def cut_on_guard_legs(art: np.ndarray, guard: dict, shift: tuple) -> dict:
    """Garde le haut du corps d'un coup, coupé juste sous la ceinture, à poser sur les jambes de la garde."""
    dx, dy = shift
    # la ligne de taille de la garde, ramenée dans le repère du coup et descendue pour recouvrir la ceinture
    line = [(x - dx, y - dy + 14) for x, y in GUARD_WAIST]
    above = poly([(-200, -200)] + [(-200, line[0][1])] + line + [(W + 200, line[-1][1]), (W + 200, -200)])
    return dict(ribbon_low=guard['ribbon_low'], lower=guard['lower'], upper=art * ((art[..., 3] > 0) & above)[..., None])


def pack(name: str, layers: dict, shifts: dict | None = None) -> tuple:
    """Range les calques d'une pose dans son atlas. Retourne les rectangles, les positions et la taille.
    `shifts` déplace le rectangle d'un calque dans la toile, sans toucher à son image."""
    boxes, crops = {}, {}
    for key, layer in layers.items():
        ys, xs = np.where(layer[..., 3] > 0)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        crop = layer[y0:y1, x0:x1].copy()
        crop[crop[..., 3] == 0] = 0
        crops[key] = np.pad(crop, ((PAD, PAD), (PAD, PAD), (0, 0)))
        sx, sy = (shifts or {}).get(key, (0, 0))
        boxes[key] = (int(x0 - PAD + sx), int(y0 - PAD + sy), int(x1 - x0 + 2 * PAD), int(y1 - y0 + 2 * PAD))
    # côtés en puissances de deux (pour les mipmaps), au plus juste : une pose en un seul calque tient dans 1024 de large
    atlas_width = 1024 if len(layers) == 1 and max(c.shape[1] for c in crops.values()) <= 1024 else 2048
    place, x, y, shelf = {}, 0, 0, 0
    for key in sorted(layers, key=lambda k: -crops[k].shape[0]):
        h, w = crops[key].shape[:2]
        if x + w > atlas_width:
            x, y, shelf = 0, y + shelf, 0
        place[key] = (x, y)
        x, shelf = x + w, max(shelf, h)
    print(f'  {name} : hauteur utilisée {y + shelf}')
    height = 1 << (y + shelf - 1).bit_length()
    atlas = np.zeros((height, atlas_width, 4), np.uint8)
    for key, (ax, ay) in place.items():
        h, w = crops[key].shape[:2]
        atlas[ay:ay + h, ax:ax + w] = crops[key]
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    return boxes, place, (atlas_width, height)


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
        walk=(cut_walk(arts['walk']), WALK_PARENT, WALK_PIVOT, WALK_JOINTS),
    )
    for name in SINGLE:
        poses[name] = (dict(body=arts[name]), dict(body=None), dict(body='center'), dict(center=(512, 768)))
    for name, shift in ON_GUARD_LEGS.items():
        layers = cut_on_guard_legs(arts[name], poses['guard'][0], shift)
        poses[name] = (layers, dict.fromkeys(layers), dict.fromkeys(layers, 'center'), dict(center=(512, 768)))
    blocks = []
    for name, (layers, parent, pivot, joints) in poses.items():
        on_guard = name in ON_GUARD_LEGS
        boxes, place, size = pack(name, layers, dict(upper=ON_GUARD_LEGS[name]) if on_guard else None)
        order = list(layers)
        # sur les jambes de la garde, le point d'appui est celui de la garde
        ax, ay = anchor(arts['guard' if on_guard else name])
        ax = SINGLE.get(name) or ax
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
