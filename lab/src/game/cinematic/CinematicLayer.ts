import { asset, loadImage } from '../gl'
import type { FrameInfo } from '../types'

/** Un plan : son image, sa fin, et le mouvement de caméra (point visé en fraction de l'image, zoom). */
interface Shot {
  file: string
  end: number
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
 * un gros plan sur lui avec son nom.
 */
const SHOTS: Shot[] = [
  {
    file: 'cinematic/temple.webp',
    end: 2.75,
    from: [0.58, 0.14, 1.75],
    to: [0.5, 0.56, 1.06],
    lanterns: [[141, 513, 120], [338, 594, 78], [389, 495, 78], [444, 490, 63], [511, 485, 96], [635, 525, 87], [688, 514, 113], [835, 537, 86], [980, 515, 116], [1032, 524, 78], [1117, 470, 120], [1244, 491, 86], [1336, 596, 52], [1545, 513, 140], [1660, 492, 74]],
    moon: [970, 110, 190],
  },
  {
    file: 'cinematic/hero.webp',
    end: 5.45,
    from: [0.5, 0.62, 1.02],
    to: [0.5, 0.4, 1.22],
    lanterns: [[120, 512, 140], [341, 596, 105], [476, 487, 120], [513, 567, 46], [1033, 517, 73], [1120, 473, 120], [1156, 566, 46], [1246, 489, 87], [1336, 596, 60], [1541, 513, 140]],
    moon: [900, 105, 180],
  },
  {
    file: 'cinematic/closeup.webp',
    end: 7.05,
    from: [0.53, 0.44, 1.16],
    to: [0.49, 0.42, 1.03],
    lanterns: [],
  },
]

/**
 * Le reste du déroulé. `petal` : le pétale qui passe devant l'objectif, de son entrée à sa sortie ; il recouvre
 * tout l'écran à mi-course, au moment de la coupe. Puis les annonces, par-dessus le stage : début et fin de
 * chacune. Le combat commence avec « Fight ».
 */
const TIMELINE = {
  petal: [2.35, 3.15] as [number, number],
  flash: 0.22,
  destiny: [7.2, 8.85] as [number, number],
  round: [8.95, 10.1] as [number, number],
  fight: [10.2, 11.3] as [number, number],
}
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

  update(delta: number): void {
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
    const t = this.time
    if (t < 0) return

    if (t < SHOTS_END) {
      const index = SHOTS.findIndex((shot) => t < shot.end)
      const shot = SHOTS[index]
      const start = index === 0 ? 0 : SHOTS[index - 1].end
      this.drawShot(ctx, shot, this.images[index], clamp((t - start) / (shot.end - start)), frame, calm)
      if (index === 2) this.drawNameCard(ctx, t - start, w, h)
      this.drawWeather(ctx, frame, calm, index === 2 ? 1.8 : 1)
      // bandes noires de cinéma
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h * 0.075)
      ctx.fillRect(0, h * 0.925, w, h * 0.075)
      this.drawPetalWipe(ctx, t, w, h, calm)
      // éclair blanc à la coupe vers le gros plan
      const cut = SHOTS[1].end
      if (t >= cut && t < cut + TIMELINE.flash) this.flash(ctx, w, h, (1 - (t - cut) / TIMELINE.flash) * (calm ? 0.35 : 0.9))
      return
    }

    // retour au stage : un éclair blanc, puis les annonces
    if (t < SHOTS_END + TIMELINE.flash) this.flash(ctx, w, h, (1 - (t - SHOTS_END) / TIMELINE.flash) * (calm ? 0.35 : 1))
    this.announce(ctx, t, TIMELINE.destiny, 'FACE YOUR DESTINY', 0.11, '#fff', w, h, calm)
    this.announce(ctx, t, TIMELINE.round, 'ROUND 1', 0.17, '#fff', w, h, calm)
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
    const [start, end] = TIMELINE.petal
    if (t < start || t > end) return
    const p = (t - start) / (end - start)
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
  private drawNameCard(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const k = easeOut(clamp((t - 0.2) / 0.45))
    if (k <= 0) return
    const x = lerp(-0.6 * w, 0.06 * w, k)
    const y = h * 0.74
    ctx.save()
    ctx.translate(x, y)
    ctx.transform(1, 0, -0.2, 1, 0, 0)
    ctx.fillStyle = RED
    ctx.fillRect(-w * 0.1, h * 0.01, w * 0.5 * k + w * 0.1, h * 0.012)
    ctx.font = `${Math.round(h * 0.12)}px ${DISPLAY_FONT}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = RED
    ctx.fillText('MOUSSA SAGNA', h * 0.008, h * 0.008)
    ctx.fillStyle = '#fff'
    ctx.fillText('MOUSSA SAGNA', 0, 0)
    ctx.font = `600 ${Math.round(h * 0.036)}px ${BODY_FONT}`
    ctx.fillStyle = '#fff'
    ctx.fillText('DÉVELOPPEUR FRONTEND', h * 0.004, h * 0.07)
    ctx.restore()
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

  private flash(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, rgb = '255, 255, 255'): void {
    if (alpha <= 0) return
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, alpha)})`
    ctx.fillRect(0, 0, w, h)
  }
}
