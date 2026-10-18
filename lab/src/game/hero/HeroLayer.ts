import { asset, createProgram, loadImage, uploadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { CANVAS, POSES } from './poseData'
import { BENDS, GAIT, WALK_SPEED, guardMatrices, heldMatrix, scaleAbout, walkMatrices } from './poseRig'
import type { Affine } from './poseRig'
import { FIRE_FRAGMENT, SPARK_FRAGMENT, SPRITE_FRAGMENT, FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha', 'uSmear'] as const
const FLAT_UNIFORMS = ['uRect', 'uTex', 'uAlpha', 'uShadow'] as const
const FIRE_UNIFORMS = ['uRect', 'uT', 'uPower', 'uTail', 'uWobble'] as const
const lerpRange = ([a, b]: [number, number], k: number) => a + (b - a) * k
const SPRITE_UNIFORMS = ['uRect', 'uTex', 'uUv', 'uAlpha'] as const
const SPARK_UNIFORMS = ['uRect', 'uK', 'uSeed', 'uPower', 'uTint', 'uGlow'] as const

type PoseName = keyof typeof POSES
const POSE_NAMES: PoseName[] = ['guard', 'step', 'walk', 'dashForward', 'dashBack', 'crouchStep', 'crouch', 'blockStep', 'block', 'crouchBlock', 'jumpStart', 'jumpRise', 'jumpPeak', 'jumpLand', 'punchStart', 'punchHit', 'punchChain1', 'punchChain2', 'punchMidHit', 'punchMidRecover', 'punchHeavyStart', 'punchHeavyHit', 'punchHeavyRecover', 'specialCharge', 'specialThrow', 'specialRecover', 'specialIn1', 'specialIn2', 'specialIn3', 'hurt', 'hurtRecover', 'exitLean', 'exitCrouch', 'exitGround', 'exitSpring', 'kickStart', 'kickHit', 'groundCharge', 'groundRise', 'groundPalm', 'koStagger', 'koFall', 'koAir', 'koDown', 'launch']

/** Position sur le stage, en fraction de l'écran ; `scale` = hauteur de la toile en hauteurs d'écran. */
export const PLACEMENT = { x: 0.33, y: 0.905, scale: 0.546, depth: 0.42, minX: 0.14, maxX: 0.8 }

/** Point de la toile posé sur le sol : le milieu des appuis de la garde. Les autres poses s'y alignent. */
const GROUND_POINT = POSES.guard.anchor
/** Point de chaque pose posé sur ce point du sol, dans sa propre toile. */
const FEET: Record<PoseName, [number, number]> = {
  guard: POSES.guard.anchor,
  step: POSES.step.anchor,
  dashForward: POSES.dashForward.anchor,
  dashBack: POSES.dashBack.anchor,
  crouchStep: POSES.crouchStep.anchor,
  crouch: POSES.crouch.anchor,
  blockStep: POSES.blockStep.anchor,
  block: POSES.block.anchor,
  crouchBlock: POSES.crouchBlock.anchor,
  jumpStart: POSES.jumpStart.anchor,
  jumpRise: POSES.jumpRise.anchor,
  jumpPeak: POSES.jumpPeak.anchor,
  jumpLand: POSES.jumpLand.anchor,
  punchStart: POSES.punchStart.anchor,
  punchHit: POSES.punchHit.anchor,
  punchHeavyStart: POSES.punchHeavyStart.anchor,
  punchHeavyHit: POSES.punchHeavyHit.anchor,
  punchHeavyRecover: POSES.punchHeavyRecover.anchor,
  specialCharge: POSES.specialCharge.anchor,
  specialIn1: POSES.specialIn1.anchor,
  specialIn2: POSES.specialIn2.anchor,
  specialIn3: POSES.specialIn3.anchor,
  specialThrow: POSES.specialThrow.anchor,
  specialRecover: POSES.specialRecover.anchor,
  hurt: POSES.hurt.anchor,
  kickStart: POSES.kickStart.anchor,
  kickHit: POSES.kickHit.anchor,
  exitLean: POSES.exitLean.anchor,
  exitCrouch: POSES.exitCrouch.anchor,
  exitGround: POSES.exitGround.anchor,
  exitSpring: POSES.exitSpring.anchor,
  koStagger: POSES.koStagger.anchor,
  koFall: POSES.koFall.anchor,
  koAir: POSES.koAir.anchor,
  launch: POSES.launch.anchor,
  koDown: POSES.koDown.anchor,
  groundCharge: POSES.groundCharge.anchor,
  groundRise: POSES.groundRise.anchor,
  groundPalm: POSES.groundPalm.anchor,
  hurtRecover: POSES.hurtRecover.anchor,
  punchChain1: POSES.punchChain1.anchor,
  punchChain2: POSES.punchChain2.anchor,
  punchMidHit: POSES.punchMidHit.anchor,
  punchMidRecover: POSES.punchMidRecover.anchor,
  // en marche, c'est la hanche qui est à l'aplomb du point d'appui
  walk: [POSES.walk.joints.hip_near[0], POSES.walk.anchor[1]],
}

/**
 * Agrandissement de chaque pose autour de ses pieds, pour que la tête garde la taille de celle de la garde.
 * Les illustrations de dash sont dessinées plus petit : valeurs mesurées sur la hauteur de la tête.
 */
const POSE_SCALE: Record<PoseName, number> = {
  guard: 1, step: 1, walk: 1, dashForward: 1.07, dashBack: 1.15, crouchStep: 1, crouch: 1, blockStep: 1, block: 1, crouchBlock: 1,
  jumpStart: 1, jumpRise: 1, jumpPeak: 0.93, jumpLand: 1,
  punchStart: 1, punchHit: 1,
  punchChain1: 1, punchChain2: 1, punchMidHit: 1, punchMidRecover: 1,
  punchHeavyStart: 1, punchHeavyHit: 1, punchHeavyRecover: 1,
  specialCharge: 1, specialThrow: 1.12, specialRecover: 1,
  specialIn1: 1, specialIn2: 1, specialIn3: 1,
  hurt: 1, hurtRecover: 1,
  // frappe au sol : mesuré sur la longueur des baskets
  groundCharge: 1.27, groundRise: 1.27, groundPalm: 1.27,
  // K.O. : mesuré sur la longueur des baskets ; le dessin au sol a été réduit à 0,85 pour tenir dans la toile
  koStagger: 1.12, koFall: 1.1, koAir: 1.1, koDown: 1.3,
  launch: 1.05,
  // sortie de fin de round : mesuré sur la longueur de la basket avant
  exitLean: 0.965, exitCrouch: 0.965, exitGround: 0.965, exitSpring: 0.965,
  // coup de pied : mesuré sur le visage (bandeau-menton), comme la rafale de coups de pied
  kickStart: 1.07, kickHit: 1.12,
}

/** Durée de la pose intermédiaire entre la garde et la marche, en secondes. */
const STEP_SECONDS = 0.09
/** Durée de la pose à mi-descente entre la garde et l'accroupi, en secondes. */
const CROUCH_STEP_SECONDS = 0.07
/** Durée de la pose de passage entre la garde et la parade debout, en secondes. */
const BLOCK_STEP_SECONDS = 0.05

/**
 * Saut vertical. Durées en secondes, hauteur en pixels de la toile (du sol au point le plus haut des pieds).
 * `tuck` : part de la montée après laquelle le corps se regroupe ; avant, il est encore en extension.
 * Un seul dessin couvre presque tout le vol : c'est sa déformation continue qui donne le mouvement.
 */
const JUMP = {
  start: 0.07,
  /** Montée puis retombée : la retombée est plus courte, le personnage tombe plus vite qu'il ne monte. */
  rise: 0.3,
  fall: 0.22,
  land: 0.1,
  height: 600,
  tuck: 0.26,
  /** Déformation du dessin : tassement à l'impulsion et à la réception, étirement à pleine vitesse. */
  squash: 0.09,
  stretch: 0.07,
  /**
   * Sauts avant et arrière : distance parcourue en vol (fraction de la largeur de l'écran) et inclinaison du
   * corps dans le sens du saut (pixels de décalage en haut du corps). Le saut arrière va moins loin.
   */
  forward: 0.17,
  back: 0.13,
  lean: 55,
}

/**
 * Coups de poing debout. Durées en secondes, calquées sur des coups de jeu de combat à 60 images par
 * seconde (démarrage, actif, récupération). `reach` : portée du coup devant le point d'appui du personnage,
 * en pixels de la toile ; `height` : hauteur du poing au-dessus du sol. Quand le coup touche :
 * `power` (de 0 à 1) règle la réaction de la cible et la taille de l'étincelle, `stop` est la durée de
 * l'arrêt sur image, en secondes.
 * Chaque coup a ses dessins par phase ; le démarrage peut en avoir plusieurs, qui se partagent sa durée.
 * Le léger réutilise son dessin de démarrage pour la récupération. Le fort est un uppercut du bras avant. Le coup de pied (`kick`), quatrième et dernier coup de l'enchaînement, part après le fort. Le moyen ne s'obtient qu'en enchaînant
 * après le léger : son démarrage est fait des deux dessins de transition entre le jab et le direct.
 */
const PUNCHES = {
  light: { startup: 4 / 60, active: 3 / 60, recovery: 7 / 60, reach: 580, height: 1010, power: 0.35, stop: 0.06, start: ['punchStart'], hit: 'punchHit', recover: 'punchStart' },
  medium: { startup: 6 / 60, active: 4 / 60, recovery: 11 / 60, reach: 560, height: 960, power: 0.6, stop: 0.09, start: ['punchChain1', 'punchChain2'], hit: 'punchMidHit', recover: 'punchMidRecover' },
  heavy: { startup: 11 / 60, active: 6 / 60, recovery: 20 / 60, reach: 480, height: 1150, power: 1, stop: 0.15, start: ['punchHeavyStart'], hit: 'punchHeavyHit', recover: 'punchHeavyRecover' },
  kick: { startup: 6 / 60, active: 4 / 60, recovery: 11 / 60, reach: 700, height: 1220, power: 1, stop: 0.17, start: ['kickStart'], hit: 'kickHit', recover: 'kickStart' },
} satisfies Record<string, { startup: number; active: number; recovery: number; reach: number; height: number; power: number; stop: number; start: PoseName[]; hit: PoseName; recover: PoseName }>
export type PunchStrength = keyof typeof PUNCHES

/**
 * Enchaînement : une seule touche d'attaque. Un nouvel appui pendant un coup met le suivant en attente ;
 * il part dès la fin des images actives, sans attendre la récupération, mais seulement si le coup a touché.
 * Un coup dans le vide va au bout de sa récupération et l'enchaînement repart du coup léger.
 * Annulation : de la même façon, la touche d'attaque spéciale pressée pendant un coup qui touche remplace
 * sa récupération par l'attaque spéciale.
 */
const CHAIN: Partial<Record<PunchStrength, PunchStrength>> = { light: 'medium', medium: 'heavy', heavy: 'kick' }
/**
 * Délai de grâce, en secondes : après la fin d'un coup, un appui pendant ce délai lance encore le coup
 * suivant au lieu de recommencer au premier. Sans lui, il faudrait appuyer pendant le quart de seconde du coup.
 */
const CHAIN_GRACE = 0.35

/**
 * Attaque spéciale : une boule de feu lancée à deux mains. Durées en secondes ; positions des mains dans
 * les illustrations de charge et de lancer, rayons en pixels de la toile ; vitesse en largeurs d'écran par seconde.
 */
const SPECIAL = {
  /**
   * Les dessins dans l'ordre, avec leur durée. `hands` : position des mains dans l'illustration, tant que
   * la boule y grossit. `launch` : la boule part des mains au début de ce dessin.
   */
  steps: [
    { pose: 'specialIn1', seconds: 0.08, hands: [215, 580] },
    { pose: 'specialCharge', seconds: 0.2, hands: [150, 575] },
    { pose: 'specialIn2', seconds: 0.07, hands: [935, 590] },
    { pose: 'specialThrow', seconds: 0.16, hands: [1010, 515], launch: true },
    { pose: 'specialIn3', seconds: 0.09 },
    { pose: 'specialRecover', seconds: 0.18 },
  ] as { pose: PoseName; seconds: number; hands?: [number, number]; launch?: boolean }[],
  chargeRadius: 130,
  radius: 190,
  speed: 1.05,
  /** Quand la boule touche : puissance du coup et durée de l'arrêt sur image, en secondes. */
  power: 1,
  stop: 0.1,
}

/**
 * Rafale de l'attaque spéciale : coups enchaînés très vite, dans un ordre tiré au hasard à chaque attaque (jamais
 * deux fois le même de suite). `count` coups de `seconds` chacun ; chacun touche une fois, avec la hauteur de son
 * coup dans l'enchaînement normal. `power` et `stop` : réaction de la cible et arrêt sur image, petits pour que la
 * rafale reste fluide.
 */
const FLURRY = {
  poses: ['punchHit', 'punchMidHit', 'punchHeavyHit', 'kickHit'] as PoseName[],
  heights: { punchHit: 1010, punchMidHit: 960, punchHeavyHit: 1150, kickHit: 1220 } as Partial<Record<PoseName, number>>,
  count: 10,
  seconds: 0.085,
  reach: 760,
  power: 0.35,
  stop: 0.03,
}

/**
 * Fin de la rafale : trois coups plus lents et plus lourds, toujours dans cet ordre, qui explosent sur la cible et
 * font trembler l'écran. `power` au-delà de 1 : secousse plus forte que pour un coup normal.
 */
const HEAVY = {
  poses: ['punchMidHit', 'punchHeavyHit', 'kickHit'] as PoseName[],
  seconds: 0.22,
  power: 1.8,
  stop: 0.12,
}

/**
 * Seconde attaque spéciale. Il se baisse, se rue sur l'adversaire (`rush`, à `rushSpeed` largeurs d'écran par
 * seconde, jusqu'à lui ou jusqu'au bord), enchaîne une rafale de coups (`FLURRY`), puis finit par la frappe au sol :
 * main au sol pour charger (`charge`), redressement et frappe de la paume en avançant (`palm`), retour. Les dessins
 * dans l'ordre, avec leur durée en secondes ; `flurry` : rang du coup de la rafale. La paume touche pendant les
 * `active` premières secondes de la frappe ; le corps avance de `advance` (fraction de la largeur de l'écran) en
 * `advanceSeconds`. `reach` et `height` : bout de la paume devant le point d'appui et hauteur, en pixels de la toile.
 */
const GROUND = {
  steps: [
    { pose: 'exitLean', seconds: 0.07 },
    { pose: 'exitCrouch', seconds: 0.08 },
    // la main au sol : le jeu se fige ici, le temps de la mise au point sur le personnage
    { pose: 'exitGround', seconds: 0.1, focus: true },
    { pose: 'dashForward', seconds: 0.28, rush: true },
    ...Array.from({ length: FLURRY.count }, (_, flurry) => ({ pose: 'punchHit' as PoseName, seconds: FLURRY.seconds, flurry })),
    ...HEAVY.poses.map((_, index) => ({ pose: 'punchHit' as PoseName, seconds: HEAVY.seconds, flurry: FLURRY.count + index, heavy: true })),
    { pose: 'exitGround', seconds: 0.08 },
    { pose: 'groundCharge', seconds: 1.34, charge: true },
    { pose: 'groundRise', seconds: 0.07 },
    { pose: 'groundPalm', seconds: 0.42, palm: true },
    { pose: 'groundRise', seconds: 0.14 },
  ] as { pose: PoseName; seconds: number; charge?: boolean; palm?: boolean; rush?: boolean; flurry?: number; heavy?: boolean; focus?: boolean }[],
  rushSpeed: 2.2,
  active: 0.12,
  advance: 0.13,
  advanceSeconds: 0.24,
  reach: 680,
  height: 700,
  /** Puissance au-delà de 1 : secousse et recul de la cible plus forts que pour un coup normal. */
  power: 1.5,
  stop: 0.28,
  /** Main posée au sol pendant la charge, paume tendue pendant la frappe : dans leur illustration. */
  hand: [585, 1235] as [number, number],
  palm: [985, 700] as [number, number],
}
const groundStart = (key: 'charge' | 'palm' | 'rush') => GROUND.steps.slice(0, GROUND.steps.findIndex((step) => step[key])).reduce((sum, step) => sum + step.seconds, 0)
const GROUND_CHARGE = groundStart('charge')
const GROUND_PALM = groundStart('palm')
const GROUND_RUSH = groundStart('rush')
const GROUND_TOTAL = GROUND.steps.reduce((sum, step) => sum + step.seconds, 0)

/**
 * Effets de la frappe au sol, découpés dans une planche (`../art/fx-ground-special.png`, préparée par
 * `tools/prepare_fx.py`) : rectangle de chaque effet dans la planche, en pixels.
 */
const FX = {
  file: 'fx/ground-special.webp',
  size: [1536, 1024] as [number, number],
  ring: [0, 0, 480, 400],
  crescent: [1080, 0, 456, 420],
  slash: [0, 390, 520, 210],
  star: [610, 395, 170, 195],
  rocks: [0, 590, 480, 175],
  dust: [0, 770, 500, 120],
  cloud: [1070, 760, 466, 130],
} satisfies Record<string, unknown>
type FxRect = [number, number, number, number]
/** Unité de texture de la planche d'effets, après celles de la fumée. */
const FX_UNIT = 6

/**
 * Sortie de fin de round : il se baisse en quatre dessins (`steps`, durées en secondes), puis bondit hors de
 * l'écran par le haut en `leap` secondes, jusqu'à `height` pixels de la toile au-dessus du sol, avec le dessin du
 * saut étiré (`stretch`) et deux images fantômes en dessous de lui (retard en secondes, opacité).
 */
const EXIT = {
  steps: [
    { pose: 'exitLean', seconds: 0.14 },
    { pose: 'exitCrouch', seconds: 0.14 },
    { pose: 'exitGround', seconds: 0.16 },
    { pose: 'exitSpring', seconds: 0.09 },
  ] as { pose: PoseName; seconds: number }[],
  leap: 0.24,
  height: 3400,
  stretch: 0.35,
  ghosts: [
    [0.05, 0.22],
    [0.025, 0.45],
  ] as [number, number][],
  /** Temps laissé à la fumée pour retomber après le bond, avant que la sortie soit terminée. */
  settle: 1.5,
}
const EXIT_CROUCH = EXIT.steps.reduce((sum, step) => sum + step.seconds, 0)
const EXIT_GONE = EXIT_CROUCH + EXIT.leap

/**
 * K.O. : il titube, bascule en arrière, est projeté en l'air puis retombe au sol, où il reste. Les dessins dans
 * l'ordre, avec leur durée en secondes ; le dernier (au sol) dure jusqu'à la fin (`total`). Il recule de `push`
 * (fraction de la largeur de l'écran) pendant `pushSeconds`. En l'air, ses pieds montent jusqu'à `height` pixels
 * de la toile. À la chute, de la fumée et des cailloux jaillissent du sol.
 */
const KO = {
  steps: [
    { pose: 'koStagger', seconds: 0.24 },
    { pose: 'koFall', seconds: 0.18 },
    { pose: 'koAir', seconds: 0.36 },
  ] as { pose: PoseName; seconds: number }[],
  push: 0.1,
  pushSeconds: 0.78,
  height: 300,
  total: 3.2,
}
const KO_AIR = KO.steps[0].seconds + KO.steps[1].seconds
const KO_DOWN = KO.steps.reduce((sum, step) => sum + step.seconds, 0)
/**
 * Propulsé par l'attaque ultime de l'adversaire : il part en l'air à toute vitesse et sort par le haut de l'écran
 * (`rise` secondes jusqu'à `height` pixels de la toile), reste hors de l'écran `away` secondes, retombe en `fall`
 * secondes et s'écrase au sol, où il reste jusqu'à `total`. Il recule de `push` pendant la montée.
 */
const LAUNCH = {
  // il reste hors de l'écran longtemps : l'adversaire s'envole à sa poursuite et le round suivant commence avant
  rise: 0.32, height: 5200, away: 4, fall: 0.3, push: 0.06, total: 6.8,
}
/**
 * Soulevé par le premier coup de l'uppercut : il décolle de `height` pixels de la toile en `rise` secondes et reste
 * suspendu ; si aucun coup ne suit, il retombe en garde au bout de `total` secondes.
 */
const POP = { rise: 0.08, height: 90, total: 0.9 }
const LAUNCH_DOWN = LAUNCH.rise + LAUNCH.away + LAUNCH.fall

/**
 * Fumée du bond : les bouffées dessinées (`tools/prepare_fx.py`), de la plus petite à la plus grande, avec leur
 * taille en pixels de l'image. `puffs` : quelle bouffée, décalage horizontal depuis les pieds (pixels de la toile),
 * retard, taille, retournée ou non (la traînée de chaque bouffée part vers l'extérieur). Une bouffée surgit en
 * grossissant, s'éloigne et monte un peu, puis s'efface.
 */
const SMOKE = {
  files: ['fx/smoke-1.webp', 'fx/smoke-2.webp', 'fx/smoke-3.webp', 'fx/smoke-4.webp'],
  sizes: [
    [347, 180],
    [438, 277],
    [548, 418],
    [679, 552],
  ] as [number, number][],
  puffs: [
    [3, 0, 0, 1.55, false],
    [2, -420, 0.03, 1.4, true],
    [2, 420, 0.05, 1.35, false],
    [1, -780, 0.08, 1.35, true],
    [1, 780, 0.1, 1.3, false],
    [0, -1080, 0.14, 1.4, true],
    [0, 1090, 0.16, 1.35, false],
  ] as [number, number, number, number, boolean][],
  grow: 0.28,
  drift: 160,
  rise: 90,
  fade: [0.45, 1.35] as [number, number],
}
/** Unité de texture de la première bouffée ; les suivantes prennent les unités d'après. */
const SMOKE_UNIT = 2

/** Cailloux projetés au bond : nombre, vitesses (pixels de la toile par seconde), gravité, taille. */
const PEBBLES = { count: 16, speed: [900, 1900] as [number, number], spread: 0.85, gravity: 4200, size: [10, 24] as [number, number] }

/**
 * Impacts : étincelle d'un coup de poing, explosion de la boule de feu. Durée en secondes, rayon en pixels
 * de la toile pour un coup de pleine puissance.
 */
const IMPACT = { spark: { seconds: 0.24, radius: 420 }, blast: { seconds: 0.42, radius: 560 } }

/**
 * Coup encaissé. Le personnage affiche le dessin du coup reçu pendant `stun` secondes, puis celui du retour
 * pendant `recover` secondes, sans pouvoir agir. Il ne recule pas : `push` (fraction de la largeur du stage, en
 * `pushSeconds`) est à zéro, à la demande de Moussa ; le remettre pour qu'il soit repoussé. `front` : distance entre son point d'appui et l'avant de son corps, en pixels de la toile,
 * là où le coup le touche.
 */
const HURT = { stun: 0.24, recover: 0.13, push: 0, pushSeconds: 0.24, front: 200 }
/**
 * Coup paré : le personnage reste en parade pendant `stun` secondes ; il ne recule pas non plus (`push` à zéro). `height` : hauteur
 * de l'étincelle sur ses avant-bras, debout et accroupi, en pixels de la toile.
 */
const GUARD_HIT = { stun: 0.2, push: 0, pushSeconds: 0.18, height: 1050, crouchHeight: 720 }
/** Couleurs des étincelles (bord, intermédiaire) : rouge et orangé pour un coup porté, bleu pour un coup paré. */
const SPARK_COLORS = { hit: [[0.91, 0.15, 0.18], [1, 0.6, 0.25]], guard: [[0.2, 0.5, 1], [0.6, 0.85, 1]] }

/** Un coup en cours qui peut toucher : où il porte et ce qu'il fait. */
export interface Strike {
  /** Bout du coup, en fraction de la largeur du stage. */
  x: number
  /** Hauteur au-dessus du sol, en pixels de la toile. */
  height: number
  power: number
  stop: number
  /**
   * Le coup le soulève (`pop` : il décolle un peu du sol et y reste suspendu) ou le propulse hors de l'écran (`fly`),
   * pendant l'attaque ultime de l'adversaire.
   */
  launch?: 'pop' | 'fly'
}
/** Instant du lancer et durée totale de l'attaque spéciale. */
const SPECIAL_LAUNCH = SPECIAL.steps.slice(0, SPECIAL.steps.findIndex((step) => step.launch)).reduce((sum, step) => sum + step.seconds, 0)
const SPECIAL_TOTAL = SPECIAL.steps.reduce((sum, step) => sum + step.seconds, 0)

/** Poses tenues en un seul calque, qui respirent d'un bloc. */
const HELD: PoseName[] = ['crouch', 'block', 'crouchBlock']

/** Unités de texture : l'atlas de la pose affichée, puis la texture du reflet. */
const ATLAS_UNIT = 0
const REFLECTION_UNIT = 1
/**
 * Nombre d'atlas gardés en mémoire vidéo. Un atlas pèse 10 à 20 Mo une fois décompressé : les garder
 * tous (plus de 250 Mo) fait perdre le contexte WebGL sur les appareils modestes.
 */
const MAX_ATLASES = 6
const CALM_AMPLITUDE = 0.35

/**
 * Dash : distance en fraction de la largeur de l'écran, durée en secondes. Le déplacement part vite et
 * freine. `ghosts` : retard (secondes) et opacité des images fantômes laissées derrière.
 */
const DASH = {
  forward: { distance: 0.2, seconds: 0.26 },
  back: { distance: 0.15, seconds: 0.22 },
  ghosts: [
    [0.075, 0.12],
    [0.04, 0.26],
  ] as [number, number][],
  /**
   * Déformation de vitesse, à pleine vitesse (elle décroît avec le freinage) : étirement dans le sens de la
   * course, tassement vertical, inclinaison (pixels de décalage en haut du corps) et longueur de la traînée
   * (pixels de la toile).
   */
  stretch: 0.2,
  squash: 0.07,
  lean: 70,
  smear: 300,
}

/** Marge autour du quad d'un ruban ondulé dans le shader, pour que rien ne soit coupé. */
const RIBBON_MARGIN = 40

/** Le reflet est rendu une fois hors écran, dans cette zone de la toile (un peu plus large qu'elle). */
const VIEW = { x: -48, y: -16, width: 1120, height: 1568 }
const REFLECTION = { width: 560, height: 784, alpha: 0.2, squash: 0.5 }

interface Program<T extends string> {
  program: WebGLProgram
  attribute: number
  u: Record<T, WebGLUniformLocation | null>
}

/**
 * Le personnage : trois illustrations découpées en calques et animées en direct.
 * À l'arrêt il est en garde, il passe par une pose intermédiaire, puis il marche.
 */
export class HeroLayer {
  ready = false
  private gl: WebGLRenderingContext | null
  private layer: Program<(typeof LAYER_UNIFORMS)[number]> | null = null
  private flat: Program<(typeof FLAT_UNIFORMS)[number]> | null = null
  private target: WebGLFramebuffer | null = null
  private x = PLACEMENT.x
  private pose: Exclude<PoseName, 'dashForward' | 'dashBack' | 'jumpStart' | 'jumpRise' | 'jumpPeak' | 'jumpLand' | 'punchStart' | 'punchHit' | 'punchChain1' | 'punchChain2' | 'punchHeavyStart' | 'punchHeavyHit' | 'punchHeavyRecover' | 'punchMidHit' | 'punchMidRecover' | 'specialCharge' | 'specialThrow' | 'specialRecover' | 'specialIn1' | 'specialIn2' | 'specialIn3' | 'hurtRecover' | 'groundCharge' | 'groundRise' | 'groundPalm' | 'koStagger' | 'koFall' | 'koAir' | 'koDown' | 'launch' | 'exitLean' | 'exitCrouch' | 'exitGround' | 'exitSpring' | 'kickStart' | 'kickHit'> | 'dash' | 'jump' | 'punch' | 'special' | 'ground' | 'exit' | 'ko' = 'guard'
  /** Temps écoulé depuis le début de l'attaque spéciale en cours. */
  private specialTime = 0
  /** Boule de feu en vol : position (fraction de la largeur du stage), hauteur au-dessus du sol (pixels de la toile), âge. */
  private fireball: { x: number; height: number; age: number } | null = null
  private fire: Program<(typeof FIRE_UNIFORMS)[number]> | null = null
  private spark: Program<(typeof SPARK_UNIFORMS)[number]> | null = null
  /** Position que le personnage ne peut pas dépasser vers l'avant (un adversaire), en fraction de la largeur du stage. */
  wall = PLACEMENT.maxX
  /** Vrai dès que le coup de poing en cours a touché : un coup ne touche qu'une fois. */
  private punchLanded = false
  /** Vrai si l'attaque spéciale a été demandée pendant le coup en cours : elle annulera sa récupération s'il touche. */
  private specialQueued = false
  /** Impacts en cours : position, hauteur au-dessus du sol, âge, et s'il s'agit d'une explosion. */
  private impacts: { x: number; height: number; age: number; power: number; blast: boolean; guard?: boolean; seed: number }[] = []
  /** Temps écoulé depuis le coup encaissé en cours. */
  private hurtTime = 0
  /** Temps écoulé depuis le début de la frappe au sol, et vrai dès qu'elle a touché. */
  private groundTime = 0
  private groundLanded = false
  /** Vrai dès que le plan de coupe de la frappe au sol en cours a été lancé. */
  private cutInTaken = false
  /** Vrai à l'image où la frappe au sol touche : le moteur fait alors flasher l'écran. */
  private groundImpact = false
  /** Position au début de la frappe au sol : le corps avance à partir d'elle pendant la frappe. */
  private groundFrom = PLACEMENT.x
  /** Les coups de la rafale en cours, et le rang du dernier qui a touché. */
  private flurry: PoseName[] = []
  private flurryLanded = -1
  /** Effets dessinés des coups de la rafale qui ont touché : point d'impact, hauteur, âge, rang du coup. */
  private flurryFx: { x: number; height: number; age: number; index: number; heavy: boolean }[] = []
  /** Vrai dès que la mise au point du début de l'attaque spéciale a été lancée. */
  private focusTaken = false
  /** Position aux images précédentes de la ruée, pour ses images fantômes. */
  private rushTrail: number[] = []
  /** Planche des effets de la frappe au sol, et le programme qui en dessine un morceau. */
  private fx: WebGLTexture | null = null
  private sprite: Program<(typeof SPRITE_UNIFORMS)[number]> | null = null
  /** Temps écoulé depuis le début du K.O., et position au moment du coup. */
  private koTime = 0
  private koFrom = PLACEMENT.x
  /** Vrai si le K.O. en cours est une propulsion hors de l'écran. */
  private launched = false
  /** Vrai s'il est seulement soulevé (premier coup de l'uppercut), suspendu en attendant le suivant. */
  private popped = false
  /** Hauteur de laquelle part la propulsion (celle où il était suspendu). */
  private launchFrom = 0
  /** Temps écoulé depuis le début de la sortie de fin de round. */
  private exitTime = 0
  /** Les bouffées de fumée, chargées avec les poses. */
  private smoke: (WebGLTexture | null)[] = []
  /** Cailloux projetés au bond : vitesse (pixels de la toile par seconde) et taille. */
  private pebbles: { vx: number; vy: number; size: number }[] = []
  /** Temps restant pendant lequel la parade est maintenue de force, après un coup paré. */
  private blockStun = 0
  /** Recul en cours après un coup reçu ou paré : position de départ, distance, temps écoulé, durée. */
  private slide: { from: number; distance: number; time: number; seconds: number } | null = null
  /** Temps écoulé depuis le début du coup de poing en cours. */
  private punchTime = 0
  private punchStrength: PunchStrength = 'light'
  /** Vrai si la touche d'attaque a été pressée à nouveau pendant le coup en cours. */
  private punchQueued = false
  /** Temps écoulé depuis la fin du dernier coup, tant qu'aucune autre action n'a eu lieu. */
  private sincePunch = Infinity
  /** Temps écoulé depuis le début du saut en cours. */
  private jumpTime = 0
  /** Saut en cours : sens (1 avant, -1 arrière, 0 vertical) et position de départ. */
  private jumping = { direction: 0, from: PLACEMENT.x }
  /** L'atlas de chaque pose. Un seul est lié à la fois, celui de la pose affichée. */
  private images = new Map<PoseName, HTMLImageElement>()
  /** Atlas envoyés à la carte graphique, du moins récemment utilisé au plus récent. */
  private atlases = new Map<PoseName, WebGLTexture>()
  /** Dash en cours : sens, position de départ et temps écoulé. */
  private dashing = { direction: 1, from: PLACEMENT.x, time: 0 }
  /** Temps restant dans la pose intermédiaire. */
  private stepLeft = 0
  private phase = 0

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
    const fire = createProgram(gl, FLAT_VERTEX, FIRE_FRAGMENT)
    if (!fire) return false
    this.fire = { program: fire, attribute: gl.getAttribLocation(fire, 'a'), u: uniforms(gl, fire, FIRE_UNIFORMS) }
    const spark = createProgram(gl, FLAT_VERTEX, SPARK_FRAGMENT)
    if (!spark) return false
    this.spark = { program: spark, attribute: gl.getAttribLocation(spark, 'a'), u: uniforms(gl, spark, SPARK_UNIFORMS) }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // une image par pose, chargée d'avance ; elle n'est envoyée à la carte graphique qu'au moment de servir
    const loaded = await Promise.all(POSE_NAMES.map((name) => loadImage(asset(POSES[name].file))))
    for (const [index, image] of loaded.entries()) {
      if (!image) return false
      this.images.set(POSE_NAMES[index], image)
    }
    this.atlas('guard')
    const sprite = createProgram(gl, FLAT_VERTEX, SPRITE_FRAGMENT)
    if (!sprite) return false
    this.sprite = { program: sprite, attribute: gl.getAttribLocation(sprite, 'a'), u: uniforms(gl, sprite, SPRITE_UNIFORMS) }
    const sheet = await loadImage(asset(FX.file))
    this.fx = sheet ? uploadTexture(gl, FX_UNIT, sheet, { alpha: true, premultiply: true }) : null
    const puffs = await Promise.all(SMOKE.files.map((file) => loadImage(asset(file))))
    this.smoke = puffs.map((image, index) => (image ? uploadTexture(gl, SMOKE_UNIT + index, image, { alpha: true, premultiply: true }) : null))

    // texture hors écran du reflet, sur sa propre unité
    gl.activeTexture(gl.TEXTURE0 + REFLECTION_UNIT)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, REFLECTION.width, REFLECTION.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    this.target = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    gl.useProgram(flat)
    gl.uniform1i(this.flat.u.uTex, REFLECTION_UNIT)
    this.ready = true
    return true
  }

  /** Lance un dash : 1 vers l'avant, -1 vers l'arrière. Possible seulement depuis la garde ou la marche. */
  dash(direction: number): void {
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free || direction === 0) return
    this.pose = 'dash'
    this.dashing = { direction: Math.sign(direction), from: this.x, time: 0 }
  }

  /** L'atlas d'une pose, envoyé à la carte graphique s'il n'y est pas ; les moins récemment utilisés sont libérés. */
  private atlas(name: PoseName): WebGLTexture | null {
    const gl = this.gl
    if (!gl) return null
    let texture = this.atlases.get(name) ?? null
    if (texture) {
      this.atlases.delete(name)
    } else {
      const image = this.images.get(name)
      if (!image) return null
      texture = uploadTexture(gl, ATLAS_UNIT, image, { alpha: true, premultiply: true, mipmap: true })
      if (!texture) return null
    }
    this.atlases.set(name, texture)
    for (const [old, stale] of this.atlases) {
      if (this.atlases.size <= MAX_ATLASES) break
      if (old === 'guard') continue
      gl.deleteTexture(stale)
      this.atlases.delete(old)
    }
    return texture
  }

  /**
   * Touche d'attaque. Depuis la garde ou la marche, lance le coup léger ; pendant un coup, met en attente
   * le coup suivant de l'enchaînement.
   */
  attack(): void {
    if (this.pose === 'punch') {
      if (CHAIN[this.punchStrength]) this.punchQueued = true
      return
    }
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free) return
    // juste après un coup, l'appui poursuit l'enchaînement ; sinon il repart du coup léger
    const next = this.sincePunch < CHAIN_GRACE && this.punchLanded ? CHAIN[this.punchStrength] : undefined
    this.pose = 'punch'
    this.punchStrength = next ?? 'light'
    this.punchTime = 0
    this.punchQueued = false
    this.punchLanded = false
    this.specialQueued = false
  }

  /** Limite avant du personnage : le bord du stage, ou l'adversaire s'il est plus près. */
  private limit(): number {
    return Math.min(PLACEMENT.maxX, this.wall)
  }

  /**
   * Le coup de poing qui peut toucher à cet instant : pendant ses images actives, tant qu'il n'a pas déjà
   * touché. `pixel` : largeur d'un pixel de la toile, en fraction de la largeur du stage.
   */
  strike(pixel: number): Strike | null {
    if (this.pose === 'ground') {
      // la rafale : chaque coup touche une fois
      const step = this.groundStep()
      if (step.flurry !== undefined) {
        if (step.flurry === this.flurryLanded) return null
        const pose = this.flurry[step.flurry]
        const heavy = step.heavy === true
        return { x: this.x + FLURRY.reach * pixel, height: FLURRY.heights[pose] ?? 1000, power: heavy ? HEAVY.power : FLURRY.power, stop: heavy ? HEAVY.stop : FLURRY.stop }
      }
      const t = this.groundTime - GROUND_PALM
      if (t < 0 || t >= GROUND.active || this.groundLanded) return null
      return { x: this.x + GROUND.reach * pixel, height: GROUND.height, power: GROUND.power, stop: GROUND.stop }
    }
    if (this.pose !== 'punch' || this.punchLanded) return null
    const move = PUNCHES[this.punchStrength]
    if (this.punchTime < move.startup || this.punchTime >= move.startup + move.active) return null
    return { x: this.x + move.reach * pixel, height: move.height, power: move.power, stop: move.stop }
  }

  /**
   * Le coup de poing en cours a touché en `x` : il ne touchera plus, et une étincelle part du point d'impact.
   * `guarded` : le coup a été paré. L'enchaînement reste possible, comme sur un coup porté.
   */
  land(strike: Strike, x: number, guarded = false): void {
    const flurry = this.pose === 'ground' ? this.groundStep().flurry : undefined
    if (flurry !== undefined) {
      this.flurryLanded = flurry
      const heavy = this.groundStep().heavy === true
      this.flurryFx.push({ x, height: strike.height, age: 0, index: flurry, heavy })
      // les trois coups lourds explosent sur la cible
      if (heavy) this.impacts.push({ x, height: strike.height, age: 0, power: 1, blast: true, guard: guarded, seed: flurry * 13 })
    } else if (this.pose === 'ground') {
      // la frappe au sol explose sur la cible, en plus de l'étincelle
      this.groundLanded = true
      this.impacts.push({ x, height: strike.height, age: 0, power: 1, blast: true, guard: guarded, seed: strike.height })
      this.groundImpact = true
    } else this.punchLanded = true
    this.impacts.push({ x, height: strike.height, age: 0, power: strike.power, blast: false, guard: guarded, seed: this.impacts.length + strike.height })
  }

  /** La boule de feu en vol, vue comme un coup : son avant, sa hauteur, sa puissance. */
  fireballStrike(pixel: number): Strike | null {
    if (!this.fireball) return null
    return { x: this.fireball.x + SPECIAL.radius * 0.5 * pixel, height: this.fireball.height, power: SPECIAL.power, stop: SPECIAL.stop }
  }

  /** La boule de feu a touché en `x` : elle explose et disparaît. `guarded` : elle a été parée. */
  burst(x: number, guarded = false): void {
    if (!this.fireball) return
    this.impacts.push({ x, height: this.fireball.height, age: 0, power: SPECIAL.power, blast: true, guard: guarded, seed: this.fireball.age * 40 })
    this.fireball = null
  }

  /** Avant du corps du personnage, là où un coup adverse le touche, en fraction de la largeur du stage. */
  front(pixel: number): number {
    return this.x + HURT.front * pixel
  }

  /**
   * Le personnage reçoit un coup. En parade (debout ou accroupi), il le pare : il reste en parade et recule
   * un peu. Sinon il l'encaisse : tout ce qu'il faisait est interrompu, il recule et reste sonné un instant.
   * Retourne vrai si le coup est paré.
   */
  takeHit(strike: Strike, pixel: number): boolean {
    // en pleine sortie de fin de round, il n'est plus là pour être touché
    if (this.pose === 'exit' || this.pose === 'ko') return false
    const guarded = this.pose === 'block' || this.pose === 'crouchBlock'
    const height = !guarded ? strike.height : this.pose === 'block' ? GUARD_HIT.height : GUARD_HIT.crouchHeight
    this.impacts.push({ x: this.front(pixel), height, age: 0, power: strike.power, blast: false, guard: guarded, seed: this.x * 50 + this.impacts.length })
    const push = guarded ? GUARD_HIT : HURT
    this.slide = { from: this.x, distance: push.push * (0.5 + 0.5 * strike.power), time: 0, seconds: push.pushSeconds }
    if (guarded) {
      this.blockStun = GUARD_HIT.stun
      return true
    }
    this.pose = 'hurt'
    this.hurtTime = 0
    this.punchQueued = false
    this.specialQueued = false
    this.sincePunch = Infinity
    return false
  }

  /** Fait vieillir les impacts. À appeler à chaque image avec le temps réel : ils continuent pendant l'arrêt sur image. */
  tick(delta: number): void {
    for (const impact of this.impacts) impact.age += delta
    for (const fx of this.flurryFx) fx.age += delta
    this.flurryFx = this.flurryFx.filter((fx) => fx.age < (fx.heavy ? 0.32 : 0.22))
    this.impacts = this.impacts.filter((impact) => impact.age < (impact.blast ? IMPACT.blast : IMPACT.spark).seconds)
  }

  /** Dessin du coup de poing en cours : démarrage, bras tendu pendant les images actives, puis récupération. */
  private punchPose(): PoseName {
    const move = PUNCHES[this.punchStrength]
    if (this.punchTime < move.startup) {
      const start: PoseName[] = move.start
      return start[Math.min(start.length - 1, Math.floor((this.punchTime / move.startup) * start.length))]
    }
    return this.punchTime < move.startup + move.active ? move.hit : move.recover
  }

  /**
   * Lance l'attaque spéciale. Possible depuis la garde ou la marche, et une boule de feu à la fois.
   * Pendant un coup de poing, elle est mise en attente : elle annule la récupération du coup s'il touche.
   */
  special(): void {
    if (this.pose === 'punch') {
      if (!this.fireball) this.specialQueued = true
      return
    }
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free || this.fireball) return
    this.pose = 'special'
    this.specialTime = 0
  }

  /**
   * Sortie de fin de round : il se baisse, puis disparaît d'un bond dans un nuage de fumée. Elle interrompt tout ;
   * `exitDone` devient vrai quand la fumée est retombée, `reenter` le ramène en garde à sa place de départ.
   */
  exit(): void {
    if (this.pose === 'exit') return
    this.pose = 'exit'
    this.exitTime = 0
    this.slide = null
    this.blockStun = 0
    this.sincePunch = Infinity
    this.throwPebbles()
  }

  /** Cailloux projetés : toujours les mêmes, pour que l'effet soit identique d'une fois à l'autre. */
  private throwPebbles(): void {
    this.pebbles = Array.from({ length: PEBBLES.count }, (_, i) => {
      const r = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
      const angle = (i / (PEBBLES.count - 1) - 0.5) * 2 * PEBBLES.spread + (r - 0.5) * 0.3
      const speed = lerpRange(PEBBLES.speed, (r * 7.3) % 1)
      return { vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, size: lerpRange(PEBBLES.size, (r * 3.1) % 1) }
    })
  }

  /** K.O. : il est mis hors de combat, quoi qu'il fasse. `koDone` devient vrai quand il est resté assez au sol. */
  knockOut(): void {
    if ((this.pose === 'ko' && !this.popped) || this.pose === 'exit') return
    this.launched = false
    this.popped = false
    this.pose = 'ko'
    this.koTime = 0
    this.koFrom = this.x
    this.slide = null
    this.blockStun = 0
    this.fireball = null
    this.sincePunch = Infinity
    this.throwPebbles()
  }

  /** Propulsé dans les airs par l'attaque ultime de l'adversaire : un K.O. qui l'envoie hors de l'écran. */
  launch(mode: 'pop' | 'fly' = 'fly'): void {
    if (this.pose === 'exit' || (this.pose === 'ko' && this.launched)) return
    // propulsé depuis la hauteur où le premier coup l'a soulevé
    this.launchFrom = this.popped ? this.koState().lift : 0
    const wasPopped = this.popped
    this.knockOut()
    this.pose = 'ko'
    this.koTime = 0
    if (!wasPopped || mode === 'pop') this.koFrom = this.x
    this.launched = mode === 'fly'
    this.popped = mode === 'pop'
  }

  /** Instant où il touche le sol pendant le K.O. en cours. */
  private get koDownAt(): number {
    return this.launched ? LAUNCH_DOWN : KO_DOWN
  }

  /** Vrai pendant le K.O. */
  get knockedOut(): boolean {
    return this.pose === 'ko' && !this.popped
  }

  /** Vrai à l'instant où il touche le sol, pendant le K.O. */
  get koLanded(): boolean {
    return this.pose === 'ko' && !this.popped && this.koTime >= this.koDownAt
  }

  /** Vrai quand le K.O. est fini : il est resté au sol assez longtemps. */
  get koDone(): boolean {
    return this.pose === 'ko' && !this.popped && this.koTime >= (this.launched ? LAUNCH.total : KO.total)
  }

  /** Dessin du K.O. et hauteur des pieds (pixels de la toile) : en l'air, une courbe qui monte et redescend. */
  private koState(): { name: PoseName; lift: number } {
    if (this.popped) {
      const k = Math.min(1, this.koTime / POP.rise)
      return { name: 'launch', lift: POP.height * (1 - (1 - k) ** 2) }
    }
    if (this.launched) {
      const t = this.koTime
      // il part très vite puis ralentit en sortant de l'écran ; il retombe en accélérant
      const from = this.launchFrom
      if (t < LAUNCH.rise) return { name: 'launch', lift: from + (LAUNCH.height - from) * (1 - (1 - t / LAUNCH.rise) ** 2) }
      if (t < LAUNCH.rise + LAUNCH.away) return { name: 'launch', lift: LAUNCH.height }
      if (t < LAUNCH_DOWN) return { name: 'koAir', lift: LAUNCH.height * (1 - ((t - LAUNCH.rise - LAUNCH.away) / LAUNCH.fall) ** 2) }
      return { name: 'koDown', lift: 0 }
    }
    let end = 0
    for (const step of KO.steps) {
      end += step.seconds
      if (this.koTime < end) {
        const air = step.pose === 'koAir' ? Math.sin((Math.PI * (this.koTime - KO_AIR)) / step.seconds) : 0
        return { name: step.pose, lift: KO.height * air }
      }
    }
    return { name: 'koDown', lift: 0 }
  }

  /** Vrai pendant la sortie de fin de round. */
  get exiting(): boolean {
    return this.pose === 'exit'
  }

  /** Vrai quand la sortie est finie : il a disparu et la fumée est retombée. */
  get exitDone(): boolean {
    return this.pose === 'exit' && this.exitTime >= EXIT_GONE + EXIT.settle
  }

  /** Ramène le personnage en garde à sa place de départ, pour le round suivant. */
  reenter(): void {
    this.pose = 'guard'
    this.launched = false
    this.popped = false
    this.slide = null
    this.x = PLACEMENT.x
    this.fireball = null
    this.impacts = []
  }

  /** Dessin de la sortie, et hauteur des pieds pendant le bond (pixels de la toile). Null une fois disparu. */
  private exitState(): { name: PoseName; lift: number; leap: number } | null {
    let end = 0
    for (const step of EXIT.steps) {
      end += step.seconds
      if (this.exitTime < end) return { name: step.pose, lift: 0, leap: 0 }
    }
    const k = (this.exitTime - EXIT_CROUCH) / EXIT.leap
    if (k >= 1) return null
    return { name: 'jumpRise', lift: EXIT.height * k * k, leap: k }
  }

  /** Lance la seconde attaque spéciale, la frappe au sol. Possible depuis la garde ou la marche. */
  groundSpecial(): void {
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free) return
    this.pose = 'ground'
    this.groundTime = 0
    this.groundLanded = false
    this.cutInTaken = false
    this.groundFrom = this.x
    this.flurryLanded = -1
    this.rushTrail = []
    // rafale : un coup au hasard à chaque fois, jamais deux fois le même de suite, puis les trois coups lourds
    this.flurry = []
    for (let i = 0; i < FLURRY.count; i++) {
      const choices = FLURRY.poses.filter((pose) => pose !== this.flurry[i - 1])
      this.flurry.push(choices[Math.floor(Math.random() * choices.length)])
    }
    this.flurry.push(...HEAVY.poses)
    this.focusTaken = false
    this.sincePunch = Infinity
  }

  /** Le dessin à afficher pendant la frappe au sol : celui de l'étape, ou le coup tiré au hasard pendant la rafale. */
  private groundPose(): PoseName {
    const step = this.groundStep()
    return step.flurry !== undefined ? (this.flurry[step.flurry] ?? step.pose) : step.pose
  }

  /** Vrai pendant la frappe au sol : le moteur assombrit alors le décor. */
  get superActive(): boolean {
    return this.pose === 'ground' && this.groundTime >= GROUND_CHARGE - 0.08
  }

  /** Vrai une seule fois, quand la charge de la frappe au sol commence : c'est le moment du plan de coupe. */
  /** Vrai une seule fois, quand il pose la main au sol au début de l'attaque spéciale : le moment de la mise au point. */
  takeFocus(): boolean {
    if (this.pose !== 'ground' || this.focusTaken || !this.groundStep().focus) return false
    this.focusTaken = true
    return true
  }

  /** Position du personnage, en fraction de la largeur de l'écran. */
  /**
   * Les combattants changent de côté : le moteur retourne leur affichage en miroir. Toutes les positions sont
   * retournées (x devient 1 - x) pour qu'il reste à la même place à l'écran, et les déplacements en cours gardent
   * leur sens à l'écran. Une boule de feu en vol disparaît.
   */
  mirror(): void {
    const flip = (x: number) => 1 - x
    this.x = flip(this.x)
    this.dashing = { ...this.dashing, direction: -this.dashing.direction, from: flip(this.dashing.from) }
    this.jumping = { direction: -this.jumping.direction, from: flip(this.jumping.from) }
    this.groundFrom = flip(this.groundFrom)
    this.koFrom = flip(this.koFrom)
    if (this.slide) this.slide = { ...this.slide, from: flip(this.slide.from), distance: -this.slide.distance }
    this.rushTrail = this.rushTrail.map(flip)
    this.impacts = this.impacts.map((impact) => ({ ...impact, x: flip(impact.x) }))
    this.flurryFx = this.flurryFx.map((fx) => ({ ...fx, x: flip(fx.x) }))
    this.fireball = null
  }

  /** Le place ailleurs sur le stage, poussé par l'adversaire qui passe dans son dos près du bord. */
  placeAt(x: number): void {
    const shift = x - this.x
    this.x = x
    this.dashing = { ...this.dashing, from: this.dashing.from + shift }
    this.jumping = { ...this.jumping, from: this.jumping.from + shift }
    this.groundFrom += shift
  }

  get position(): number {
    return this.x
  }

  takeCutIn(): boolean {
    if (this.pose !== 'ground' || this.cutInTaken || this.groundTime < GROUND_CHARGE) return false
    this.cutInTaken = true
    return true
  }

  /** Vrai une seule fois, à l'image où la frappe au sol touche. */
  takeGroundImpact(): boolean {
    const hit = this.groundImpact
    this.groundImpact = false
    return hit
  }

  /** Le dessin en cours de la frappe au sol. */
  private groundStep(): (typeof GROUND.steps)[number] {
    let end = 0
    for (const step of GROUND.steps) {
      end += step.seconds
      if (this.groundTime < end) return step
    }
    return GROUND.steps[GROUND.steps.length - 1]
  }

  /** Le dessin en cours de l'attaque spéciale. */
  private specialStep(): (typeof SPECIAL.steps)[number] {
    let end = 0
    for (const step of SPECIAL.steps) {
      end += step.seconds
      if (this.specialTime < end) return step
    }
    return SPECIAL.steps[SPECIAL.steps.length - 1]
  }

  /** Lance un saut vertical. Possible seulement depuis la garde ou la marche. */
  jump(direction = 0): void {
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free) return
    this.pose = 'jump'
    this.jumpTime = 0
    this.jumping = { direction: Math.sign(direction), from: this.x }
  }

  /** Avancée du vol, de 0 au décollage à 1 à l'atterrissage ; le corps garde une vitesse horizontale constante. */
  private jumpFlight(): number {
    return Math.max(0, Math.min(1, (this.jumpTime - JUMP.start) / (JUMP.rise + JUMP.fall)))
  }

  /**
   * Dessin, hauteur des pieds (pixels de la toile) et déformation (largeur, hauteur) à l'instant courant du saut.
   * Le dessin se tasse pendant l'impulsion, s'étire quand il va vite, reprend sa forme au sommet,
   * puis s'écrase à la réception avant de se redresser.
   */
  private jumpState(): { name: PoseName; lift: number; sx: number; sy: number } {
    const t = this.jumpTime - JUMP.start
    if (t < 0) {
      const p = 1 + t / JUMP.start
      const squash = JUMP.squash * p * p
      return { name: 'jumpStart', lift: 0, sx: 1 + squash * 0.5, sy: 1 - squash }
    }
    if (t >= JUMP.rise + JUMP.fall) {
      const q = Math.min(1, (t - JUMP.rise - JUMP.fall) / JUMP.land)
      const squash = JUMP.squash * (1 - q) ** 2
      return { name: 'jumpLand', lift: 0, sx: 1 + squash * 0.5, sy: 1 - squash }
    }
    // deux demi-paraboles qui se rejoignent au sommet ; vitesse verticale : 1 au décollage, 0 au sommet, 1 à la retombée
    const rising = t < JUMP.rise
    const speed = rising ? 1 - t / JUMP.rise : (t - JUMP.rise) / JUMP.fall
    const stretch = JUMP.stretch * speed * speed
    return {
      name: rising && t / JUMP.rise < JUMP.tuck ? 'jumpRise' : 'jumpPeak',
      lift: JUMP.height * (1 - speed * speed),
      sx: 1 - stretch * 0.6,
      sy: 1 + stretch,
    }
  }

  /**
   * Déformation du dessin en saut : tassement ou étirement autour des pieds et, pour un saut avant ou arrière,
   * inclinaison du corps dans le sens du saut, nulle au sol et maximale en milieu de vol.
   */
  private jumpMatrix(feet: [number, number], sx: number, sy: number, amplitude: number): Affine {
    const k = this.jumpFlight()
    const shear = (-this.jumping.direction * JUMP.lean * Math.sin(Math.PI * k) * amplitude) / feet[1]
    return [sx, 0, shear, sy, feet[0] - sx * feet[0] - shear * feet[1], feet[1] - sy * feet[1]]
  }

  /** Vitesse du dash en cours : 1 au départ, 0 à l'arrêt. */
  private dashSpeed(): number {
    const move = this.dashing.direction > 0 ? DASH.forward : DASH.back
    const k = Math.max(0, Math.min(1, this.dashing.time / move.seconds))
    return (1 - k) ** 2
  }

  /** Déformation du dessin pendant le dash : étiré et penché dans le sens de la course, pieds fixes. */
  private dashMatrix(feet: [number, number]): Affine {
    const v = this.dashSpeed()
    const sx = 1 + DASH.stretch * v
    const sy = 1 - DASH.squash * v
    // inclinaison : le haut du corps part vers l'avant, proportionnellement à la hauteur
    const shear = (-this.dashing.direction * DASH.lean * v) / feet[1]
    return [sx, 0, shear, sy, feet[0] - sx * feet[0] - shear * feet[1], feet[1] - sy * feet[1]]
  }

  /** Position du personnage `time` secondes après le début du dash en cours. */
  private dashX(time: number): number {
    const move = this.dashing.direction > 0 ? DASH.forward : DASH.back
    const k = Math.max(0, Math.min(1, time / move.seconds))
    const eased = 1 - (1 - k) ** 3
    return Math.max(PLACEMENT.minX, Math.min(this.limit(), this.dashing.from + this.dashing.direction * move.distance * eased))
  }

  /**
   * Fait avancer l'état du personnage. `direction` : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt.
   * `crouch` et `block` : s'accroupir et parer tant que c'est vrai. Accroupi ou en parade, le personnage
   * ne se déplace pas.
   */
  update(frame: FrameInfo, direction: number, crouch: boolean, block: boolean): void {
    if (this.pose === 'exit') {
      this.exitTime += frame.delta
      return
    }
    if (this.pose === 'ko') {
      this.koTime += frame.delta
      // soulevé sans coup suivant : il retombe en garde
      if (this.popped) {
        if (this.koTime >= POP.total) {
          this.pose = 'guard'
          this.popped = false
        }
        return
      }
      // il recule en freinant, sans sortir du stage
      const k = Math.min(1, this.koTime / (this.launched ? LAUNCH.rise : KO.pushSeconds))
      this.x = Math.max(PLACEMENT.minX, this.koFrom - (this.launched ? LAUNCH.push : KO.push) * (1 - (1 - k) ** 2))
      return
    }
    // recul après un coup reçu ou paré : il part vite et freine
    if (this.slide) {
      const slide = this.slide
      slide.time += frame.delta
      const k = Math.min(1, slide.time / slide.seconds)
      this.x = Math.max(PLACEMENT.minX, slide.from - slide.distance * (1 - (1 - k) ** 3))
      if (k >= 1) this.slide = null
    }
    if (this.pose === 'hurt') {
      this.hurtTime += frame.delta
      if (this.hurtTime < HURT.stun + HURT.recover) return
      this.pose = 'guard'
    }
    // après un coup paré, la parade tient encore un instant, même si la touche est relâchée
    if (this.blockStun > 0) {
      this.blockStun -= frame.delta
      crouch = this.pose === 'crouchBlock'
      block = true
    }
    if (this.pose === 'dash') {
      this.dashing.time += frame.delta
      this.x = this.dashX(this.dashing.time)
      const move = this.dashing.direction > 0 ? DASH.forward : DASH.back
      if (this.dashing.time < move.seconds) return
      this.pose = 'guard'
    }
    // la boule de feu vit sa vie, quoi que fasse le personnage ensuite
    if (this.fireball) {
      this.fireball.age += frame.delta
      this.fireball.x += SPECIAL.speed * frame.delta
      if (this.fireball.x > 1.2) this.fireball = null
    }
    if (this.pose === 'ground') {
      const before = this.groundTime
      this.groundTime += frame.delta
      // la ruée : il fonce jusqu'à l'adversaire ou jusqu'au bord, en laissant des images fantômes
      if (this.groundStep().rush) {
        this.rushTrail = [this.x, ...this.rushTrail].slice(0, 6)
        this.x = Math.max(PLACEMENT.minX, Math.min(this.limit(), this.x + GROUND.rushSpeed * frame.delta))
      } else if (this.groundTime < GROUND_PALM) {
        this.rushTrail = []
      }
      // pendant la frappe, il avance encore un peu, sans franchir le bord ni l'adversaire
      if (before < GROUND_PALM && this.groundTime >= GROUND_PALM) this.groundFrom = this.x
      if (this.groundTime >= GROUND_PALM) {
        const k = Math.min(1, (this.groundTime - GROUND_PALM) / GROUND.advanceSeconds)
        this.x = Math.max(PLACEMENT.minX, Math.min(this.limit(), this.groundFrom + GROUND.advance * (1 - (1 - k) ** 3)))
      }
      if (this.groundTime < GROUND_TOTAL) return
      this.pose = 'guard'
    }
    if (this.pose === 'special') {
      const before = this.specialTime
      this.specialTime += frame.delta
      if (before < SPECIAL_LAUNCH && this.specialTime >= SPECIAL_LAUNCH) {
        // elle part des mains tendues du dessin de lancer
        const step = this.specialStep()
        const pixel = (PLACEMENT.scale / CANVAS[1]) * (frame.height / frame.width)
        const feet = FEET[step.pose]
        const grown = POSE_SCALE[step.pose]
        const hands = step.hands ?? feet
        this.fireball = { x: this.x + (hands[0] - feet[0]) * grown * pixel, height: (feet[1] - hands[1]) * grown, age: 0 }
      }
      if (this.specialTime < SPECIAL_TOTAL) return
      this.pose = 'guard'
    }
    // le délai de grâce ne court qu'en garde : toute autre action l'annule
    if (this.pose === 'guard') this.sincePunch += frame.delta
    else if (this.pose !== 'punch') this.sincePunch = Infinity
    if (this.pose === 'punch') {
      this.punchTime += frame.delta
      const move = PUNCHES[this.punchStrength]
      const next = CHAIN[this.punchStrength]
      const cancellable = this.punchLanded && this.punchTime >= move.startup + move.active
      if (cancellable && this.specialQueued) {
        // l'attaque spéciale remplace la récupération du coup
        this.pose = 'special'
        this.specialTime = 0
        this.specialQueued = false
        this.punchQueued = false
        this.sincePunch = Infinity
        return
      }
      if (next && this.punchQueued && cancellable) {
        // le coup suivant remplace la récupération de celui-ci
        this.punchStrength = next
        this.punchTime = 0
        this.punchQueued = false
        this.punchLanded = false
        this.specialQueued = false
        return
      }
      if (this.punchTime < move.startup + move.active + move.recovery) return
      this.pose = 'guard'
      this.sincePunch = 0
    }
    if (this.pose === 'jump') {
      this.jumpTime += frame.delta
      // saut avant ou arrière : le corps avance pendant tout le vol, sans franchir le bord ni l'adversaire
      const { direction, from } = this.jumping
      if (direction !== 0) {
        const distance = direction > 0 ? JUMP.forward : JUMP.back
        this.x = Math.max(PLACEMENT.minX, Math.min(this.limit(), from + direction * distance * this.jumpFlight()))
      }
      if (this.jumpTime < JUMP.start + JUMP.rise + JUMP.fall + JUMP.land) return
      this.pose = 'guard'
    }
    // poses de passage : elles durent un instant, puis on arrive selon ce qui est encore demandé
    if (this.pose === 'crouchStep' || this.pose === 'blockStep') {
      this.stepLeft -= frame.delta
      if (this.stepLeft > 0) return
      if (this.pose === 'crouchStep') this.pose = crouch ? 'crouch' : 'guard'
      else this.pose = block && !crouch ? 'block' : 'guard'
      return
    }
    const pass = (pose: 'crouchStep' | 'blockStep') => {
      this.pose = pose
      this.stepLeft = pose === 'crouchStep' ? CROUCH_STEP_SECONDS : BLOCK_STEP_SECONDS
    }
    // accroupi : la parade basse se prend et se quitte sans pose de passage
    if (this.pose === 'crouch' || this.pose === 'crouchBlock') {
      if (!crouch) pass('crouchStep')
      else this.pose = block ? 'crouchBlock' : 'crouch'
      return
    }
    if (this.pose === 'block') {
      if (!block || crouch) pass('blockStep')
      return
    }
    if (this.pose === 'guard' && (crouch || block)) {
      pass(crouch ? 'crouchStep' : 'blockStep')
      return
    }
    const blocked = (direction > 0 && this.x >= this.limit()) || (direction < 0 && this.x <= PLACEMENT.minX)
    // demander l'accroupi ou la parade en marchant arrête d'abord la marche : le personnage repasse par la garde
    const moving = direction !== 0 && !blocked && !crouch && !block
    // garde <-> pose intermédiaire <-> marche : on ne saute jamais directement d'un bout à l'autre
    if (this.pose === 'step') {
      this.stepLeft -= frame.delta
      if (this.stepLeft <= 0) {
        this.pose = moving ? 'walk' : 'guard'
        this.phase = 0
      }
    } else if ((this.pose === 'guard') === moving) {
      this.pose = 'step'
      this.stepLeft = STEP_SECONDS
    }
    if (this.pose !== 'walk' || !moving) return
    this.phase = (((this.phase + (direction * frame.delta) / GAIT.period) % 1) + 1) % 1
    // le corps avance à la vitesse du pied posé ; jouer le cycle à l'envers donne la marche arrière
    const pixel = (PLACEMENT.scale / CANVAS[1]) * (frame.height / frame.width)
    this.x = Math.max(PLACEMENT.minX, Math.min(this.limit(), this.x + direction * WALK_SPEED * pixel * frame.delta))
  }

  /**
   * Effets de la frappe au sol. `front` : faux pour ceux qui passent derrière le personnage (l'énergie qui tourne
   * pendant la charge, les cailloux), vrai pour ceux de devant (l'onde et l'éclair de la paume, la poussière).
   */
  private drawGround(gl: WebGLRenderingContext, frame: FrameInfo, left: number, top: number, w: number, h: number, calm: boolean, front: boolean, zoom = 1): void {
    const sprite = this.sprite
    if (!sprite || !this.fx) return
    gl.useProgram(sprite.program)
    gl.enableVertexAttribArray(sprite.attribute)
    gl.vertexAttribPointer(sprite.attribute, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1i(sprite.u.uTex, FX_UNIT)
    const ux = w / CANVAS[0]
    const uy = h / CANVAS[1]
    /** Un point d'une illustration, à l'écran, à la place qu'elle occupe à cet instant. */
    const at = (pose: PoseName, [px, py]: [number, number]): [number, number] => {
      const feet = FEET[pose]
      const scale = POSE_SCALE[pose]
      return [left + ((px - feet[0]) * scale + GROUND_POINT[0]) * ux, top + ((py - feet[1]) * scale + GROUND_POINT[1]) * uy]
    }
    /** Un effet de la planche : centre à l'écran, largeur en pixels de la toile, opacité, retourné ou non. */
    const draw = ([rx, ry, rw, rh]: FxRect, [cx, cy]: [number, number], width: number, alpha: number, flip = false) => {
      if (alpha <= 0.01) return
      const [sw, sh] = FX.size
      gl.uniform4f(sprite.u.uUv, rx / sw, ry / sh, rw / sw, rh / sh)
      gl.uniform1f(sprite.u.uAlpha, Math.min(1, alpha) * (calm ? 0.7 : 1))
      gl.uniform4f(sprite.u.uRect, cx * 2 - 1, 1 - cy * 2, width * ux * (flip ? -1 : 1), -width * (rh / rw) * uy)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const fade = (t: number, start: number, end: number) => 1 - Math.max(0, Math.min(1, (t - start) / (end - start)))
    const grow = (t: number, seconds: number) => 1 - (1 - Math.min(1, Math.max(0, t / seconds))) ** 3
    // l'énergie clignote d'un dessin à son miroir, comme un dessin animé à deux images
    const flicker = !calm && Math.floor(frame.time * 18) % 2 === 1

    const charge = this.groundTime - GROUND_CHARGE
    const palm = this.groundTime - GROUND_PALM
    const hand = at('groundCharge', GROUND.hand)
    if (charge >= 0 && !front) {
      // pendant la charge : un anneau d'énergie rouge autour de lui, qui grossit puis s'efface après la frappe
      const ring = at('groundCharge', [560, 960])
      // l'anneau grossit puis bat comme un cœur tant que la charge dure
      const beat = calm ? 0 : 60 * Math.sin(charge * 9)
      draw(FX.ring as FxRect, ring, 900 + 380 * grow(charge, 0.3) + beat, grow(charge, 0.12) * fade(palm, 0, 0.25), flicker)
      // les cailloux arrachés du sol sous la main
      const [hx, hy] = hand
      draw(FX.rocks as FxRect, [hx, hy - 0.5 * (FX.rocks[3] / FX.rocks[2]) * 900 * grow(charge, 0.2) * uy], 900 * (0.5 + 0.5 * grow(charge, 0.2)), fade(charge, 0.25, 0.7))
      // un second jaillissement de cailloux juste avant la frappe
      const late = charge - (GROUND_PALM - GROUND_CHARGE - 0.4)
      if (late > 0) draw(FX.rocks as FxRect, [hx, hy - 0.5 * (FX.rocks[3] / FX.rocks[2]) * 1000 * grow(late, 0.2) * uy], 1000 * (0.5 + 0.5 * grow(late, 0.2)), fade(late, 0.2, 0.5), true)
    }
    // chaque coup de la rafale qui touche : un éclair en étoile et une entaille au point d'impact, en alternance
    if (front) {
      const sx = left + GROUND_POINT[0] * ux
      const sy = top + GROUND_POINT[1] * uy
      for (const fx of this.flurryFx) {
        const point: [number, number] = [sx + (fx.x - this.x) * zoom, sy - fx.height * uy]
        const size = fx.heavy ? 1.7 : 1
        const k = fx.age / (fx.heavy ? 0.32 : 0.22)
        draw(FX.star as FxRect, point, 520 * size * (0.6 + 0.6 * grow(fx.age, 0.05)), 1 - k * k, fx.index % 2 === 1)
        draw((fx.index % 2 ? FX.slash : FX.crescent) as FxRect, [point[0] - 60 * ux, point[1]], 560 * size, (1 - k) * grow(fx.age, 0.03), fx.index % 3 === 0)
      }
    }
    if (palm >= 0 && front) {
      const tip = at('groundPalm', GROUND.palm)
      // l'onde en croissant devant la paume, l'éclair au bout des doigts
      // devant la main, pour ne pas recouvrir le personnage
      draw(FX.crescent as FxRect, [tip[0] + 160 * ux, tip[1]], 700 + 380 * grow(palm, 0.15), fade(palm, 0.14, 0.42), flicker)
      draw(FX.star as FxRect, tip, 640 * (0.6 + 0.6 * grow(palm, 0.08)), fade(palm, 0.1, 0.28))
      draw(FX.slash as FxRect, [tip[0] + 320 * ux, tip[1] + 30 * uy], 820, fade(palm, 0.06, 0.26) * grow(palm, 0.04))
      draw(FX.slash as FxRect, [tip[0] + 260 * ux, tip[1] - 80 * uy], 700, fade(palm, 0.08, 0.3) * grow(palm, 0.06), true)
      // la poussière soulevée derrière lui par l'élan, au ras du sol
      const [fx, fy] = at('groundPalm', [300, 1225])
      draw(FX.dust as FxRect, [fx - 140 * ux, fy - 50 * uy], 1100 * (0.6 + 0.4 * grow(palm, 0.25)), fade(palm, 0.25, 0.55), true)
      draw(FX.cloud as FxRect, [fx - 260 * ux, fy - 60 * uy], 900 * (0.5 + 0.5 * grow(palm, 0.35)), fade(palm, 0.3, 0.6) * grow(palm, 0.1), true)
    }
  }

  /**
   * La fumée et les cailloux du bond, `t` secondes après le départ. `sx`, `sy` : les pieds à l'écran ; `ux`, `uy` :
   * taille d'un pixel de la toile, en fraction de l'écran.
   */
  private drawSmoke(gl: WebGLRenderingContext, flat: Program<(typeof FLAT_UNIFORMS)[number]>, t: number, sx: number, sy: number, ux: number, uy: number, calm: boolean, size = 1): void {
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    // cailloux : de petits disques sombres projetés en l'air, qui retombent et disparaissent au sol
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform1f(flat.u.uAlpha, 1)
    if (!calm) {
      for (const pebble of this.pebbles) {
        const height = pebble.vy * t - (PEBBLES.gravity * t * t) / 2
        if (height < 0) continue
        const x = sx + pebble.vx * t * ux
        const y = sy - height * uy
        gl.uniform4f(flat.u.uRect, x * 2 - 1, 1 - y * 2, pebble.size * ux * 2, pebble.size * uy * 2)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    }
    // bouffées : des petites, sur les côtés, à la grande, au centre, qui passe devant
    gl.uniform1f(flat.u.uShadow, 0)
    for (const [index, offset, delay, puffSize, flip] of [...SMOKE.puffs].reverse()) {
      const age = t - delay
      const texture = this.smoke[index]
      if (age <= 0 || !texture) continue
      const [fadeStart, fadeEnd] = SMOKE.fade
      const alpha = 1 - Math.max(0, Math.min(1, (age - fadeStart) / (fadeEnd - fadeStart)))
      if (alpha <= 0) continue
      const grow = 1 - (1 - Math.min(1, age / SMOKE.grow)) ** 3
      const scale = puffSize * size * (0.35 + 0.65 * grow) * (calm ? 0.8 : 1)
      const [iw, ih] = SMOKE.sizes[index]
      const away = Math.sign(offset) * SMOKE.drift * Math.min(1, age / 0.8)
      const x = sx + (offset + away) * size * ux
      // posée sur le sol, elle monte un peu en s'effaçant
      const bottom = sy - SMOKE.rise * Math.min(1, age / 1.2) * uy
      gl.uniform1i(flat.u.uTex, SMOKE_UNIT + index)
      gl.uniform1f(flat.u.uAlpha, alpha)
      // hauteur négative : l'image est envoyée tête en bas ; `flip` la retourne de gauche à droite
      gl.uniform4f(flat.u.uRect, x * 2 - 1, 1 - (bottom - (ih * scale * uy) / 2) * 2, iw * scale * ux * (flip ? -1 : 1), -ih * scale * uy)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.uniform1i(flat.u.uTex, REFLECTION_UNIT)
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

    // même caméra que le décor : zoom autour du centre et parallaxe du plan du sol
    const sx = (this.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
    const sy = (PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5
    const h = PLACEMENT.scale * camera.zoom
    const w = h * (CANVAS[0] / CANVAS[1]) * (frame.height / frame.width)
    const left = sx - (GROUND_POINT[0] / CANVAS[0]) * w
    const top = sy - (GROUND_POINT[1] / CANVAS[1]) * h

    const jump = this.pose === 'jump' ? this.jumpState() : null
    const leaving = this.pose === 'exit' ? this.exitState() : null
    // une fois parti d'un bond, il n'est plus dessiné : il ne reste que la fumée
    const hidden = this.pose === 'exit' && !leaving
    const ko = this.pose === 'ko' ? this.koState() : null
    const lift = jump ? jump.lift : leaving ? leaving.lift : ko ? ko.lift : 0
    const name: PoseName =
      ko
        ? ko.name
        : leaving
        ? leaving.name
        : this.pose === 'jump'
        ? (jump?.name ?? 'guard')
        : this.pose === 'punch'
          ? this.punchPose()
        : this.pose === 'ground'
          ? this.groundPose()
        : this.pose === 'hurt'
          ? this.hurtTime < HURT.stun
            ? 'hurt'
            : 'hurtRecover'
        : this.pose === 'special'
          ? this.specialStep().pose
        : this.pose === 'dash'
          ? this.dashing.direction > 0
            ? 'dashForward'
            : 'dashBack'
          : this.pose === 'exit' || this.pose === 'ko'
            ? 'guard'
            : this.pose
    const amplitude = calm ? CALM_AMPLITUDE : 1
    const feet = FEET[name]
    const scale = POSE_SCALE[name]
    const matrices: Affine[] | null =
      name === 'guard'
        ? guardMatrices(frame.time, amplitude)
        : name === 'walk'
          ? walkMatrices(this.phase)
          : HELD.includes(name)
            ? [heldMatrix(POSES[name].anchor, frame.time, amplitude)]
            : jump
              ? [this.jumpMatrix(feet, 1 + (jump.sx - 1) * amplitude, 1 + (jump.sy - 1) * amplitude, amplitude)]
              : leaving && leaving.leap > 0
                ? [scaleAbout(feet, 1 - EXIT.stretch * 0.5 * amplitude, 1 + EXIT.stretch * amplitude)]
              : this.pose === 'dash' && !calm
                ? [this.dashMatrix(feet)]
                : null
    const bends = BENDS[name]
    // traînée derrière le personnage : du côté opposé à sa course
    const rushing = this.pose === 'ground' && this.groundTime >= GROUND_RUSH && this.groundStep().rush
    const smear = calm ? 0 : this.pose === 'dash' ? this.dashing.direction * DASH.smear * this.dashSpeed() : rushing ? DASH.smear * 0.8 : 0

    /** Dessine la pose affichée, ou `other` (une pose de même point d'appui et de même échelle, en un calque). */
    const drawLayers = (vx: number, vy: number, vz: number, vw: number, alpha = 1, raise = 0, other?: PoseName) => {
      const shown = other ?? name
      const pose = POSES[shown]
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform1f(u.uAlpha, alpha)
      gl.activeTexture(gl.TEXTURE0 + ATLAS_UNIT)
      gl.bindTexture(gl.TEXTURE_2D, this.atlas(shown))
      gl.uniform1i(u.uTex, ATLAS_UNIT)
      gl.uniform2f(u.uAtlasSize, pose.atlasSize[0], pose.atlasSize[1])
      pose.layers.forEach((item, index) => {
        const m = matrices ? matrices[index] : null
        const bend = bends[item.name]
        const margin = bend ? RIBBON_MARGIN : Math.ceil(Math.abs(smear))
        const [bx, by, bw, bh] = item.box
        gl.uniform4f(u.uQuad, bx - margin, by - margin, bw + 2 * margin, bh + 2 * margin)
        // la pose est agrandie autour de ses pieds, puis ses pieds sont posés sur le point du sol
        const mx = [m ? m[0] : 1, m ? m[2] : 0, (m ? m[4] : 0) - feet[0]]
        const my = [m ? m[1] : 0, m ? m[3] : 1, (m ? m[5] : 0) - feet[1]]
        gl.uniform3f(u.uMx, mx[0] * scale, mx[1] * scale, mx[2] * scale + GROUND_POINT[0])
        gl.uniform3f(u.uMy, my[0] * scale, my[1] * scale, my[2] * scale + GROUND_POINT[1] - raise)
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, item.atlas[0], item.atlas[1])
        gl.uniform4f(u.uBend, bend ? bend.amplitude * amplitude : 0, bend ? bend.length : 1, frame.time * (name === 'walk' ? 7 : 2.4) + index, 0)
        gl.uniform1f(u.uSmear, smear)
        gl.uniform4f(u.uAxis, bend ? bend.axis[0] : 1, bend ? bend.axis[1] : 0, item.pivot[0], item.pivot[1])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      })
    }

    if (!hidden) {
    // 1. le personnage entier, une fois, dans la texture du reflet
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target)
    gl.viewport(0, 0, REFLECTION.width, REFLECTION.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    drawLayers(2 / VIEW.width, 2 / VIEW.height, -1 - (2 * VIEW.x) / VIEW.width, -1 - (2 * VIEW.y) / VIEW.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, frame.width, frame.height)

    // 2. reflet (retourné et écrasé sous les pieds) et ombre
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    const px = w / CANVAS[0]
    const py = (h / CANVAS[1]) * REFLECTION.squash
    // en l'air, le reflet s'éloigne des pieds et s'estompe, et l'ombre rétrécit
    const air = Math.min(1, lift / JUMP.height)
    const mirrorTop = sy + (GROUND_POINT[1] - VIEW.y - VIEW.height + lift) * py
    gl.uniform1f(flat.u.uShadow, 0)
    gl.uniform1f(flat.u.uAlpha, REFLECTION.alpha * (1 - 0.6 * air))
    gl.uniform4f(
      flat.u.uRect,
      (left + (VIEW.x + VIEW.width / 2) * px) * 2 - 1,
      1 - (mirrorTop + (VIEW.height * py) / 2) * 2,
      VIEW.width * px,
      VIEW.height * py,
    )
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, h * 0.313 * (1 - 0.45 * air) * (frame.height / frame.width), h * 0.031 * (1 - 0.45 * air))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 3. pendant un dash, des images fantômes à ses positions précédentes (la pose n'a qu'un calque, donc pas de recouvrement)
    if (this.pose === 'dash' && !calm) {
      for (const [delay, alpha] of DASH.ghosts) {
        if (this.dashing.time <= delay) continue
        const shift = (this.dashX(this.dashing.time - delay) - this.x) * camera.zoom
        drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * (left + shift) - 1, 1 - 2 * top, alpha)
      }
    }

    // pendant la ruée, des images fantômes à ses positions précédentes
    if (this.pose === 'ground' && this.groundStep().rush && !calm) {
      this.rushTrail.forEach((x, index) => {
        if (index % 2 === 0) return
        const shift = (x - this.x) * camera.zoom
        drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * (left + shift) - 1, 1 - 2 * top, 0.35 / (1 + index * 0.5))
      })
    }

    // la frappe au sol : l'énergie qui tourne et les cailloux, derrière le personnage
    if (this.pose === 'ground') this.drawGround(gl, frame, left, top, w, h, calm, false)

    // pendant le bond de sortie, des images fantômes restent en dessous de lui
    if (leaving && leaving.leap > 0 && !calm) {
      for (const [delay, alpha] of EXIT.ghosts) {
        const k = Math.max(0, (this.exitTime - delay - EXIT_CROUCH) / EXIT.leap)
        drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * left - 1, 1 - 2 * top, alpha, EXIT.height * k * k)
      }
    }

    // 4. le personnage, calque par calque, du fond vers le premier plan
    drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * left - 1, 1 - 2 * top, 1, lift)
    }

    const unitX = (2 * w) / CANVAS[0]
    const unitY = (2 * h) / CANVAS[1]

    // la frappe au sol : l'onde, l'éclair de la paume et la poussière, devant le personnage
    if (this.pose === 'ground') this.drawGround(gl, frame, left, top, w, h, calm, true, camera.zoom)

    // la fumée et les cailloux du bond de sortie, devant lui
    if (this.pose === 'exit' && this.exitTime >= EXIT_CROUCH) this.drawSmoke(gl, flat, this.exitTime - EXIT_CROUCH, sx, sy, unitX / 2, unitY / 2, calm)
    // et celles de sa chute au sol, à la fin d'un K.O.
    if (this.pose === 'ko' && this.koTime >= this.koDownAt) this.drawSmoke(gl, flat, this.koTime - this.koDownAt, sx, sy, unitX / 2, unitY / 2, calm, 0.55)

    // 5. la boule de feu : elle grossit dans les mains pendant la charge, puis vole devant le personnage
    const fire = this.fire
    const charging = this.pose === 'special' && this.specialTime < SPECIAL_LAUNCH
    const blasting = this.impacts.some((impact) => impact.blast)
    if (fire && (charging || this.fireball || blasting)) {
      gl.useProgram(fire.program)
      gl.enableVertexAttribArray(fire.attribute)
      gl.vertexAttribPointer(fire.attribute, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(fire.u.uT, frame.time)
      gl.uniform1f(fire.u.uWobble, calm ? 0.4 : 1)
      /** Dessine une boule : centre en coordonnées d'écran, rayons en pixels de la toile. */
      const ball = (x: number, y: number, rx: number, ry: number, power: number, tail: number) => {
        gl.uniform1f(fire.u.uPower, power)
        gl.uniform1f(fire.u.uTail, tail)
        gl.uniform4f(fire.u.uRect, x * 2 - 1, 1 - y * 2, rx * unitX, ry * unitY)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      if (charging) {
        const k = this.specialTime / SPECIAL_LAUNCH
        const hands = this.specialStep().hands ?? feet
        const x = left + ((hands[0] - feet[0]) * scale + GROUND_POINT[0]) * (w / CANVAS[0])
        const y = top + ((hands[1] - feet[1]) * scale + GROUND_POINT[1]) * (h / CANVAS[1])
        ball(x, y, SPECIAL.chargeRadius * k, SPECIAL.chargeRadius * k, 0.5 + 0.5 * k, 0)
      }
      if (this.fireball) {
        const x = (this.fireball.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
        const y = sy - this.fireball.height * (h / CANVAS[1])
        const grow = Math.min(1, 0.5 + this.fireball.age / 0.08)
        // lueur sur le sol mouillé, sous la boule
        ball(x, sy, SPECIAL.radius * 2.2, SPECIAL.radius * 0.28, 0.3 * grow, 0)
        // le quad est une fois et demie plus large que haut ; le cœur est au tiers avant
        ball(x - (SPECIAL.radius * 0.5 * unitX) / 2, y, SPECIAL.radius * 1.5 * grow, SPECIAL.radius * grow, 1, 1)
      }
      // explosion : la boule se dilate d'un coup puis s'éteint, avec un éclair sur le sol
      for (const impact of this.impacts) {
        if (!impact.blast) continue
        const k = impact.age / IMPACT.blast.seconds
        const x = (impact.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
        const y = sy - impact.height * (h / CANVAS[1])
        const radius = IMPACT.blast.radius * (0.35 + 0.65 * (1 - (1 - k) ** 3))
        ball(x, sy, radius * 1.6, radius * 0.2, 0.5 * (1 - k) ** 2, 0)
        ball(x, y, radius, radius, 1.3 * (1 - k) ** 2, 0)
      }
    }

    // 6. les étincelles d'impact, par-dessus tout le reste
    const spark = this.spark
    if (!spark || this.impacts.length === 0) return
    gl.useProgram(spark.program)
    gl.enableVertexAttribArray(spark.attribute)
    gl.vertexAttribPointer(spark.attribute, 2, gl.FLOAT, false, 0, 0)
    for (const impact of this.impacts) {
      const shape = impact.blast ? IMPACT.blast : IMPACT.spark
      const k = impact.age / shape.seconds
      const x = (impact.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
      const y = sy - impact.height * (h / CANVAS[1])
      // une étincelle de coup léger est plus petite que celle d'un coup fort
      const radius = shape.radius * (0.55 + 0.45 * impact.power) * (impact.blast ? 0.8 : 1)
      const [tint, glow] = impact.guard ? SPARK_COLORS.guard : SPARK_COLORS.hit
      gl.uniform3f(spark.u.uTint, tint[0], tint[1], tint[2])
      gl.uniform3f(spark.u.uGlow, glow[0], glow[1], glow[2])
      gl.uniform1f(spark.u.uK, k)
      gl.uniform1f(spark.u.uSeed, impact.seed)
      gl.uniform1f(spark.u.uPower, calm ? 0.6 : 1)
      gl.uniform4f(spark.u.uRect, x * 2 - 1, 1 - y * 2, radius * unitX, radius * unitY)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }
}
