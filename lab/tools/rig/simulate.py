"""Simule la pose neutre (respiration + rubans) à partir des calques, et contrôle trous et raccords.

Usage : simulate.py dossier_rig [--stress 2.0]
Écrit rig.json et les aperçus dans 05_apercus/.
"""
import sys, json, math
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

rig_dir = Path(sys.argv[1])
STRESS = float(sys.argv[sys.argv.index('--stress') + 1]) if '--stress' in sys.argv else 2.0
W, H = 1024, 1536
TAU = 2 * math.pi

# Hiérarchie et mouvement. Coordonnées en pixels du maître. Angles en degrés, phases en fraction de cycle.
#   follow 'matrix' : hérite de toute la transformation du parent (reste soudé à lui)
#   follow 'point'  : suit rigidement le déplacement de son pivot sur le parent (pas de déformation héritée)
RIG = {
    'cycle_seconds': 4.0,
    'layers': {
        'lower':    dict(parent=None, pivot=[560, 1500]),
        'torso':    dict(parent='lower', follow='matrix', pivot=[610, 640], breath_scale=[0.005, 0.009]),
        'jacket':   dict(parent='torso', follow='matrix', pivot=[610, 640], breath_scale=[0.003, 0.0]),
        'sleeve_l': dict(parent='jacket', follow='matrix', pivot=[400, 290], rot=0.25, phase=0.05),
        'sleeve_r': dict(parent='jacket', follow='matrix', pivot=[735, 300], rot=-0.20, phase=0.05),
        'arm_l':    dict(parent='sleeve_l', follow='point', pivot=[330, 560], rot=0.30, phase=0.12),
        'arm_r':    dict(parent='sleeve_r', follow='point', pivot=[810, 578], rot=-0.25, phase=0.12),
        'head':     dict(parent='torso', follow='point', pivot=[590, 215], rot=0.45, phase=0.10, lift=-0.5),
        'hair':     dict(parent='head', follow='matrix', pivot=[620, 120], rot=0.12, phase=0.20),
        'rb_top':   dict(parent='head', follow='point', pivot=[532, 125], sway=1.2, bend=4.0, phase=0.30, axis=[-1.0, 0.35], length=180),
        'rb_knot':  dict(parent='head', follow='point', pivot=[530, 165], sway=1.0, bend=2.0, phase=0.42, axis=[-1.0, 0.25], length=95),
        'rb_long':  dict(parent='torso', follow='point', pivot=[432, 208], sway=0.9, bend=7.0, phase=0.38, axis=[-1.0, 0.45], length=400),
        'rb_mid':   dict(parent='torso', follow='point', pivot=[318, 350], sway=0.9, bend=7.0, phase=0.52, axis=[-0.75, 0.66], length=400),
        'rb_low':   dict(parent='torso', follow='point', pivot=[262, 615], sway=1.0, bend=6.0, phase=0.66, axis=[-0.66, 0.75], length=300),
        'rb_bottom': dict(parent='torso', follow='point', pivot=[286, 772], sway=1.0, bend=6.0, phase=0.80, axis=[-0.5, 0.87], length=290),
        'rb_hip':   dict(parent='lower', follow='point', pivot=[356, 866], sway=0.9, bend=4.0, phase=0.92, axis=[-0.4, 0.92], length=210),
        'rb_right': dict(parent='lower', follow='point', pivot=[850, 848], sway=0.8, bend=4.0, phase=0.60, axis=[0.4, 0.92], length=260),
    },
}
meta = json.load(open(rig_dir / 'calques.json'))
ORDER = [m['name'] for m in meta]
for m in meta:
    RIG['layers'][m['name']].update(z=m['z'], file=m['file'], bbox=m['bbox'])
RIG['canvas'] = [W, H]
RIG['draw_order_back_to_front'] = ORDER
json.dump(RIG, open(rig_dir / 'rig.json', 'w'), indent=1, ensure_ascii=False)

layers = {}
for m in meta:
    a = np.asarray(Image.open(rig_dir / m['file'])).astype(np.float32) / 255
    layers[m['name']] = np.dstack([a[..., :3] * a[..., 3:], a[..., 3]])      # prémultiplié
