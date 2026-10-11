import { asset, createProgram, loadTexture, uniforms } from '../gl'
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
/**
 * Ses poses, un dessin chacune. `ground` : point du dessin posé sur le sol, en pixels de la toile ; les
 * poses sont calées sur le pied arrière de la garde. `scale` : agrandissement autour de ce point, pour
 * que la tête garde la taille de celle de la garde (les illustrations ne sont pas à la même échelle).
 */
const POSES = {
  guard: { file: 'rival/guard.webp', ground: [510, 1500], scale: 1 },
  blockStep: { file: 'rival/block-step.webp', ground: [519, 1414], scale: 1.1 },
  block: { file: 'rival/block.webp', ground: [543, 1492], scale: 0.95 },
  hurt: { file: 'rival/hurt.webp', ground: [490, 1478], scale: 0.9 },
  hurtRecover: { file: 'rival/hurt-recover.webp', ground: [564, 1472], scale: 0.9 },
} satisfies Record<string, { file: string; ground: [number, number]; scale: number }>
type RivalPose = keyof typeof POSES
const POSE_NAMES = Object.keys(POSES) as RivalPose[]
/** Durée du dessin de passage entre la garde et la parade, en secondes. */
const BLOCK_STEP_SECONDS = 0.06

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

/** L'adversaire : pour l'instant immobile, en garde ou en parade, il encaisse ou pare les coups. */
export class RivalLayer implements Opponent {
  readonly x = 0.66
  readonly surface = 220
  readonly gap = 660
  private gl: WebGLRenderingContext | null
  private layer: { program: WebGLProgram; attribute: number; u: Record<(typeof LAYER_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private flat: { program: WebGLProgram; attribute: number; u: Record<(typeof FLAT_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private ready = false
  /** Vrai tant qu'il doit parer. */
  blocking = false
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
    // une unité de texture par pose
    const loaded = await Promise.all(POSE_NAMES.map((name, unit) => loadTexture(gl, unit, asset(POSES[name].file), { alpha: true, premultiply: true, mipmap: true })))
    this.ready = loaded.every(Boolean)
    return this.ready
  }

  hit(power: number): boolean {
    const guarded = this.pose === 'block'
    this.lean = (guarded ? GUARDED_LEAN : HIT.lean) * (0.45 + 0.55 * power)
    this.velocity = 0
    if (!guarded) {
      this.pose = 'hurt'
      this.hurtTime = 0
    }
    return guarded
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
    gl.uniform1i(u.uTex, POSE_NAMES.indexOf(this.pose))
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
