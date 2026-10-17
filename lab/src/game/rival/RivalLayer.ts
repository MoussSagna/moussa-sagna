import { asset, createProgram, loadImage, uploadTexture, uniforms } from '../gl'
import { PLACEMENT } from '../hero/HeroLayer'
import type { Strike } from '../hero/HeroLayer'
import { CANVAS } from '../hero/poseData'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from '../hero/shaders'
import type { Opponent } from '../opponent'
import type { Camera, FrameInfo } from '../types'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha', 'uSmear'] as const
const FLAT_UNIFORMS = ['uRect', 'uAlpha', 'uShadow'] as const

/** Taille des images préparées par `tools/prepare_rival.py` : le dessin occupe le haut (1024 × 1536). */
const IMAGE_SIZE: [number, number] = [1024, 2048]
/** Un point du dessin, en pixels de la toile. */
type Point = [number, number]
/**
 * Ses poses, un dessin chacune. `ground` : point du dessin posé sur le sol, en pixels de la toile ; les
 * poses sont calées sur le pied arrière de la garde. `scale` : agrandissement autour de ce point, pour
 * que la tête garde la taille de celle de la garde (les illustrations ne sont pas à la même échelle).
 */
const POSES = {
  guard: { file: 'rival/guard.webp', ground: [525, 1455], scale: 1.1 },
  // lévitation : calées sur le ceinturon de la garde, pour que le buste ne saute pas au changement de dessin ;
  // `ground` est alors le point sous le ceinturon, à hauteur du bas de la botte la plus basse
  floatForward: { file: 'rival/float-forward.webp', ground: [480, 1426], scale: 1.1 },
  floatBack: { file: 'rival/float-back.webp', ground: [445, 1453], scale: 1.1 },
  // pose de passage : droite, en l'air, entre la garde et le vol, et entre l'avance et le recul
  floatStart: { file: 'rival/float-start.webp', ground: [450, 1474], scale: 1.1 },
  // téléportation : baissé, effacé dans un trait de vitesse, puis relevé
  teleportCrouch: { file: 'rival/teleport-crouch.webp', ground: [565, 1256], scale: 1.1 },
  teleportStreak: { file: 'rival/teleport-streak.webp', ground: [565, 1221], scale: 1.1 },
  teleportRise: { file: 'rival/teleport-rise.webp', ground: [545, 1434], scale: 1.1 },
  // coup de poing : calé sur le centre de sa botte arrière, qui reste plantée pendant que le corps part en avant ;
  // l'échelle ramène la distance du haut des cheveux au ceinturon à celle de la garde (la taille de la tête pour
  // les poses penchées, où cette distance se raccourcit)
  punchReady: { file: 'rival/punch-ready.webp', ground: [559, 1400], scale: 1.13 },
  punchWindup: { file: 'rival/punch-windup.webp', ground: [643, 1365], scale: 1.13 },
  punchReach: { file: 'rival/punch-reach.webp', ground: [642, 1171], scale: 1.27 },
  punchHit: { file: 'rival/punch-hit.webp', ground: [655, 1241], scale: 1.35 },
  // coup de pied : calé sur la botte d'appui, qui reste au sol
  kickChamber: { file: 'rival/kick-chamber.webp', ground: [548, 1404], scale: 1.2 },
  kickRaise: { file: 'rival/kick-raise.webp', ground: [551, 1421], scale: 1.18 },
  kickHit: { file: 'rival/kick-hit.webp', ground: [647, 1337], scale: 1.18 },
  // coup de marteau : calé sur la botte arrière, qui reste au sol (coupée par le bord droit de l'illustration)
  smashRaise: { file: 'rival/smash-raise.webp', ground: [619, 1415], scale: 1.05 },
  smashSwing: { file: 'rival/smash-swing.webp', ground: [627, 1455], scale: 1.05 },
  smashHit: { file: 'rival/smash-hit.webp', ground: [627, 1389], scale: 1.05 },
  // uppercut : calé sur la botte arrière
  upperCrouch: { file: 'rival/upper-crouch.webp', ground: [606, 1198], scale: 1.1 },
  upperRise: { file: 'rival/upper-rise.webp', ground: [550, 1272], scale: 1.1 },
  upperHit: { file: 'rival/upper-hit.webp', ground: [653, 1463], scale: 1.28 },
  // coup de pied de face, de dos : calé sur la botte d'appui ; illustrations dessinées plus petit, d'où l'échelle
  pushReady: { file: 'rival/push-ready.webp', ground: [412, 1344], scale: 1.4 },
  pushChamber: { file: 'rival/push-chamber.webp', ground: [408, 1332], scale: 1.4 },
  pushHit: { file: 'rival/push-hit.webp', ground: [399, 1373], scale: 1.4 },
  // coup spécial : pose, amorçage, amorçage chargé d'énergie, coup de pied ; calés sur la botte d'appui
  specialStance: { file: 'rival/special-stance.webp', ground: [576, 1395], scale: 1.3 },
  specialChamber: { file: 'rival/special-chamber.webp', ground: [344, 1365], scale: 1.3 },
  specialCharge: { file: 'rival/special-charge.webp', ground: [434, 1333], scale: 1.3 },
  specialKick: { file: 'rival/special-kick.webp', ground: [469, 1289], scale: 1.3 },
  // attaque ultime : mains tendues, puis énergie qui grossit entre ses mains ; calés sur la botte arrière
  ultReady: { file: 'rival/ult-ready.webp', ground: [631, 1459], scale: 1.1 },
  ultCharge1: { file: 'rival/ult-charge-1.webp', ground: [664, 1466], scale: 1.1 },
  ultCharge2: { file: 'rival/ult-charge-2.webp', ground: [624, 1351], scale: 1.35 },
  // après l'uppercut de l'attaque ultime (mêmes dessins que l'uppercut de l'enchaînement), il se baisse en trois dessins
  ultLand1: { file: 'rival/ult-land-1.webp', ground: [519, 1346], scale: 1.3 },
  ultLand2: { file: 'rival/ult-land-2.webp', ground: [611, 1326], scale: 1.3 },
  ultLand3: { file: 'rival/ult-land-3.webp', ground: [599, 1247], scale: 1.3 },
  // effets du coup spécial (planche fournie par Moussa) : leur cœur lumineux est calé sur la semelle du coup de pied.
  // La traînée grandit en trois dessins ; l'explosion et l'anneau éclatent quand le coup touche.
  fxTrail1: { file: 'rival/fx-trail-1.webp', ground: [745, 1716], scale: 1 },
  fxTrail2: { file: 'rival/fx-trail-2.webp', ground: [745, 1716], scale: 1 },
  fxTrail3: { file: 'rival/fx-trail-3.webp', ground: [745, 1716], scale: 1 },
  fxBurst: { file: 'rival/fx-burst.webp', ground: [1057, 1716], scale: 1 },
  fxRing: { file: 'rival/fx-ring.webp', ground: [1057, 1716], scale: 1 },
  blockStep: { file: 'rival/block-step.webp', ground: [519, 1414], scale: 1.1 },
  block: { file: 'rival/block.webp', ground: [543, 1492], scale: 0.95 },
  hurt: { file: 'rival/hurt.webp', ground: [490, 1478], scale: 0.9 },
  hurtRecover: { file: 'rival/hurt-recover.webp', ground: [564, 1472], scale: 0.9 },
} satisfies Record<string, { file: string; ground: Point; scale: number }>
type RivalPose = keyof typeof POSES
const POSE_NAMES = Object.keys(POSES) as RivalPose[]
/** Durée du dessin de passage entre la garde et la parade, en secondes. */
const BLOCK_STEP_SECONDS = 0.06