recon = {}
for m in meta:
    k = np.asarray(Image.open(rig_dir / '03_masques' / (Path(m['file']).stem + '_masque.png')))
    recon[m['name']] = (k == 80).astype(np.float32)

def T(dx, dy): return np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1]], np.float64)
def about(px, py, Mx): return T(px, py) @ Mx @ T(-px, -py)
def Rot(deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg)); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], np.float64)
def Sc(sx, sy): return np.diag([sx, sy, 1.0])

def matrices(t, k=1.0):
    """t dans [0,1[ : position dans le cycle ; k : facteur d'amplitude (1 = animation prévue)."""
    out = {}
    def solve(name):
        if name in out: return out[name]
        L = RIG['layers'][name]; px, py = L['pivot']
        ph = TAU * (t - L.get('phase', 0.0))
        breath = (1 - math.cos(ph)) / 2
        local = np.eye(3)
        if 'breath_scale' in L:
            local = about(px, py, Sc(1 + k * L['breath_scale'][0] * breath, 1 + k * L['breath_scale'][1] * breath))
        ang = k * (L.get('rot', 0.0) * math.sin(ph) + L.get('sway', 0.0) * math.sin(ph))
        local = T(0, k * L.get('lift', 0.0) * breath) @ about(px, py, Rot(ang)) @ local
        if L['parent'] is None:
            Mx = local
        else:
            P = solve(L['parent'])
            if L['follow'] == 'matrix':
                Mx = P @ local
            else:
                q = P @ np.array([px, py, 1.0]); Mx = T(q[0] - px, q[1] - py) @ local
        out[name] = Mx; return Mx
    for n in RIG['layers']: solve(n)
    return out

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

def warp(img, name, Mx, t, k):
    L = RIG['layers'][name]
    inv = np.linalg.inv(Mx)
    mx = inv[0, 0] * XX + inv[0, 1] * YY + inv[0, 2]
    my = inv[1, 0] * XX + inv[1, 1] * YY + inv[1, 2]
    if 'bend' in L:      # ondulation : déplacement perpendiculaire à l'axe, nul à la racine, maximal à la pointe
        ax = np.array(L['axis'], np.float32); ax /= np.linalg.norm(ax)
        s = np.clip(((mx - L['pivot'][0]) * ax[0] + (my - L['pivot'][1]) * ax[1]) / L['length'], 0, 1.3)
        d = k * L['bend'] * s * s * np.sin(TAU * (t - L['phase']) - 2.2 * s)
        mx = mx + d * ax[1]; my = my - d * ax[0]
    return cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

def render(t, k=1.0, with_recon=False):
    Ms = matrices(t, k)
    acc = np.zeros((H, W, 4), np.float32); seen = np.zeros((H, W), np.float32)
    for n in ORDER:
        L = warp(layers[n], n, Ms[n], t, k)
        acc = L + acc * (1 - L[..., 3:])
        if with_recon:
            r = warp(recon[n], n, Ms[n], t, k) * L[..., 3]
            seen = r + seen * (1 - L[..., 3])
    return (acc, seen) if with_recon else acc

def on(bg, im):
    return np.clip(im[..., :3] + np.array(bg, np.float32) / 255 * (1 - im[..., 3:]), 0, 1)

