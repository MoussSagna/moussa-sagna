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
 * Pointe des deux bottes, pour la garde et la marche : le pied qui reste au sol garde sa place d'un dessin à
 * l'autre. Le point posé au sol de ces poses est pris à la même distance de la pointe du pied avant que dans la garde.
 */
const WALK_FEET = {
  guard: { front: [152, 1412], back: [740, 1486] },
  walkIn: { front: [48, 1430], back: [640, 1365] },
  walkGather: { front: [165, 1412], back: [495, 1385] },
  walkStride1: { front: [45, 1427], back: [585, 1335] },
  walkStride2: { front: [48, 1428], back: [755, 1385] },
} satisfies Record<string, { front: Point; back: Point }>
type WalkPose = keyof typeof WALK_FEET
/** Point posé au sol d'une pose de marche : décalé de la pointe du pied avant comme dans la garde. */
const onFrontFoot = (pose: WalkPose): Point => {
  const [x, y] = WALK_FEET[pose].front
  return [x + 373, y + 43]
}

/**
 * Ses poses, un dessin chacune. `ground` : point du dessin posé sur le sol, en pixels de la toile ; les
 * poses sont calées sur le pied arrière de la garde. `scale` : agrandissement autour de ce point, pour
 * que la tête garde la taille de celle de la garde (les illustrations ne sont pas à la même échelle).
 */