/**
 * Déplacement en lévitation : il ne marche pas, il glisse en rasant le sol. Un seul dessin par sens
 * (`floatForward` en avançant, `floatBack` en reculant), animé en continu : il monte, flotte et redescend. Un dessin
 * de passage (`floatStart`) s'affiche `bridge` secondes au décollage et au changement de sens, et pendant qu'il se repose.
 * `forward`, `back` : vitesse, en largeurs d'écran par seconde ; `accel` : vitesse de mise en route et de freinage ;
 * `height` : hauteur de vol, en pixels de la toile ; `bob` et `period` : flottement (pixels, secondes) ;
 * `rise`, `land` : vitesse de montée et de descente ; `ground` : part de la hauteur sous laquelle il reprend la
 * garde ; `lean` : inclinaison dans le sens du déplacement, à pleine vitesse.
 */
const FLOAT = { forward: 0.2, back: 0.17, accel: 18, height: 14, bob: 4, period: 1.5, rise: 18, land: 16, ground: 0.12, lean: 0.035, bridge: 0.07 }
/**
 * Dash avant en téléportation, à la manière de Doom : il se baisse, s'efface dans un trait de vitesse, disparaît
 * un instant et réapparaît `distance` plus loin (fraction de la largeur de l'écran, sans traverser Moussa), baissé,
 * puis se relève ; au corps à corps, il réapparaît dans le dos de Moussa. Les étapes dans l'ordre, avec leur durée en secondes ; `pose: null` : invisible, c'est là qu'il
 * change de place. `ghost` : durée de l'image rémanente laissée au départ ; `min` : distance en dessous de laquelle
 * il ne se téléporte pas (il est déjà contre Moussa).
 */
const TELEPORT = {
  steps: [
    { pose: 'teleportCrouch', seconds: 0.06 },
    { pose: 'teleportStreak', seconds: 0.05 },
    { pose: null, seconds: 0.1 },
    { pose: 'teleportStreak', seconds: 0.05 },
    { pose: 'teleportCrouch', seconds: 0.08 },
    { pose: 'teleportRise', seconds: 0.1 },
  ] as { pose: RivalPose | null; seconds: number }[],
  distance: 0.22,
  ghost: 0.16,
  min: 0.02,
  /**
   * Au corps à corps (moins de `cross` entre lui et sa place la plus proche de Moussa), il passe dans le dos de
   * Moussa : les combattants changent de côté. Il réapparaît derrière lui, à la distance minimale plus `margin`.
   */
  cross: 0.1,
  /** Marge gardée devant Moussa à l'arrivée : baissé, sa main dépasse en avant de sa garde. */
  margin: 0.05,
}
const TELEPORT_VANISH = TELEPORT.steps[0].seconds + TELEPORT.steps[1].seconds
const TELEPORT_TOTAL = TELEPORT.steps.reduce((sum, step) => sum + step.seconds, 0)
/** Une étape d'un coup. */
interface Step {
  pose: RivalPose
  seconds: number
  active?: boolean
  vanish?: boolean
  warp?: boolean
}
/** Un coup de son enchaînement. */
interface Move {
  /**
   * Les étapes dans l'ordre, avec leur durée en secondes ; `active` : le coup peut toucher pendant cette étape ;
   * `vanish` : il est invisible ; `warp` : en commençant l'étape, il se téléporte juste devant Moussa.
   */
  steps: Step[]
  /** Avancée (fraction de la largeur de l'écran) entre `advanceFrom` et `advanceTo` secondes, sans traverser Moussa. */
  advance: number
  advanceFrom: number
  advanceTo: number
  /** Bout du coup devant lui et hauteur, en pixels de la toile. */
  reach: number
  height: number
  power: number
  stop: number
  /** Le coup suivant de l'enchaînement, lancé par un nouvel appui pendant celui-ci. */
  next?: MoveName
}
type MoveName = 'punch' | 'kick' | 'smash' | 'uppercut' | 'push' | 'special' | 'ultimate'
/**
 * Son enchaînement. Le coup de poing : mise en place, bras armé, le bras part, poing tendu, puis retour ; il avance
 * très légèrement pendant l'armé. Un nouvel appui pendant le coup de poing enchaîne le coup de pied haut : genou
 * monté, plus haut, jambe tendue, puis retour ; puis le coup de marteau : poing levé au-dessus de la tête, abattu
 * vers le sol, plus lourd ; enfin l'uppercut, dernier coup : accroupi, il se relève en lançant le poing vers le haut.
 * Pour finir, le coup de pied de face : il se met de dos, monte le genou et repousse Moussa d'un coup de pied tendu.
 * Le coup suivant part à la fin des images actives, à la place du retour.
 */