def checker(sz=16):
    c = ((XX // sz + YY // sz) % 2)[..., None]; return (0.80 + 0.12 * c) * np.ones((H, W, 3), np.float32)

def save(arr, path):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)

out = rig_dir / '05_apercus'; out.mkdir(exist_ok=True)
rest = render(0.0, 0.0)
master = np.asarray(Image.open(rig_dir / '01_base' / 'master_repaired.png')).astype(np.float32) / 255
mp = np.dstack([master[..., :3] * master[..., 3:], master[..., 3]])
print('repos vs maître réparé : écart max %.4f (sur 1.0)' % np.abs(rest - mp).max())
ck = checker()
save(np.hstack([on((255, 255, 255), rest), on((24, 24, 30), rest), rest[..., :3] + ck * (1 - rest[..., 3:])]), out / 'composition_fonds_clair_sombre_damier.png')

def cracks(a, ref_holes):
    solid = a > 0.5
    holes = ndi.binary_fill_holes(solid) & ~solid
    n, lab = cv2.connectedComponents(holes.astype(np.uint8), connectivity=8)
    new = 0
    for i in range(1, n):
        c = lab == i
        if not (c & ref_holes).any(): new += int(c.sum())
    return new
rest_solid = rest[..., 3] > 0.5
ref_holes = cv2.dilate((ndi.binary_fill_holes(rest_solid) & ~rest_solid).astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool)

rows = []
for k in (1.0, STRESS):
    worst_seen, worst_crack, worst_move = 0, 0, 0.0
    for i in range(24):
        t = i / 24
        im, seen = render(t, k, True)
        worst_seen = max(worst_seen, int((seen > 0.5).sum()))
        worst_crack = max(worst_crack, cracks(im[..., 3], ref_holes))
        for n, Mx in matrices(t, k).items():
            x0, y0, x1, y1 = RIG['layers'][n]['bbox']
            for cx, cy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
                q = Mx @ np.array([cx, cy, 1.0]); worst_move = max(worst_move, math.hypot(q[0] - cx, q[1] - cy))
    rows.append((k, worst_seen, worst_crack, worst_move))
    print('amplitude x%.1f : pixels reconstruits visibles (pire image) %d, trous nouveaux %d px, déplacement rigide max %.1f px (hors ondulation)' % rows[-1])
json.dump([dict(amplitude=r[0], reconstructed_px_visible_worst=r[1], new_holes_px=r[2], max_rigid_move_px=round(r[3], 2)) for r in rows], open(out / 'controle_mouvement.json', 'w'), indent=1)

# planche : repos, inspiration, mi-cycle, à l'amplitude prévue puis en amplitude forcée, sur fond sombre et clair
tiles = []
for k, bg in ((1.0, (24, 24, 30)), (STRESS, (255, 255, 255))):
    row = [on(bg, render(t, k)) for t in (0.0, 0.25, 0.5, 0.75)]
    tiles.append(np.hstack(row))
sheet = np.vstack(tiles)
save(cv2.resize(sheet, (sheet.shape[1] // 2, sheet.shape[0] // 2), interpolation=cv2.INTER_AREA), out / 'test_mouvement_planche.png')
# différence amplifiée repos / inspiration, pour voir où ça bouge
a, b = render(0.0, 1.0), render(0.5, 1.0)
save(np.clip(np.abs(on((128, 128, 128), a) - on((128, 128, 128), b)) * 4, 0, 1), out / 'test_mouvement_difference_x4.png')
# boucle de TEST (pas l'animation finale) : 24 images, demi-résolution
frames = []
for i in range(24):
    f = on((24, 24, 30), render(i / 24, 1.0))
    frames.append(Image.fromarray((cv2.resize(f, (W // 2, H // 2), interpolation=cv2.INTER_AREA) * 255 + 0.5).astype(np.uint8)))
frames[0].save(out / 'test_boucle_24_images.webp', save_all=True, append_images=frames[1:], duration=int(RIG['cycle_seconds'] * 1000 / 24), loop=0, quality=88)
frames[0].save(out / 'test_boucle_24_images.gif', save_all=True, append_images=frames[1:], duration=int(RIG['cycle_seconds'] * 1000 / 24), loop=0)
# gros plans en amplitude forcée pour l'inspection visuelle
for name, (x0, y0, x1, y1) in dict(cou=(470, 90, 730, 350), poignet_g=(230, 520, 480, 860), taille=(390, 560, 810, 760), epaule_g=(300, 170, 560, 420), poignet_d=(700, 480, 960, 860), rubans=(0, 150, 420, 700)).items():
    crops = [on((70, 200, 90), render(t, STRESS))[y0:y1, x0:x1] for t in (0.0, 0.25, 0.5, 0.75)]
    z = np.hstack(crops)
    s = 2 if (x1 - x0) <= 260 else 1
    save(cv2.resize(z, (z.shape[1] * s, z.shape[0] * s), interpolation=cv2.INTER_NEAREST), out / f'zoom_stress_{name}.png')
