"""Segmente la copie réparée du maître en parties (carte d'étiquettes), repère du maître 1024 x 1536."""
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

out = Path(sys.argv[1])
M = np.asarray(Image.open(out / 'master_repaired.png').convert('RGBA'))
H, W = M.shape[:2]
R, G, B, A = [M[..., i].astype(int) for i in range(4)]
vis = A > 0
mx, mn = np.maximum(np.maximum(R, G), B), np.minimum(np.minimum(R, G), B)
redcloth = vis & (R > 55) & (G < 0.40 * R) & (B < 0.50 * R)
skin = vis & (R > 60) & (G >= 0.40 * R) & (G <= 0.80 * R) & (B < 0.9 * G) & (R - B > 25)
light = vis & (mx > 135) & (mx - mn < 70)
reddish = vis & (R > G + 12) & (R > B + 12)

NAMES = ['', 'rb_top', 'rb_knot', 'rb_long', 'rb_mid', 'rb_low', 'rb_bottom', 'rb_hip', 'rb_right',
         'lower', 'torso', 'jacket', 'arm_r', 'arm_l', 'sleeve_l', 'sleeve_r', 'head', 'hair']
ID = {n: i for i, n in enumerate(NAMES)}

def poly(points):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(points, np.int32)], 1); return m.astype(bool)

def line(m, pts, t=3):
    cv2.polylines(m, [np.array(pts, np.int32)], False, 0, t)

def fill(m):
    return ndi.binary_fill_holes(m)

lab = np.zeros((H, W), np.uint8)

# ---------- 1. rubans : composantes rouges, coupées là où deux tissus rouges se touchent ----------
rc = redcloth.astype(np.uint8)
line(rc, [(539, 85), (539, 150)])                                   # racine du ruban du haut / bandeau
line(rc, [(360, 191), (406, 190)], 2)                                  # ruban du haut / ruban long
line(rc, [(408, 226), (419, 206), (427, 190), (431, 184)])          # pointe gauche de la capuche
line(rc, [(427, 190), (445, 193), (458, 196), (468, 187), (480, 180), (500, 177), (527, 173), (546, 165)])  # bord haut de la capuche
n, cc = cv2.connectedComponents(rc, connectivity=4)
SEEDS = {'rb_top': [(430, 140)], 'rb_knot': [(490, 165)], 'rb_long': [(250, 250)], 'rb_mid': [(250, 335), (200, 440)],
         'rb_low': [(150, 680)], 'rb_bottom': [(200, 880)], 'rb_hip': [(290, 1000)], 'rb_right': [(900, 930)]}
if '--debug' in sys.argv:
    rng = np.random.RandomState(1); pal = rng.randint(60, 255, (n, 3)).astype(np.uint8); pal[0] = (0, 0, 0)
    Image.fromarray(pal[cc]).save(out / 'dbg_cc.png')
for name, pts in SEEDS.items():
    for x, y in pts:
        win = cc[y - 10:y + 11, x - 10:x + 11]
        ids = np.bincount(win[win > 0])
        assert len(ids), (name, x, y)
        lab[cc == ids.argmax()] = ID[name]
