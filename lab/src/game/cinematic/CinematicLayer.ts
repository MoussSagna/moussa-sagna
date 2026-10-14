import { asset, loadImage } from '../gl'
import type { FrameInfo } from '../types'

/**
 * Un plan : son image, sa fin, le mouvement de caméra (point visé en fraction de l'image, zoom) et la façon
 * dont il arrive : coupe franche, pétale qui passe devant l'objectif, éclair blanc ou coupe en diagonale.
 */
interface Shot {
  file: string
  end: number
  enter: 'cut' | 'petal' | 'flash' | 'slash'
  /** Carton de nom, qui glisse depuis son côté de l'écran. */
  card?: { title: string; subtitle: string; side: 'left' | 'right' }
  from: [number, number, number]
  to: [number, number, number]
  /** Lanternes dont la lueur vacille : centre et taille, en pixels de l'image (`tools/prepare_cinematic.py`). */
  lanterns: [number, number, number][]
  /** Lune : centre et rayon, en pixels de l'image. */
  moon?: [number, number, number]
}

/**
 * Les plans de la cinématique d'entrée, en secondes depuis son début. Le temple vide (la caméra descend de la
 * lune vers l'esplanade), un pétale passe devant l'objectif et révèle Moussa en pied (la caméra s'approche), puis
 * un gros plan sur lui avec son nom. Une coupe en diagonale passe à l'adversaire : de dos face à la ville, de
 * plus près, puis il se retourne avec un sourire.
 */
const SHOTS: Shot[] = [
  {
    file: 'cinematic/temple.webp',
    end: 2.75,
    enter: 'cut',
    from: [0.58, 0.14, 1.75],
    to: [0.5, 0.56, 1.06],
    lanterns: [[141, 513, 120], [338, 594, 78], [389, 495, 78], [444, 490, 63], [511, 485, 96], [635, 525, 87], [688, 514, 113], [835, 537, 86], [980, 515, 116], [1032, 524, 78], [1117, 470, 120], [1244, 491, 86], [1336, 596, 52], [1545, 513, 140], [1660, 492, 74]],
    moon: [970, 110, 190],
  },
  {
    file: 'cinematic/hero.webp',
    end: 5.45,
    enter: 'petal',
    from: [0.5, 0.62, 1.02],
    to: [0.5, 0.4, 1.22],
    lanterns: [[120, 512, 140], [341, 596, 105], [476, 487, 120], [513, 567, 46], [1033, 517, 73], [1120, 473, 120], [1156, 566, 46], [1246, 489, 87], [1336, 596, 60], [1541, 513, 140]],
    moon: [900, 105, 180],
  },
  {
    file: 'cinematic/closeup.webp',
    end: 9.05,
    enter: 'flash',
    card: { title: 'MOUSSA SAGNA', subtitle: 'DÉVELOPPEUR FRONTEND', side: 'left' },
    from: [0.53, 0.44, 1.16],
    to: [0.49, 0.42, 1.03],
    lanterns: [],
  },
  {
    file: 'cinematic/rival-wide.webp',
    end: 11.1,
    enter: 'slash',
    from: [0.5, 0.6, 1.02],
    to: [0.5, 0.45, 1.16],
    lanterns: [[17, 451, 90], [174, 540, 100], [295, 442, 65], [321, 564, 45], [406, 594, 90], [1253, 593, 90], [1370, 572, 63], [1492, 541, 100], [1649, 452, 90]],
    moon: [820, 110, 140],
  },
  {
    file: 'cinematic/rival-back.webp',
    end: 12.5,
    enter: 'cut',
    from: [0.5, 0.45, 1.03],
    to: [0.5, 0.38, 1.12],
    lanterns: [[26, 633, 90], [159, 544, 110], [192, 641, 30], [248, 632, 79], [1298, 546, 90], [1380, 639, 49], [1550, 552, 100]],
    moon: [1000, 100, 210],
  },
  {
    file: 'cinematic/rival-turn.webp',
    end: 15.1,
    enter: 'flash',
    card: { title: '???', subtitle: 'LE BOSS FINAL', side: 'right' },
    from: [0.42, 0.34, 1.18],
    to: [0.46, 0.36, 1.04],
    lanterns: [[26, 631, 90], [140, 533, 120], [1380, 638, 48], [1457, 651, 34], [1552, 551, 100]],
    moon: [1000, 90, 210],
  },
]