const MOVES: Record<MoveName, Move> = {
  punch: {
    steps: [
      { pose: 'punchReady', seconds: 0.05 },
      { pose: 'punchWindup', seconds: 0.09 },
      { pose: 'punchReach', seconds: 0.04 },
      { pose: 'punchHit', seconds: 0.11, active: true },
      { pose: 'punchReach', seconds: 0.07 },
      { pose: 'punchReady', seconds: 0.07 },
  ],
    advance: 0.025,
    advanceFrom: 0.05,
    advanceTo: 0.18,
    reach: 580,
    height: 1000,
    power: 0.7,
    stop: 0.12,
    next: 'kick',
  },
  kick: {
    steps: [
      { pose: 'kickChamber', seconds: 0.06 },
      { pose: 'kickRaise', seconds: 0.07 },
      { pose: 'kickHit', seconds: 0.13, active: true },
      { pose: 'kickRaise', seconds: 0.08 },
      { pose: 'kickChamber', seconds: 0.07 },
    ],
    advance: 0.015,
    advanceFrom: 0,
    advanceTo: 0.13,
    reach: 650,
    height: 1200,
    power: 0.9,
    stop: 0.14,
    next: 'smash',
  },
  smash: {
    steps: [
      { pose: 'smashRaise', seconds: 0.11 },
      { pose: 'smashSwing', seconds: 0.05 },
      { pose: 'smashHit', seconds: 0.1, active: true },
      { pose: 'smashHit', seconds: 0.16 },
      { pose: 'smashSwing', seconds: 0.06 },
    ],
    advance: 0.02,
    advanceFrom: 0.06,
    advanceTo: 0.2,
    reach: 620,
    height: 450,
    power: 1,
    stop: 0.18,
    next: 'uppercut',
  },
  uppercut: {
    steps: [
      { pose: 'upperCrouch', seconds: 0.09 },
      { pose: 'upperRise', seconds: 0.05 },
      { pose: 'upperHit', seconds: 0.12, active: true },
      { pose: 'upperHit', seconds: 0.2 },
      { pose: 'upperRise', seconds: 0.08 },
    ],
    advance: 0.02,
    advanceFrom: 0.05,
    advanceTo: 0.2,
    reach: 640,
    height: 1350,
    power: 1.3,
    stop: 0.22,
    next: 'push',
  },
  push: {
    steps: [
      { pose: 'pushReady', seconds: 0.08 },
      { pose: 'pushChamber', seconds: 0.08 },
      { pose: 'pushHit', seconds: 0.12, active: true },
      { pose: 'pushHit', seconds: 0.18 },
      { pose: 'pushChamber', seconds: 0.08 },
      { pose: 'pushReady', seconds: 0.08 },
    ],
    advance: 0.025,
    advanceFrom: 0.05,
    advanceTo: 0.22,
    reach: 680,
    height: 1150,
    power: 1.2,
    stop: 0.2,
  },
  // premier coup spécial, hors enchaînement : pose, amorçage, amorçage chargé d'énergie, coup de pied enveloppé
  // d'énergie violette, puis retour à l'amorçage
  special: {
    steps: [
      { pose: 'specialStance', seconds: 0.05 },
      { pose: 'specialChamber', seconds: 0.05 },
      { pose: 'specialCharge', seconds: 0.1 },
      { pose: 'specialKick', seconds: 0.12, active: true },
      { pose: 'specialKick', seconds: 0.12 },
      { pose: 'specialCharge', seconds: 0.06 },
      { pose: 'specialChamber', seconds: 0.07 },
    ],
    advance: 0.03,
    advanceFrom: 0.1,
    advanceTo: 0.22,
    reach: 820,
    height: 1150,
    power: 1.4,
    stop: 0.24,
  },
  // attaque ultime : mains tendues, l'énergie se forme puis grossit (le combat se fige et la caméra se resserre sur lui,
  // `takeFocus`), puis il se téléporte à travers l'écran juste devant Moussa, le frappe d'un uppercut et se baisse
  ultimate: {
    steps: [
      { pose: 'ultReady', seconds: 0.1 },
      { pose: 'ultCharge1', seconds: 0.14 },
      { pose: 'ultCharge2', seconds: 0.45 },
      { pose: 'teleportStreak', seconds: 0.05 },
      { pose: 'teleportStreak', seconds: 0.1, vanish: true, warp: true },
      { pose: 'teleportStreak', seconds: 0.04 },
      // uppercut : accroupi, bras armé figé un instant, puis il l'envoie
      { pose: 'upperCrouch', seconds: 0.07 },
      { pose: 'upperRise', seconds: 0.35 },
      { pose: 'upperHit', seconds: 0.14, active: true },
      { pose: 'upperHit', seconds: 0.4 },
      { pose: 'ultLand1', seconds: 0.08 },
      { pose: 'ultLand2', seconds: 0.08 },
      { pose: 'ultLand3', seconds: 0.4 },
      { pose: 'ultLand2', seconds: 0.08 },
      { pose: 'ultLand1', seconds: 0.08 },
    ],
    advance: 0,
    advanceFrom: 0,
    advanceTo: 1,
    reach: 900,
    height: 1350,
    power: 1.6,
    stop: 0.3,
  },
}
/** Effets du coup spécial : durée de la croissance de la traînée, de son estompage et de l'explosion, en secondes. */
const FX = { grow: 0.08, fade: 0.22, burst: 0.35 }
const SPECIAL_KICK = MOVES.special.steps.slice(0, 3).reduce((sum, step) => sum + step.seconds, 0)
const moveTotal = (move: Move) => move.steps.reduce((sum, step) => sum + step.seconds, 0)
/** Fin des images actives d'un coup : c'est là que part le coup suivant de l'enchaînement. */
const moveActiveEnd = (move: Move) => {
  let end = 0
  for (const step of move.steps) {
    end += step.seconds
    if (step.active) return end
  }
  return end
}
type FloatPose = 'floatForward' | 'floatBack' | 'floatStart'
const isFloatPose = (pose: RivalPose): pose is FloatPose => pose === 'floatForward' || pose === 'floatBack' || pose === 'floatStart'
/** Les dessins du vol dans un sens. */
const isFlightPose = (pose: RivalPose): boolean => pose === 'floatForward' || pose === 'floatBack'
/**
 * Son comportement quand il se déplace seul : il garde Moussa à une distance comprise entre `near` et `far`
 * (en fraction de la largeur du stage, en plus de la distance minimale), et marche jusqu'au milieu de cet
 * intervalle quand il en sort. `maxX` : sa position la plus reculée.
 */
