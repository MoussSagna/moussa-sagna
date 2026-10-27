/**
 * Interface de combat, à la manière de Street Fighter 6 : barres de vie en haut, barre de super et jauge de drive
 * (quatre blocs) en bas, Moussa à gauche, l'adversaire à droite. Elle tient aussi les valeurs : le moteur lui
 * signale les coups (`damage`, `block`), les combos (`combo`, `endCombo`), l'usage des attaques ultimes (`useSuper`) et le
 * changement de round (`reset`).
 * Elle se dessine sur la toile de la cinématique, sous les annonces et les plans de coupe.
 */

export type HudSide = 'hero' | 'rival'

const NAMES: Record<HudSide, string> = { hero: 'MOUSSA', rival: 'SHIGARAKI' }
const DISPLAY_FONT = 'Anton, Impact, sans-serif'
const BODY_FONT = '"Barlow Semi Condensed", "Arial Narrow", sans-serif'

/**
 * Réglages. `trail` : vitesse à laquelle la part perdue (en rouge) rattrape la vie, par seconde, après `trailDelay`.
 * Drive : `segments` blocs ; une parade en coûte `block` × la puissance du coup, un drive rush `rush` ; il se recharge de `regen` bloc par
 * seconde, `regenDelay` secondes après la dernière dépense ; vide, il passe en surchauffe (« BURNOUT ») et se
 * recharge à `burnoutRegen` jusqu'au plein. Super : chaque coup donné en remplit `gainDealt` × sa puissance, chaque
 * coup reçu `gainTaken` × sa puissance.
 */
export const HUD = {
  trail: 0.6,
  trailDelay: 0.5,
  segments: 4,
  block: 0.5,
  rush: 2,
  regen: 0.35,
  regenDelay: 1.2,
  burnoutRegen: 0.25,
  gainDealt: 0.07,
  gainTaken: 0.035,
}

/**
 * Compteur de combo, affiché du côté de l'attaquant, sous sa barre de vie, à partir de `min` coups. Chaque coup le fait
 * grossir un instant (`pop` secondes) ; une fois le combo fini, il reste `hold` secondes puis s'efface en `fade` secondes.
 */
const COMBO = { min: 2, pop: 0.14, hold: 0.9, fade: 0.35 }

type Combo = { count: number; age: number; over: number }

type Gauges = { health: number; trail: number; trailWait: number; super: number; drive: number; driveWait: number; burnout: boolean; flash: number }

const fresh = (): Gauges => ({ health: 1, trail: 1, trailWait: 0, super: 0, drive: HUD.segments, driveWait: 0, burnout: false, flash: 0 })

export class HudLayer {
  private sides: Record<HudSide, Gauges> = { hero: fresh(), rival: fresh() }
  /** Combo en cours (ou qui s'efface) de chaque attaquant ; `over` : temps écoulé depuis sa fin, négatif tant qu'il dure. */
  private combos: Record<HudSide, Combo> = { hero: { count: 0, age: 0, over: Infinity }, rival: { count: 0, age: 0, over: Infinity } }
  private time = 0
  /** Numéro du round affiché au centre. */
  round = 1

  /** Nouveau round : tout revient au plein (le super est gardé, comme dans Street Fighter). */
  reset(keepSuper = true): void {
    for (const combo of Object.values(this.combos)) combo.over = Infinity
    for (const side of ['hero', 'rival'] as HudSide[]) {
      const kept = keepSuper ? this.sides[side].super : 0
      this.sides[side] = { ...fresh(), super: kept }
    }
  }

  health(side: HudSide): number {
    return this.sides[side].health
  }

  /** Coup encaissé par `side` : il perd `amount` de vie (fraction de la barre), et chacun gagne du super. */
  damage(side: HudSide, amount: number, power: number): void {
    const gauges = this.sides[side]
    gauges.health = Math.max(0, gauges.health - amount)
    gauges.trailWait = HUD.trailDelay
    gauges.flash = 0.25
    gauges.super = Math.min(1, gauges.super + HUD.gainTaken * power)
    const other = this.sides[side === 'hero' ? 'rival' : 'hero']
    other.super = Math.min(1, other.super + HUD.gainDealt * power)
  }

  /** Coup paré par `side` : il y laisse du drive ; l'attaquant gagne un peu de super. */
  block(side: HudSide, power: number): void {
    this.spendDrive(side, HUD.block * power)
    const other = this.sides[side === 'hero' ? 'rival' : 'hero']
    other.super = Math.min(1, other.super + (HUD.gainDealt / 2) * power)
  }

