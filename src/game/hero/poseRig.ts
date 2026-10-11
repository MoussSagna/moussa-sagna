import { POSES } from './poseData'
import type { Point } from './poseData'

/** Transformation affine 2D en pixels de la toile : x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number]

/** Ondulation d'un ruban : amplitude à la pointe et longueur (px), axe unitaire racine vers pointe. */
export interface Bend {
  amplitude: number
  length: number
  axis: Point
}

/** Rubans qui ondulent, par pose et par calque. Les autres calques sont rigides. */
export const BENDS: Record<keyof typeof POSES, Record<string, Bend>> = {
  guard: {
    ribbons: { amplitude: 9, length: 520, axis: [-0.906, 0.423] },
    ribbon_low: { amplitude: 7, length: 300, axis: [-0.555, 0.832] },
  },
  step: {},
  walk: {
    ribbons: { amplitude: 14, length: 520, axis: [-0.906, 0.423] },
    ribbon_low: { amplitude: 8, length: 200, axis: [-0.93, 0.368] },
  },
  walkPass: {
    ribbons: { amplitude: 14, length: 520, axis: [-0.906, 0.423] },
    ribbon_low: { amplitude: 8, length: 240, axis: [-0.8, 0.6] },
  },
  walkReach: {
    ribbons: { amplitude: 14, length: 520, axis: [-0.906, 0.423] },
    ribbon_low: { amplitude: 8, length: 240, axis: [-0.8, 0.6] },
  },
}

/** Garde : durée d'une respiration et d'un rebond sur les appuis (secondes), amplitudes. */
export const GUARD = { breath: 2.8, bounce: 1.4, squash: 0.007, chest: [0.004, 0.008] as Point, head: 0.5, sway: 1 }

/**
 * Réglages de la marche. Longueurs en pixels de la toile, angles en degrés.
 * Un cycle = deux pas. `reach` est la demi-foulée : le pied se pose à +reach devant la hanche
 * et quitte le sol à -reach derrière.
 */
export const GAIT = {
  period: 0.95,
  reach: 170,
  /** Part du cycle où un pied est au sol ; au-dessus de 0,5 les deux pieds sont posés un instant. */
  stance: 0.56,
  /** Levée du pied : au décollage du talon, puis hauteur du pied pendant tout son retour vers l'avant. */
  heelLift: 55,
  kick: 140,
  kickPitch: 28,
  heelStrike: -14,
  toeOff: 30,
  hipRise: 14,
  lean: 2.2,
  armNear: 36,
  armFar: 32,
}

/**
 * Dessins clés de la marche. Chacun sert autour de la phase `at` où il a été dessiné, de `from` à `to`
 * (le premier sert partout ailleurs), et ses membres ne tournent que de l'écart avec cette phase.
 * `farAnkle` : hauteur de la cheville éloignée, en pixels au-dessus de la cheville proche posée.
 * `farFlat` : angle qui remet le pied éloigné à plat.
 */
export type WalkDrawing = 'walk' | 'walkPass' | 'walkReach'

const WALK_KEYS: { pose: WalkDrawing; at: number; from: number; to: number; farAnkle: number; farFlat: number }[] = [
  { pose: 'walk', at: 0, from: 0, to: 1, farAnkle: 14, farFlat: -20 },
  { pose: 'walkPass', at: 0.247, from: 0.13, to: 0.36, farAnkle: 14, farFlat: -54 },
  { pose: 'walkReach', at: 0.45, from: 0.36, to: 0.5, farAnkle: 14, farFlat: -8 },
]

/** Vitesse du corps en pixels de la toile par seconde : exactement celle du pied posé, donc rien ne patine. */
export const WALK_SPEED = (2 * GAIT.reach) / (GAIT.stance * GAIT.period)

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]
const RAD = Math.PI / 180
const smooth = (x: number) => {
  const k = Math.max(0, Math.min(1, x))
  return k * k * (3 - 2 * k)
}
const apply = (m: Affine, p: Point): Point => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]

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

/** Rotation (radians) et échelle qui envoient le point de repos `pivot` sur `target`. */
function place(target: Point, pivot: Point, angle: number, scale = 1): Affine {
  const a = Math.cos(angle) * scale
  const b = Math.sin(angle) * scale
  return [a, b, -b, a, target[0] - a * pivot[0] + b * pivot[1], target[1] - b * pivot[0] - a * pivot[1]]
}

