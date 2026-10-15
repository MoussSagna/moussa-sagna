import { CUT_IN_SECONDS, FOCUS_SECONDS, CinematicLayer } from '../cinematic/CinematicLayer'
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
  /** Cinématique d'entrée et annonces, par-dessus tout le reste. */
  cinematic: HTMLCanvasElement
}

/** Durée du travelling d'ouverture, en millisecondes. */
const INTRO_MS = 3600
/** Secousse de la caméra à l'impact : amplitude (fraction d'écran) pour un coup de pleine puissance, et vitesse d'extinction. */
const SHAKE = { amplitude: 0.006, decay: 16 }
/**
 * Mise au point du début de l'attaque spéciale : la caméra zoome de `zoom` et se recentre vers le personnage
 * (`pull` : part du chemin parcouru, pour ne pas montrer le bord du décor), le temps de `FOCUS_SECONDS`.
 * `height` : hauteur visée, en fraction de l'écran (le haut du corps du personnage baissé).
 */
const FOCUS = { zoom: 0.38, pull: 0.45, height: 0.8, ease: 0.12 }

/**
 * Orchestre l'écran du stage : une seule boucle, une seule caméra, six plans
 * (décor WebGL, mannequin et adversaire WebGL, dont un seul est affiché, personnage WebGL, météo Canvas 2D,
 * cinématique d'entrée Canvas 2D). C'est aussi lui qui décide
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
  /** Adversaire contrôlé par le joueur : déplacement demandé (-1 vers le personnage, 1 en s'éloignant) et parade. */
  rivalWalk = 0
  rivalBlock = false
  /** Appelée quand la cinématique commence (vrai) ou que ses plans illustrés se terminent (faux). */
  onCinematic?: (playing: boolean) => void
  private cinematic: CinematicLayer
  /** Vrai tant que les plans illustrés de la cinématique recouvrent le stage, à l'image précédente. */
  private covered = false
  /** Temps écoulé depuis le début de la mise au point, ou -1. */
  private focusTime = -1
  /** Round en cours, et vrai pendant la sortie de fin de round. */
  private round = 1
  private roundEnding = false
  /** Vrai dès que « K.O. » a été annoncé pour le K.O. en cours. */
  private koAnnounced = false
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
  /** Plans assombris pendant la frappe au sol. */
  private dimmed: HTMLCanvasElement[]
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
    this.cinematic = new CinematicLayer(canvases.cinematic)
    this.dimmed = [canvases.backdrop, canvases.dummy, canvases.rival, canvases.weather]
    for (const canvas of this.dimmed) canvas.style.transition = 'filter 0.15s'
    this.canvases = [canvases.backdrop, canvases.dummy, canvases.rival, canvases.hero, canvases.weather, canvases.cinematic]
  }

  /** Charge les images puis lance la boucle. Résout `false` si le décor animé est indisponible. */
  async run(): Promise<boolean> {
    this.root.addEventListener('pointermove', this.onPointerMove)
    this.root.addEventListener('pointerleave', this.onPointerLeave)
    this.raf = requestAnimationFrame(this.frame)
    const [backdrop] = await Promise.all([this.backdrop.load(), this.hero.load(), this.dummy.load(), this.rival.load(), this.cinematic.load()])
    this.cinematic.start()
    return backdrop
  }

  /** Lance un dash du personnage : 1 vers l'avant, -1 vers l'arrière. */
  dash(direction: number): void {
    if (!this.cinematic.locked) this.hero.dash(direction)
  }

  /** Touche d'attaque : lance un coup de poing ou enchaîne sur le suivant. */
  attack(): void {
    if (!this.cinematic.locked) this.hero.attack()
  }

  /** Lance l'attaque spéciale du personnage. */
  special(): void {
    if (!this.cinematic.locked) this.hero.special()
  }

  /** Fait attaquer celui qui fait face au personnage, pour tester les coups reçus et parés. */
  dummyAttack(): void {
    this.opponent().attack()
  }

  /** Celui qui fait face au personnage, selon l'option choisie. */
  private opponent(): Opponent {
    return this.options.opponent === 'rival' ? this.rival : this.dummy
  }

  /** Lance la seconde attaque spéciale du personnage, la frappe au sol. */
  groundSpecial(): void {
    if (!this.cinematic.locked) this.hero.groundSpecial()
  }

  /** Lance un saut vertical du personnage. */
  jump(): void {
    // une direction tenue au moment du saut en fait un saut avant ou arrière
    if (!this.cinematic.locked) this.hero.jump(this.walk)
  }

  /** Rejoue la cinématique d'entrée, puis le travelling d'ouverture du stage. */
  replayIntro(): void {
    this.introAt = performance.now()
    this.cinematic.start()
    this.round = 1
    if (this.roundEnding) this.hero.reenter()
    this.rival.reset()
    this.roundEnding = false
  }

  /**
   * Le personnage perd le round : K.O. Il est projeté au sol, « K.O. » s'affiche, puis il se retrouve en garde et
   * le round suivant est annoncé.
   */
  knockOut(): void {
    if (this.cinematic.locked || this.roundEnding || this.hero.knockedOut) return
    this.hero.knockOut()
    this.koAnnounced = false
    this.stop = 0.22 * (this.options.calm ? 0.5 : 1)
    this.shake = 1
  }

  /**
   * Fin du round : le personnage se baisse et disparaît d'un bond dans la fumée ; quand elle est retombée, il
   * revient à sa place et le round suivant est annoncé.
   */
  endRound(): void {
    if (this.cinematic.locked || this.roundEnding) return
    this.roundEnding = true
    this.hero.exit()
  }

  /** Passe les plans illustrés de la cinématique : on arrive directement aux annonces avant le combat. */
  skipCinematic(): void {
    this.cinematic.skip()
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
    if (blow && !this.hero.exiting && !this.hero.knockedOut && this.hero.front(pixel) >= blow.x) {
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
    // mise au point du début de l'attaque spéciale : zoom et recentrage sur le personnage, entrée et sortie adoucies
    if (this.focusTime >= 0) {
      this.focusTime += delta
      if (this.focusTime >= FOCUS_SECONDS) this.focusTime = -1
    }
    if (this.focusTime >= 0 && !calm) {
      const t = this.focusTime
      const k = Math.min(1, t / FOCUS.ease) * Math.min(1, (FOCUS_SECONDS - t) / FOCUS.ease)
      const e = k * k * (3 - 2 * k)
      const zoom = camera.zoom + FOCUS.zoom * e
      const depth = PLACEMENT.depth
      const ox = (0.5 - this.hero.position) / depth
      const oy = (0.5 + 0.05 / zoom - FOCUS.height) / depth
      camera.zoom = zoom
      camera.ox += (ox - camera.ox) * FOCUS.pull * e
      camera.oy += (oy - camera.oy) * FOCUS.pull * e
    }
    // secousse d'impact : elle déplace tous les plans ensemble
    this.shake *= Math.exp(-delta * SHAKE.decay)
    if (!calm) {
      camera.ox += Math.sin(time * 97) * this.shake * SHAKE.amplitude
      camera.oy += Math.cos(time * 83) * this.shake * SHAKE.amplitude * 0.6
    }
    const info: FrameInfo = { time, delta, width: this.size.width, height: this.size.height }

    // cinématique d'entrée : tant que ses plans recouvrent l'écran, le stage n'est pas dessiné ; quand ils se
    // terminent, le travelling d'ouverture du stage commence
    this.cinematic.update(delta)
    const covering = this.cinematic.covering
    if (covering !== this.covered) {
      this.covered = covering
      if (!covering) this.introAt = now
      this.onCinematic?.(covering)
    }
    this.cinematic.draw(info, calm)
    if (covering) return
    // le personnage ne répond pas avant le « Fight »
    const locked = this.cinematic.locked
    this.backdrop.draw(info, camera, calm)

    // arrêt sur image : le combat se fige un instant, le décor, la météo et les étincelles continuent
    const stopped = this.stop > 0
    if (stopped) {
      this.stop -= delta
      this.frozen += delta
    }
    const fight: FrameInfo = { ...info, time: time - this.frozen, delta: stopped ? 0 : delta }
    this.hero.update(fight, locked ? 0 : this.walk, locked ? false : this.crouch, locked ? false : this.block)
    // contrôlé par le joueur, il marche et pare à la demande ; sinon il pare selon l'option et garde ses distances
    const controlled = this.options.rivalControl === true
    this.rival.controlled = controlled && !locked
    this.rival.request = this.rivalWalk
    this.rival.blocking = this.options.rivalBlocks === true || (controlled && !locked && this.rivalBlock)
    // il ne se déplace pas avant le « Fight », ni pendant la mise au point de la frappe au sol
    this.rival.moves = this.options.rivalMoves !== false && !locked && !controlled
    this.rival.heroX = this.hero.position
    const target = this.opponent()
    target.update(fight)
    this.hero.tick(delta)
    // frappe au sol : quand la charge commence, le combat se fige le temps du plan de coupe
    if (this.hero.takeFocus()) {
      // la main au sol : le jeu se fige, la caméra se resserre sur lui
      this.cinematic.focus()
      this.focusTime = 0
      this.stop = FOCUS_SECONDS
    }
    if (this.hero.takeCutIn()) {
      this.cinematic.cutIn()
      this.stop = CUT_IN_SECONDS
    }
    // à l'impact : un éclair sur tout l'écran et une secousse plus forte que d'habitude
    if (this.hero.takeGroundImpact()) {
      this.cinematic.impactFlash()
      this.shake = 2.2
    }
    // et tant qu'elle dure, le décor, l'adversaire et la météo sont assombris : seul le personnage reste éclairé
    const dim = this.hero.superActive || this.focusTime >= 0 ? 'brightness(0.35) saturate(0.7)' : ''
    for (const canvas of this.dimmed) {
      if (canvas.style.filter !== dim) canvas.style.filter = dim
    }
    if (this.hero.koLanded && !this.koAnnounced) {
      // il touche le sol : la caméra tremble et « K.O. » s'affiche
      this.koAnnounced = true
      this.shake = 1
      this.cinematic.showKO()
    }
    if (this.hero.koDone) {
      this.round += 1
      this.hero.reenter()
      this.rival.reset()
      this.cinematic.startRound(this.round)
    }
    if (this.roundEnding && this.hero.exitDone) {
      this.roundEnding = false
      this.round += 1
      this.hero.reenter()
      this.rival.reset()
      this.cinematic.startRound(this.round)
    }
    if (!stopped) this.resolveHits(info, calm)
    // un seul des deux est affiché
    this.opponentCanvases.dummy.style.visibility = target === this.dummy ? 'visible' : 'hidden'
    this.opponentCanvases.rival.style.visibility = target === this.rival ? 'visible' : 'hidden'
    target.draw(fight, camera, calm)
    this.hero.draw(fight, camera, calm)
    this.weather.draw(info, -camera.ox * 0.5, this.options)
  }
}
