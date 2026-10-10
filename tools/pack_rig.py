"""Range les calques du rig dans un atlas et génère les données du moteur.

Usage : python3 tools/pack_rig.py
Lit moussa_rig/rig.json et moussa_rig/02_calques/, écrit public/assets/hero/rig-atlas.webp
et src/game/hero/rigData.ts. rig.json reste la seule source des pivots et du mouvement.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RIG = ROOT / 'moussa_rig'
ATLAS = ROOT / 'public' / 'assets' / 'hero' / 'rig-atlas.webp'
DATA = ROOT / 'src' / 'game' / 'hero' / 'rigData.ts'
PAD = 8             # marge transparente autour de chaque calque : rien ne bave d'un calque sur l'autre, même en mipmap
ATLAS_WIDTH = 2048  # puissance de deux, pour que le moteur puisse générer les mipmaps


def next_pow2(n: int) -> int:
    return 1 << (n - 1).bit_length()


def main() -> None:
    rig = json.load(open(RIG / 'rig.json'))
    order = rig['draw_order_back_to_front']
    width, height = rig['canvas']
    crops = {}
    for name in order:
        layer = rig['layers'][name]
        x0, y0, x1, y1 = layer['bbox']
        image = np.asarray(Image.open(RIG / layer['file']).convert('RGBA'))
        assert image.shape[:2] == (height, width), name
        crop = image[y0:y1, x0:x1].copy()
        crop[crop[..., 3] == 0] = 0     # aucune couleur sous les pixels transparents
        crops[name] = np.pad(crop, ((PAD, PAD), (PAD, PAD), (0, 0)))

    # rangement en étagères, les calques les plus hauts d'abord
    place, x, y, shelf = {}, 0, 0, 0
    for name in sorted(order, key=lambda n: -crops[n].shape[0]):
        h, w = crops[name].shape[:2]
        if x + w > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf, 0
        place[name] = (x, y)
        x, shelf = x + w, max(shelf, h)
    atlas_height = next_pow2(y + shelf)
    atlas = np.zeros((atlas_height, ATLAS_WIDTH, 4), np.uint8)
    for name, (ax, ay) in place.items():
        h, w = crops[name].shape[:2]
        atlas[ay:ay + h, ax:ax + w] = crops[name]
    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(ATLAS, lossless=True, quality=100, method=6)

    def num(v: float) -> str:
        return repr(round(float(v), 6)).rstrip('0').rstrip('.') if float(v) != int(v) else str(int(v))

    rows = []
    for name in order:
        layer = rig['layers'][name]
        x0, y0, x1, y1 = layer['bbox']
        axis = np.array(layer.get('axis', [1.0, 0.0]), float)
        axis /= np.linalg.norm(axis)
        scale = layer.get('breath_scale', [0, 0])
        fields = [
            f"name: '{name}'",
            f"parent: {order.index(layer['parent']) if layer['parent'] else -1}",
            f"follow: '{layer.get('follow', 'matrix')}'",
            f"pivot: [{num(layer['pivot'][0])}, {num(layer['pivot'][1])}]",
            f"box: [{x0 - PAD}, {y0 - PAD}, {x1 - x0 + 2 * PAD}, {y1 - y0 + 2 * PAD}]",
            f"atlas: [{place[name][0]}, {place[name][1]}]",
            f"breathScale: [{num(scale[0])}, {num(scale[1])}]",
            f"rot: {num(layer.get('rot', 0))}",
            f"sway: {num(layer.get('sway', 0))}",
            f"lift: {num(layer.get('lift', 0))}",
            f"phase: {num(layer.get('phase', 0))}",
            f"bend: {num(layer.get('bend', 0))}",
            f"axis: [{num(axis[0])}, {num(axis[1])}]",
            f"length: {num(layer.get('length', 1))}",
        ]
        rows.append('    { ' + ', '.join(fields) + ' },')
    DATA.write_text(f"""// Fichier généré par tools/pack_rig.py à partir de moussa_rig/rig.json. Ne pas modifier à la main.

export interface RigLayer {{
  name: string
  /** Indice du parent dans `layers`, -1 pour la racine. */
  parent: number
  /** 'matrix' : hérite de toute la transformation du parent ; 'point' : suit seulement le déplacement de son pivot. */
  follow: 'matrix' | 'point'
  pivot: [number, number]
  /** Rectangle du calque dans la toile (x, y, largeur, hauteur), marge transparente comprise. */
  box: [number, number, number, number]
  /** Coin haut gauche de ce rectangle dans l'atlas. */
  atlas: [number, number]
  breathScale: [number, number]
  /** Angles en degrés, phase en fraction de cycle. */
  rot: number
  sway: number
  lift: number
  phase: number
  /** Ondulation des rubans : amplitude à la pointe (px), axe unitaire racine vers pointe, longueur (px). */
  bend: number
  axis: [number, number]
  length: number
}}

/** Le rig du personnage : toile en pixels du maître, calques du fond vers le premier plan. */
export const RIG: {{ canvas: [number, number]; cycleSeconds: number; atlasSize: [number, number]; layers: RigLayer[] }} = {{
  canvas: [{width}, {height}],
  cycleSeconds: {num(rig['cycle_seconds'])},
  atlasSize: [{ATLAS_WIDTH}, {atlas_height}],
  layers: [
{chr(10).join(rows)}
  ],
}}
""")
    used = sum(c.shape[0] * c.shape[1] for c in crops.values())
    print(f'atlas {ATLAS_WIDTH} x {atlas_height}, rempli à {100 * used / (ATLAS_WIDTH * atlas_height):.0f} %, {ATLAS.stat().st_size / 1024:.0f} Ko')
    print(f'{len(order)} calques écrits dans {DATA.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
