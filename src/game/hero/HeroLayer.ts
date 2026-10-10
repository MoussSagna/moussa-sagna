import { asset, bindQuad, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { HERO_FRAGMENT, HERO_VERTEX } from './shaders'

const UNIFORMS = ['uRect', 'uFlip', 'uTex', 'uMap', 'uT', 'uAlpha', 'uMode', 'uCalm', 'uChest', 'uCx'] as const

/**
 * Mesures de l'illustration (public/assets/hero/hero.webp), en fraction de l'image.
 * À recalculer si l'image change : voir docs/ASSETS.md.
 */
const SPRITE = { width: 799, height: 1100, anchorX: 0.5832, feetY: 0.9917, chestY: 0.3185, centerX: 0.5998 }

/** Position sur le stage, en fraction de l'écran, et profondeur du plan du sol pour la parallaxe. */
const PLACEMENT = { x: 0.33, y: 0.905, size: 0.56, depth: 0.42 }

/** Le personnage en position neutre : une seule image, animée par déformation. */
export class HeroLayer {
  ready = false
  private gl: WebGLRenderingContext | null
  private u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null> | null = null

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
    ])
    if (!loaded.every(Boolean)) return false
    gl.uniform1i(this.u.uTex, 0)
    gl.uniform1i(this.u.uMap, 1)
    gl.uniform1f(this.u.uChest, SPRITE.chestY)
    gl.uniform1f(this.u.uCx, SPRITE.centerX)
    this.ready = true
    return true
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
    const sx = (PLACEMENT.x + PLACEMENT.depth * camera.ox - 0.5) * camera.zoom + 0.5
    const sy = (PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5
    const h = PLACEMENT.size * camera.zoom
    const w = h * (SPRITE.width / SPRITE.height) * (frame.height / frame.width)
    const left = sx - SPRITE.anchorX * w
    const top = sy - SPRITE.feetY * h
    const cx = (left + w / 2) * 2 - 1

    gl.uniform1f(u.uT, frame.time)
    gl.uniform1f(u.uCalm, calm ? 1 : 0)
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
