"""Répare une COPIE du maître : rebouche les blancs détourés par erreur, retire les restes de damier."""
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image
src, out = Path(sys.argv[1]), Path(sys.argv[2])
M = np.asarray(Image.open(src).convert('RGBA')).copy()
rgb, A = M[..., :3].copy(), M[..., 3].copy()
H, W = A.shape
mx, mn = rgb.max(2).astype(int), rgb.min(2).astype(int)
light = (mx > 135) & (mx - mn < 70)

def poly(points):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(points, np.int32)], 1); return m.astype(bool)

# 1. vrais vides (fond visible entre des éléments) : on y retire les restes clairs du faux damier
GAPS = [poly([(222, 345), (262, 322), (318, 322), (318, 372), (268, 398), (226, 412)]),   # entre deux rubans
        poly([(398, 150), (440, 140), (500, 140), (500, 160), (470, 192), (400, 196)]),   # sous le noeud du bandeau
        poly([(380, 684), (416, 684), (416, 728), (380, 728)])]                           # entre gant gauche et veste
gap = np.zeros((H, W), bool)
for g in GAPS: gap |= g
# zone des rubans libres à gauche : aucun blanc n'y est dessiné, tout pixel clair est un reste de damier
ribbon_zone = poly([(0, 100), (400, 100), (400, 200), (330, 260), (250, 440), (200, 560), (262, 640), (262, 880), (330, 900), (330, 1100), (0, 1100)])
# autour du noeud du bandeau (pas de blanc dessiné à gauche de la chaîne) et le long des dreads côté droit
knot_zone = poly([(330, 95), (545, 95), (545, 196), (498, 196), (498, 240), (330, 240)])
hair_edge = poly([(690, 20), (800, 20), (800, 215), (712, 215), (690, 190)])
outside = cv2.dilate((A == 0).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
junk = light & (A > 0) & (gap | ribbon_zone | knot_zone | (hair_edge & outside))
junk = cv2.dilate(junk.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (A > 0) & ((mx - mn < 110) | (A < 255))
A2 = A.copy(); A2[junk] = 0
print('restes de damier retirés :', int(junk.sum()), 'px')

# 2. trous internes restants = blancs détourés par erreur -> rebouchés
solid = (A2 > 0).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(1 - solid, 4)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
fill = np.zeros((H, W), bool)
for i in range(1, n):
    if i in border: continue
    comp = lab == i
    if (comp & (gap | ribbon_zone)).sum() > 0.5 * st[i][4]: continue
    fill |= comp
filled = solid.astype(bool) | fill
interior = cv2.erode(filled.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
todo = (fill | (interior & (A2 < 255)))
print('pixels rebouchés :', int(fill.sum()), ' pixels semi-transparents internes rendus opaques :', int((todo & ~fill).sum()))
# couleur de remplissage : propagée depuis les voisins opaques (blancs/gris clairs)
# les pixels de bord semi-transparents ont gardé leur vraie couleur : ils redeviennent opaques tels quels
# et servent de source pour reboucher les pixels totalement effacés (alpha 0)
hole = todo & (A2 == 0)
inp = cv2.inpaint(np.where((A2 > 0)[..., None], rgb, 0).astype(np.uint8), hole.astype(np.uint8), 3, cv2.INPAINT_TELEA)
rgb2 = np.where(hole[..., None], inp, rgb).astype(np.uint8)
A3 = A2.copy(); A3[todo] = 255
rgb2[A3 == 0] = 0
Image.fromarray(np.dstack([rgb2, A3])).save(out / 'master_repaired.png')
Image.fromarray((todo * 255).astype(np.uint8)).save(out / 'repair_filled_mask.png')
Image.fromarray((junk * 255).astype(np.uint8)).save(out / 'repair_removed_mask.png')
n, lab, st, _ = cv2.connectedComponentsWithStats((A3 == 0).astype(np.uint8), 4)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
print('trous internes restants :', [(int(st[i][0]), int(st[i][1]), int(st[i][4])) for i in range(1, n) if i not in border])
n2, _, st2, _ = cv2.connectedComponentsWithStats((A3 > 0).astype(np.uint8), 8)
print('îlots :', [(int(s[0]), int(s[1]), int(s[4])) for s in st2[1:] if s[4] < 5000])
