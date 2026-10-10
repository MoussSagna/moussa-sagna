import { asset, createProgram, loadTexture, uniforms } from '../gl'
import type { Camera, FrameInfo } from '../types'
import { IDENTITY, rigMatrices } from './rig'
import type { Affine } from './rig'
import { RIG } from './rigData'
import { WALK_RIG } from './walkData'
import { GAIT, WALK_SPEED, walkMatrices } from './walkRig'
import { FLAT_FRAGMENT, FLAT_VERTEX, LAYER_FRAGMENT, LAYER_VERTEX } from './shaders'

const LAYER_UNIFORMS = [
  'uQuad', 'uMx', 'uMy', 'uView', 'uTex', 'uBox', 'uAtlas', 'uAtlasSize',
  'uBend', 'uAxis',
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

/** Marge autour du quad d'un ruban ondulé dans le shader, pour que rien ne soit coupé. */
const RIBBON_MARGIN = 40

/**
 * Décalage qui pose le rig de profil au même endroit que la pose neutre : le milieu de ses appuis
 * sur l'ancrage, et ses semelles sur la ligne des pieds.
 */
const WALK_OFFSET = { x: SPRITE.anchorX * SPRITE.width - 605, y: SPRITE.feetY * SPRITE.height - WALK_RIG.soleNear }

/**
 * Passage entre la pose de face et la marche de profil : les deux rigs sont rendus hors écran puis
 * fondus l'un dans l'autre, en se resserrant sur l'axe du corps comme un personnage qui pivote.
 */
const TURN = { seconds: 0.2, squash: 0.62 }

/** Ce qu'il faut pour dessiner un calque, quel que soit le rig dont il vient. */
interface Piece {
  box: [number, number, number, number]
  atlas: [number, number]
  matrix: Affine
  /** Ondulation : amplitude, longueur, angle de phase. Amplitude 0 pour un calque rigide. */
  bend: [number, number, number]
  axis: [number, number]
  pivot: [number, number]
}

/** Le reflet est rendu une fois hors écran, dans cette zone de la toile (un peu plus large qu'elle). */
const VIEW = { x: -48, y: -16, width: 1120, height: 1568 }
const REFLECTION = { width: 560, height: 784, alpha: 0.2, squash: 0.5 }

interface Program<T extends string> {
  program: WebGLProgram
  attribute: number
  u: Record<T, WebGLUniformLocation | null>
}

/**
 * Le personnage : deux rigs de calques animés en direct. Le rig de face respire à l'arrêt,
 * le rig de profil marche.
 */
export class HeroLayer {
  ready = false
  private gl: WebGLRenderingContext | null
  private layer: Program<(typeof LAYER_UNIFORMS)[number]> | null = null
  private flat: Program<(typeof FLAT_UNIFORMS)[number]> | null = null
  private target: WebGLFramebuffer | null = null
  /** Cibles hors écran du fondu, une par rig, sur les unités de texture 3 et 4. */
  private turnTargets: (WebGLFramebuffer | null)[] = []
  private x = PLACEMENT.x
  private phase = 0
  private moving = false
  /** 0 = pose de face, 1 = marche de profil ; entre les deux, le fondu. */
  private turn = 0

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
      loadTexture(gl, 1, asset('hero/walk-atlas.webp'), { alpha: true, premultiply: true, mipmap: true }),
    ])
    if (!loaded.every(Boolean)) return false

    // textures hors écran : le reflet sur l'unité 2, les deux rigs du fondu sur les unités 3 et 4
    const makeTarget = (unit: number, width: number, height: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      const target = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, target)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return target
    }
    this.target = makeTarget(2, REFLECTION.width, REFLECTION.height)
    this.turnTargets = [makeTarget(3, VIEW.width, VIEW.height), makeTarget(4, VIEW.width, VIEW.height)]

    this.ready = true
    return true
  }

  /** Fait avancer le cycle de marche. `direction` : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  update(frame: FrameInfo, direction: number): void {
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX)
    const moving = direction !== 0 && !blocked
    if (moving && !this.moving) this.phase = 0
    this.moving = moving
    const step = frame.delta / TURN.seconds
    this.turn = Math.max(0, Math.min(1, this.turn + (moving ? step : -step)))
    if (!moving) return
    this.phase = (((this.phase + (direction * frame.delta) / GAIT.period) % 1) + 1) % 1
    // le corps avance à la vitesse du pied posé ; jouer le cycle à l'envers donne la marche arrière
    const pixel = (SIZE / SPRITE.height) * (frame.height / frame.width)
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
    const h = SIZE * camera.zoom
    const w = h * (SPRITE.width / SPRITE.height) * (frame.height / frame.width)
    const left = sx - SPRITE.anchorX * w
    const top = sy - SPRITE.feetY * h

    const amplitude = Math.min(1, AMPLITUDE) * (calm ? CALM_AMPLITUDE : 1)
    const idle = { pieces: this.idlePieces(frame.time, amplitude), atlas: RIG.atlasSize, unit: 0 }
    const walk = { pieces: this.walkPieces(frame.time, calm), atlas: WALK_RIG.atlasSize, unit: 1 }
    const turning = this.turn > 0 && this.turn < 1
    const main = this.turn >= 0.5 ? walk : idle

    const drawLayers = (rig: typeof idle, vx: number, vy: number, vz: number, vw: number) => {
      gl.useProgram(layer.program)
      gl.enableVertexAttribArray(layer.attribute)
      gl.vertexAttribPointer(layer.attribute, 2, gl.FLOAT, false, 0, 0)
      const u = layer.u
      gl.uniform4f(u.uView, vx, vy, vz, vw)
      gl.uniform1i(u.uTex, rig.unit)
      gl.uniform2f(u.uAtlasSize, rig.atlas[0], rig.atlas[1])
      for (const piece of rig.pieces) {
        const m = piece.matrix
        const margin = piece.bend[0] > 0 ? RIBBON_MARGIN : 0
        const [bx, by, bw, bh] = piece.box
        gl.uniform4f(u.uQuad, bx - margin, by - margin, bw + 2 * margin, bh + 2 * margin)
        gl.uniform3f(u.uMx, m[0], m[2], m[4])
        gl.uniform3f(u.uMy, m[1], m[3], m[5])
        gl.uniform4f(u.uBox, bx, by, bw, bh)
        gl.uniform2f(u.uAtlas, piece.atlas[0], piece.atlas[1])
        gl.uniform4f(u.uBend, piece.bend[0], piece.bend[1], piece.bend[2], 0)
        gl.uniform4f(u.uAxis, piece.axis[0], piece.axis[1], piece.pivot[0], piece.pivot[1])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    }
    /** Rend un rig entier dans une cible hors écran qui couvre la zone VIEW de la toile. */
    const renderTo = (target: WebGLFramebuffer | null, width: number, height: number, rig: typeof idle) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target)
      gl.viewport(0, 0, width, height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      drawLayers(rig, 2 / VIEW.width, 2 / VIEW.height, -1 - (2 * VIEW.x) / VIEW.width, -1 - (2 * VIEW.y) / VIEW.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, frame.width, frame.height)
    }

    // 1. le personnage entier, une fois, dans la texture du reflet (et les deux rigs pendant le fondu)
    renderTo(this.target, REFLECTION.width, REFLECTION.height, main)
    if (turning) {
      renderTo(this.turnTargets[0], VIEW.width, VIEW.height, idle)
      renderTo(this.turnTargets[1], VIEW.width, VIEW.height, walk)
    }

    // 2. reflet (retourné et écrasé sous les pieds) et ombre
    gl.useProgram(flat.program)
    gl.enableVertexAttribArray(flat.attribute)
    gl.vertexAttribPointer(flat.attribute, 2, gl.FLOAT, false, 0, 0)
    const px = w / SPRITE.width
    const py = (h / SPRITE.height) * REFLECTION.squash
    const feet = SPRITE.feetY * SPRITE.height
    const mirrorTop = sy + (feet - VIEW.y - VIEW.height) * py
    const centerX = (left + (VIEW.x + VIEW.width / 2) * px) * 2 - 1
    gl.uniform1i(flat.u.uTex, 2)
    gl.uniform1f(flat.u.uShadow, 0)
    gl.uniform1f(flat.u.uAlpha, REFLECTION.alpha)
    gl.uniform4f(flat.u.uRect, centerX, 1 - (mirrorTop + (VIEW.height * py) / 2) * 2, VIEW.width * px, VIEW.height * py)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.uniform1f(flat.u.uShadow, 1)
    gl.uniform4f(flat.u.uRect, sx * 2 - 1, 1 - (sy - h * 0.006) * 2, h * 0.313 * (frame.height / frame.width), h * 0.031)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 3. le personnage, calque par calque, du fond vers le premier plan
    if (!turning) {
      drawLayers(main, (2 * w) / SPRITE.width, (-2 * h) / SPRITE.height, 2 * left - 1, 1 - 2 * top)
      return
    }
    // pendant le fondu : le rig qui s'en va d'abord, celui qui arrive par-dessus, chacun resserré sur l'axe du corps
    const k = this.turn * this.turn * (3 - 2 * this.turn)
    const axis = sx * 2 - 1
    const pyFull = h / SPRITE.height
    const centerY = 1 - (top + (VIEW.y + VIEW.height / 2) * pyFull) * 2
    const drawRig = (unit: number, alpha: number, squash: number) => {
      gl.uniform1i(flat.u.uTex, unit)
      gl.uniform1f(flat.u.uAlpha, alpha)
      // hauteur négative : la cible hors écran est stockée tête en bas
      gl.uniform4f(flat.u.uRect, axis + (centerX - axis) * squash, centerY, VIEW.width * px * squash, -VIEW.height * pyFull)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.uniform1f(flat.u.uShadow, 0)
    const squashIdle = calm ? 1 : 1 - (1 - TURN.squash) * k
    const squashWalk = calm ? 1 : TURN.squash + (1 - TURN.squash) * k
    // les deux fondus se chevauchent, pour que le décor ne transparaisse pas à travers le personnage
    const ramp = (x: number) => {
      const c = Math.max(0, Math.min(1, x))
      return c * c * (3 - 2 * c)
    }
    drawRig(3, 1 - ramp((this.turn - 0.35) / 0.65), squashIdle)
    drawRig(4, ramp(this.turn / 0.65), squashWalk)
  }

  /** Pose neutre de face : respiration, tête, manches et rubans. */
  private idlePieces(time: number, amplitude: number): Piece[] {
    const matrices = rigMatrices(time, amplitude, IDENTITY)
    const cycle = time / RIG.cycleSeconds
    return RIG.layers.map((item, index) => ({
      box: item.box,
      atlas: item.atlas,
      matrix: matrices[index],
      bend: [amplitude * item.bend, item.length, 2 * Math.PI * (cycle - item.phase)],
      axis: item.axis,
      pivot: item.pivot,
    }))
  }

  /** Marche de profil : os des jambes et des bras, rubans qui ondulent derrière. */
  private walkPieces(time: number, calm: boolean): Piece[] {
    const matrices = walkMatrices(this.phase)
    return WALK_RIG.layers.map((item, index) => {
      const m = matrices[index]
      const ribbon = item.name === 'ribbons'
      return {
        box: item.box,
        atlas: item.atlas,
        matrix: [m[0], m[1], m[2], m[3], m[4] + WALK_OFFSET.x, m[5] + WALK_OFFSET.y],
        bend: [ribbon ? GAIT.ribbonBend * (calm ? CALM_AMPLITUDE : 1) : 0, GAIT.ribbonLength, time * 7],
        axis: GAIT.ribbonAxis,
        pivot: item.pivot,
      }
    })
  }
}
