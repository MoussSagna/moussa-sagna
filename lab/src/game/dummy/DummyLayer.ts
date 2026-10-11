import { asset, createProgram, loadTexture, uniforms } from '../gl'
import { PLACEMENT } from '../hero/HeroLayer'
import type { Strike } from '../hero/HeroLayer'
import { CANVAS } from '../hero/poseData'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from '../hero/shaders'
import type { Opponent } from '../opponent'
import type { Camera, FrameInfo } from '../types'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha', 'uSmear'] as const
const FLAT_UNIFORMS = ['uRect', 'uAlpha', 'uShadow'] as const

type Box = [number, number, number, number]

/**
 * Le mannequin dans son atlas (`tools/prepare_dummy.py`) : le dessin au repos à gauche, le coup reçu à
 * droite, chacun sur une toile de 1024 × 1536. Rectangles en pixels de la toile.
 */
const ATLAS = {
  size: [2048, 2048] as [number, number],
  /** Décalage du dessin du coup reçu dans l'atlas. */
  hit: [1024, 0] as [number, number],
  /** Point du socle posé sur le sol. */
  ground: [500, 1455] as [number, number],
  /** Le socle, immobile. Il recouvre le bas du ressort. */
  base: [0, 1236, 1024, 300] as Box,
  /** Le buste et son ressort, qui basculent autour du pied du ressort. */
  body: [0, 0, 1024, 1264] as Box,
  pivot: [502, 1236] as [number, number],
  whole: [0, 0, 1024, 1536] as Box,
}

/**
 * Réaction aux coups. Le dessin du coup reçu s'affiche pendant `hold` secondes, puis le buste au repos
 * part penché de `tilt` radians (pour un coup de pleine puissance) et oscille sur son ressort :
 * `frequency` en battements par seconde, `damping` freine l'oscillation.
 */
const HIT = { hold: 0.1, tilt: 0.4, frequency: 3.4, damping: 6.5 }
/**
 * Attaque du mannequin : un coup de tête. Il se penche en arrière jusqu'à `back` radians pendant `windup`
 * secondes, se détend vers l'avant jusqu'à `forward` en `strike` secondes, y reste `reached` secondes (c'est
 * là qu'il peut toucher), puis son ressort le ramène.
 * `reach` : distance entre son axe et le bout de sa tête penchée, `height` : hauteur du coup, en pixels de la toile.
 */
const ATTACK = { windup: 0.32, back: 0.3, strike: 0.09, reached: 0.05, forward: -0.6, reach: 680, height: 1150, power: 0.8, stop: 0.12 }
const REFLECTION = { alpha: 0.2, squash: 0.5 }
/** « Réduire les mouvements » : part de l'oscillation conservée. */
const CALM_AMPLITUDE = 0.35

