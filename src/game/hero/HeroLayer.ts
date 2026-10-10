import { asset, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { IDENTITY, rigMatrices } from './rig'
import type { Affine } from './rig'
import { RIG } from './rigData'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = [
  'uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uLegs', 'uBox', 'uAtlas', 'uAtlasSize', 'uCanvas',
  'uBend', 'uAxis', 'uLegsOn', 'uBack', 'uFront', 'uBody',
] as const
const FLAT_UNIFORMS = ['uRect', 'uTex', 'uAlpha', 'uShadow'] as const

/**
 * Mesures du personnage dans la toile du rig, en fraction de la toile.
 * Affichées par tools/prepare_hero.py : à recalculer si l'illustration change (voir docs/ASSETS.md).
 */
const SPRITE = { width: 1024, height: 1536, anchorX: 0.561, feetY: 0.9831, bodyHeight: 0.9792 }

/** Position sur le stage et hauteur du personnage, en fraction de l'écran ; profondeur du sol pour la parallaxe. */
const PLACEMENT = { x: 0.33, y: 0.905, bodyHeight: 0.5344, depth: 0.42, minX: 0.14, maxX: 0.8 }
const SIZE = PLACEMENT.bodyHeight / SPRITE.bodyHeight

/**
 * Amplitude de l'animation du rig. 1 = mouvement validé ; au-delà, les calques sortent de leurs
 * zones de recouvrement et des trous apparaissent (voir moussa_rig/README.md).
 */
const AMPLITUDE = 1
const CALM_AMPLITUDE = 0.35

/**
 * Pas glissé. Les longueurs sont en pixels de la toile du rig.
 * Un cycle = un pas de la jambe avant puis un pas de la jambe arrière.
 */
const WALK = { period: 0.8, stride: 63, lift: 35, knee: 15, bob: 6.3, lean: 8, trail: 12 }

/** Marge autour du quad d'un calque déformé dans le shader, pour que rien ne soit coupé. */
const MARGIN = { ribbon: 40, legs: 80 }
const LEGS_LAYER = 'lower'

/** Le reflet est rendu une fois hors écran, dans cette zone de la toile (un peu plus large qu'elle). */
const VIEW = { x: -48, y: -16, width: 1120, height: 1568 }
const REFLECTION = { width: 560, height: 784, alpha: 0.2, squash: 0.5 }

/** Position d'un pied dans le cycle : il avance en l'air pendant la première moitié, puis recule au sol. */
function footAt(phase: number): [number, number, number] {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.5) {
    const u = p / 0.5
    const ease = u * u * (3 - 2 * u)
    const arc = Math.sin(Math.PI * u)
    return [WALK.stride * (ease - 0.5), WALK.lift * arc, WALK.knee * arc]
  }
  return [WALK.stride * (0.5 - (p - 0.5) / 0.5), 0, 0]
}

interface Program<T extends string> {
  program: WebGLProgram
  attribute: number
  u: Record<T, WebGLUniformLocation | null>
}

/** Le personnage : un rig de calques animé en direct (respiration, rubans, marche). */
export class HeroLayer {
  ready = false
  private gl: WebGLRenderingContext | null
  private layer: Program<(typeof LAYER_UNIFORMS)[number]> | null = null
  private flat: Program<(typeof FLAT_UNIFORMS)[number]> | null = null
  private target: WebGLFramebuffer | null = null
  private x = PLACEMENT.x
  private phase = 0
  /** 0 = à l'arrêt, 1 = en pleine marche ; lissé pour que les jambes reviennent en douceur. */
  private walking = 0
  private direction = 1

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
    const loaded = await Promise.all([
      loadTexture(gl, 0, asset('hero/rig-atlas.webp'), { alpha: true, premultiply: true, mipmap: true }),
      loadTexture(gl, 1, asset('hero/hero-legs.png')),
    ])
    if (!loaded.every(Boolean)) return false

    // texture hors écran du reflet, sur l'unité 2
    gl.activeTexture(gl.TEXTURE2)
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

