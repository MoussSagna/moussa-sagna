import { DummyLayer } from '../dummy/DummyLayer'
import { HeroLayer, PLACEMENT } from '../hero/HeroLayer'
import type { Strike } from '../hero/HeroLayer'
import { CANVAS } from '../hero/poseData'
import type { Opponent } from '../opponent'
import { RivalLayer } from '../rival/RivalLayer'
import type { Camera, FrameInfo, StageOptions } from '../types'
import { StageBackdrop } from './StageBackdrop'
import { WeatherLayer } from './WeatherLayer'

export interface StageCanvases {
  backdrop: HTMLCanvasElement
  dummy: HTMLCanvasElement
  rival: HTMLCanvasElement
  hero: HTMLCanvasElement
  weather: HTMLCanvasElement
}

/** Durée du travelling d'ouverture, en millisecondes. */
const INTRO_MS = 3600
/** Secousse de la caméra à l'impact : amplitude (fraction d'écran) pour un coup de pleine puissance, et vitesse d'extinction. */
const SHAKE = { amplitude: 0.006, decay: 16 }

/**
 * Orchestre l'écran du stage : une seule boucle, une seule caméra, cinq plans
 * (décor WebGL, mannequin et adversaire WebGL, dont un seul est affiché, personnage WebGL, météo Canvas 2D). C'est aussi lui qui décide
 * quand un coup touche, et ce qui se passe alors.
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
  private dummy: DummyLayer
  private rival: RivalLayer
  private opponentCanvases: { dummy: HTMLCanvasElement; rival: HTMLCanvasElement }
  private hero: HeroLayer
  /** Arrêt sur image en cours : temps restant, et temps total passé à l'arrêt depuis le démarrage. */
  private stop = 0
  private frozen = 0
  /** Secousse de la caméra, de 0 à 1 ; elle s'éteint d'elle-même. */
  private shake = 0
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
    this.dummy = new DummyLayer(canvases.dummy)
    this.rival = new RivalLayer(canvases.rival)
    this.opponentCanvases = { dummy: canvases.dummy, rival: canvases.rival }
    this.hero = new HeroLayer(canvases.hero)
    this.weather = new WeatherLayer(canvases.weather)
    this.canvases = [canvases.backdrop, canvases.dummy, canvases.rival, canvases.hero, canvases.weather]
  }

  /** Charge les images puis lance la boucle. Résout `false` si le décor animé est indisponible. */
  async run(): Promise<boolean> {
    this.root.addEventListener('pointermove', this.onPointerMove)
    this.root.addEventListener('pointerleave', this.onPointerLeave)
    this.raf = requestAnimationFrame(this.frame)
    const [backdrop] = await Promise.all([this.backdrop.load(), this.hero.load(), this.dummy.load(), this.rival.load()])
    return backdrop
  }

  /** Lance un dash du personnage : 1 vers l'avant, -1 vers l'arrière. */
  dash(direction: number): void {
    this.hero.dash(direction)
  }

  /** Touche d'attaque : lance un coup de poing ou enchaîne sur le suivant. */
  attack(): void {
    this.hero.attack()
  }

  /** Lance l'attaque spéciale du personnage. */
  special(): void {
    this.hero.special()
  }

  /** Fait attaquer celui qui fait face au personnage, pour tester les coups reçus et parés. */
  dummyAttack(): void {
    this.opponent().attack()
  }

  /** Celui qui fait face au personnage, selon l'option choisie. */
  private opponent(): Opponent {
    return this.options.opponent === 'rival' ? this.rival : this.dummy
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

  /** Le personnage ne traverse pas son vis-à-vis ; un coup ou la boule de feu qui l'atteint le fait réagir. */
  private resolveHits(info: FrameInfo, calm: boolean): void {
    const target = this.opponent()
    // largeur d'un pixel de la toile, en fraction de la largeur du stage
    const pixel = (PLACEMENT.scale / CANVAS[1]) * (info.height / info.width)
    this.hero.wall = target.x - target.gap * pixel
    const surface = target.x - target.surface * pixel
    /** Le coup atteint la cible : elle l'encaisse ou le pare. Retourne vrai s'il est paré. */
    const react = (strike: Strike): boolean => {
      const guarded = target.hit(strike.power)
      this.stop = strike.stop * (guarded ? 0.5 : 1) * (calm ? 0.5 : 1)
      this.shake = Math.max(this.shake, strike.power * (guarded ? 0.4 : 1))
      return guarded
    }
    const punch = this.hero.strike(pixel)
    if (punch && punch.x >= surface) {
      this.hero.land(punch, surface, react(punch))
    }
    // son attaque : encaissée, ou parée si le personnage est en parade
    const blow = target.strike(pixel)
    if (blow && this.hero.front(pixel) >= blow.x) {
      target.land()
      const guarded = this.hero.takeHit(blow, pixel)
      this.stop = blow.stop * (guarded ? 0.5 : 1) * (calm ? 0.5 : 1)
      this.shake = Math.max(this.shake, blow.power * (guarded ? 0.4 : 1))
    }
    const ball = this.hero.fireballStrike(pixel)
    if (ball && ball.x >= surface) {
      this.hero.burst(surface, react(ball))
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
    // secousse d'impact : elle déplace tous les plans ensemble
    this.shake *= Math.exp(-delta * SHAKE.decay)
    if (!calm) {
      camera.ox += Math.sin(time * 97) * this.shake * SHAKE.amplitude
      camera.oy += Math.cos(time * 83) * this.shake * SHAKE.amplitude * 0.6
    }
    const info: FrameInfo = { time, delta, width: this.size.width, height: this.size.height }
    this.backdrop.draw(info, camera, calm)

    // arrêt sur image : le combat se fige un instant, le décor, la météo et les étincelles continuent
    const stopped = this.stop > 0
    if (stopped) {
      this.stop -= delta
      this.frozen += delta
    }
    const fight: FrameInfo = { ...info, time: time - this.frozen, delta: stopped ? 0 : delta }
    this.hero.update(fight, this.walk, this.crouch, this.block)
    this.rival.blocking = this.options.rivalBlocks === true
    const target = this.opponent()
    target.update(fight)
    this.hero.tick(delta)
    if (!stopped) this.resolveHits(info, calm)
    // un seul des deux est affiché
    this.opponentCanvases.dummy.style.visibility = target === this.dummy ? 'visible' : 'hidden'
    this.opponentCanvases.rival.style.visibility = target === this.rival ? 'visible' : 'hidden'
    target.draw(fight, camera, calm)
    this.hero.draw(fight, camera, calm)
    this.weather.draw(info, -camera.ox * 0.5, this.options)
  }
}