/**
 * Le reste du déroulé. Durées des transitions : le pétale et la coupe en diagonale recouvrent l'écran à
 * mi-course, au moment de la coupe ; l'éclair part de la coupe. Puis les annonces, par-dessus le stage : début
 * et fin de chacune. Le combat commence avec « Fight ».
 */
const TIMELINE = {
  petal: 0.8,
  slash: 0.42,
  flash: 0.22,
  destiny: [15.25, 16.9] as [number, number],
  round: [17.0, 18.15] as [number, number],
  fight: [18.25, 19.35] as [number, number],
}
/** Annonce « K.O. » : début et fin, en secondes depuis le K.O. du personnage au sol. */
const KO_ANNOUNCE: [number, number] = [0, 1.7]
/**
 * Plan de coupe de la frappe au sol : un gros plan de Moussa qui charge, dans une bande inclinée qui s'ouvre au
 * milieu de l'écran, pendant que le combat est figé. Durée, et temps d'ouverture et de fermeture de la bande.
 */
export const CUT_IN_SECONDS = 1.05
/** Mise au point du début de l'attaque spéciale : durée pendant laquelle le jeu est figé. */
export const FOCUS_SECONDS = 0.8
const CUT_IN = { file: 'cinematic/cutin.webp', open: 0.14, close: 0.16, height: 0.6, pan: 0.05 }
const SHOTS_END = SHOTS[SHOTS.length - 1].end
/** Instant à partir duquel le personnage peut jouer, et fin de la cinématique. */
export const CINEMATIC_FIGHT_AT = TIMELINE.fight[0]
const END = TIMELINE.fight[1]

const RED = '#e8262d'
const DISPLAY_FONT = 'Anton, Impact, sans-serif'
const BODY_FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif'

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
const easeOut = (k: number) => 1 - (1 - k) ** 3
const clamp = (k: number) => Math.max(0, Math.min(1, k))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** Tracé d'un pétale de cerisier, centré sur l'origine, de demi-hauteur `size`, pointe échancrée vers le haut. */
function petalPath(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.78)
  ctx.lineTo(size * 0.16, -size)
  ctx.bezierCurveTo(size * 0.95, -size * 0.55, size * 0.75, size * 0.65, 0, size)
  ctx.bezierCurveTo(-size * 0.75, size * 0.65, -size * 0.95, -size * 0.55, -size * 0.16, -size)
  ctx.closePath()
}

/**
 * La cinématique d'entrée : trois plans illustrés, animés par la caméra, la pluie, les pétales et la lueur des
 * lanternes, puis les annonces avant le combat (« Face your destiny », « Round 1 », « Fight »). Canvas 2D,
 * par-dessus tous les autres plans.
 */
