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
  dashForward: {},
  dashBack: {},
  crouchStep: {},
  crouch: {},
  blockStep: {},
  block: {},
  crouchBlock: {},
  jumpStart: {},
  jumpRise: {},
  jumpPeak: {},
  jumpLand: {},
  punchStart: {},
  punchHit: {},
  punchHeavyStart: {},
  punchHeavyHit: {},
  punchHeavyRecover: {},
  hurt: {},
  kicksHigh: {},
  kicksMid: {},
  kicksLow: {},
  hurtRecover: {},
  specialIn1: {},
  specialIn2: {},
  specialIn3: {},
  specialCharge: {},
  specialThrow: {},
  specialRecover: {},
  punchChain1: {},
  punchChain2: {},
  punchMidHit: {},
  punchMidRecover: {},
  walk: {
    ribbons: { amplitude: 14, length: 520, axis: [-0.906, 0.423] },
    ribbon_low: { amplitude: 8, length: 200, axis: [-0.93, 0.368] },
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
  lift: 42,
  heelLift: 38,
  heelStrike: -14,
  toeOff: 30,
  hipRise: 14,
  lean: 2.2,
  armNear: 36,
  armFar: 32,
  /** Hauteur de la cheville éloignée quand son pied est à plat, et angle qui remet ce pied à plat. */
  farAnkleGround: 1306,
  farFootFlat: -20,
}

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
export function scaleAbout(pivot: Point, sx: number, sy: number): Affine {
  return [sx, 0, 0, sy, pivot[0] * (1 - sx), pivot[1] * (1 - sy)]
}

/** Pose tenue en un seul calque (accroupi, parade) : le dessin entier respire en se tassant à peine vers le sol, semelles fixes. */
export function heldMatrix(anchor: Point, time: number, amplitude: number): Affine {
  const breath = (1 - Math.cos((2 * Math.PI * time) / GUARD.breath)) / 2
  return scaleAbout(anchor, 1 + amplitude * 0.003 * breath, 1 - amplitude * 0.012 * breath)
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
  return {
    x: GAIT.reach * (2 * smooth(s) - 1),
    lift: GAIT.heelLift * (1 - s) ** 2 + GAIT.lift * Math.sin(Math.PI * s),
    pitch: GAIT.toeOff + (GAIT.heelStrike - GAIT.toeOff) * smooth(s * 1.15),
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

/** Marche : une matrice par calque de `POSES.walk.layers` pour la phase `u` du cycle (0 à 1). */
export function walkMatrices(u: number): Affine[] {
  const j = POSES.walk.joints
  const turn = 2 * Math.PI * u
  // le bassin monte quand une jambe passe à la verticale et redescend à chaque pose du pied
  const rise = -GAIT.hipRise * Math.sin(turn) ** 2
  const lean = (GAIT.lean + 0.8 * Math.sin(2 * turn - 0.6)) * RAD
  const root = place([j.hip_near[0], j.hip_near[1] + rise], j.hip_near, lean)

  const near = footAt(u)
  const far = footAt(u + 0.5)
  const nearLeg = solveLeg(
    apply(root, j.hip_near),
    [j.hip_near, j.knee_near, j.ankle_near],
    [j.hip_near[0] + near.x, j.ankle_near[1] - near.lift],
    near.pitch,
  )
  const farLeg = solveLeg(
    apply(root, j.hip_far),
    [j.hip_far, j.knee_far, j.ankle_far],
    [j.hip_far[0] + far.x, GAIT.farAnkleGround - far.lift],
    far.pitch + GAIT.farFootFlat,
  )
  // les bras balancent à l'opposé des jambes : au repos le bras proche est en arrière, comme sur l'illustration
  const swing = (1 - Math.cos(turn)) / 2
  const head = place(apply(root, j.neck), j.neck, lean * 0.3 + 1.1 * RAD * Math.sin(2 * turn + 1))
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
  return POSES.walk.layers.map((layer) => byName[layer.name] ?? IDENTITY)
}
