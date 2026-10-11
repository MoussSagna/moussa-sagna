import { asset, createProgram, loadImage, uploadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { CANVAS, POSES } from './poseData'
import { BENDS, GAIT, WALK_SPEED, guardMatrices, heldMatrix, scaleAbout, walkMatrices } from './poseRig'
import type { Affine } from './poseRig'
import { FIRE_FRAGMENT, FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha', 'uSmear'] as const
const FLAT_UNIFORMS = ['uRect', 'uTex', 'uAlpha', 'uShadow'] as const
const FIRE_UNIFORMS = ['uRect', 'uT', 'uPower', 'uTail', 'uWobble'] as const

type PoseName = keyof typeof POSES
const POSE_NAMES: PoseName[] = ['guard', 'step', 'walk', 'dashForward', 'dashBack', 'crouchStep', 'crouch', 'blockStep', 'block', 'crouchBlock', 'jumpStart', 'jumpRise', 'jumpPeak', 'jumpLand', 'punchStart', 'punchHit', 'punchChain1', 'punchChain2', 'punchMidHit', 'punchMidRecover', 'punchHeavyStart', 'punchHeavyHit', 'punchHeavyRecover', 'specialCharge', 'specialThrow', 'specialRecover', 'specialIn1', 'specialIn2', 'specialIn3']

/** Position sur le stage, en fraction de l'écran ; `scale` = hauteur de la toile en hauteurs d'écran. */
const PLACEMENT = { x: 0.33, y: 0.905, scale: 0.546, depth: 0.42, minX: 0.14, maxX: 0.8 }

/** Point de la toile posé sur le sol : le milieu des appuis de la garde. Les autres poses s'y alignent. */
const GROUND = POSES.guard.anchor
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
  specialCharge: 1, specialThrow: 1.09, specialRecover: 1.13,
  specialIn1: 1, specialIn2: 1, specialIn3: 1,
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
  start: 0.1,
  /** Montée puis retombée : la retombée est plus courte, le personnage tombe plus vite qu'il ne monte. */
  rise: 0.4,
  fall: 0.27,
  land: 0.14,
  height: 600,
  tuck: 0.26,
  /** Déformation du dessin : tassement à l'impulsion et à la réception, étirement à pleine vitesse. */
  squash: 0.09,
  stretch: 0.07,
}

/**
 * Coups de poing debout. Durées en secondes, calquées sur des coups de jeu de combat à 60 images par
 * seconde (démarrage, actif, récupération). `reach` : distance entre l'aplomb des hanches et le bout du
 * poing tendu, en pixels de la toile, pour la future zone de frappe.
 * Chaque coup a ses dessins par phase ; le démarrage peut en avoir plusieurs, qui se partagent sa durée.
 * Le léger réutilise son dessin de démarrage pour la récupération. Le fort est un uppercut du bras avant. Le moyen ne s'obtient qu'en enchaînant
 * après le léger : son démarrage est fait des deux dessins de transition entre le jab et le direct.
 */
const PUNCHES = {
  light: { startup: 4 / 60, active: 3 / 60, recovery: 7 / 60, reach: 580, start: ['punchStart'], hit: 'punchHit', recover: 'punchStart' },
  medium: { startup: 6 / 60, active: 4 / 60, recovery: 11 / 60, reach: 560, start: ['punchChain1', 'punchChain2'], hit: 'punchMidHit', recover: 'punchMidRecover' },
  heavy: { startup: 11 / 60, active: 6 / 60, recovery: 20 / 60, reach: 420, start: ['punchHeavyStart'], hit: 'punchHeavyHit', recover: 'punchHeavyRecover' },
} satisfies Record<string, { startup: number; active: number; recovery: number; reach: number; start: PoseName[]; hit: PoseName; recover: PoseName }>
export type PunchStrength = keyof typeof PUNCHES

/**
 * Enchaînement : une seule touche d'attaque. Un nouvel appui pendant un coup met le suivant en attente ;
 * il part dès la fin des images actives, sans attendre la récupération.
 */
const CHAIN: Partial<Record<PunchStrength, PunchStrength>> = { light: 'medium', medium: 'heavy' }
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
    { pose: 'specialIn3', seconds: 0.12 },
    { pose: 'specialRecover', seconds: 0.3 },
  ] as { pose: PoseName; seconds: number; hands?: [number, number]; launch?: boolean }[],
  chargeRadius: 130,
  radius: 190,
  speed: 1.05,
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
  private pose: Exclude<PoseName, 'dashForward' | 'dashBack' | 'jumpStart' | 'jumpRise' | 'jumpPeak' | 'jumpLand' | 'punchStart' | 'punchHit' | 'punchChain1' | 'punchChain2' | 'punchHeavyStart' | 'punchHeavyHit' | 'punchHeavyRecover' | 'punchMidHit' | 'punchMidRecover' | 'specialCharge' | 'specialThrow' | 'specialRecover' | 'specialIn1' | 'specialIn2' | 'specialIn3'> | 'dash' | 'jump' | 'punch' | 'special' = 'guard'
  /** Temps écoulé depuis le début de l'attaque spéciale en cours. */
  private specialTime = 0
  /** Boule de feu en vol : position (fraction de la largeur du stage), hauteur au-dessus du sol (pixels de la toile), âge. */
  private fireball: { x: number; height: number; age: number } | null = null
  private fire: Program<(typeof FIRE_UNIFORMS)[number]> | null = null
  /** Temps écoulé depuis le début du coup de poing en cours. */
  private punchTime = 0
  private punchStrength: PunchStrength = 'light'
  /** Vrai si la touche d'attaque a été pressée à nouveau pendant le coup en cours. */
  private punchQueued = false
  /** Temps écoulé depuis la fin du dernier coup, tant qu'aucune autre action n'a eu lieu. */
  private sincePunch = Infinity
  /** Temps écoulé depuis le début du saut en cours. */
  private jumpTime = 0
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
    const next = this.sincePunch < CHAIN_GRACE ? CHAIN[this.punchStrength] : undefined
    this.pose = 'punch'
    this.punchStrength = next ?? 'light'
    this.punchTime = 0
    this.punchQueued = false
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

  /** Lance l'attaque spéciale. Possible seulement depuis la garde ou la marche, et une boule de feu à la fois. */
  special(): void {
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free || this.fireball) return
    this.pose = 'special'
    this.specialTime = 0
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
  jump(): void {
    const free = this.pose === 'guard' || this.pose === 'step' || this.pose === 'walk'
    if (!free) return
    this.pose = 'jump'
    this.jumpTime = 0
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
    return Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, this.dashing.from + this.dashing.direction * move.distance * eased))
  }

  /**
   * Fait avancer l'état du personnage. `direction` : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt.
   * `crouch` et `block` : s'accroupir et parer tant que c'est vrai. Accroupi ou en parade, le personnage
   * ne se déplace pas.
   */
  update(frame: FrameInfo, direction: number, crouch: boolean, block: boolean): void {
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
      if (next && this.punchQueued && this.punchTime >= move.startup + move.active) {
        // le coup suivant remplace la récupération de celui-ci
        this.punchStrength = next
        this.punchTime = 0
        this.punchQueued = false
        return
      }
      if (this.punchTime < move.startup + move.active + move.recovery) return
      this.pose = 'guard'
      this.sincePunch = 0
    }
    if (this.pose === 'jump') {
      this.jumpTime += frame.delta
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
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX)
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
    this.x = Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, this.x + direction * WALK_SPEED * pixel * frame.delta))
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
    const left = sx - (GROUND[0] / CANVAS[0]) * w
    const top = sy - (GROUND[1] / CANVAS[1]) * h

    const jump = this.pose === 'jump' ? this.jumpState() : null
    const lift = jump ? jump.lift : 0
    const name: PoseName =
      this.pose === 'jump'
        ? (jump?.name ?? 'guard')
        : this.pose === 'punch'
          ? this.punchPose()
        : this.pose === 'special'
          ? this.specialStep().pose
        : this.pose === 'dash'
          ? this.dashing.direction > 0
            ? 'dashForward'
            : 'dashBack'
          : this.pose
    const pose = POSES[name]
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
              ? [scaleAbout(feet, 1 + (jump.sx - 1) * amplitude, 1 + (jump.sy - 1) * amplitude)]
              : this.pose === 'dash' && !calm
                ? [this.dashMatrix(feet)]
                : null
    const bends = BENDS[name]
    // traînée derrière le personnage : du côté opposé à sa course
    const smear = this.pose === 'dash' && !calm ? this.dashing.direction * DASH.smear * this.dashSpeed() : 0

    const drawLayers = (vx: number, vy: number, vz: number, vw: number, alpha = 1, raise = 0) => {
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform1f(u.uAlpha, alpha)
      gl.activeTexture(gl.TEXTURE0 + ATLAS_UNIT)
      gl.bindTexture(gl.TEXTURE_2D, this.atlas(name))
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
        gl.uniform3f(u.uMx, mx[0] * scale, mx[1] * scale, mx[2] * scale + GROUND[0])
        gl.uniform3f(u.uMy, my[0] * scale, my[1] * scale, my[2] * scale + GROUND[1] - raise)
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, item.atlas[0], item.atlas[1])
        gl.uniform4f(u.uBend, bend ? bend.amplitude * amplitude : 0, bend ? bend.length : 1, frame.time * (name === 'walk' ? 7 : 2.4) + index, 0)
        gl.uniform1f(u.uSmear, smear)
        gl.uniform4f(u.uAxis, bend ? bend.axis[0] : 1, bend ? bend.axis[1] : 0, item.pivot[0], item.pivot[1])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      })
    }

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
    const air = lift / JUMP.height
    const mirrorTop = sy + (GROUND[1] - VIEW.y - VIEW.height + lift) * py
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

    // 4. le personnage, calque par calque, du fond vers le premier plan
    drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * left - 1, 1 - 2 * top, 1, lift)

    // 5. la boule de feu : elle grossit dans les mains pendant la charge, puis vole devant le personnage
    const fire = this.fire
    const charging = this.pose === 'special' && this.specialTime < SPECIAL_LAUNCH
    if (!fire || (!charging && !this.fireball)) return
    gl.useProgram(fire.program)
    gl.enableVertexAttribArray(fire.attribute)
    gl.vertexAttribPointer(fire.attribute, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(fire.u.uT, frame.time)
    gl.uniform1f(fire.u.uWobble, calm ? 0.4 : 1)
    const unitX = (2 * w) / CANVAS[0]
    const unitY = (2 * h) / CANVAS[1]
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
      const x = left + ((hands[0] - feet[0]) * scale + GROUND[0]) * (w / CANVAS[0])
      const y = top + ((hands[1] - feet[1]) * scale + GROUND[1]) * (h / CANVAS[1])
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
  }
}