  /** Vrai si `side` a au moins `segments` blocs de drive et n'est pas en surchauffe. */
  hasDrive(side: HudSide, segments: number): boolean {
    const gauges = this.sides[side]
    return !gauges.burnout && gauges.drive >= segments
  }

  /** Dépense `segments` blocs de drive ; à zéro, surchauffe. */
  spendDrive(side: HudSide, segments: number): void {
    const gauges = this.sides[side]
    if (gauges.burnout) return
    gauges.drive = Math.max(0, gauges.drive - segments)
    gauges.driveWait = HUD.regenDelay
    if (gauges.drive <= 0) gauges.burnout = true
  }

  /** `side` vient de toucher : `count` coups d'affilée sans que l'adversaire ait pu se remettre. */
  combo(side: HudSide, count: number): void {
    this.combos[side] = { count, age: 0, over: -1 }
  }

  /** L'adversaire de `side` s'est remis (il peut bouger ou parer) : le combo s'arrête. */
  endCombo(side: HudSide): void {
    const combo = this.combos[side]
    if (combo.over < 0) combo.over = 0
  }

  /** Attaque ultime lancée : la barre de super se vide. */
  useSuper(side: HudSide): void {
    this.sides[side].super = 0
  }

  update(delta: number): void {
    this.time += delta
    for (const combo of Object.values(this.combos)) {
      combo.age += delta
      if (combo.over >= 0) combo.over += delta
    }
    for (const gauges of Object.values(this.sides)) {
      gauges.flash = Math.max(0, gauges.flash - delta)
      if (gauges.trailWait > 0) gauges.trailWait -= delta
      else gauges.trail = Math.max(gauges.health, gauges.trail - HUD.trail * delta)
      if (gauges.driveWait > 0) {
        gauges.driveWait -= delta
      } else {
        gauges.drive = Math.min(HUD.segments, gauges.drive + (gauges.burnout ? HUD.burnoutRegen : HUD.regen) * delta)
        if (gauges.burnout && gauges.drive >= HUD.segments) gauges.burnout = false
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, calm: boolean): void {
    ctx.save()
    const unit = Math.min(h, w * 0.5625)
    // ---------- en haut : les barres de vie, de part et d'autre du numéro de round ----------
    const top = unit * 0.045
    const barH = unit * 0.042
    const gap = unit * 0.11
    const barW = w / 2 - gap / 2 - unit * 0.06
    this.drawRound(ctx, w / 2, top + barH / 2, unit)
    this.drawHealth(ctx, 'hero', w / 2 - gap / 2, top, barW, barH, -1, unit, calm)
    this.drawHealth(ctx, 'rival', w / 2 + gap / 2, top, barW, barH, 1, unit, calm)
    // ---------- en bas : super, puis drive juste en dessous ----------
    const margin = unit * 0.06
    const superW = w * 0.3
    const superH = unit * 0.026
    const driveH = unit * 0.018
    const driveY = h - unit * 0.05 - driveH
    const superY = driveY - unit * 0.016 - superH
    this.drawSuper(ctx, 'hero', margin, superY, superW, superH, 1, unit, calm)
    this.drawSuper(ctx, 'rival', w - margin, superY, superW, superH, -1, unit, calm)
    this.drawDrive(ctx, 'hero', margin, driveY, superW, driveH, 1, unit, calm)
    this.drawDrive(ctx, 'rival', w - margin, driveY, superW, driveH, -1, unit, calm)
    // ---------- compteur de combo, sous la barre de vie de l'attaquant ----------
    const comboY = top + barH + unit * 0.14
    this.drawCombo(ctx, 'hero', unit * 0.06, comboY, 1, unit, calm)
    this.drawCombo(ctx, 'rival', w - unit * 0.06, comboY, -1, unit, calm)
    ctx.restore()
  }

  /** Compteur de combo : le nombre de coups en grand, « HITS » à côté, du bord de l'écran vers le centre (`dir`). */
  private drawCombo(ctx: CanvasRenderingContext2D, side: HudSide, edge: number, y: number, dir: number, unit: number, calm: boolean): void {
    const combo = this.combos[side]
    if (combo.count < COMBO.min || combo.over > COMBO.hold + COMBO.fade) return
    const alpha = combo.over > COMBO.hold ? 1 - (combo.over - COMBO.hold) / COMBO.fade : 1
    // à chaque coup, le chiffre grossit puis reprend sa taille
    const pop = calm ? 1 : 1 + 0.35 * Math.max(0, 1 - combo.age / COMBO.pop)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = dir > 0 ? 'left' : 'right'
    const size = unit * 0.085
    ctx.font = `italic ${size * pop}px ${DISPLAY_FONT}`
    const number = String(combo.count)
    const numberW = ctx.measureText(number).width
    ctx.lineJoin = 'round'
    ctx.lineWidth = unit * 0.008
    ctx.strokeStyle = 'rgba(8, 4, 12, 0.9)'
    ctx.strokeText(number, edge, y)
    const fill = ctx.createLinearGradient(0, y - size * pop, 0, y)
    fill.addColorStop(0, '#fff6c2')
    fill.addColorStop(1, '#ffb21e')
    ctx.fillStyle = fill
    ctx.fillText(number, edge, y)
    // « HITS » à côté du nombre, côté centre
    ctx.font = `italic 700 ${unit * 0.032}px ${BODY_FONT}`
    const label = 'HITS'
    const x = edge + dir * (numberW + unit * 0.012)
    ctx.lineWidth = unit * 0.006
    ctx.strokeText(label, x, y)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, x, y)
    ctx.restore()
  }

  /** Barre inclinée : un parallélogramme de `x0` à `x1` (dans un sens ou l'autre), penché de `slant`. */
  private slanted(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, height: number, slant: number): void {
    const dir = Math.sign(x1 - x0) || 1
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.lineTo(x1 - slant * dir, y + height)
    ctx.lineTo(x0 - slant * dir, y + height)
    ctx.closePath()
  }

  private drawRound(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number): void {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${unit * 0.026}px ${BODY_FONT}`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.fillText('ROUND', x, y - unit * 0.024)
    ctx.font = `${unit * 0.055}px ${DISPLAY_FONT}`
    ctx.fillStyle = '#fff'
    ctx.fillText(String(this.round), x, y + unit * 0.014)
  }

  /**
   * Barre de vie : ancrée près du centre (`inner`), elle s'étend vers l'extérieur (`dir` -1 pour Moussa, à gauche).
   * La vie perdue s'efface d'abord en rouge, puis la part rouge rattrape la vie.
   */
  private drawHealth(ctx: CanvasRenderingContext2D, side: HudSide, inner: number, y: number, width: number, height: number, dir: number, unit: number, calm: boolean): void {
    const gauges = this.sides[side]
    const slant = height * 0.5
    const outer = inner + dir * width
    // cadre
    ctx.fillStyle = 'rgba(8, 4, 12, 0.75)'
    this.slanted(ctx, inner - dir * unit * 0.006, outer + dir * unit * 0.006, y - unit * 0.006, height + unit * 0.012, slant)
    ctx.fill()
    // part perdue (rouge), puis vie restante : elles partent du centre vers l'extérieur
    ctx.fillStyle = '#e8262d'
    this.slanted(ctx, inner, inner + dir * width * gauges.trail, y, height, slant)
    ctx.fill()
    const low = gauges.health < 0.3
    const fill = ctx.createLinearGradient(0, y, 0, y + height)
    if (low && !calm && Math.sin(this.time * 10) > 0) {
      fill.addColorStop(0, '#fff1a8')
      fill.addColorStop(1, '#ff9d2e')
    } else {
      fill.addColorStop(0, '#fff6c4')
      fill.addColorStop(0.45, '#ffd23a')
      fill.addColorStop(1, '#e89a10')
    }
    ctx.fillStyle = fill
    if (gauges.health > 0) {
      this.slanted(ctx, inner, inner + dir * width * gauges.health, y, height, slant)
      ctx.fill()
    }
    // éclair blanc quand il encaisse
    if (gauges.flash > 0 && !calm) {
      ctx.fillStyle = `rgba(255, 255, 255, ${gauges.flash * 2})`
      this.slanted(ctx, inner, outer, y, height, slant)
      ctx.fill()
    }
    // bord
    ctx.lineWidth = Math.max(1, unit * 0.003)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    this.slanted(ctx, inner, outer, y, height, slant)
    ctx.stroke()
    // nom, sous la barre, côté extérieur
    ctx.font = `italic 700 ${unit * 0.03}px ${BODY_FONT}`
    ctx.textBaseline = 'top'
    ctx.textAlign = dir < 0 ? 'left' : 'right'
    ctx.fillStyle = '#000'
    ctx.fillText(NAMES[side], outer - dir * slant + unit * 0.002, y + height + unit * 0.01)
    ctx.fillStyle = '#fff'
    ctx.fillText(NAMES[side], outer - dir * slant, y + height + unit * 0.008)
  }

  /** Barre de super, en bas, partant du bord de l'écran (`dir` 1 pour Moussa, vers la droite) ; pleine, elle brille. */
  private drawSuper(ctx: CanvasRenderingContext2D, side: HudSide, edge: number, y: number, width: number, height: number, dir: number, unit: number, calm: boolean): void {
    const gauges = this.sides[side]
    const full = gauges.super >= 1
    const color = side === 'hero' ? ['#ff6a5e', '#e8262d', '#8a0d12'] : ['#d68bff', '#9b3dff', '#4d0d6e']
    const slant = -height * 0.6 * dir
    ctx.fillStyle = 'rgba(8, 4, 12, 0.75)'
    this.slanted(ctx, edge, edge + dir * width, y, height, slant)
    ctx.fill()
    if (gauges.super > 0) {
      const fill = ctx.createLinearGradient(0, y, 0, y + height)
      fill.addColorStop(0, color[0])
      fill.addColorStop(0.5, color[1])
      fill.addColorStop(1, color[2])
      ctx.fillStyle = fill
      this.slanted(ctx, edge, edge + dir * width * gauges.super, y, height, slant)
      ctx.fill()
    }
    if (full && !calm) {
      // pleine : un reflet blanc qui balaie la barre
      const k = (this.time * 0.8) % 1
      const sweep = ctx.createLinearGradient(edge + dir * width * (k - 0.15), 0, edge + dir * width * (k + 0.15), 0)
      sweep.addColorStop(0, 'rgba(255, 255, 255, 0)')
      sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)')
      sweep.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = sweep
      this.slanted(ctx, edge, edge + dir * width, y, height, slant)
      ctx.fill()
    }
    ctx.lineWidth = Math.max(1, unit * 0.0025)
    ctx.strokeStyle = full ? '#fff' : 'rgba(255, 255, 255, 0.6)'
    this.slanted(ctx, edge, edge + dir * width, y, height, slant)
    ctx.stroke()
    // étiquette au-dessus, côté bord : « SUPER », ou « MAX » quand elle est pleine
    ctx.font = `italic 700 ${unit * 0.024}px ${BODY_FONT}`
    ctx.textBaseline = 'bottom'
    ctx.textAlign = dir > 0 ? 'left' : 'right'
    ctx.fillStyle = full ? '#fff' : 'rgba(255, 255, 255, 0.75)'
    ctx.fillText(full ? 'SUPER  MAX' : 'SUPER', edge, y - unit * 0.004)
  }

  /** Jauge de drive : quatre blocs sous la barre de super ; en surchauffe, grise et marquée « BURNOUT ». */
  private drawDrive(ctx: CanvasRenderingContext2D, side: HudSide, edge: number, y: number, width: number, height: number, dir: number, unit: number, calm: boolean): void {
    const gauges = this.sides[side]
    const space = unit * 0.008
    const block = (width - space * (HUD.segments - 1)) / HUD.segments
    const slant = -height * 0.6 * dir
    for (let i = 0; i < HUD.segments; i++) {
      const start = edge + dir * i * (block + space)
      ctx.fillStyle = 'rgba(8, 4, 12, 0.75)'
      this.slanted(ctx, start, start + dir * block, y, height, slant)
      ctx.fill()
      const k = Math.max(0, Math.min(1, gauges.drive - i))
      if (k > 0) {
        if (gauges.burnout) ctx.fillStyle = '#6b6b70'
        else {
          const fill = ctx.createLinearGradient(0, y, 0, y + height)
          fill.addColorStop(0, '#c9ffb0')
          fill.addColorStop(1, k >= 1 ? '#39d353' : '#1f8a33')
          ctx.fillStyle = fill
        }
        this.slanted(ctx, start, start + dir * block * k, y, height, slant)
        ctx.fill()
      }
      ctx.lineWidth = Math.max(1, unit * 0.002)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
      this.slanted(ctx, start, start + dir * block, y, height, slant)
      ctx.stroke()
    }
    if (gauges.burnout) {
      ctx.font = `italic 700 ${unit * 0.02}px ${BODY_FONT}`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillStyle = calm || Math.sin(this.time * 8) > 0 ? '#ff5a4f' : '#fff'
      ctx.fillText('BURNOUT', edge + (dir * width) / 2, y + height / 2)
    }
  }
}