ribbon_zone = poly([(0, 80), (548, 80), (548, 200), (440, 200), (360, 240), (250, 440), (200, 560), (262, 640), (262, 760), (300, 860), (390, 860), (390, 1100), (0, 1100)]) | poly([(840, 835), (1000, 835), (1000, 1120), (890, 1120)])
# le trait d'encre et l'anticrénelage du bord appartiennent au ruban ; les lignes de coupe sont rendues au voisin
rib = lab > 0
for _ in range(4):
    near = cv2.dilate(rib.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    grow = near & ~rib & vis & (cc == 0) & (reddish | (A < 255)) & ~skin
    if not grow.any(): break
    rib |= grow
_, idx = ndi.distance_transform_edt(lab == 0, return_indices=True)
lab = np.where(rib, lab[idx[0], idx[1]], 0).astype(np.uint8)
for i in range(1, 9):
    m = fill(lab == i) & vis
    lab[m & (lab == 0)] = i
ribbons = lab > 0

# ---------- 2. corps ----------
body = vis & ~ribbons
L = np.zeros((H, W), np.uint8)
L[body] = ID['lower']

J = poly([(200, 150), (1010, 150), (1010, 640), (792, 680), (786, 693), (768, 681), (740, 656), (712, 626), (700, 600), (480, 598), (440, 634), (408, 690), (403, 700), (360, 702), (200, 705)])
L[body & J] = ID['jacket']

T = poly([(545, 163), (560, 100), (700, 100), (700, 190), (660, 214), (650, 226), (640, 236), (606, 232), (630, 246), (646, 275), (660, 292), (672, 316), (680, 345), (692, 387), (697, 453), (692, 495), (700, 527), (717, 550), (735, 580), (760, 615), (784, 655), (778, 680), (765, 672), (735, 642), (712, 618), (700, 606), (680, 619), (647, 629), (620, 624), (590, 612), (547, 600), (510, 612), (480, 632), (470, 655), (455, 680), (445, 700), (428, 716), (412, 712), (405, 690), (415, 668), (440, 632), (480, 597), (500, 573), (527, 533), (552, 497), (563, 477), (568, 430), (572, 385), (567, 360), (560, 335), (552, 315), (535, 265), (524, 250), (502, 202), (535, 167)])
Tband = cv2.dilate(T.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(bool)
Tcore = cv2.erode(T.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(bool)
tors = body & (Tcore | (Tband & (light | skin)))
tors = fill(cv2.morphologyEx(tors.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)) & body & Tband
L[tors] = ID['torso']

SL = poly([(200, 200), (404, 214), (424, 300), (438, 420), (440, 520), (418, 580), (392, 620), (370, 642), (240, 642), (200, 560)])
SR = poly([(722, 275), (748, 400), (764, 500), (772, 560), (778, 596), (800, 583), (840, 571), (870, 592), (1010, 600), (1010, 250)])
L[body & SL & (L == ID['jacket'])] = ID['sleeve_l']
L[body & SR & (L == ID['jacket'])] = ID['sleeve_r']

AL = poly([(273, 612), (271, 590), (276, 578), (290, 566), (304, 557), (327, 552), (350, 555), (372, 566), (381, 584), (378, 600), (372, 618), (362, 640), (378, 658), (381, 705), (387, 728), (399, 740), (402, 750), (416, 754), (423, 770), (423, 800), (413, 821), (391, 832), (365, 844), (332, 847), (305, 834), (282, 807), (255, 800), (255, 640)])
AR = poly([(779, 596), (800, 580), (840, 568), (852, 574), (965, 640), (965, 845), (878, 845), (868, 829), (845, 807), (831, 778), (823, 742), (829, 722), (816, 702), (803, 688), (799, 668), (789, 652), (784, 630)])
L[body & AL] = ID['arm_l']
L[body & AR] = ID['arm_r']

HZ = poly([(495, 0), (800, 0), (800, 215), (684, 215), (676, 200), (660, 212), (652, 224), (645, 234), (634, 239), (618, 236), (603, 224), (590, 208), (578, 190), (573, 166), (562, 160), (552, 172), (540, 172), (528, 160), (515, 150), (495, 150)])
PH = poly([(556, 105), (700, 105), (700, 188), (676, 200), (660, 212), (652, 224), (645, 234), (634, 239), (618, 236), (603, 224), (590, 208), (578, 190), (573, 166), (562, 160), (555, 140)])
EYE = poly([(629, 151), (651, 153), (652, 167), (640, 168), (629, 163)])
head = fill((skin & PH) | (EYE & body)) & body & PH
L[body & HZ & ~skin] = ID['hair']
L[body & HZ & skin & ~PH] = ID['torso']
# le trait d'encre de la mâchoire, du menton et du profil appartient à la tête, pas aux cheveux
YY, XX = np.mgrid[0:H, 0:W]
jaw_zone = PH & ((YY > 185) | ((XX < 640) & (YY > 158)) | (XX < 566))
for _ in range(3):
    head |= cv2.dilate(head.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & body & jaw_zone & ~skin
L[body & PH & ~head] = ID['hair']
L[head] = ID['head']

lab = np.where(ribbons, lab, L).astype(np.uint8)
# petits îlots : rattachés à l'étiquette voisine majoritaire
for i in range(1, len(NAMES)):
    n, c, st, _ = cv2.connectedComponentsWithStats((lab == i).astype(np.uint8), 8)
    for k in range(1, n):
        if st[k][4] < 400:
            comp = c == k
            ring = cv2.dilate(comp.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~comp & (lab > 0)
            if ring.any():
                vals = np.bincount(lab[ring], minlength=len(NAMES)); vals[i] = 0
                if vals.max() > 0: lab[comp] = vals.argmax()
Image.fromarray(lab).save(out / 'labels.png')
PAL = np.array([(0, 0, 0), (255, 80, 80), (255, 170, 0), (255, 255, 0), (120, 255, 0), (0, 220, 120), (0, 220, 255), (255, 255, 255), (255, 0, 255),
                (70, 90, 200), (240, 240, 150), (150, 60, 200), (0, 150, 150), (0, 255, 200), (200, 120, 60), (120, 200, 60), (255, 150, 200), (90, 255, 90)], np.uint8)
ov = (M[..., :3] * 0.45 + PAL[lab] * 0.55).astype(np.uint8)
edge = np.zeros((H, W), bool)
edge[:-1] |= lab[:-1] != lab[1:]; edge[:, :-1] |= lab[:, :-1] != lab[:, 1:]
ov[edge & (lab > 0)] = (255, 255, 255)
ov[lab == 0] = (15, 15, 40)
Image.fromarray(ov).save(out / 'labels_overlay.png')
for i, nme in enumerate(NAMES[1:], 1):
    print('%-10s %7d px' % (nme, (lab == i).sum()))
