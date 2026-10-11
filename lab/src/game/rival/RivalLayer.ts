import { asset, createProgram, loadTexture, uniforms } from '../gl'
import { PLACEMENT } from '../hero/HeroLayer'
import type { Strike } from '../hero/HeroLayer'
import { CANVAS } from '../hero/poseData'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from '../hero/shaders'
import type { Opponent } from '../opponent'
import type { Camera, FrameInfo } from '../types'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha', 'uSmear'] as const
const FLAT_UNIFORMS = ['uRect', 'uAlpha', 'uShadow'] as const

/**
 * Sa garde (`tools/prepare_rival.py`) : un seul dessin, en haut d'une image de 1024 × 2048.
 * `ground` : milieu de ses appuis et ligne de sa semelle la plus basse, en pixels de la toile.
 */
const GUARD = { file: 'rival/guard.webp', size: [1024, 2048] as [number, number], ground: [510, 1500] as [number, number] }

/** Respiration de la garde : amplitude de l'étirement vertical et durée d'un cycle, en secondes. */
const BREATH = { amplitude: 0.007, period: 3.6 }
/**
 * Réaction aux coups, en attendant son dessin de coup encaissé : tout le corps penche en arrière, pieds
 * fixes, puis revient comme un ressort amorti. `lean` : pente de l'inclinaison pour un coup de pleine
 * puissance (décalage horizontal par pixel de hauteur).
 */
const HIT = { lean: 0.11, frequency: 2.6, damping: 11 }
const REFLECTION = { alpha: 0.2, squash: 0.5 }
/** « Réduire les mouvements » : part de la respiration et du recul conservée. */
const CALM_AMPLITUDE = 0.35

/** L'adversaire : pour l'instant en garde, immobile, il encaisse les coups. */
export class RivalLayer implements Opponent {
  readonly x = 0.66
  readonly surface = 220
  readonly gap = 660
  private gl: WebGLRenderingContext | null
  private layer: { program: WebGLProgram; attribute: number; u: Record<(typeof LAYER_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private flat: { program: WebGLProgram; attribute: number; u: Record<(typeof FLAT_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private ready = false
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
    this.ready = await loadTexture(gl, 0, asset(GUARD.file), { alpha: true, premultiply: true, mipmap: true })
    return this.ready
  }

  hit(power: number): void {
    this.lean = HIT.lean * (0.45 + 0.55 * power)
    this.velocity = 0
  }

  /** Il n'a pas encore d'attaque. */
  attack(): void {}

  strike(): Strike | null {
    return null
  }

  land(): void {}

  update(frame: FrameInfo): void {
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
    const [gx, gy] = GUARD.ground
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
    gl.uniform1i(u.uTex, 0)
    gl.uniform2f(u.uAtlasSize, GUARD.size[0], GUARD.size[1])
    gl.uniform4f(u.uBend, 0, 1, 0, 0)
    gl.uniform4f(u.uAxis, 1, 0, 0, 0)
    gl.uniform1f(u.uSmear, 0)
    gl.uniform4f(u.uQuad, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform4f(u.uBox, 0, 0, CANVAS[0], CANVAS[1])
    gl.uniform2f(u.uAtlas, 0, 0)
    // il respire en s'étirant depuis le sol, et penche en arrière quand il encaisse ; ses semelles ne bougent pas
    const amplitude = calm ? CALM_AMPLITUDE : 1
    const stretch = 1 + BREATH.amplitude * amplitude * Math.sin((frame.time * 2 * Math.PI) / BREATH.period)
    const lean = this.lean * amplitude
    gl.uniform3f(u.uMx, 1, -lean, lean * gy)
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
