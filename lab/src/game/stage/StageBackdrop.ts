import { asset, bindQuad, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { STAGE_FRAGMENT, STAGE_VERTEX } from './shaders'

const UNIFORMS = ['uImg', 'uDepth', 'uT', 'uZoom', 'uTrain', 'uCalm', 'uBolt', 'uOff', 'uPan'] as const

/** Le décor : parallaxe par carte de profondeur, ciel, écrans, lanternes, métro, brume et sol mouillé. */
export class StageBackdrop {
  ready = false
  private gl: WebGLRenderingContext | null
  private u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null> | null = null
  private nextBolt: number | null = null
  private boltAt = -99

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', { antialias: false, alpha: false })
  }

  /** Résout `false` si WebGL ou les images manquent : l'écran garde alors l'image fixe en fond CSS. */
  async load(): Promise<boolean> {
    const gl = this.gl
    if (!gl) return false
    const program = createProgram(gl, STAGE_VERTEX, STAGE_FRAGMENT)
    if (!program) return false
    gl.useProgram(program)
    bindQuad(gl, program)
    this.u = uniforms(gl, program, UNIFORMS)
    const loaded = await Promise.all([
      loadTexture(gl, 0, asset('stage/stage.webp')),
      loadTexture(gl, 1, asset('stage/depth.png')),
    ])
    if (!loaded.every(Boolean)) return false
    gl.uniform1i(this.u.uImg, 0)
    gl.uniform1i(this.u.uDepth, 1)
    this.ready = true
    return true
  }

  draw(frame: FrameInfo, camera: Camera, calm: boolean): void {
    const gl = this.gl
    const u = this.u
    if (!gl || !u || !this.ready) return
    const t = frame.time
    gl.viewport(0, 0, frame.width, frame.height)

    // éclair : un flash franc puis une réplique
    if (this.nextBolt === null) this.nextBolt = t + 5
    if (t > this.nextBolt) {
      this.boltAt = t
      this.nextBolt = t + 7 + Math.random() * 9
    }
    const since = t - this.boltAt
    const bolt = calm ? 0 : Math.exp(-since * 7) + Math.exp(-((since - 0.2) ** 2) * 380) * 0.8

    // métro : la motrice traverse le viaduc en 7 s toutes les 17 s
    const cycle = t % 17
    const train = cycle < 7 ? (cycle / 7) * 1.9 - 0.15 : -1

    gl.uniform1f(u.uT, t)
    gl.uniform1f(u.uZoom, camera.zoom)
    gl.uniform1f(u.uTrain, train)
    gl.uniform1f(u.uCalm, calm ? 1 : 0)
    gl.uniform1f(u.uBolt, bolt)
    gl.uniform2f(u.uOff, -camera.ox, -camera.oy)
    gl.uniform1f(u.uPan, camera.pan ?? 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
