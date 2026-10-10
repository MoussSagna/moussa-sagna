import { asset, bindQuad, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { HERO_FRAGMENT, HERO_VERTEX } from './shaders'

const UNIFORMS = [
  'uRect', 'uFlip', 'uTex', 'uMap', 'uLegs', 'uT', 'uAlpha', 'uMode', 'uCalm', 'uChest', 'uCx',
  'uBob', 'uLean', 'uWalk', 'uBack', 'uFront',
] as const

/**
 * Mesures de l'illustration (public/assets/hero/hero.webp), en fraction de l'image.
 * À recalculer si l'image change : voir docs/ASSETS.md.
 */
const SPRITE = { width: 799, height: 1100, anchorX: 0.5832, feetY: 0.9917, chestY: 0.3185, centerX: 0.5998 }

/** Position sur le stage, en fraction de l'écran, et profondeur du plan du sol pour la parallaxe. */
const PLACEMENT = { x: 0.33, y: 0.905, size: 0.56, depth: 0.42, minX: 0.14, maxX: 0.8 }

/**
 * Pas glissé. Les longueurs sont en fraction de l'image du personnage.
 * Un cycle = un pas de la jambe avant puis un pas de la jambe arrière.
 */
const WALK = { period: 0.8, stride: 0.055, lift: 0.022, knee: 0.013, bob: 0.004, lean: 0.007 }

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

/** Le personnage en position neutre : une seule image, animée par déformation. */
export class HeroLayer {
  ready = false
  private gl: WebGLRenderingContext | null
  private u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null> | null = null
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
    const program = createProgram(gl, HERO_VERTEX, HERO_FRAGMENT)
    if (!program) return false
    gl.useProgram(program)
    bindQuad(gl, program)
    this.u = uniforms(gl, program, UNIFORMS)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const loaded = await Promise.all([
      loadTexture(gl, 0, asset('hero/hero.webp'), { alpha: true, premultiply: true }),
      loadTexture(gl, 1, asset('hero/hero-map.png')),
      loadTexture(gl, 2, asset('hero/hero-legs.png')),
    ])
    if (!loaded.every(Boolean)) return false
    gl.uniform1i(this.u.uTex, 0)
    gl.uniform1i(this.u.uMap, 1)
    gl.uniform1i(this.u.uLegs, 2)
    gl.uniform1f(this.u.uChest, SPRITE.chestY)
    gl.uniform1f(this.u.uCx, SPRITE.centerX)
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
    const spriteWidth = PLACEMENT.size * (SPRITE.width / SPRITE.height) * (frame.height / frame.width)
    const speed = ((2 * WALK.stride) / WALK.period) * spriteWidth
    this.x = Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, this.x + direction * speed * dt))
  }

  draw(frame: FrameInfo, camera: Camera, calm: boolean): void {
    const gl = this.gl
    const u = this.u
    if (!gl) return
    gl.viewport(0, 0, frame.width, frame.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!u || !this.ready) return

    // même caméra que le décor : zoom autour du centre et parallaxe du plan du sol
    const sx = (this.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
    const sy = (PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5
    const h = PLACEMENT.size * camera.zoom
    const w = h * (SPRITE.width / SPRITE.height) * (frame.height / frame.width)
    const left = sx - SPRITE.anchorX * w
    const top = sy - SPRITE.feetY * h
    const cx = (left + w / 2) * 2 - 1

    gl.uniform1f(u.uT, frame.time)
    gl.uniform1f(u.uCalm, calm ? 1 : 0)
    const amount = this.walking
    const front = footAt(this.phase)
    const back = footAt(this.phase + 0.5)
    gl.uniform3f(u.uFront, front[0] * amount, front[1] * amount, front[2] * amount)
    gl.uniform3f(u.uBack, back[0] * amount, back[1] * amount, back[2] * amount)
    gl.uniform1f(u.uBob, WALK.bob * Math.cos(4 * Math.PI * this.phase) * amount)
    gl.uniform1f(u.uLean, WALK.lean * amount * this.direction)
    gl.uniform1f(u.uWalk, amount * this.direction)
    const quad = (mode: number, flip: number, alpha: number, x: number, y: number, hw: number, hh: number) => {
      gl.uniform1f(u.uMode, mode)
      gl.uniform1f(u.uFlip, flip)
      gl.uniform1f(u.uAlpha, alpha)
      gl.uniform4f(u.uRect, x, y, hw, hh)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const reflection = h * 0.5
    quad(1, 1, 0.2, cx, 1 - (sy + reflection / 2 - (1 - SPRITE.feetY) * reflection) * 2, w, reflection)
    quad(2, 0, 1, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, w * 0.42, h * 0.03)
    quad(0, 0, 1, cx, 1 - (top + h / 2) * 2, w, h)
  }
}
