import type { Affine } from './rig'
import { WALK_RIG } from './walkData'

/**
 * Réglages de la marche de profil. Longueurs en pixels de la toile, angles en degrés.
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
  armNear: 38,
  armFar: 34,
  /** La jambe éloignée est dessinée plus longue que l'autre : elle est ramenée à la même longueur. */
  farScale: 0.9,
  /** Hauteur de la cheville éloignée quand son pied est à plat, et angle qui remet ce pied à plat. */
  farAnkleGround: 1312,
  farFootFlat: -27,
  ribbonBend: 14,
  ribbonLength: 520,
  ribbonAxis: [-0.906, 0.423] as [number, number],
}

/** Vitesse du corps en pixels de la toile par seconde : exactement celle du pied posé, donc rien ne patine. */
export const WALK_SPEED = (2 * GAIT.reach) / (GAIT.stance * GAIT.period)

type Point = [number, number]
const RAD = Math.PI / 180
const smooth = (x: number) => {
  const k = Math.max(0, Math.min(1, x))
  return k * k * (3 - 2 * k)
}
const apply = (m: Affine, p: Point): Point => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]

/** Rotation (radians) et échelle qui envoient le point de repos `pivot` sur `target`. */
function place(target: Point, pivot: Point, angle: number, scale = 1): Affine {
  const a = Math.cos(angle) * scale
  const b = Math.sin(angle) * scale
  return [a, b, -b, a, target[0] - a * pivot[0] + b * pivot[1], target[1] - b * pivot[0] - a * pivot[1]]
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
function solveLeg(hip: Point, rest: [Point, Point, Point], ankle: Point, scale: number, pitch: number): [Affine, Affine, Affine] {
  const [hip0, knee0, ankle0] = rest
  const l1 = Math.hypot(knee0[0] - hip0[0], knee0[1] - hip0[1]) * scale
  const l2 = Math.hypot(ankle0[0] - knee0[0], ankle0[1] - knee0[1]) * scale
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
  return [place(hip, hip0, thigh - thigh0, scale), place(knee, knee0, shin - shin0, scale), place(end, ankle0, pitch * RAD, scale)]
}

/** Transformation de chaque calque de `WALK_RIG.layers` pour la phase `u` du cycle (0 à 1). */
export function walkMatrices(u: number): Affine[] {
  const j = WALK_RIG.joints
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
    1,
    near.pitch,
  )
  const farLeg = solveLeg(
    apply(root, j.hip_far),
    [j.hip_far, j.knee_far, j.ankle_far],
    [j.hip_far[0] + far.x, GAIT.farAnkleGround - far.lift],
    GAIT.farScale,
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
    arm_near: place(apply(root, j.shoulder_near), j.shoulder_near, lean - GAIT.armNear * RAD * swing),
    arm_far: place(apply(root, j.shoulder_far), j.shoulder_far, lean + GAIT.armFar * RAD * swing),
    thigh_near: nearLeg[0],
    shin_near: nearLeg[1],
    foot_near: nearLeg[2],
    thigh_far: farLeg[0],
    shin_far: farLeg[1],
    foot_far: farLeg[2],
  }
  return WALK_RIG.layers.map((layer) => byName[layer.name])
}
