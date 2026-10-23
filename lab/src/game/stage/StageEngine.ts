import { CUT_IN_SECONDS, FOCUS_SECONDS, CinematicLayer } from '../cinematic/CinematicLayer'
import { HUD, HudLayer } from '../hud/HudLayer'
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
 * Caméra de combat : zoom de base (`zoom`), hauteur à l'écran des pieds des combattants (`feet`, fraction de la
 * hauteur), et suivi horizontal (`follow`, par seconde) : la caméra glisse vers le milieu des deux combattants. Le
 * glissement est surtout un travelling (`pan`, tout le décor d'un bloc, sans déformation), plus une part de
 * parallaxe (jusqu'à `parallax` en `ox`, comme la souris) qui donne la perspective. Le travelling s'arrête avant les
 * bords de l'image : la marge laissée par le zoom, moins ce que la parallaxe décale au premier plan (profondeur 0,98 :
 * 0,56 × `ox`).
 */
const CAMERA = { zoom: 1.25, feet: 0.923, follow: 3.5, parallax: 0.04 }
const CAMERA_MAX_PAN = 0.5 - 0.5 / CAMERA.zoom - 0.56 * (CAMERA.parallax + 0.03)
const CAMERA_MAX_SHIFT = CAMERA_MAX_PAN + PLACEMENT.depth * CAMERA.parallax
/**
 * Dégâts, en fraction de la barre de vie : un coup en retire `perPower` × sa puissance. Les deux derniers coups de
 * l'attaque ultime de l'adversaire (sa retombée en coup de poing, puis le coup de marteau) retirent `dive` et
 * `hammer`. Après un K.O. de l'adversaire, le round suivant commence au bout de `koSeconds`.
 */
const DAMAGE = { perPower: 0.05, dive: 0.08, hammer: 0.2, koSeconds: 3 }
/**
 * Secousse verticale de l'impact du coup de marteau de l'adversaire : l'écran rebondit de haut en bas `frequency`
 * fois par seconde, de moins en moins fort, pendant `seconds` (la durée de l'explosion). `amplitude` : décalage de
 * la caméra au début.
 */
const QUAKE = { seconds: 1.2, frequency: 7, amplitude: 0.07 }
/**
 * Mise au point du début de l'attaque spéciale : la caméra zoome de `zoom` et se recentre vers le personnage
 * (`pull` : part du chemin parcouru, pour ne pas montrer le bord du décor), le temps de `FOCUS_SECONDS`.
 * `height` : hauteur visée, en fraction de l'écran (le haut du corps du personnage baissé).
 */
const FOCUS = { zoom: 0.38, pull: 0.45, height: 0.8, rivalHeight: 0.7, ease: 0.12 }

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
  /**
   * Vrai quand les combattants ont changé de côté (Moussa à droite, l'adversaire à gauche). Le combat se calcule
   * toujours comme si Moussa était à gauche ; seuls l'affichage des combattants (retourné en miroir) et le sens des
   * commandes changent.
   */
  private mirrored = false
  /** Plans des combattants, retournés en miroir quand ils ont changé de côté. */
  private fighters: HTMLCanvasElement[]
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
  /** Celui sur qui la caméra se resserre pendant la mise au point. */
  private focusOn: 'hero' | 'rival' = 'hero'
  /** Plans assombris pendant l'attaque ultime de l'adversaire : tout sauf lui. */
  private rivalDimmed: HTMLCanvasElement[]
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
  /** Décalage horizontal de la caméra qui suit les combattants (lissé). */
  private track = 0
  /** Barres de vie, de super et de drive. */
  private hud = new HudLayer()
  private hudRound = 1
  /** Temps écoulé depuis un K.O. qui attend la fin de son annonce pour passer au round suivant, ou -1. */
  private koWait = -1
  /** Temps écoulé depuis le début de la secousse verticale, ou -1. */
  private quake = -1
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
    this.cinematic.hud = (ctx, w, h) => this.hud.draw(ctx, w, h, this.options.calm)
    this.fighters = [canvases.dummy, canvases.rival, canvases.hero]
    this.dimmed = [canvases.backdrop, canvases.dummy, canvases.rival, canvases.weather]
    this.rivalDimmed = [canvases.backdrop, canvases.dummy, canvases.hero, canvases.weather]
    for (const canvas of [...this.dimmed, canvases.hero]) canvas.style.transition = 'filter 0.15s'
    this.canvases = [canvases.backdrop, canvases.dummy, canvases.rival, canvases.hero, canvases.weather, canvases.cinematic]
  }

  /**
   * Charge les images puis lance la boucle. Résout `false` si le décor animé est indisponible. La cinématique
   * d'entrée ne part pas toute seule : l'écran de chargement la lance (`replayIntro`) quand le joueur démarre.
   */
  async run(): Promise<boolean> {
    this.root.addEventListener('pointermove', this.onPointerMove)
    this.root.addEventListener('pointerleave', this.onPointerLeave)
    this.raf = requestAnimationFrame(this.frame)
    const [backdrop] = await Promise.all([this.backdrop.load(), this.hero.load(), this.dummy.load(), this.rival.load(), this.cinematic.load()])
    return backdrop
  }

  /**
   * Lance un dash du personnage : 1 vers l'avant, -1 vers l'arrière. Vers l'avant pendant un coup qui a touché
   * ou a été paré, c'est un drive rush, s'il reste assez de drive : le coup est annulé et le drive dépensé.
   */
  dash(direction: number): void {
    if (this.cinematic.locked) return
    const move = direction * this.side
    if (move > 0 && this.hero.canDriveRush && this.hud.hasDrive('hero', HUD.rush)) {
      this.hud.spendDrive('hero', HUD.rush)
      this.hero.driveRush()
      return
    }
    this.hero.dash(move)
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
  /** Attaque ultime de l'adversaire. */
  rivalUltimate(): void {
    if (!this.cinematic.locked) this.rival.ultimate()
  }

  /** Coup spécial de l'adversaire. */
  rivalSpecial(): void {
    if (!this.cinematic.locked) this.rival.special()
  }

  dummyAttack(): void {
    if (!this.cinematic.locked) this.opponent().attack()
  }

  /** Celui qui fait face au personnage, selon l'option choisie. */
  private opponent(): Opponent {
    return this.options.opponent === 'rival' ? this.rival : this.dummy
  }

  /** Dash avant de l'adversaire contrôlé par le joueur : il se téléporte vers le personnage. */
  rivalDash(direction: number): void {
    // vers le personnage (à gauche à l'écran, à droite quand ils ont changé de côté) : dash avant ; sinon, dash arrière
    if (!this.cinematic.locked && this.options.rivalControl === true) this.rival.teleport(direction * this.side)
  }

  /** 1 quand Moussa est à gauche, -1 quand les combattants ont changé de côté : convertit un sens à l'écran. */
  private get side(): number {
    return this.mirrored ? -1 : 1
  }

  /** Retourne ou remet à l'endroit l'affichage des combattants. */
  /** Passe au round suivant : les deux combattants reviennent en garde à leur place de départ. */
  private nextRound(): void {
    this.quake = -1
    this.round += 1
    this.hero.reenter()
    this.rival.reset()
    this.setMirrored(false)
    this.cinematic.startRound(this.round)
  }

  private setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored
    for (const canvas of this.fighters) canvas.style.transform = mirrored ? 'scaleX(-1)' : ''
  }

  /** Lance la seconde attaque spéciale du personnage, la frappe au sol. */
  groundSpecial(): void {
    if (!this.cinematic.locked) this.hero.groundSpecial()
  }

  /** Lance un saut vertical du personnage. */
  jump(): void {
    // une direction tenue au moment du saut en fait un saut avant ou arrière
    if (!this.cinematic.locked) this.hero.jump(this.walk * this.side)
  }

  /** Rejoue la cinématique d'entrée, puis le travelling d'ouverture du stage. */
  replayIntro(): void {
    this.introAt = performance.now()
    this.cinematic.start()
    this.round = 1
    this.hud.reset(false)
    this.koWait = -1
    // Moussa revient à sa place s'il était sorti ou s'il avait changé de côté
    if (this.roundEnding || this.mirrored) this.hero.reenter()
    this.rival.reset()
    this.setMirrored(false)
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
    // l'adversaire (pas le mannequin) peut être franchi d'un saut : Moussa passe au-dessus en gardant son sens, et
    // c'est en retombant dans son dos que les combattants se retournent (un demi-tour en l'air paraissait faux)
    const jumpable = target === this.rival && !this.rival.knockedDown
    this.hero.crossable = jumpable ? target.x : null
    if (jumpable && !this.hero.airborne && this.hero.position > this.rival.x) {
      this.setMirrored(!this.mirrored)
      this.hero.mirror()
      this.rival.flipSide(this.hero.position)
      this.hero.wall = this.rival.x - this.rival.gap * pixel
    }
    // retombé trop près de lui : il est repoussé (et Moussa aussi s'il est dans le coin)
    if (jumpable && !this.hero.airborne && this.hero.position > this.hero.wall + 0.001) {
      const overlap = this.hero.position - this.hero.wall
      const moved = this.rival.pushBack(overlap)
      if (moved < overlap) this.hero.placeAt(this.hero.position - (overlap - moved))
      this.hero.wall = this.rival.x - this.rival.gap * pixel
    }
    const surface = target.x - target.surface * pixel
    /** Le coup atteint la cible : elle l'encaisse ou le pare. Retourne vrai s'il est paré. */
    const rivalTarget = target === this.rival
    const react = (strike: Strike): boolean => {
      const guarded = target.hit(strike.power)
      // barres : seul l'adversaire a une vie ; le mannequin encaisse sans fin
      if (rivalTarget && this.koWait < 0) {
        if (guarded) this.hud.block('rival', strike.power)
        else this.hud.damage('rival', strike.power * DAMAGE.perPower, strike.power)
        // plus de vie : « K.O. », puis round suivant
        if (this.hud.health('rival') <= 0) {
          this.koWait = 0
          this.rival.knockOut()
          this.cinematic.showKO()
          this.shake = Math.max(this.shake, 2.2)
        }
      }
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
      if (guarded) this.hud.block('hero', blow.power)
      else if (this.koWait < 0) {
        this.hud.damage('hero', blow.power * DAMAGE.perPower, blow.power)
        // plus de vie sur un coup ordinaire : K.O. (pendant l'attaque ultime, il attend la fin de celle-ci)
        if (this.hud.health('hero') <= 0 && !blow.launch && !this.rival.ultimateActive) this.knockOut()
      }
      // l'uppercut de l'attaque ultime : s'il n'est pas paré, le premier coup soulève Moussa, le second le propulse
      // hors de l'écran (K.O.)
      if (blow.launch && !guarded) {
        this.hero.launch(blow.launch)
        this.koAnnounced = false
      }
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
    // elle suit le milieu des deux combattants (positions à l'écran, retournées quand ils ont changé de côté)
    const screenX = (x: number) => (this.mirrored ? 1 - x : x)
    const middle = (screenX(this.hero.position) + screenX(this.opponent().x)) / 2
    // décalage voulu des combattants à l'écran (en fraction du stage), partagé entre parallaxe et travelling
    const follow = Math.max(-CAMERA_MAX_SHIFT, Math.min(CAMERA_MAX_SHIFT, 0.5 - middle))
    this.track += (follow - this.track) * Math.min(1, delta * CAMERA.follow)
    const parallax = (this.track / CAMERA_MAX_SHIFT) * CAMERA.parallax
    const pan = -(this.track - PLACEMENT.depth * parallax)
    const zoom = CAMERA.zoom + (1 - settle) * 0.13 * sway + Math.sin(time * 0.13) * 0.006 * sway
    // plus zoomée, elle vise plus bas, pour garder les pieds à la même hauteur à l'écran
    const lower = ((CAMERA.feet - 0.5) / CAMERA.zoom - (PLACEMENT.y - 0.5)) / PLACEMENT.depth
    const camera: Camera = {
      ox: parallax + p.x * 0.02 + Math.sin(time * 0.21) * 0.007 * sway + (1 - settle) * 0.045 * sway,
      oy: lower + p.y * 0.008 + Math.cos(time * 0.17) * 0.003 * sway,
      zoom,
      pan,
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
      // position du personnage à l'écran, retournée quand les combattants ont changé de côté
      const position = this.focusOn === 'rival' ? this.rival.x : this.hero.position
      const screen = this.mirrored ? 1 - position : position
      const ox = (0.5 - screen + pan) / depth
      // l'adversaire est debout : la caméra vise plus haut que pour Moussa baissé
      const height = this.focusOn === 'rival' ? FOCUS.rivalHeight : FOCUS.height
      const oy = (0.5 + 0.05 / zoom - height) / depth
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
    if (this.quake >= 0) {
      this.quake += delta
      const k = this.quake / QUAKE.seconds
      if (k >= 1) this.quake = -1
      else if (!calm) camera.oy += Math.sin(2 * Math.PI * QUAKE.frequency * this.quake) * QUAKE.amplitude * (1 - k) ** 2
    }
    const info: FrameInfo = { time, delta, width: this.size.width, height: this.size.height }
    // impact du coup de marteau de l'adversaire : dessiné par la cinématique, devant les combattants, au même endroit
    // du stage qu'eux (même caméra, secousse comprise)
    if (this.cinematic.blasting) {
      const fighterOx = camera.ox - pan / PLACEMENT.depth
      const view = this.mirrored ? -fighterOx : fighterOx
      const x = (this.rival.hammerX + PLACEMENT.depth * view - 0.5) * camera.zoom + 0.5
      this.cinematic.blastAt = {
        x: this.mirrored ? 1 - x : x,
        y: (PLACEMENT.y + PLACEMENT.depth * camera.oy - 0.5) * camera.zoom + 0.5,
        unit: (PLACEMENT.scale * camera.zoom) / CANVAS[1],
      }
    }

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
    this.hero.update(fight, locked ? 0 : this.walk * this.side, locked ? false : this.crouch, locked ? false : this.block)
    // contrôlé par le joueur, il marche et pare à la demande ; sinon il pare selon l'option et garde ses distances
    const controlled = this.options.rivalControl === true
    this.rival.controlled = controlled && !locked
    this.rival.request = this.rivalWalk * this.side
    this.rival.blocking = this.options.rivalBlocks === true || (controlled && !locked && this.rivalBlock)
    // il ne se déplace pas avant le « Fight », ni pendant la mise au point de la frappe au sol
    this.rival.moves = this.options.rivalMoves !== false && !locked && !controlled
    this.rival.heroX = this.hero.position
    const target = this.opponent()
    target.update(fight)
    // l'adversaire décolle : forte secousse de l'écran
    if (this.rival.flying) this.shake = Math.max(this.shake, 3.5)
    // envolé hors de l'écran, il renvoie Moussa au sol : Moussa s'écrase (forte secousse) et rebondit ; pendant
    // le rebond, l'adversaire retombe sur lui d'un coup de poing qui le recloue au sol (même secousse). Pour la
    // démo, le round suivant commence quand il est resté sur son coup (tout de suite si Moussa n'était pas propulsé)
    const tookOff = this.rival.takeTakeoff()
    if (tookOff && !this.hero.slam()) this.nextRound()
    if (this.hero.takeSlamImpact()) this.shake = Math.max(this.shake, 3.5)
    if (this.hero.slamHanging) this.rival.dive(this.hero.position, (PLACEMENT.scale / CANVAS[1]) * (info.height / info.width))
    if (this.rival.takeDiveImpact()) {
      this.hud.damage('hero', DAMAGE.dive, 1.2)
      this.shake = Math.max(this.shake, 3.5)
      this.hero.pin()
    }
    // puis le plan de coupe sur l'adversaire (combat figé), et le coup de marteau : éclair et forte secousse
    if (this.rival.takeHammerCutIn()) {
      this.cinematic.cutIn('rival')
      this.stop = CUT_IN_SECONDS
    }
    if (this.rival.takeHammerImpact()) {
      this.hud.damage('hero', DAMAGE.hammer, 2)
      this.cinematic.blast()
      this.cinematic.impactFlash()
      this.quake = 0
    }
    // coup final terminé : l'adversaire repart à sa place et Moussa se relève, le combat reprend
    if (this.rival.takeFinish()) {
      // plus de vie : il reste au sol, « K.O. », puis round suivant ; sinon il se relève
      if (this.hud.health('hero') <= 0) {
        this.koWait = 0
        this.cinematic.showKO()
      } else {
        this.hero.standUp()
      }
    }
    // (sans coup de poing de l'adversaire, pour la démo : round suivant)
    if (this.hero.slamDone && !this.rival.diving) this.nextRound()
    // l'adversaire disparaît au corps à corps : les combattants changent de côté et il réapparaît dans le dos de Moussa
    if (this.rival.takeCross()) {
      const pixel = (PLACEMENT.scale / CANVAS[1]) * (info.height / info.width)
      this.setMirrored(!this.mirrored)
      this.hero.mirror()
      const heroX = this.rival.landBehind(this.hero.position, pixel)
      if (heroX !== this.hero.position) this.hero.placeAt(heroX)
    }
    this.hero.tick(delta)
    // frappe au sol : quand la charge commence, le combat se fige le temps du plan de coupe
    if (this.hero.takeFocus()) {
      // la main au sol : le jeu se fige, la caméra se resserre sur lui
      this.cinematic.focus()
      this.focusTime = 0
      this.focusOn = 'hero'
      this.stop = FOCUS_SECONDS
    }
    // attaque ultime de l'adversaire : quand son énergie grossit, le combat se fige et la caméra se resserre sur lui
    if (this.rival.takeFocus()) {
      this.hud.useSuper('rival')
      this.cinematic.focus()
      this.focusTime = 0
      this.focusOn = 'rival'
      this.stop = FOCUS_SECONDS
    }
    if (this.hero.takeCutIn()) {
      this.hud.useSuper('hero')
      this.cinematic.cutIn()
      this.stop = CUT_IN_SECONDS
    }
    // à l'impact : un éclair sur tout l'écran et une secousse plus forte que d'habitude
    if (this.hero.takeGroundImpact()) {
      this.cinematic.impactFlash()
      this.shake = 2.2
    }
    // et tant qu'elle dure, le décor, l'adversaire et la météo sont assombris : seul le personnage reste éclairé
    // (pendant l'attaque ultime de l'adversaire, c'est lui qui reste éclairé)
    const heroDim = this.hero.superActive || (this.focusTime >= 0 && this.focusOn === 'hero')
    const rivalDim = this.rival.ultimateActive || (this.focusTime >= 0 && this.focusOn === 'rival')
    for (const canvas of new Set([...this.dimmed, ...this.rivalDimmed])) {
      const dark = (heroDim && this.dimmed.includes(canvas)) || (rivalDim && this.rivalDimmed.includes(canvas))
      const dim = dark ? 'brightness(0.35) saturate(0.7)' : ''
      if (canvas.style.filter !== dim) canvas.style.filter = dim
    }
    // barres : elles suivent le round (pleines à chaque nouveau round), et un K.O. en attente passe au suivant
    this.hud.update(delta)
    if (this.koWait >= 0) {
      this.koWait += delta
      if (this.koWait >= DAMAGE.koSeconds) {
        this.koWait = -1
        this.nextRound()
      }
    }
    if (this.round !== this.hudRound) {
      this.hudRound = this.round
      this.hud.reset()
    }
    this.hud.round = this.round
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
      this.setMirrored(false)
      this.cinematic.startRound(this.round)
    }
    if (this.roundEnding && this.hero.exitDone) {
      this.roundEnding = false
      this.round += 1
      this.hero.reenter()
      this.rival.reset()
      this.setMirrored(false)
      this.cinematic.startRound(this.round)
    }
    if (!stopped) this.resolveHits(info, calm)
    // le coup spécial de l'adversaire : forte secousse de l'écran à l'impact, comme la frappe au sol de Moussa
    if (this.rival.takeImpact()) this.shake = 2.2
    // l'adversaire K.O. touche le sol
    if (this.rival.takeKoLanding()) this.shake = Math.max(this.shake, 1.6)
    // un seul des deux est affiché
    this.opponentCanvases.dummy.style.visibility = target === this.dummy ? 'visible' : 'hidden'
    this.opponentCanvases.rival.style.visibility = target === this.rival ? 'visible' : 'hidden'
    // plans retournés en miroir : la parallaxe horizontale s'inverse aussi, pour rester calée sur le décor
    // les combattants suivent aussi le travelling (`pan`), exprimé dans leur décalage de parallaxe
    const fighterOx = camera.ox - (camera.pan ?? 0) / PLACEMENT.depth
    const view = { ...camera, ox: this.mirrored ? -fighterOx : fighterOx }
    target.draw(fight, view, calm)
    this.hero.draw(fight, view, calm)
    this.weather.draw(info, -camera.ox * 0.5, this.options)
  }
}
