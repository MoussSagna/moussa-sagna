import { asset, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { CANVAS, POSES } from './poseData'
import { BENDS, GAIT, WALK_SPEED, guardMatrices, walkGround, walkPose } from './poseRig'
import type { Affine } from './poseRig'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis'] as const
const FLAT_UNIFORMS = ['uRect', 'uTex', 'uAlpha', 'uShadow'] as const

type PoseName = keyof typeof POSES
const POSE_NAMES: PoseName[] = ['guard', 'step', 'walk', 'walkPass']

/** Position sur le stage, en fraction de l'écran ; `scale` = hauteur de la toile en hauteurs d'écran. */
const PLACEMENT = { x: 0.33, y: 0.905, scale: 0.546, depth: 0.42, minX: 0.14, maxX: 0.8 }

/** Point de la toile posé sur le sol : le milieu des appuis de la garde. Les autres poses s'y alignent. */
const GROUND = POSES.guard.anchor
const OFFSETS: Record<PoseName, [number, number]> = {
  guard: [0, 0],
  step: [GROUND[0] - POSES.step.anchor[0], GROUND[1] - POSES.step.anchor[1]],
  // en marche, la hanche est à l'aplomb du point d'appui et la cheville posée est à la même hauteur pour tous les dessins
  walk: walkOffset('walk'),
  walkPass: walkOffset('walkPass'),
}

function walkOffset(pose: 'walk' | 'walkPass'): [number, number] {
  const sole = POSES.walk.anchor[1] - POSES.walk.joints.ankle_near[1]
  return [GROUND[0] - POSES[pose].joints.hip_near[0], GROUND[1] - sole - walkGround(pose)]
}

/** Durée de la pose intermédiaire entre la garde et la marche, en secondes. */
const STEP_SECONDS = 0.09
const CALM_AMPLITUDE = 0.35

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
  private pose: 'guard' | 'step' | 'walk' = 'guard'
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
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // un atlas par pose, sur les premières unités de texture
    const loaded = await Promise.all(
      POSE_NAMES.map((name, unit) => loadTexture(gl, unit, asset(POSES[name].file), { alpha: true, premultiply: true, mipmap: true })),
    )
    if (!loaded.every(Boolean)) return false

    // texture hors écran du reflet, sur l'unité qui suit
    gl.activeTexture(gl.TEXTURE0 + POSE_NAMES.length)
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
    gl.uniform1i(this.flat.u.uTex, POSE_NAMES.length)
    this.ready = true
    return true
  }

  /** Fait avancer l'état du personnage. `direction` : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  update(frame: FrameInfo, direction: number): void {
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX)
    const moving = direction !== 0 && !blocked
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

    const amplitude = calm ? CALM_AMPLITUDE : 1
    const walking = this.pose === 'walk' ? walkPose(this.phase) : null
    const name: PoseName = walking ? walking.pose : this.pose
    const pose = POSES[name]
    const matrices: Affine[] | null = walking ? walking.matrices : name === 'guard' ? guardMatrices(frame.time, amplitude) : null
    const offset = OFFSETS[name]
    const bends = BENDS[name]

    const drawLayers = (vx: number, vy: number, vz: number, vw: number) => {
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform1i(u.uTex, POSE_NAMES.indexOf(name))
      gl.uniform2f(u.uAtlasSize, pose.atlasSize[0], pose.atlasSize[1])
      pose.layers.forEach((item, index) => {
        const m = matrices ? matrices[index] : null
        const bend = bends[item.name]
        const margin = bend ? RIBBON_MARGIN : 0
        const [bx, by, bw, bh] = item.box
        gl.uniform4f(u.uQuad, bx - margin, by - margin, bw + 2 * margin, bh + 2 * margin)
        gl.uniform3f(u.uMx, m ? m[0] : 1, m ? m[2] : 0, (m ? m[4] : 0) + offset[0])
        gl.uniform3f(u.uMy, m ? m[1] : 0, m ? m[3] : 1, (m ? m[5] : 0) + offset[1])
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, item.atlas[0], item.atlas[1])
        gl.uniform4f(u.uBend, bend ? bend.amplitude * amplitude : 0, bend ? bend.length : 1, frame.time * (walking ? 7 : 2.4) + index, 0)
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
    const mirrorTop = sy + (GROUND[1] - VIEW.y - VIEW.height) * py
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
    drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * left - 1, 1 - 2 * top)
  }
}