const POSES = {
  guard: { file: 'rival/guard.webp', ground: onFrontFoot('guard'), scale: 1.1 },
  walkIn: { file: 'rival/walk-in.webp', ground: onFrontFoot('walkIn'), scale: 1.1 },
  walkGather: { file: 'rival/walk-gather.webp', ground: onFrontFoot('walkGather'), scale: 1.1 },
  walkStride1: { file: 'rival/walk-stride-1.webp', ground: onFrontFoot('walkStride1'), scale: 1.1 },
  walkStride2: { file: 'rival/walk-stride-2.webp', ground: onFrontFoot('walkStride2'), scale: 1.1 },
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
 * Marche en pas chassés : un premier pas main ouverte (`walkIn`), puis le pied arrière rejoint le pied avant
 * (`walkGather`) et le pied avant repart (`walkStride1`, puis `walkStride2`). Durée de chaque dessin, en secondes.
 * En reculant, les mêmes dessins, le pied arrière part le premier.
 */
const WALK = { in: 0.14, gather: 0.17, stride: 0.21 }
const WALK_CYCLE: WalkPose[] = ['walkGather', 'walkStride1', 'walkGather', 'walkStride2']
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

const isWalkPose = (pose: RivalPose): pose is WalkPose => pose in WALK_FEET && pose !== 'guard'

/** L'adversaire : en garde ou en parade, il marche pour garder ses distances, encaisse ou pare les coups. */
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
  /** Vrai quand le joueur le contrôle : il marche dans le sens demandé par `request`, au lieu de garder ses distances. */
  controlled = false
  /** Sens demandé par le joueur : -1 vers Moussa, 1 en reculant, 0 à l'arrêt. */
  request = 0
  /** Position de Moussa, transmise par le moteur à chaque image. */
  heroX = 0.33
  /** Textures de ses poses, liées tour à tour à l'unité 0 pour le dessin. */
  private textures: Partial<Record<RivalPose, WebGLTexture>> = {}
  /** Marche en cours : sens (-1 vers Moussa, 1 en reculant), dessin suivant du cycle, temps restant sur le dessin. */
  private walkDirection = 0
  private cycle = 0
  private walkLeft = 0
  /** Vrai pendant le dernier pas, avant le retour en garde. */
  private stopping = false
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
      this.walkDirection = 0
    }
    return guarded
  }

  /** Revient à sa place de départ, en garde, pour un nouveau round. */
  reset(): void {
    this.x = RivalLayer.START_X
    this.pose = 'guard'
    this.walkDirection = 0
  }

  /** Il n'a pas encore d'attaque. */
  attack(): void {}

  strike(): Strike | null {
    return null
  }

  land(): void {}

  update(frame: FrameInfo): void {
    // coup encaissé : le dessin du coup reçu, celui du retour, puis la garde
    if (this.pose === 'hurt' || this.pose === 'hurtRecover') {
      this.hurtTime += frame.delta
      this.pose = this.hurtTime < HIT.stun ? 'hurt' : 'hurtRecover'
      if (this.hurtTime >= HIT.stun + HIT.recover) this.pose = 'guard'
    } else if (this.pose === 'blockStep') {
      this.stepLeft -= frame.delta
      if (this.stepLeft <= 0) this.pose = this.blocking ? 'block' : 'guard'
    } else if ((this.pose === 'block') !== this.blocking) {
      this.pose = 'blockStep'
      this.stepLeft = BLOCK_STEP_SECONDS
      this.walkDirection = 0
    } else {
      this.walk(frame)
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

  /** Le sens dans lequel il veut marcher : -1 vers Moussa, 1 en reculant, 0 pour rester en garde. */
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
   * Déplacement de son point posé au sol, en pixels de la toile, quand il passe au dessin `next` en gardant
   * au sol le pied qui ne bouge pas. En avançant, quand les pieds s'écartent, c'est le pied avant qui part :
   * le pied arrière reste ; quand ils se rapprochent, l'inverse. En reculant, tout s'inverse.
   */
  private shiftTo(next: WalkPose, direction: number): number {
    const from = this.pose as WalkPose
    const a = WALK_FEET[from]
    const b = WALK_FEET[next]
    const spreads = b.back[0] - b.front[0] > a.back[0] - a.front[0]
    const anchor = (direction < 0) === spreads ? 'back' : 'front'
    return (a[anchor][0] - POSES[from].ground[0]) * POSES[from].scale - (b[anchor][0] - POSES[next].ground[0]) * POSES[next].scale
  }

  /**
   * Vrai si le pas vers le dessin `next` le laisse entre ses bornes. Quand il se déplace seul, il ne fait pas
   * non plus de pas qui l'amènerait plus près de Moussa que `RANGE.near` (une grande foulée peut dépasser le milieu).
   */
  private fits(next: WalkPose, direction: number, pixel: number): boolean {
    const [min, max] = this.bounds(pixel)
    const x = this.x + this.shiftTo(next, direction) * pixel
    const near = this.moves && !this.controlled && direction < 0 ? RANGE.near : 0
    return x >= min + near && x <= max
  }

  private stepTo(next: WalkPose, direction: number, pixel: number): void {
    const [min, max] = this.bounds(pixel)
    this.x = Math.min(max, Math.max(min, this.x + this.shiftTo(next, direction) * pixel))
    this.pose = next
  }

  /** Marche : un dessin après l'autre, en commençant et en finissant par le premier pas, main ouverte. */
  private walk(frame: FrameInfo): void {
    if (this.pose !== 'guard' && !isWalkPose(this.pose)) return
    const pixel = this.pixel(frame)
    const wish = this.wish(pixel)
    if (this.pose === 'guard') {
      if (wish === 0 || !this.fits('walkIn', wish, pixel)) return
      this.walkDirection = wish
      this.cycle = 0
      this.stopping = false
      this.stepTo('walkIn', wish, pixel)
      this.walkLeft = WALK.in
      return
    }
    this.walkLeft -= frame.delta
    if (this.walkLeft > 0) return
    const direction = this.walkDirection
    const next = WALK_CYCLE[this.cycle % WALK_CYCLE.length]
    const going = !this.stopping && wish === direction && this.fits(next, direction, pixel)
    if (going) {
      this.cycle++
      this.stepTo(next, direction, pixel)
      this.walkLeft = next === 'walkGather' ? WALK.gather : WALK.stride
    } else if (this.pose === 'walkIn') {
      // dernier pas : retour en garde
      this.stepTo('guard', direction, pixel)
      this.walkDirection = 0
    } else {
      // il s'arrête en repassant par le premier pas
      this.stopping = true
      this.stepTo('walkIn', direction, pixel)
      this.walkLeft = WALK.in
    }
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
    const pose = POSES[this.pose]
    const [gx, gy] = pose.ground
    const scale = pose.scale
    // le point posé au sol reste en (gx, gy) dans la toile : l'agrandissement et l'inclinaison se font autour de lui
    const left = sx - gx * unitX
    const top = sy - gy * unitY

    // ombre au sol
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, h * 0.34 * (frame.height / frame.width), h * 0.033)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.useProgram(layer.program)
    gl.enableVertexAttribArray(layer.attribute)
    gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
    const u = layer.u
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.pose] ?? null)
    gl.uniform1i(u.uTex, 0)
    gl.uniform2f(u.uAtlasSize, IMAGE_SIZE[0], IMAGE_SIZE[1])
    gl.uniform4f(u.uBend, 0, 1, 0, 0)
    gl.uniform4f(u.uAxis, 1, 0, 0, 0)
    gl.uniform1f(u.uSmear, 0)
    gl.uniform4f(u.uQuad, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform4f(u.uBox, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform2f(u.uAtlas, 0, 0)
    // il respire en s'étirant depuis le sol, et penche en arrière quand il encaisse ; ses semelles ne bougent pas
    const amplitude = calm ? CALM_AMPLITUDE : 1
    const stretch = scale * (1 + BREATH.amplitude * amplitude * Math.sin((frame.time * 2 * Math.PI) / BREATH.period))
    const lean = this.lean * amplitude * scale
    gl.uniform3f(u.uMx, scale, -lean, gx - scale * gx + lean * gy)
    gl.uniform3f(u.uMy, 0, stretch, gy - stretch * gy)

    // reflet sur le sol mouillé : le même dessin, retourné et écrasé sous ses pieds
    const mirror = unitY * REFLECTION.squash
    gl.uniform1f(u.uAlpha, REFLECTION.alpha)
    gl.uniform4f(u.uView, 2 * unitX, 2 * mirror, 2 * left - 1, 1 - 2 * sy - 2 * gy * mirror)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.uniform1f(u.uAlpha, 1)
    gl.uniform4f(u.uView, 2 * unitX, -2 * unitY, 2 * left - 1, 1 - 2 * top)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
