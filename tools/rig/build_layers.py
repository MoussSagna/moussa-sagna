"""Construit les calques du rig à partir de master_repaired.png et labels.png (repère du maître)."""
import sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

work = Path(sys.argv[1]); dst = Path(sys.argv[2])
M = np.asarray(Image.open(work / 'master_repaired.png').convert('RGBA'))
lab = np.asarray(Image.open(work / 'labels.png'))
H, W = lab.shape
RGB, A = M[..., :3], M[..., 3]
NAMES = ['', 'rb_top', 'rb_knot', 'rb_long', 'rb_mid', 'rb_low', 'rb_bottom', 'rb_hip', 'rb_right',
         'lower', 'torso', 'jacket', 'arm_r', 'arm_l', 'sleeve_l', 'sleeve_r', 'head', 'hair']
ID = {n: i for i, n in enumerate(NAMES)}
# ordre d'empilement, du fond vers le premier plan
ORDER = ['rb_long', 'rb_mid', 'rb_low', 'rb_bottom', 'rb_hip', 'rb_right', 'rb_top', 'rb_knot',
         'lower', 'torso', 'arm_r', 'jacket', 'arm_l', 'sleeve_r', 'sleeve_l', 'head', 'hair']
MARGIN = {n: 28 for n in ORDER if n.startswith('rb_')}      # px de matière reconstruite sous les calques du dessus
MARGIN.update(lower=14, torso=14, arm_r=14, jacket=14, arm_l=14, sleeve_r=10, sleeve_l=10, head=10, hair=0)
ONLY_UNDER = {'rb_right': ['lower']}                        # ce ruban part de la ceinture : rien à prolonger sous le poing
FEATHER = 14                                                 # fondu des coupes faites en plein tissu
SOFT = [('sleeve_l', 'jacket'), ('sleeve_r', 'jacket')]      # (calque du dessus, calque du dessous)

def poly(points):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(points, np.int32)], 1); return m.astype(bool)

def smooth(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))

own = {n: lab == ID[n] for n in ORDER}
alpha = {n: np.where(own[n], A, 0).astype(np.float32) / 255 for n in ORDER}
true_px = {n: own[n].copy() for n in ORDER}                  # pixels copiés du maître (pas inventés)

for top, under in SOFT:
    d = ndi.distance_transform_edt(~own[under])
    alpha[top] *= np.where(own[top], smooth((d - 1) / FEATHER), 0)
    dup = own[top] & (d <= FEATHER + 3)                      # le dessous garde les vrais pixels sous le fondu
    alpha[top][dup & (A < 255)] = 0                          # bord de silhouette : porté par le dessous seul
    true_px[under] |= dup
    alpha[under] = np.where(dup, A / 255.0, alpha[under]).astype(np.float32)

# tête : fondu dans le cou (le torse garde tout le cou)
NECK = poly([(540, 158), (578, 158), (650, 240), (612, 270), (548, 250), (530, 200)])
d = ndi.distance_transform_edt(~own['head'])
neck = own['torso'] & NECK & (d <= 18)
alpha['head'] = np.where(neck, (A / 255.0) * (1 - smooth(d / 18)), alpha['head']).astype(np.float32)
alpha['head'][neck & (A < 255)] = 0
true_px['head'] |= neck

layers, recon = {}, {}
for k, n in enumerate(ORDER):
    # un pixel reconstruit n'est admis que là où les calques du dessus le recouvrent totalement au repos
    through = np.ones((H, W), np.float32)
    for u in ONLY_UNDER.get(n, ORDER[k + 1:]):
        through *= 1 - alpha[u]
    above = through < 0.001
    have = true_px[n]
    ext = np.zeros((H, W), bool)
    if MARGIN[n]:
        ext = cv2.dilate(have.astype(np.uint8), disk(MARGIN[n])).astype(bool) & above & ~have
    rgb = np.where(have[..., None], RGB, 0).astype(np.uint8)
    if have.any():
        # la matière cachée est prolongée depuis l'intérieur du calque (sans son trait de contour),
        # puis adoucie : c'est un prolongement de couleur, pas un redessin
        core = cv2.erode((have & (A == 255)).astype(np.uint8), disk(5)).astype(bool)
        if core.sum() < 50: core = have & (A > 200)
        _, idx = ndi.distance_transform_edt(~core, return_indices=True)
        far = RGB[idx[0], idx[1]].astype(np.float32)
        far = cv2.GaussianBlur(far, (0, 0), 3)
        _, idx = ndi.distance_transform_edt(~(have & (A > 200)), return_indices=True)
        base = np.where(ext[..., None], far, RGB[idx[0], idx[1]]).astype(np.uint8)
        bleed = cv2.dilate((have | ext).astype(np.uint8), disk(4)).astype(bool)
        rgb = np.where(bleed[..., None], base, 0).astype(np.uint8)
        rgb = np.where((have & (A > 0))[..., None], RGB, rgb)
    a = alpha[n].copy(); a[ext] = 1.0
    layers[n] = np.dstack([rgb, np.round(a * 255).astype(np.uint8)])
    recon[n] = ext

# ---------- recomposition et comparaison ----------
def composite(stack, bg=None):
    acc = np.zeros((H, W, 3), np.float64); aa = np.zeros((H, W), np.float64)
    for n in ORDER:
        L = stack[n]; a = L[..., 3] / 255.0
        acc = L[..., :3] * a[..., None] + acc * (1 - a[..., None])
        aa = a + aa * (1 - a)
    return acc, aa
acc, aa = composite(layers)
ref = RGB.astype(np.float64) * (A[..., None] / 255.0)
diff = np.abs(acc - ref).max(2)
print('recomposition vs maître réparé : écart max %.2f /255, pixels avec écart > 1 : %d, écart alpha max %.3f' % (diff.max(), (diff > 1).sum(), np.abs(aa - A / 255.0).max()))

(dst / '02_calques').mkdir(parents=True, exist_ok=True); (dst / '03_masques').mkdir(parents=True, exist_ok=True)
meta = []
for k, n in enumerate(ORDER, 1):
    L = layers[n]
    Image.fromarray(L).save(dst / '02_calques' / f'{k:02d}_{n}.png', optimize=True)
    mask = np.zeros((H, W), np.uint8)
    mask[true_px[n]] = 160          # vrais pixels du maître gardés en recouvrement (cachés au repos ou fondus)
    mask[own[n]] = 255              # zone visible au repos
    mask[recon[n]] = 80             # pixels reconstruits (inventés par prolongement)
    Image.fromarray(mask).save(dst / '03_masques' / f'{k:02d}_{n}_masque.png', optimize=True)
    ys, xs = np.where(L[..., 3] > 0)
    meta.append(dict(name=n, z=k, file=f'02_calques/{k:02d}_{n}.png', bbox=[int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
                     visible_px=int(own[n].sum()), overlap_true_px=int((true_px[n] & ~own[n]).sum()), reconstructed_px=int(recon[n].sum())))
    print('%02d %-10s visible %7d  recouvrement vrai %6d  reconstruit %6d' % (k, n, meta[-1]['visible_px'], meta[-1]['overlap_true_px'], meta[-1]['reconstructed_px']))
json.dump(meta, open(work / 'layers_meta.json', 'w'), indent=1)
np.save(work / 'recon_all.npy', np.any([recon[n] for n in ORDER], axis=0))