/** Mise à l'échelle autour d'un point fixe. */
function scaleAbout(pivot: Point, sx: number, sy: number): Affine {
  return [sx, 0, 0, sy, pivot[0] * (1 - sx), pivot[1] * (1 - sy)]
}

/**
 * Garde : le corps se tasse un peu sur ses appuis, le buste respire, la tête et les rubans suivent.
 * `amplitude` vaut 1 pour le mouvement prévu. Une matrice par calque de `POSES.guard.layers`.
 */
export function guardMatrices(time: number, amplitude: number): Affine[] {
  const pose = POSES.guard
  const j = pose.joints
  const breath = (1 - Math.cos((2 * Math.PI * time) / GUARD.breath)) / 2
  const bounce = (1 - Math.cos((2 * Math.PI * time) / GUARD.bounce)) / 2
  // les semelles ne bougent pas : tout le corps est écrasé vers la ligne du sol
  const root = scaleAbout(pose.anchor, 1, 1 - amplitude * GUARD.squash * bounce)
  const chest = scaleAbout(j.waist, 1 + amplitude * GUARD.chest[0] * breath, 1 + amplitude * GUARD.chest[1] * breath)
  const upper = mul(root, chest)
  const nod = amplitude * GUARD.head * RAD * Math.sin((2 * Math.PI * time) / GUARD.breath - 0.6)
  const sway = amplitude * GUARD.sway * RAD * Math.sin((2 * Math.PI * time) / GUARD.breath - 1.4)
  const byName: Record<string, Affine> = {
    lower: root,
    upper,
    head: place(apply(upper, j.neck), j.neck, nod),
    ribbons: place(apply(upper, j.ribbon), j.ribbon, sway),
    ribbon_low: place(apply(upper, j.ribbon_low), j.ribbon_low, -sway),
  }
  return pose.layers.map((layer) => byName[layer.name] ?? IDENTITY)
}

/** Trajectoire d'une cheville par rapport à la hanche : avancée, levée et angle du pied. */
function footAt(phase: number): { x: number; lift: number; pitch: number } {
  const p = ((phase % 1) + 1) % 1
  if (p < GAIT.stance) {
    const k = p / GAIT.stance
    const off = smooth((k - 0.66) / 0.34)
    return {
      x: GAIT.reach * (1 - 2 * k),
      lift: GAIT.heelLift * off,
      pitch: GAIT.heelStrike * (1 - smooth(k / 0.16)) + GAIT.toeOff * off,
    }
  }
  const s = (p - GAIT.stance) / (1 - GAIT.stance)
  // le pied monte vite derrière, reste haut pendant qu'il avance (genou levé) et ne redescend qu'à la pose
  const land = smooth((s - 0.45) / 0.5)
  return {
    x: GAIT.reach * (2 * smooth(s) - 1),
    lift: GAIT.heelLift * (1 - s) ** 2 + GAIT.kick * Math.sqrt(Math.sin(Math.PI * s)),
    pitch: (GAIT.toeOff + GAIT.kickPitch * Math.sin(Math.PI * Math.min(1, s / 0.6))) * (1 - land) + GAIT.heelStrike * land,
  }
}

/** Jambe à deux os : cuisse et tibia tournent pour que la cheville atteigne `ankle`, genou vers l'avant. */
function solveLeg(hip: Point, rest: [Point, Point, Point], ankle: Point, pitch: number): [Affine, Affine, Affine] {
  const [hip0, knee0, ankle0] = rest
  const l1 = Math.hypot(knee0[0] - hip0[0], knee0[1] - hip0[1])
  const l2 = Math.hypot(ankle0[0] - knee0[0], ankle0[1] - knee0[1])
  const dx = ankle[0] - hip[0]
  const dy = ankle[1] - hip[1]
  const dist = Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.999)
  const toward = Math.atan2(dy, dx)
  const inner = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))))
  const thigh = toward - inner
  const knee: Point = [hip[0] + l1 * Math.cos(thigh), hip[1] + l1 * Math.sin(thigh)]
  const end: Point = [hip[0] + dist * Math.cos(toward), hip[1] + dist * Math.sin(toward)]
  const shin = Math.atan2(end[1] - knee[1], end[0] - knee[0])
  const thigh0 = Math.atan2(knee0[1] - hip0[1], knee0[0] - hip0[0])
  const shin0 = Math.atan2(ankle0[1] - knee0[1], ankle0[0] - knee0[0])
  return [place(hip, hip0, thigh - thigh0), place(knee, knee0, shin - shin0), place(end, ankle0, pitch * RAD)]
}