export class CinematicLayer {
  private ctx: CanvasRenderingContext2D | null
  private images: (HTMLImageElement | null)[] = []
  /** Temps écoulé depuis le début, ou -1 quand elle ne joue pas. */
  private time = -1
  /** Temps écoulé depuis l'annonce « K.O. », ou -1 quand elle n'est pas affichée. */
  private koTime = -1
  /** Temps écoulé depuis le début du plan de coupe, ou -1 quand il n'est pas affiché. */
  private cutInTime = -1
  /** Temps écoulé depuis l'impact de la frappe au sol, ou -1 : un éclair blanc puis rouge sur tout l'écran. */
  private impactTime = -1
  /** Temps écoulé depuis le début de la mise au point, ou -1 : traits de vitesse qui convergent vers le centre. */
  private focusTime = -1
  private cutInImage: HTMLImageElement | null = null
  /** Traits de vitesse du plan de coupe : hauteur dans la bande, longueur, vitesse. */
  private streaks = Array.from({ length: 26 }, () => ({ y: Math.random(), length: 0.08 + Math.random() * 0.25, speed: 1.5 + Math.random() * 2.5, x: Math.random() }))
  /** Numéro du round annoncé. */
  private round = 1
  private drops = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), length: 0.03 + Math.random() * 0.05, speed: 1.6 + Math.random() * 1.2 }))
  private petals = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 0.006 + Math.random() * 0.014,
    turn: Math.random() * 6.28,
    spin: (Math.random() - 0.5) * 3,
    sway: Math.random() * 6.28,
    speed: 0.05 + Math.random() * 0.08,
  }))

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
  }

  /** Charge les plans et les polices. Résout `false` si un plan manque : la cinématique ne jouera pas. */
  async load(): Promise<boolean> {
    this.images = await Promise.all(SHOTS.map((shot) => loadImage(asset(shot.file))))
    this.cutInImage = await loadImage(asset(CUT_IN.file))
    try {
      await Promise.all([document.fonts.load(`100px ${DISPLAY_FONT}`), document.fonts.load(`600 40px ${BODY_FONT}`)])
    } catch {
      // sans les polices, les textes prennent une police de secours
    }
    return this.images.every(Boolean)
  }

  /** (Re)lance la cinématique depuis le début. */
  start(): void {
    if (this.images.length && this.images.every(Boolean)) this.time = 0
    this.round = 1
  }

  /** Annonce un nouveau round, sans les plans illustrés : « Round n » puis « Fight! ». */
  startRound(round: number): void {
    this.round = round
    this.time = TIMELINE.round[0] - 0.05
  }

  /** Passe les plans illustrés : on arrive directement aux annonces. */
  skip(): void {
    if (this.time >= 0 && this.time < SHOTS_END) this.time = SHOTS_END
  }

  /** Vrai tant que les plans illustrés recouvrent le stage. */
  get covering(): boolean {
    return this.time >= 0 && this.time < SHOTS_END
  }

  /** Vrai tant que le personnage ne peut pas encore jouer. */
  get locked(): boolean {
    return this.time >= 0 && this.time < CINEMATIC_FIGHT_AT
  }

  /** Mise au point du début de l'attaque spéciale. */
  focus(): void {
    this.focusTime = 0
  }

  /** Éclair d'impact de la frappe au sol. */
  impactFlash(): void {
    this.impactTime = 0
  }

  /** Lance le plan de coupe de la frappe au sol. */
  cutIn(): void {
    if (this.cutInImage) this.cutInTime = 0
  }

  /** Affiche « K.O. » par-dessus le stage, le temps de `KO_ANNOUNCE`. */
  showKO(): void {
    this.koTime = 0
  }

  update(delta: number): void {
    if (this.focusTime >= 0) {
      this.focusTime += delta
      if (this.focusTime >= FOCUS_SECONDS) this.focusTime = -1
    }
    if (this.impactTime >= 0) {
      this.impactTime += delta
      if (this.impactTime >= 0.35) this.impactTime = -1
    }
    if (this.cutInTime >= 0) {
      this.cutInTime += delta
      if (this.cutInTime >= CUT_IN_SECONDS) this.cutInTime = -1
    }
    if (this.koTime >= 0) {
      this.koTime += delta
      if (this.koTime >= KO_ANNOUNCE[1]) this.koTime = -1
    }
    if (this.time < 0) return
    this.time += delta
    if (this.time >= END) this.time = -1
  }

  draw(frame: FrameInfo, calm: boolean): void {
    const ctx = this.ctx
    if (!ctx) return
    const { width: w, height: h } = frame
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (this.focusTime >= 0) this.drawFocus(ctx, this.focusTime, frame, calm)
    if (this.impactTime >= 0) {
      // blanc d'abord, puis un voile rouge qui s'éteint
      const k = this.impactTime
      if (k < 0.06) this.flash(ctx, w, h, calm ? 0.3 : 0.85)
      else this.flash(ctx, w, h, (1 - (k - 0.06) / 0.29) * (calm ? 0.15 : 0.4), '232, 38, 45')
    }
    if (this.cutInTime >= 0) this.drawCutIn(ctx, this.cutInTime, frame, calm)
    if (this.koTime >= 0) this.announce(ctx, this.koTime, KO_ANNOUNCE, 'K.O.', 0.3, RED, w, h, calm)
    const t = this.time
    if (t < 0) return

    if (t < SHOTS_END) {
      const index = SHOTS.findIndex((shot) => t < shot.end)
      const shot = SHOTS[index]
      const start = index === 0 ? 0 : SHOTS[index - 1].end
      this.drawShot(ctx, shot, this.images[index], clamp((t - start) / (shot.end - start)), frame, calm)
      if (shot.card) this.drawNameCard(ctx, shot.card, t - start, w, h)
      this.drawWeather(ctx, frame, calm, shot.card ? 1.8 : 1)
      // bandes noires de cinéma
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h * 0.075)
      ctx.fillRect(0, h * 0.925, w, h * 0.075)
      // la transition qui a amené ce plan, et celle vers le suivant, qui commence avant la coupe
      const transitions: [Shot['enter'] | undefined, number][] = [
        [shot.enter, start],
        [SHOTS[index + 1]?.enter, shot.end],
      ]
      for (const [enter, cut] of transitions) {
        if (enter === 'petal') this.drawPetalWipe(ctx, t - cut, w, h, calm)
        if (enter === 'slash') this.drawSlash(ctx, t - cut, w, h, calm)
        if (enter === 'flash' && t >= cut && t < cut + TIMELINE.flash) this.flash(ctx, w, h, (1 - (t - cut) / TIMELINE.flash) * (calm ? 0.35 : 0.9))
      }
      return
    }

    // retour au stage : un éclair blanc, puis les annonces
    if (t < SHOTS_END + TIMELINE.flash) this.flash(ctx, w, h, (1 - (t - SHOTS_END) / TIMELINE.flash) * (calm ? 0.35 : 1))
    this.announce(ctx, t, TIMELINE.destiny, 'FACE YOUR DESTINY', 0.11, '#fff', w, h, calm)
    this.announce(ctx, t, TIMELINE.round, `ROUND ${this.round}`, 0.17, '#fff', w, h, calm)
    this.announce(ctx, t, TIMELINE.fight, 'FIGHT!', 0.24, RED, w, h, calm)
  }

  /** Un plan, cadré pour remplir l'écran, avec son mouvement de caméra, la lueur de la lune et des lanternes. */
  private drawShot(ctx: CanvasRenderingContext2D, shot: Shot, image: HTMLImageElement | null, k: number, frame: FrameInfo, calm: boolean): void {
    if (!image) return
    const { width: w, height: h } = frame
    // « Réduire les mouvements » : la caméra reste sur le cadrage d'arrivée
    const e = calm ? 1 : ease(k)
    const [fx, fy, zoom] = [0, 1, 2].map((i) => lerp(shot.from[i], shot.to[i], e))
    const scale = Math.max(w / image.width, h / image.height) * zoom
    const iw = image.width * scale
    const ih = image.height * scale
    // le point visé au centre de l'écran, sans jamais laisser voir le bord de l'image
    const dx = Math.min(0, Math.max(w - iw, w / 2 - fx * iw))
    const dy = Math.min(0, Math.max(h - ih, h / 2 - fy * ih))
    ctx.drawImage(image, dx, dy, iw, ih)

    const time = frame.time
    ctx.globalCompositeOperation = 'lighter'
    if (shot.moon) {
      const [mx, my, mr] = shot.moon
      const pulse = 0.16 + 0.06 * Math.sin(time * 1.3)
      const glow = ctx.createRadialGradient(dx + mx * scale, dy + my * scale, mr * scale * 0.6, dx + mx * scale, dy + my * scale, mr * scale * 1.8)
      glow.addColorStop(0, `rgba(255, 40, 50, ${pulse})`)
      glow.addColorStop(1, 'rgba(255, 40, 50, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
    }
    shot.lanterns.forEach(([lx, ly, size], i) => {
      const flicker = 0.5 + 0.5 * Math.sin(time * 11 + i * 1.7) * Math.sin(time * 6.3 + i * 0.9)
      const x = dx + lx * scale
      const y = dy + ly * scale
      const r = size * scale * 1.1
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
      glow.addColorStop(0, `rgba(255, 150, 70, ${0.1 + 0.18 * flicker})`)
      glow.addColorStop(1, 'rgba(255, 120, 50, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
    })
    ctx.globalCompositeOperation = 'source-over'
  }

  /** Pluie et pétales devant le plan. `near` grossit les pétales sur le gros plan. */
  private drawWeather(ctx: CanvasRenderingContext2D, frame: FrameInfo, calm: boolean, near: number): void {
    const { width: w, height: h, delta } = frame
    const amount = calm ? 0.4 : 1
    ctx.strokeStyle = 'rgba(215, 205, 255, 0.28)'
    ctx.lineWidth = Math.max(1, h / 650)
    ctx.beginPath()
    this.drops.forEach((drop, i) => {
      drop.y += drop.speed * delta
      drop.x -= drop.speed * 0.18 * delta
      if (drop.y > 1.1) {
        drop.y -= 1.2
        drop.x = Math.random() * 1.2
      }
      if (i > this.drops.length * amount) return
      const x = drop.x * w
      const y = drop.y * h
      ctx.moveTo(x, y)
      ctx.lineTo(x + drop.length * h * 0.18, y - drop.length * h)
    })
    ctx.stroke()

    this.petals.forEach((petal, i) => {
      petal.y += petal.speed * delta
      petal.sway += delta * 1.6
      petal.turn += petal.spin * delta
      if (petal.y > 1.08) {
        petal.y = -0.08
        petal.x = Math.random()
      }
      if (i > this.petals.length * amount) return
      ctx.save()
      ctx.translate((petal.x + Math.sin(petal.sway) * 0.03) * w, petal.y * h)
      ctx.rotate(petal.turn)
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(petal.sway * 1.3)))
      petalPath(ctx, petal.size * h * near)
      ctx.fillStyle = 'rgba(255, 150, 190, 0.85)'
      ctx.fill()
      ctx.restore()
    })
  }

  /** Le pétale qui passe devant l'objectif : il traverse l'écran en tournant et le recouvre entièrement à mi-course. */
  private drawPetalWipe(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, calm: boolean): void {
    // `t` : temps depuis la coupe ; le pétale recouvre l'écran à la coupe
    const half = TIMELINE.petal / 2
    if (t < -half || t > half) return
    const p = (t + half) / TIMELINE.petal
    if (calm) {
      // « Réduire les mouvements » : un fondu rose à la place du pétale qui traverse
      this.flash(ctx, w, h, 1 - Math.abs(p - 0.5) * 2, '255, 160, 200')
      return
    }
    const size = Math.max(w, h) * 1.3
    // trois copies de plus en plus pâles derrière lui : un flou de vitesse
    for (const [lag, alpha] of [
      [0.08, 0.25],
      [0.04, 0.5],
      [0, 1],
    ]) {
      const q = p - lag
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(lerp(-0.7 * w, 1.7 * w, q), lerp(1.45 * h, -0.45 * h, q))
      ctx.rotate(-1.05 + q * 1.3)
      petalPath(ctx, size)
      const fill = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size)
      fill.addColorStop(0, '#ffd3e4')
      fill.addColorStop(0.55, '#f78db4')
      fill.addColorStop(1, '#d93b74')
      ctx.fillStyle = fill
      ctx.fill()
      // nervure centrale
      ctx.strokeStyle = 'rgba(200, 40, 100, 0.35)'
      ctx.lineWidth = size * 0.012
      ctx.beginPath()
      ctx.moveTo(0, size * 0.95)
      ctx.quadraticCurveTo(size * 0.08, 0, 0, -size * 0.75)
      ctx.stroke()
      ctx.restore()
    }
  }

  /** Le nom de Moussa sur le gros plan : il glisse depuis la gauche, sur une bande rouge inclinée. */
  private drawNameCard(ctx: CanvasRenderingContext2D, card: NonNullable<Shot['card']>, t: number, w: number, h: number): void {
    const k = easeOut(clamp((t - 0.2) / 0.45))
    if (k <= 0) return
    const left = card.side === 'left'
    const x = left ? lerp(-0.6 * w, 0.06 * w, k) : lerp(1.6 * w, 0.94 * w, k)
    const y = h * 0.74
    ctx.save()
    ctx.translate(x, y)
    ctx.transform(1, 0, -0.2, 1, 0, 0)
    ctx.textAlign = left ? 'left' : 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = RED
    const bar = w * 0.5 * k + w * 0.1
    ctx.fillRect(left ? -w * 0.1 : w * 0.1 - bar, h * 0.01, bar, h * 0.012)
    ctx.font = `${Math.round(h * 0.12)}px ${DISPLAY_FONT}`
    ctx.fillText(card.title, h * 0.008, h * 0.008)
    ctx.fillStyle = '#fff'
    ctx.fillText(card.title, 0, 0)
    ctx.font = `600 ${Math.round(h * 0.036)}px ${BODY_FONT}`
    ctx.fillText(card.subtitle, left ? h * 0.004 : -h * 0.004, h * 0.07)
    ctx.restore()
  }

  /**
   * Une coupe en diagonale : une bande sombre bordée de rouge balaie l'écran de gauche à droite. Elle le
   * recouvre entièrement à la coupe (`t` = 0, temps depuis la coupe), puis découvre le plan suivant.
   */
  private drawSlash(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, calm: boolean): void {
    const half = TIMELINE.slash / 2
    if (t < -half || t > half) return
    if (calm) {
      // « Réduire les mouvements » : un fondu au noir à la place du balayage
      this.flash(ctx, w, h, 1 - Math.abs(t) / half, '10, 6, 12')
      return
    }
    const p = (t + half) / TIMELINE.slash
    const lean = h * 0.35
    // avant la coupe, le bord avant avance ; après, c'est le bord arrière qui le suit
    const front = p < 0.5 ? lerp(-lean, w + lean, ease(p * 2)) : w + lean * 2
    const back = p < 0.5 ? -lean * 2 : lerp(-lean, w + lean, ease((p - 0.5) * 2))
    const band = (from: number, to: number, color: string) => {
      ctx.beginPath()
      ctx.moveTo(from + lean, 0)
      ctx.lineTo(to + lean, 0)
      ctx.lineTo(to - lean, h)
      ctx.lineTo(from - lean, h)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
    band(back, front, '#0a060c')
    const edge = h * 0.03
    if (p < 0.5) band(front - edge, front, RED)
    else band(back, back + edge, RED)
  }

  /** Une annonce : elle arrive en se resserrant, tient, puis s'étire en disparaissant, sur une bande sombre. */
  private announce(ctx: CanvasRenderingContext2D, t: number, [start, end]: [number, number], text: string, size: number, color: string, w: number, h: number, calm: boolean): void {
    if (t < start || t >= end) return
    const age = t - start
    const left = end - t
    const enter = easeOut(clamp(age / 0.18))
    const leave = clamp(1 - left / 0.22)
    const alpha = enter * (1 - leave)
    const fight = color === RED
    // le « Fight » secoue l'écran à son arrivée
    const shake = fight && !calm ? Math.max(0, 1 - age / 0.3) * h * 0.012 : 0
    ctx.save()
    ctx.translate(w / 2 + Math.sin(age * 90) * shake, h / 2 + Math.cos(age * 70) * shake)
    ctx.globalAlpha = alpha * 0.55
    ctx.fillStyle = '#000'
    ctx.fillRect(-w / 2, -h * size * 0.85, w, h * size * 1.7)
    ctx.globalAlpha = alpha
    ctx.fillStyle = RED
    ctx.fillRect(-w / 2, -h * size * 0.85, w * enter, h * 0.006)
    ctx.fillRect(w / 2 - w * enter, h * size * 0.85 - h * 0.006, w * enter, h * 0.006)
    const zoom = calm ? 1 : lerp(fight ? 2.2 : 1.5, 1, enter)
    ctx.scale(zoom * (1 + leave * 0.6), zoom)
    ctx.transform(1, 0, -0.18, 1, 0, 0)
    ctx.font = `${Math.round(h * size)}px ${DISPLAY_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = h * size * 0.08
    ctx.strokeStyle = fight ? '#fff' : RED
    ctx.strokeText(text, 0, 0)
    ctx.fillStyle = color
    ctx.fillText(text, 0, 0)
    ctx.restore()
    if (fight && age < 0.15) this.flash(ctx, w, h, (1 - age / 0.15) * (calm ? 0.25 : 0.6))
  }

  /**
   * Le plan de coupe : l'écran s'assombrit, une bande inclinée s'ouvre au milieu avec le gros plan de Moussa qui
   * glisse lentement, des traits de vitesse et des bords rouges, puis elle se referme.
   */
  private drawCutIn(ctx: CanvasRenderingContext2D, t: number, frame: FrameInfo, calm: boolean): void {
    const image = this.cutInImage
    if (!image) return
    const { width: w, height: h, delta } = frame
    const opening = easeOut(clamp(t / CUT_IN.open))
    const closing = clamp((t - (CUT_IN_SECONDS - CUT_IN.close)) / CUT_IN.close)
    const size = opening * (1 - closing * closing)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * (1 - closing)})`
    ctx.fillRect(0, 0, w, h)
    if (size <= 0) return
    const half = (h * CUT_IN.height * size) / 2
    const lean = h * 0.12
    const band = () => {
      ctx.beginPath()
      ctx.moveTo(0, h / 2 - half + lean)
      ctx.lineTo(w, h / 2 - half - lean)
      ctx.lineTo(w, h / 2 + half - lean)
      ctx.lineTo(0, h / 2 + half + lean)
      ctx.closePath()
    }
    ctx.save()
    band()
    ctx.clip()
    const fill = ctx.createLinearGradient(0, 0, w, 0)
    fill.addColorStop(0, '#2a0306')
    fill.addColorStop(0.55, '#7a0a10')
    fill.addColorStop(1, '#1a0204')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, w, h)
    // traits de vitesse qui filent vers la gauche, derrière le personnage
    ctx.strokeStyle = 'rgba(255, 190, 190, 0.35)'
    ctx.lineWidth = Math.max(1, h / 400)
    ctx.beginPath()
    for (const streak of this.streaks) {
      if (!calm) streak.x -= streak.speed * delta
      if (streak.x < -streak.length) streak.x += 1 + streak.length
      const y = h / 2 + (streak.y - 0.5) * h * CUT_IN.height * 1.4
      ctx.moveTo(streak.x * w, y)
      ctx.lineTo((streak.x + streak.length) * w, y)
    }
    ctx.stroke()
    // le gros plan couvre la bande et glisse lentement vers la gauche
    const scale = Math.max(w / image.width, (h * CUT_IN.height * 1.25) / image.height) * 1.08
    const pan = calm ? 0 : CUT_IN.pan * (0.5 - t / CUT_IN_SECONDS)
    ctx.drawImage(image, w / 2 - (image.width * scale) / 2 + pan * w, h / 2 - (image.height * scale) / 2, image.width * scale, image.height * scale)
    ctx.restore()
    // bords de la bande : un trait rouge et un trait blanc
    ctx.save()
    band()
    ctx.lineWidth = h * 0.012
    ctx.strokeStyle = RED
    ctx.stroke()
    ctx.lineWidth = h * 0.004
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    ctx.restore()
    // éclair à l'ouverture
    if (t < 0.1) this.flash(ctx, w, h, (1 - t / 0.1) * (calm ? 0.25 : 0.7))
  }

  /**
   * Mise au point, à la manière des jeux de combat : un éclair, un vignettage rouge et sombre sur les bords, et des
   * traits qui filent vers le centre de l'écran, là où la caméra s'est resserrée sur le personnage.
   */
  private drawFocus(ctx: CanvasRenderingContext2D, t: number, frame: FrameInfo, calm: boolean): void {
    const { width: w, height: h } = frame
    const fade = Math.min(1, t / 0.08) * Math.min(1, (FOCUS_SECONDS - t) / 0.15)
    const vignette = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.hypot(w, h) * 0.6)
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(0.6, `rgba(60, 0, 6, ${0.45 * fade})`)
    vignette.addColorStop(1, `rgba(0, 0, 0, ${0.85 * fade})`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)
    if (!calm) {
      // traits de vitesse : partent des bords, filent vers le centre, renouvelés à chaque image
      ctx.save()
      ctx.translate(w / 2, h * 0.55)
      ctx.strokeStyle = `rgba(255, 220, 220, ${0.5 * fade})`
      const reach = Math.hypot(w, h) * 0.6
      for (let i = 0; i < 70; i++) {
        const angle = (i / 70) * Math.PI * 2 + Math.sin(i * 12.9 + Math.floor(t * 30)) * 0.05
        const inner = reach * (0.42 + 0.25 * Math.abs(Math.sin(i * 7.3 + Math.floor(t * 30) * 1.7)))
        ctx.lineWidth = h * (0.002 + 0.004 * Math.abs(Math.sin(i * 3.1)))
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (t < 0.07) this.flash(ctx, w, h, (1 - t / 0.07) * (calm ? 0.25 : 0.75))
  }

  private flash(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, rgb = '255, 255, 255'): void {
    if (alpha <= 0) return
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha)})`
    ctx.fillRect(0, 0, w, h)
  }
}
