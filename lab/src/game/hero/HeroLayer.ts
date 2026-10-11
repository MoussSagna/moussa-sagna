import { asset, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { CANVAS, POSES } from './poseData'
import { BENDS, GAIT, WALK_SPEED, crouchMatrix, guardMatrices, walkMatrices } from './poseRig'
import type { Affine } from './poseRig'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = ['uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize', 'uBend', 'uAxis', 'uAlpha'] as const
const FLAT_UNIFORMS = ['uRect', 'uTex', 'uAlpha', 'uShadow'] as const

type PoseName = keyof typeof POSES
const POSE_NAMES: PoseName[] = ['guard', 'step', 'walk', 'dashForward', 'dashBack', 'crouchStep', 'crouch']

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
  // en marche, c'est la hanche qui est à l'aplomb du point d'appui
  walk: [POSES.walk.joints.hip_near[0], POSES.walk.anchor[1]],
}

/**
 * Agrandissement de chaque pose autour de ses pieds, pour que la tête garde la taille de celle de la garde.
 * Les illustrations de dash sont dessinées plus petit : valeurs mesurées sur la hauteur de la tête.
 */
const POSE_SCALE: Record<PoseName, number> = { guard: 1, step: 1, walk: 1, dashForward: 1.07, dashBack: 1.15, crouchStep: 1, crouch: 1 }

/** Durée de la pose intermédiaire entre la garde et la marche, en secondes. */
const STEP_SECONDS = 0.09
/** Durée de la pose à mi-descente entre la garde et l'accroupi, en secondes. */
const CROUCH_STEP_SECONDS = 0.07
const CALM_AMPLITUDE = 0.35

/**
 * Dash : distance en fraction de la largeur de l'écran, durée en secondes. Le déplacement part vite et
 * freine. `ghosts` : retard (secondes) et opacité des images fantômes laissées derrière.
 */
const DASH = {
  forward: { distance: 0.17, seconds: 0.3 },
  back: { distance: 0.13, seconds: 0.26 },
  ghosts: [
    [0.09, 0.14],
    [0.045, 0.3],
  ] as [number, number][],
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
  private pose: 'guard' | 'step' | 'walk' | 'dash' | 'crouchStep' | 'crouch' = 'guard'
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

  /** Lance un dash : 1 vers l'avant, -1 vers l'arrière. Sans effet pendant un dash ou accroupi. */
  dash(direction: number): void {
    if (this.pose === 'dash' || this.pose === 'crouch' || this.pose === 'crouchStep' || direction === 0) return
    this.pose = 'dash'
    this.dashing = { direction: Math.sign(direction), from: this.x, time: 0 }
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
   * `crouch` : s'accroupir tant que c'est vrai ; accroupi, le personnage ne se déplace pas.
   */
  update(frame: FrameInfo, direction: number, crouch: boolean): void {
    if (this.pose === 'dash') {
      this.dashing.time += frame.delta
      this.x = this.dashX(this.dashing.time)
      const move = this.dashing.direction > 0 ? DASH.forward : DASH.back
      if (this.dashing.time < move.seconds) return
      this.pose = 'guard'
    }
    // garde <-> mi-descente <-> accroupi, sur le même principe que la marche
    if (this.pose === 'crouchStep') {
      this.stepLeft -= frame.delta
      if (this.stepLeft <= 0) this.pose = crouch ? 'crouch' : 'guard'
      return
    }
    if (this.pose === 'crouch' ? !crouch : crouch && this.pose === 'guard') {
      this.pose = 'crouchStep'
      this.stepLeft = CROUCH_STEP_SECONDS
      return
    }
    if (this.pose === 'crouch') return
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX)
    // demander l'accroupi en marchant arrête d'abord la marche : le personnage repasse par la garde
    const moving = direction !== 0 && !blocked && !crouch
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

    const name: PoseName = this.pose !== 'dash' ? this.pose : this.dashing.direction > 0 ? 'dashForward' : 'dashBack'
    const pose = POSES[name]
    const amplitude = calm ? CALM_AMPLITUDE : 1
    const matrices: Affine[] | null =
      name === 'guard'
        ? guardMatrices(frame.time, amplitude)
        : name === 'walk'
          ? walkMatrices(this.phase)
          : name === 'crouch'
            ? [crouchMatrix(frame.time, amplitude)]
            : null
    const feet = FEET[name]
    const scale = POSE_SCALE[name]
    const bends = BENDS[name]

    const drawLayers = (vx: number, vy: number, vz: number, vw: number, alpha = 1) => {
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform1f(u.uAlpha, alpha)
      gl.uniform1i(u.uTex, POSE_NAMES.indexOf(name))
      gl.uniform2f(u.uAtlasSize, pose.atlasSize[0], pose.atlasSize[1])
      pose.layers.forEach((item, index) => {
        const m = matrices ? matrices[index] : null
        const bend = bends[item.name]
        const margin = bend ? RIBBON_MARGIN : 0
        const [bx, by, bw, bh] = item.box
        gl.uniform4f(u.uQuad, bx - margin, by - margin, bw + 2 * margin, bh + 2 * margin)
        // la pose est agrandie autour de ses pieds, puis ses pieds sont posés sur le point du sol
        const mx = [m ? m[0] : 1, m ? m[2] : 0, (m ? m[4] : 0) - feet[0]]
        const my = [m ? m[1] : 0, m ? m[3] : 1, (m ? m[5] : 0) - feet[1]]
        gl.uniform3f(u.uMx, mx[0] * scale, mx[1] * scale, mx[2] * scale + GROUND[0])
        gl.uniform3f(u.uMy, my[0] * scale, my[1] * scale, my[2] * scale + GROUND[1])
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, item.atlas[0], item.atlas[1])
        gl.uniform4f(u.uBend, bend ? bend.amplitude * amplitude : 0, bend ? bend.length : 1, frame.time * (name === 'walk' ? 7 : 2.4) + index, 0)
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

    // 3. pendant un dash, des images fantômes à ses positions précédentes (la pose n'a qu'un calque, donc pas de recouvrement)
    if (this.pose === 'dash' && !calm) {
      for (const [delay, alpha] of DASH.ghosts) {
        if (this.dashing.time <= delay) continue
        const shift = (this.dashX(this.dashing.time - delay) - this.x) * camera.zoom
        drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * (left + shift) - 1, 1 - 2 * top, alpha)
      }
    }

    // 4. le personnage, calque par calque, du fond vers le premier plan
    drawLayers((2 * w) / CANVAS[0], (-2 * h) / CANVAS[1], 2 * left - 1, 1 - 2 * top)
  }
}
