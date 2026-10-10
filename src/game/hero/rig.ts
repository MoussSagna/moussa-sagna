import { RIG } from './rigData'

/** Transformation affine 2D en pixels de la toile : x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number]

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

/** Compose deux transformations : applique `n`, puis `m`. */
function mul(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

/** Applique une transformation linéaire (a, b, c, d) autour d'un pivot. */
function about(px: number, py: number, a: number, b: number, c: number, d: number): Affine {
  return [a, b, c, d, px - a * px - c * py, py - b * px - d * py]
}

/**
 * Transformation de chaque calque à l'instant `time` (secondes), dans l'ordre de `RIG.layers`.
 * Portage de `matrices()` de tools/rig/simulate.py, qui reste la référence.
 * `amplitude` vaut 1 pour l'animation prévue ; `root` s'applique à la racine et à tout ce qui en dépend.
 */
export function rigMatrices(time: number, amplitude: number, root: Affine): Affine[] {
  const t = time / RIG.cycleSeconds
  const out: (Affine | null)[] = RIG.layers.map(() => null)
  const solve = (index: number): Affine => {
    const known = out[index]
    if (known) return known
    const layer = RIG.layers[index]
    const [px, py] = layer.pivot
    const angle = 2 * Math.PI * (t - layer.phase)
    const breath = (1 - Math.cos(angle)) / 2
    const scale = about(px, py, 1 + amplitude * layer.breathScale[0] * breath, 0, 0, 1 + amplitude * layer.breathScale[1] * breath)
    const turn = (amplitude * (layer.rot + layer.sway) * Math.sin(angle) * Math.PI) / 180
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    let local = mul(about(px, py, cos, sin, -sin, cos), scale)
    local[5] += amplitude * layer.lift * breath
    const parent = layer.parent < 0 ? root : solve(layer.parent)
    if (layer.parent < 0 || layer.follow === 'matrix') {
      local = mul(parent, local)
    } else {
      // suit le déplacement de son pivot sur le parent, sans hériter de sa déformation
      local[4] += parent[0] * px + parent[2] * py + parent[4] - px
      local[5] += parent[1] * px + parent[3] * py + parent[5] - py
    }
    out[index] = local
    return local
  }
  return RIG.layers.map((_, index) => solve(index))
}