const RANGE = { near: 0.04, far: 0.14, maxX: 0.86 }

/** Respiration de la garde : amplitude de l'étirement vertical et durée d'un cycle, en secondes. */
const BREATH = { amplitude: 0.007, period: 3.6 }
/**
 * Coup encaissé : il affiche le dessin du coup reçu pendant `stun` secondes, puis celui du retour pendant
 * `recover` secondes. En plus, tout le corps penche en arrière, pieds fixes, puis revient comme un ressort
 * amorti. `lean` : pente de l'inclinaison pour un coup de pleine puissance (décalage horizontal par pixel de hauteur).
 */
const HIT = { stun: 0.26, recover: 0.16, lean: 0.05, frequency: 2.6, damping: 11 }
/** Coup paré : il garde sa pose et penche seulement, de cette pente pour un coup de pleine puissance. */
const GUARDED_LEAN = 0.035
const REFLECTION = { alpha: 0.2, squash: 0.5 }
/** « Réduire les mouvements » : part de la respiration et du recul conservée. */
const CALM_AMPLITUDE = 0.35

/** L'adversaire : en garde ou en parade, il se déplace en lévitation pour garder ses distances, encaisse ou pare les coups. */
export class RivalLayer implements Opponent {
  /** Position de départ sur le stage, en fraction de la largeur de l'écran. */
  static readonly START_X = 0.66
  x = RivalLayer.START_X
  readonly surface = 310
  readonly gap = 760
  private gl: WebGLRenderingContext | null
  private layer: { program: WebGLProgram; attribute: number; u: Record<(typeof LAYER_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private flat: { program: WebGLProgram; attribute: number; u: Record<(typeof FLAT_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private ready = false
  /** Vrai tant qu'il doit parer. */
  blocking = false
  /** Vrai s'il se déplace seul pour garder ses distances. */
  moves = true
  /** Vrai quand le joueur le contrôle : il se déplace dans le sens demandé par `request`, au lieu de garder ses distances. */
  controlled = false
  /** Sens demandé par le joueur : -1 vers Moussa, 1 en reculant, 0 à l'arrêt. */
  request = 0
  /** Position de Moussa, transmise par le moteur à chaque image. */
  heroX = 0.33
  /** Textures de ses poses, liées tour à tour à l'unité 0 pour le dessin. */
  private textures: Partial<Record<RivalPose, WebGLTexture>> = {}
  /** Sens du déplacement voulu à l'image précédente (-1 vers Moussa, 1 en reculant, 0 à l'arrêt). */
  private walkDirection = 0
  /** Vitesse, en largeurs d'écran par seconde, et part de la hauteur de vol (0 au sol, 1 en vol). */
  private speed = 0
  private hover = 0
  /** Temps passé en l'air, pour le flottement. */
  private floatTime = 0
  /** Temps écoulé depuis le début de la téléportation en cours, ou -1. */
  private teleportTime = -1
  /** Image rémanente laissée au départ de la téléportation : position et temps écoulé. */
  private ghostX = 0
  private ghostTime = Infinity
  /** Temps écoulé depuis le début du coup de poing en cours (ou -1), position au départ, et vrai s'il a déjà touché. */
  private attackTime = -1
  private attackFrom = 0
  private attackLanded = false
  /** Temps écoulé depuis l'impact du coup spécial, pour son explosion. */
  private burstTime = Infinity
  /** Vrai quand le coup spécial vient de toucher, jusqu'à ce que le moteur le prenne en compte. */
  private impact = false
  /** Vrai dès que la mise au point de l'attaque ultime en cours a été lancée. */
  private focusTaken = false
  /** Vrai dès que la téléportation de l'attaque ultime en cours a eu lieu. */
  private warped = false
  /** Coup en cours de l'enchaînement, et vrai si le joueur a demandé le suivant. */
  private move: MoveName = 'punch'
  private queued = false
  /** Vrai si le coup spécial a été demandé pendant un coup de l'enchaînement, pour l'annuler. */
  private specialQueued = false
  /** Sens de la téléportation en cours : -1 vers Moussa, 1 en s'éloignant. */
  private teleportDirection = -1
  /** Vrai quand il vient de disparaître au corps à corps : le moteur fait changer les combattants de côté. */
  private crossing = false
  /** Temps restant sur le dessin de passage, au décollage ou au changement de sens. */
  private bridgeLeft = 0
  private pose: RivalPose = 'guard'
  /** Temps restant sur le dessin de passage. */
  private stepLeft = 0
  /** Temps écoulé depuis le coup encaissé en cours. */
  private hurtTime = 0
  /** Inclinaison du corps après un coup (positive vers l'arrière) et sa vitesse. */
  private lean = 0
  private velocity = 0

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
  }

  async load(): Promise<boolean> {
    const gl = this.gl
    if (!gl) return false
    const layer = createProgram(gl, LAYER_VERTEX, LAYER_FRAGMENT)
    const flat = createProgram(gl, FLAT_VERTEX, FLAT_FRAGMENT)
    if (!layer || !flat) return false
    this.layer = { program: layer, attribute: gl.getAttribLocation(layer, 'a'), u: uniforms(gl, layer, LAYER_UNIFORMS) }
    this.flat = { program: flat, attribute: gl.getAttribLocation(flat, 'a'), u: uniforms(gl, flat, FLAT_UNIFORMS) }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // les textures sont liées à l'unité 0 au moment du dessin : plus de poses que d'unités garanties par WebGL
    const images = await Promise.all(POSE_NAMES.map((name) => loadImage(asset(POSES[name].file))))
    POSE_NAMES.forEach((name, index) => {
      const image = images[index]
      const texture = image && uploadTexture(gl, 0, image, { alpha: true, premultiply: true, mipmap: true })
      if (texture) this.textures[name] = texture
    })
    this.ready = POSE_NAMES.every((name) => this.textures[name])
    return this.ready
  }

  hit(power: number): boolean {
    const guarded = this.pose === 'block'
    this.lean = (guarded ? GUARDED_LEAN : HIT.lean) * (0.45 + 0.55 * power)
    this.velocity = 0
    if (!guarded) {
      this.pose = 'hurt'
      this.hurtTime = 0
      this.teleportTime = -1
      this.attackTime = -1
      this.settle()
    }
    return guarded
  }

  /** Revient à sa place de départ, en garde, pour un nouveau round. */
  reset(): void {
    this.x = RivalLayer.START_X
    this.pose = 'guard'
    this.teleportTime = -1
    this.attackTime = -1
    this.burstTime = Infinity
    this.ghostTime = Infinity
    this.crossing = false
    this.settle()
  }

  /** Il se pose d'un coup : coup encaissé, parade, nouveau round. */
  private settle(): void {
    this.walkDirection = 0
    this.speed = 0
    this.hover = 0
  }

  /**
   * Touche d'attaque. Depuis la garde ou la lévitation, lance le coup de poing ; pendant un coup, met en attente le
   * coup suivant de l'enchaînement.
   */
  attack(): void {
    if (this.attackTime >= 0) {
      if (MOVES[this.move].next) this.queued = true
      return
    }
    if (this.teleportTime >= 0 || !(this.pose === 'guard' || isFloatPose(this.pose))) return
    this.settle()
    this.startMove('punch')
  }

  /** Attaque ultime : possible seulement en garde ou en lévitation. */
  ultimate(): void {
    if (this.attackTime >= 0 || this.teleportTime >= 0 || !(this.pose === 'guard' || isFloatPose(this.pose))) return
    this.settle()
    this.focusTaken = false
    this.startMove('ultimate')
  }

  /** Vrai pendant l'attaque ultime : le moteur assombrit le décor et Moussa. */
  get ultimateActive(): boolean {
    return this.attackTime >= 0 && this.move === 'ultimate'
  }

  /** Vrai une seule fois, quand l'énergie de l'attaque ultime grossit : le combat se fige et la caméra se resserre sur lui. */
  takeFocus(): boolean {
    if (!this.ultimateActive || this.focusTaken || this.pose !== 'ultCharge2') return false
    this.focusTaken = true
    return true
  }

  /**
   * Coup spécial : en garde ou en lévitation, ou pendant n'importe quel coup de l'enchaînement, qu'il annule. Pendant
   * un coup, il part dès la fin des images actives (tout de suite si elles sont passées), à la place de la suite.
   */
  special(): void {
    if (this.attackTime >= 0) {
      if (this.move !== 'special') this.specialQueued = true
      return
    }
    if (this.teleportTime >= 0 || !(this.pose === 'guard' || isFloatPose(this.pose))) return
    this.settle()
    this.startMove('special')
  }

  private startMove(move: MoveName): void {
    this.move = move
    this.attackTime = 0
    this.attackFrom = this.x
    this.attackLanded = false
    this.queued = false
    this.specialQueued = false
    this.warped = false
    this.pose = MOVES[move].steps[0].pose
  }

  /** L'étape en cours du coup. */
  private moveStep(): Step {
    const steps = MOVES[this.move].steps
    let end = 0
    for (const step of steps) {
      end += step.seconds
      if (this.attackTime < end) return step
    }
    return steps[steps.length - 1]
  }

  /** Son coup, s'il peut toucher à cet instant : il frappe vers Moussa, donc vers la gauche. L'uppercut de l'attaque ultime le propulse. */
  strike(pixel: number): Strike | null {
    if (this.attackTime < 0 || this.attackLanded || !this.moveStep().active) return null
    const move = MOVES[this.move]
    return { x: this.x - move.reach * pixel, height: move.height, power: move.power, stop: move.stop, launch: this.move === 'ultimate' }
  }

  /** Son coup a touché ou a été paré : il ne touchera plus. Le coup spécial explose à l'impact. */
  land(): void {
    this.attackLanded = true
    if (this.move === 'special' || this.move === 'ultimate') {
      this.burstTime = 0
      this.impact = true
    }
  }

  /** Vrai une seule fois, quand le coup spécial vient de toucher ou d'être paré : le moteur fait trembler l'écran. */
  takeImpact(): boolean {
    const impact = this.impact
    this.impact = false
    return impact
  }

  /**
   * Dash : il se téléporte, vers Moussa (`direction` -1, dash avant) ou en s'éloignant (1, dash arrière), avec les
   * mêmes dessins. Possible seulement en garde ou en lévitation.
   */
  teleport(direction = -1): void {
    if (this.teleportTime >= 0 || this.attackTime >= 0 || !(this.pose === 'guard' || isFloatPose(this.pose))) return
    this.settle()
    this.teleportTime = 0
    this.teleportDirection = Math.sign(direction) || -1
    this.pose = 'teleportCrouch'
  }

  /** Vrai une seule fois, quand il vient de disparaître pour passer dans le dos de Moussa. */
  takeCross(): boolean {
    const crossing = this.crossing
    this.crossing = false
    return crossing
  }

  /**
   * Les combattants viennent de changer de côté (le moteur a retourné l'affichage et la position de Moussa) :
   * il se place derrière Moussa, à la distance minimale plus la marge. S'il n'y a pas la place (Moussa près du
   * bord), il se pose au bord et retourne la position où Moussa doit être poussé ; sinon, celle de Moussa.
   * Son image rémanente reste où elle était à l'écran.
   */
  landBehind(heroX: number, pixel: number): number {
    const distance = this.gap * pixel + TELEPORT.margin
    this.x = Math.min(RANGE.maxX, heroX + distance)
    this.heroX = Math.min(heroX, this.x - distance)
    this.ghostX = 1 - this.ghostX
    return this.heroX
  }

  /** Vrai pendant la téléportation, quand il n'est plus visible. */
  private get vanished(): boolean {
    return (this.teleportTime >= 0 && this.teleportStep() === null) || (this.attackTime >= 0 && this.moveStep().vanish === true)
  }

  /** Le dessin de l'étape en cours de la téléportation, ou `null` quand il est invisible. */
  private teleportStep(): RivalPose | null {
    let end = 0
    for (const step of TELEPORT.steps) {
      end += step.seconds
      if (this.teleportTime < end) return step.pose
    }
    return 'teleportRise'
  }

  update(frame: FrameInfo): void {
    this.burstTime += frame.delta
    this.ghostTime += frame.delta
    if (this.teleportTime >= 0) {
      const before = this.teleportTime
      this.teleportTime += frame.delta
      // il disparaît : il laisse une image rémanente et change de place
      if (before < TELEPORT_VANISH && this.teleportTime >= TELEPORT_VANISH) {
        this.ghostX = this.x
        this.ghostTime = 0
        const [min] = this.bounds(this.pixel(frame))
        const stop = min + TELEPORT.margin
        // dash arrière : il recule d'autant, sans sortir du stage
        if (this.teleportDirection > 0) this.x = Math.min(RANGE.maxX, this.x + TELEPORT.distance)
        // au corps à corps, il passe dans le dos de Moussa
        else if (this.x - stop < TELEPORT.cross) this.crossing = true
        else if (this.x - stop > TELEPORT.min) this.x = Math.max(stop, this.x - TELEPORT.distance)
      }
      if (this.teleportTime >= TELEPORT_TOTAL) {
        this.teleportTime = -1
        this.pose = 'guard'
      } else {
        this.pose = this.teleportStep() ?? this.pose
      }
    }
    if (this.attackTime >= 0) {
      this.attackTime += frame.delta
      const move = MOVES[this.move]
      // téléportation de l'attaque ultime : il laisse une image rémanente et réapparaît juste devant Moussa
      if (this.moveStep().warp && !this.warped) {
        this.warped = true
        this.ghostX = this.x
        this.ghostTime = 0
        const [min] = this.bounds(this.pixel(frame))
        this.x = min + 0.02
        this.attackFrom = this.x
      }
      // il avance très légèrement pendant le coup, sans traverser Moussa
      const k = Math.max(0, Math.min(1, (this.attackTime - move.advanceFrom) / (move.advanceTo - move.advanceFrom)))
      const [min] = this.bounds(this.pixel(frame))
      const target = this.attackFrom - move.advance * (1 - (1 - k) ** 2)
      this.x = Math.max(Math.min(this.x, min), target)
      if (this.specialQueued && this.attackTime >= moveActiveEnd(move)) {
        // le coup spécial annule la suite du coup en cours
        this.startMove('special')
      } else if (move.next && this.queued && this.attackTime >= moveActiveEnd(move)) {
        // le coup suivant remplace le retour de celui-ci
        this.startMove(move.next)
      } else if (this.attackTime >= moveTotal(move)) {
        this.attackTime = -1
        this.pose = 'guard'
      } else {
        this.pose = this.moveStep().pose
      }
    }
    // coup encaissé : le dessin du coup reçu, celui du retour, puis la garde
    if (this.attackTime >= 0 || this.teleportTime >= 0) {
      // rien d'autre pendant la téléportation
    } else if (this.pose === 'hurt' || this.pose === 'hurtRecover') {
      this.hurtTime += frame.delta
      this.pose = this.hurtTime < HIT.stun ? 'hurt' : 'hurtRecover'
      if (this.hurtTime >= HIT.stun + HIT.recover) this.pose = 'guard'
    } else if (this.pose === 'blockStep') {
      this.stepLeft -= frame.delta
      if (this.stepLeft <= 0) this.pose = this.blocking ? 'block' : 'guard'
    } else if ((this.pose === 'block') !== this.blocking) {
      this.pose = 'blockStep'
      this.stepLeft = BLOCK_STEP_SECONDS
      this.settle()
    } else if (this.pose !== 'block') {
      this.float(frame)
    }
    // ressort amorti, en petits pas pour rester stable quand une image dure longtemps
    const stiffness = (2 * Math.PI * HIT.frequency) ** 2
    const steps = 4
    const dt = frame.delta / steps
    for (let i = 0; i < steps; i++) {
      this.velocity += (-stiffness * this.lean - HIT.damping * this.velocity) * dt
      this.lean += this.velocity * dt
    }
  }

  /** Largeur d'un pixel de la toile, en fraction de la largeur du stage. */
  private pixel(frame: FrameInfo): number {
    return (PLACEMENT.scale / CANVAS[1]) * (frame.height / frame.width)
  }

  /** Le sens dans lequel il veut se déplacer : -1 vers Moussa, 1 en reculant, 0 pour rester en garde. */
  private wish(pixel: number): number {
    if (this.blocking) return 0
    if (this.controlled) return Math.sign(this.request)
    if (!this.moves) return 0
    const distance = this.x - this.heroX - this.gap * pixel
    const middle = (RANGE.near + RANGE.far) / 2
    // il va jusqu'au milieu de l'intervalle avant de s'arrêter
    if (this.walkDirection < 0) return distance > middle ? -1 : 0
    if (this.walkDirection > 0) return distance < middle && this.x < RANGE.maxX - 0.005 ? 1 : 0
    if (distance > RANGE.far) return -1
    if (distance < RANGE.near && this.x < RANGE.maxX - 0.005) return 1
    return 0
  }

  /** Les bornes de sa position : pas plus près de Moussa que la distance minimale, pas au-delà de `RANGE.maxX`. */
  private bounds(pixel: number): [number, number] {
    return [this.heroX + this.gap * pixel, RANGE.maxX]
  }

  /**
   * Lévitation : il accélère et freine en douceur, s'élève en partant et se repose à l'arrêt. Le dessin de vol
   * dépend du sens ; au sol, il reprend la garde.
   */
  private float(frame: FrameInfo): void {
    const pixel = this.pixel(frame)
    const wish = this.wish(pixel)
    this.walkDirection = wish
    const [min, max] = this.bounds(pixel)
    const target = wish * (wish < 0 ? FLOAT.forward : FLOAT.back)
    this.speed += (target - this.speed) * Math.min(1, frame.delta * FLOAT.accel)
    if (wish === 0 && Math.abs(this.speed) < 0.012) this.speed = 0
    const x = this.x + this.speed * frame.delta
    // s'il est déjà plus près que la borne (Moussa s'est approché), il ne s'avance pas davantage
    const low = Math.min(this.x, min)
    if (x < low || x > max) this.speed = 0
    this.x = Math.max(low, Math.min(max, x))
    const flying = wish !== 0 || this.speed !== 0
    const k = flying ? FLOAT.rise : FLOAT.land
    this.hover += ((flying ? 1 : 0) - this.hover) * Math.min(1, frame.delta * k)
    this.floatTime = this.pose === 'guard' && !flying ? 0 : this.floatTime + frame.delta
    // le dessin : celui du sens du déplacement en vol, le dessin de passage pendant qu'il se repose, puis la garde
    const direction = wish !== 0 ? wish : Math.sign(this.speed)
    const want: RivalPose = flying && direction !== 0 ? (direction < 0 ? 'floatForward' : 'floatBack') : this.hover < FLOAT.ground ? 'guard' : 'floatStart'
    this.bridgeLeft -= frame.delta
    let next = want
    if (isFlightPose(want)) {
      // au décollage et au changement de sens, il passe un instant par le dessin de passage
      if (this.pose === 'guard' || (isFlightPose(this.pose) && this.pose !== want)) {
        next = 'floatStart'
        this.bridgeLeft = FLOAT.bridge
      } else if (this.pose === 'floatStart' && this.bridgeLeft > 0) {
        next = 'floatStart'
      }
    }
    // les dessins s'enchaînent sans fondu : un fondu rendrait le personnage transparent un instant
    this.pose = next
  }

  /** Hauteur de vol du dessin `pose` à cet instant, en pixels de la toile : montée, puis flottement. */
  private lift(pose: RivalPose, amplitude: number): number {
    if (!isFloatPose(pose)) return 0
    const bob = Math.sin((this.floatTime * 2 * Math.PI) / FLOAT.period) * FLOAT.bob * amplitude
    return this.hover * (FLOAT.height + bob)
  }

  draw(frame: FrameInfo, camera: Camera, calm: boolean): void {
    const gl = this.gl
    const layer = this.layer
    const flat = this.flat
    if (!gl) return
    gl.viewport(0, 0, frame.width, frame.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!layer || !flat || !this.ready) return

    // même plan du sol et même caméra que le personnage
    const sx = (this.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
    const sy = (PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5
    const h = PLACEMENT.scale * camera.zoom
    const w = h * (CANVAS[0] / CANVAS[1]) * (frame.height / frame.width)
    const unitX = w / CANVAS[0]
    const unitY = h / CANVAS[1]
    const amplitude = calm ? CALM_AMPLITUDE : 1

    // ombre au sol : elle rétrécit quand il s'élève
    const height = this.lift(this.pose, amplitude) / FLOAT.height
    const shadow = 1 - 0.3 * height
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, h * 0.34 * shadow * (frame.height / frame.width), h * 0.033 * shadow)
    if (!this.vanished) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.useProgram(layer.program)
    gl.enableVertexAttribArray(layer.attribute)
    gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
    const u = layer.u
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(u.uTex, 0)
    gl.uniform2f(u.uAtlasSize, IMAGE_SIZE[0], IMAGE_SIZE[1])
    gl.uniform4f(u.uBend, 0, 1, 0, 0)
    gl.uniform4f(u.uAxis, 1, 0, 0, 0)
    gl.uniform1f(u.uSmear, 0)
    gl.uniform4f(u.uQuad, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform4f(u.uBox, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform2f(u.uAtlas, 0, 0)

    /** Dessine une pose avec son reflet, à l'opacité `alpha`. */
    const drawPose = (name: RivalPose, alpha: number, at = sx, stretchX = 1) => {
      const pose = POSES[name]
      const [gx, gy] = pose.ground
      const scale = pose.scale
      const lift = this.lift(name, amplitude)
      // le point posé au sol reste en (gx, gy) dans la toile : l'agrandissement et l'inclinaison se font autour de lui
      const left = at - gx * unitX * stretchX
      const top = sy - (gy + lift) * unitY
      gl.bindTexture(gl.TEXTURE_2D, this.textures[name] ?? null)
      // il respire en s'étirant depuis le sol, penche en arrière quand il encaisse et, en vol, dans le sens du déplacement
      const stretch = scale * (1 + BREATH.amplitude * amplitude * Math.sin((frame.time * 2 * Math.PI) / BREATH.period))
      const drift = isFloatPose(name) ? (this.speed / FLOAT.forward) * FLOAT.lean : 0
      const lean = (this.lean + drift) * amplitude * scale
      gl.uniform3f(u.uMx, scale, -lean, gx - scale * gx + lean * gy)
      gl.uniform3f(u.uMy, 0, stretch, gy - stretch * gy)
      // reflet sur le sol mouillé : le même dessin, retourné et écrasé sous ses pieds, plus pâle quand il vole
      const mirror = unitY * REFLECTION.squash
      gl.uniform1f(u.uAlpha, REFLECTION.alpha * alpha * (1 - 0.4 * (lift / FLOAT.height)))
      gl.uniform4f(u.uView, 2 * unitX * stretchX, 2 * mirror, 2 * left - 1, 1 - 2 * sy - 2 * (gy + lift) * mirror)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.uniform1f(u.uAlpha, alpha)
      gl.uniform4f(u.uView, 2 * unitX * stretchX, -2 * unitY, 2 * left - 1, 1 - 2 * top)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    // image rémanente de la téléportation : le trait de vitesse, qui s'étire vers l'arrière et s'efface
    const ghost = this.ghostTime / TELEPORT.ghost
    if (ghost < 1 && !calm) {
      const at = (this.ghostX + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
      drawPose('teleportStreak', 0.45 * (1 - ghost) ** 2, at, 1 + 0.5 * ghost)
    }
    if (!this.vanished) drawPose(this.pose, 1)
    // coup spécial : la traînée d'énergie grandit en trois dessins pendant la jambe tendue, puis s'estompe
    const strength = calm ? 0.6 : 1
    if (this.pose === 'specialKick' && this.attackTime >= 0) {
      const t = this.attackTime - SPECIAL_KICK
      const k = Math.min(1, Math.max(0, (t - FX.grow) / FX.fade))
      drawPose(t < FX.grow / 2 ? 'fxTrail1' : t < FX.grow ? 'fxTrail2' : 'fxTrail3', strength * (1 - k * k))
    }
    // à l'impact : l'anneau et l'explosion éclatent sur Moussa, puis s'estompent
    if (this.burstTime < FX.burst) {
      const k = this.burstTime / FX.burst
      if (k < 0.5) drawPose('fxRing', strength * (1 - 2 * k))
      drawPose('fxBurst', strength * (1 - k * k))
    }
  }
}
