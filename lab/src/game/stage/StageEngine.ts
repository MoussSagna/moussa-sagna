import { HeroLayer } from '../hero/HeroLayer'
import type { Camera, FrameInfo, StageOptions } from '../types'
import { StageBackdrop } from './StageBackdrop'
import { WeatherLayer } from './WeatherLayer'

export interface StageCanvases {
  backdrop: HTMLCanvasElement
  hero: HTMLCanvasElement
  weather: HTMLCanvasElement
}

/** Durée du travelling d'ouverture, en millisecondes. */
const INTRO_MS = 3600

/**
 * Orchestre l'écran du stage : une seule boucle, une seule caméra, trois plans
 * (décor WebGL, personnage WebGL, météo Canvas 2D).
 */
export class StageEngine {
  options: StageOptions = { rain: true, petals: true, calm: false }
  /** Déplacement demandé pour le personnage : 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt. */
  walk = 0
  /** Vrai tant que le personnage doit rester accroupi. */
  crouch = false
  /** Vrai tant que le personnage doit parer. */
  block = false
  private backdrop: StageBackdrop
  private hero: HeroLayer
  private weather: WeatherLayer
  private canvases: HTMLCanvasElement[]
  private raf = 0
  private start = performance.now()
  private last = 0
  private introAt = performance.now()
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
  private size = { width: 0, height: 0 }

  private root: HTMLElement

  constructor(root: HTMLElement, canvases: StageCanvases) {
    this.root = root
    this.backdrop = new StageBackdrop(canvases.backdrop)
    this.hero = new HeroLayer(canvases.hero)
    this.weather = new WeatherLayer(canvases.weather)
    this.canvases = [canvases.backdrop, canvases.hero, canvases.weather]
  }

  /** Charge les images puis lance la boucle. Résout `false` si le décor animé est indisponible. */
  async run(): Promise<boolean> {
    this.root.addEventListener('pointermove', this.onPointerMove)
    this.root.addEventListener('pointerleave', this.onPointerLeave)
    this.raf = requestAnimationFrame(this.frame)
    const [backdrop] = await Promise.all([this.backdrop.load(), this.hero.load()])
    return backdrop
  }

  /** Lance un dash du personnage : 1 vers l'avant, -1 vers l'arrière. */
  dash(direction: number): void {
    this.hero.dash(direction)
  }

  /** Lance un saut vertical du personnage. */
  jump(): void {
    this.hero.jump()
  }

  replayIntro(): void {
    this.introAt = performance.now()
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.root.removeEventListener('pointermove', this.onPointerMove)
    this.root.removeEventListener('pointerleave', this.onPointerLeave)
  }

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.root.getBoundingClientRect()
    this.pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    this.pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
  }

  private onPointerLeave = () => {
    this.pointer.targetX = 0
    this.pointer.targetY = 0
  }

  private resize(): void {
    const rect = this.root.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(2, Math.round(rect.width * dpr))
    const height = Math.max(2, Math.round(rect.height * dpr))
    if (width === this.size.width && height === this.size.height) return
    this.size = { width, height }
    for (const canvas of this.canvases) {
      canvas.width = width
      canvas.height = height
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    this.resize()
    const time = (now - this.start) / 1000
    const delta = Math.min(0.05, (now - this.last) / 1000 || 0.016)
    this.last = now
    const p = this.pointer
    p.x += (p.targetX - p.x) * 0.06
    p.y += (p.targetY - p.y) * 0.06

    // caméra : travelling d'intro, puis respiration lente à laquelle s'ajoute la souris
    const calm = this.options.calm
    const sway = calm ? 0 : 1
    const k = Math.min(1, (now - this.introAt) / INTRO_MS)
    const settle = 1 - (1 - k) ** 3
    const camera: Camera = {
      ox: p.x * 0.02 + Math.sin(time * 0.21) * 0.007 * sway + (1 - settle) * 0.045 * sway,
      oy: p.y * 0.008 + Math.cos(time * 0.17) * 0.003 * sway,
      zoom: 1.045 + (1 - settle) * 0.13 * sway + Math.sin(time * 0.13) * 0.006 * sway,
    }
    const info: FrameInfo = { time, delta, width: this.size.width, height: this.size.height }
    this.backdrop.draw(info, camera, calm)
    this.hero.update(info, this.walk, this.crouch, this.block)
    this.hero.draw(info, camera, calm)
    this.weather.draw(info, -camera.ox * 0.5, this.options)
  }
}