/** Mouvements du haut du corps en fonction de la phase : montée du bassin, inclinaison, balancement des bras. */
function bodyAt(u: number): { rise: number; lean: number; swing: number; nod: number } {
  const turn = 2 * Math.PI * u
  return {
    // le bassin monte quand une jambe passe à la verticale et redescend à chaque pose du pied
    rise: -GAIT.hipRise * Math.sin(turn) ** 2,
    lean: (GAIT.lean + 0.8 * Math.sin(2 * turn - 0.6)) * RAD,
    swing: (1 - Math.cos(turn)) / 2,
    nod: 1.1 * RAD * Math.sin(2 * turn + 1),
  }
}

/**
 * Marche : choisit le dessin clé de la phase `u` (0 à 1) et calcule une matrice par calque de ce dessin.
 * Aux changements de dessin, les deux squelettes sont dans la même pose : seul le dessin change.
 */
export function walkPose(u: number): { pose: WalkDrawing; matrices: Affine[] } {
  const key = WALK_KEYS.find((k, index) => index > 0 && u >= k.from && u < k.to) ?? WALK_KEYS[0]
  const j = POSES[key.pose].joints
  const now = bodyAt(u)
  const drawn = bodyAt(key.at)
  const lean = now.lean - drawn.lean
  const root = place([j.hip_near[0], j.hip_near[1] + now.rise - drawn.rise], j.hip_near, lean)

  // les chevilles visent le même point pour tous les dessins : la hauteur du sol est celle du dessin de contact
  const ground = j.hip_near[1] - drawn.rise + GROUND_BELOW_HIP
  const near = footAt(u)
  const far = footAt(u + 0.5)
  const nearLeg = solveLeg(
    apply(root, j.hip_near),
    [j.hip_near, j.knee_near, j.ankle_near],
    [j.hip_near[0] + near.x, ground - near.lift],
    near.pitch - footAt(key.at).pitch,
  )
  const farLeg = solveLeg(
    apply(root, j.hip_far),
    [j.hip_far, j.knee_far, j.ankle_far],
    [j.hip_far[0] + far.x, ground - key.farAnkle - far.lift],
    far.pitch + key.farFlat,
  )
  // les bras balancent à l'opposé des jambes : bras proche en arrière quand la jambe proche est en avant
  const swing = now.swing - drawn.swing
  const head = place(apply(root, j.neck), j.neck, lean * 0.3 + now.nod - drawn.nod)
  const turn = 2 * Math.PI * u
  const byName: Record<string, Affine> = {
    torso: root,
    pelvis: root,
    hip: root,
    head,
    ribbons: place(apply(head, j.ribbon), j.ribbon, 2.5 * RAD * Math.sin(2 * turn + 2)),
    ribbon_low: place(apply(root, j.ribbon_low), j.ribbon_low, 3 * RAD * Math.sin(2 * turn + 0.5)),
    arm_near: place(apply(root, j.shoulder_near), j.shoulder_near, lean - GAIT.armNear * RAD * swing),
    arm_far: place(apply(root, j.shoulder_far), j.shoulder_far, lean + GAIT.armFar * RAD * swing),
    thigh_near: nearLeg[0],
    shin_near: nearLeg[1],
    foot_near: nearLeg[2],
    thigh_far: farLeg[0],
    shin_far: farLeg[1],
    foot_far: farLeg[2],
  }
  return { pose: key.pose, matrices: POSES[key.pose].layers.map((layer) => byName[layer.name] ?? IDENTITY) }
}

/** Hauteur de la cheville proche posée sous la hanche, mesurée sur le dessin de contact. */
const GROUND_BELOW_HIP = POSES.walk.joints.ankle_near[1] - POSES.walk.joints.hip_near[1]

/** Décalage vertical qui pose la cheville proche d'un dessin de marche sur la ligne du sol de la garde. */
export function walkGround(pose: WalkDrawing): number {
  const key = WALK_KEYS.find((k) => k.pose === pose) ?? WALK_KEYS[0]
  return POSES[pose].joints.hip_near[1] - bodyAt(key.at).rise + GROUND_BELOW_HIP
}