    gl.useProgram(layer)
    gl.uniform1i(this.layer.u.uTex, 0)
    gl.uniform1i(this.layer.u.uLegs, 1)
    gl.uniform2f(this.layer.u.uAtlasSize, RIG.atlasSize[0], RIG.atlasSize[1])
    gl.uniform2f(this.layer.u.uCanvas, RIG.canvas[0], RIG.canvas[1])
    gl.useProgram(flat)
    gl.uniform1i(this.flat.u.uTex, 2)
    this.ready = true
    return true
  }

  /** Fait avancer le cycle de marche. `direction` : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  update(frame: FrameInfo, direction: number): void {
    const dt = frame.delta
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX)
    const active = direction !== 0 && !blocked
    this.walking += ((active ? 1 : 0) - this.walking) * Math.min(1, dt * 9)
    if (!active) return
    this.direction = direction
    this.phase = (((this.phase + (direction * dt) / WALK.period) % 1) + 1) % 1
    // le pied au sol recule d'une foulée par demi-cycle : le corps avance d'autant, donc rien ne patine
    const pixel = (SIZE / SPRITE.height) * (frame.height / frame.width)
    const speed = ((2 * WALK.stride) / WALK.period) * pixel
    this.x = Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, this.x + direction * speed * dt))
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
    const h = SIZE * camera.zoom
    const w = h * (SPRITE.width / SPRITE.height) * (frame.height / frame.width)
    const left = sx - SPRITE.anchorX * w
    const top = sy - SPRITE.feetY * h

    // marche : le corps monte, descend et se penche ; tout ce qui dépend du bassin suit
    const amount = this.walking
    const front = footAt(this.phase)
    const back = footAt(this.phase + 0.5)
    const bob = WALK.bob * Math.cos(4 * Math.PI * this.phase) * amount
    const lean = WALK.lean * amount * this.direction
    const feet = SPRITE.feetY * SPRITE.height
    const body: Affine = [1, 0, -lean / feet, 1, lean, bob]
    const amplitude = Math.min(1, AMPLITUDE) * (calm ? CALM_AMPLITUDE : 1)
    const matrices = rigMatrices(frame.time, amplitude, body)
    const cycle = frame.time / RIG.cycleSeconds

    const drawLayers = (vx: number, vy: number, vz: number, vw: number) => {
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform3f(u.uFront, front[0] * amount, front[1] * amount, front[2] * amount)
      gl.uniform3f(u.uBack, back[0] * amount, back[1] * amount, back[2] * amount)
      gl.uniform3f(u.uBody, bob, lean, feet)
      RIG.layers.forEach((item, index) => {
        const legs = item.name === LEGS_LAYER
        // le calque des jambes garde les pieds au sol : sa déformation est faite dans le shader
        const m = legs ? IDENTITY : matrices[index]
        const margin = legs ? MARGIN.legs : item.bend > 0 ? MARGIN.ribbon : 0
        const [bx, by, bw, bh] = item.box
        gl.uniform4f(u.uQuad, bx - margin, by - margin, bw + 2 * margin, bh + 2 * margin)
        gl.uniform3f(u.uMx, m[0], m[2], m[4])
        gl.uniform3f(u.uMy, m[1], m[3], m[5])
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, item.atlas[0], item.atlas[1])
        gl.uniform4f(
          u.uBend,
          amplitude * item.bend,
          item.length,
          2 * Math.PI * (cycle - item.phase),
          item.bend > 0 ? WALK.trail * amount * this.direction : 0,
        )
        gl.uniform4f(u.uAxis, item.axis[0], item.axis[1], item.pivot[0], item.pivot[1])
        gl.uniform1f(u.uLegsOn, legs ? 1 : 0)
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
    const px = w / SPRITE.width
    const py = (h / SPRITE.height) * REFLECTION.squash
    const mirrorTop = sy + (feet - VIEW.y - VIEW.height) * py
    gl.uniform1f(flat.u.uShadow, 0)
    gl.uniform1f(flat.u.uAlpha, REFLECTION.alpha)
    gl.uniform4f(
      flat.u.uRect,
      (left + (VIEW.x + VIEW.width / 2) * px) * 2 - 1,
      1 - (mirrorTop + (VIEW.height * py) / 2) * 2,
      VIEW.width * px,
      VIEW.height * py,
    )
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, h * 0.313 * (frame.height / frame.width), h * 0.031)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 3. le personnage, calque par calque, du fond vers le premier plan
    drawLayers((2 * w) / SPRITE.width, (-2 * h) / SPRITE.height, 2 * left - 1, 1 - 2 * top)
  }
}