/** Le mannequin d'entraînement : une cible fixe, qui encaisse les coups et oscille sur son ressort. */
export class DummyLayer implements Opponent {
  /** Position sur le stage, en fraction de la largeur de l'écran. */
  readonly x = 0.64
  /** Distance entre l'axe du mannequin et la surface du buste côté personnage, en pixels de la toile. */
  readonly surface = 170
  /** Distance minimale entre l'axe du mannequin et le point d'appui du personnage, en pixels de la toile. */
  readonly gap = 640
  private gl: WebGLRenderingContext | null
  private layer: { program: WebGLProgram; attribute: number; u: Record<(typeof LAYER_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private flat: { program: WebGLProgram; attribute: number; u: Record<(typeof FLAT_UNIFORMS)[number], WebGLUniformLocation | null> } | null = null
  private ready = false
  /** Temps restant sur le dessin du coup reçu. */
  private hold = 0
  /** Puissance du dernier coup reçu, de 0 à 1. */
  private power = 0
  /** Inclinaison du buste (radians, positive vers l'arrière) et sa vitesse. */
  private angle = 0
  private velocity = 0
  /** Temps écoulé depuis le début de l'attaque en cours, ou -1 s'il n'attaque pas. */
  private attackTime = -1
  /** Vrai dès que l'attaque en cours a touché ou a été parée. */
  private landed = false
  /** Vrai tant que le buste oscille après un coup reçu : c'est ce mouvement que « Réduire les mouvements » atténue. */
  private wobbling = false

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
    this.ready = await loadTexture(gl, 0, asset('dummy/dummy.webp'), { alpha: true, premultiply: true, mipmap: true })
    return this.ready
  }

  /** Encaisse un coup. `power` : de 0 (effleuré) à 1 (coup fort). */
  hit(power: number): void {
    this.hold = HIT.hold
    this.power = power
    // un coup reçu interrompt son attaque
    this.attackTime = -1
    this.angle = 0
    this.velocity = 0
  }

  /** Lance le coup de tête du mannequin, s'il n'est pas déjà en train d'attaquer ou d'encaisser. */
  attack(): void {
    if (this.hold > 0 || this.attackTime >= 0) return
    this.attackTime = 0
    this.landed = false
    this.wobbling = false
    this.velocity = 0
  }

  /**
   * Son coup de tête, s'il peut toucher à cet instant : au bout de sa détente, tant qu'il n'a pas déjà
   * touché. `pixel` : largeur d'un pixel de la toile, en fraction de la largeur du stage.
   */
  strike(pixel: number): Strike | null {
    if (this.attackTime < ATTACK.windup + ATTACK.strike || this.landed) return null
    return { x: this.x - ATTACK.reach * pixel, height: ATTACK.height, power: ATTACK.power, stop: ATTACK.stop }
  }

  /** Son coup de tête a touché ou a été paré : il ne touchera plus. */
  land(): void {
    this.landed = true
  }

  update(frame: FrameInfo): void {
    if (this.hold > 0) {
      this.hold -= frame.delta
      // le buste au repos repart de l'inclinaison du dessin du coup reçu
      if (this.hold <= 0) {
        this.angle = HIT.tilt * (0.45 + 0.55 * this.power)
        this.wobbling = true
      }
      return
    }
    if (this.attackTime >= 0) {
      this.attackTime += frame.delta
      const t = this.attackTime
      if (t < ATTACK.windup) {
        // il s'arme en freinant
        this.angle = ATTACK.back * (1 - (1 - t / ATTACK.windup) ** 2)
      } else if (t < ATTACK.windup + ATTACK.strike) {
        // il part en accélérant
        this.angle = ATTACK.back + (ATTACK.forward - ATTACK.back) * ((t - ATTACK.windup) / ATTACK.strike) ** 2
      } else {
        // au bout de sa course : il peut toucher, puis le ressort le ramène
        this.angle = ATTACK.forward
        this.velocity = 0
        if (t >= ATTACK.windup + ATTACK.strike + ATTACK.reached) this.attackTime = -1
      }
      return
    }
    // ressort amorti, en petits pas pour rester stable quand une image dure longtemps
    const stiffness = (2 * Math.PI * HIT.frequency) ** 2
    const steps = 4
    const dt = frame.delta / steps
    for (let i = 0; i < steps; i++) {
      this.velocity += (-stiffness * this.angle - HIT.damping * this.velocity) * dt
      this.angle += this.velocity * dt
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
    const left = sx - ATLAS.ground[0] * unitX
    const top = sy - ATLAS.ground[1] * unitY

    // ombre au sol
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.004) * 2, h * 0.24 * (frame.height / frame.width), h * 0.03)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.useProgram(layer.program)
    gl.enableVertexAttribArray(layer.attribute)
    gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
    const u = layer.u
    gl.uniform1i(u.uTex, 0)
    gl.uniform2f(u.uAtlasSize, ATLAS.size[0], ATLAS.size[1])
    gl.uniform4f(u.uBend, 0, 1, 0, 0)
    gl.uniform4f(u.uAxis, 1, 0, 0, 0)
    gl.uniform1f(u.uSmear, 0)

    const angle = this.angle * (calm && this.wobbling ? CALM_AMPLITUDE : 1)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const [px, py] = ATLAS.pivot
    /** Dessine un rectangle de la toile ; `turned` le fait basculer autour du pied du ressort. */
    const part = (box: Box, offset: [number, number], turned: boolean) => {
      gl.uniform4f(u.uQuad, box[0], box[1], box[2], box[3])
      gl.uniform4f(u.uBox, box[0], box[1], box[2], box[3])
      gl.uniform2f(u.uAtlas, box[0] + offset[0], box[1] + offset[1])
      if (turned) {
        gl.uniform3f(u.uMx, cos, -sin, px - cos * px + sin * py)
        gl.uniform3f(u.uMy, sin, cos, py - sin * px - cos * py)
      } else {
        gl.uniform3f(u.uMx, 1, 0, 0)
        gl.uniform3f(u.uMy, 0, 1, 0)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const parts = () => {
      if (this.hold > 0) {
        part(ATLAS.whole, ATLAS.hit, false)
      } else {
        part(ATLAS.body, [0, 0], true)
        part(ATLAS.base, [0, 0], false)
      }
    }

    // reflet sur le sol mouillé : le même dessin, retourné et écrasé sous le socle
    const mirror = unitY * REFLECTION.squash
    gl.uniform1f(u.uAlpha, REFLECTION.alpha)
    gl.uniform4f(u.uView, 2 * unitX, 2 * mirror, 2 * left - 1, 1 - 2 * sy - 2 * ATLAS.ground[1] * mirror)
    parts()
    gl.uniform1f(u.uAlpha, 1)
    gl.uniform4f(u.uView, 2 * unitX, -2 * unitY, 2 * left - 1, 1 - 2 * top)
    parts()
  }
}
