import type { FrameInfo, StageOptions } from '../types'

interface Drop { x: number; y: number; z: number }
interface Petal { x: number; y: number; z: number; angle: number; spin: number; phase: number; speed: number }
interface Ring { x: number; y: number; radius: number; life: number }

const newPetal = (anywhere: boolean): Petal => ({
  x: anywhere ? Math.random() * 1.2 - 0.2 : -0.1 - Math.random() * 0.3,
  y: anywhere ? Math.random() : Math.random() * 0.7 - 0.2,
  z: Math.random(),
  angle: Math.random() * 6.3,
  spin: (Math.random() - 0.5) * 0.08,
  phase: Math.random() * 6.3,
  speed: 0.5 + Math.random() * 0.7,
})

/** Premier plan en Canvas 2D : trois nappes de pluie, ronds dans l'eau et pétales de cerisier. */
export class WeatherLayer {
  private ctx: CanvasRenderingContext2D | null
  private rain: Drop[] = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }))
  private petals: Petal[] = Array.from({ length: 46 }, () => newPetal(true))
  private rings: Ring[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
  }

  /** `shift` : décalage horizontal de la caméra, pour que les plans proches bougent davantage. */
  draw(frame: FrameInfo, shift: number, options: StageOptions): void {
    const ctx = this.ctx
    if (!ctx) return
    const { width: w, height: h, time: t, delta: dt } = frame
    const calm = options.calm
    ctx.clearRect(0, 0, w, h)

    if (options.rain) {
      if (!calm && Math.random() < 0.5) this.rings.push({ x: Math.random(), y: 0.75 + Math.random() * 0.25, radius: 0, life: 1 })
      ctx.lineWidth = Math.max(1, w / 1400)
      for (const ring of this.rings) {
        ring.radius += dt * 0.05
        ring.life -= dt * 1.7
        const k = (ring.y - 0.66) * 3
        ctx.strokeStyle = `rgba(230,220,255,${Math.max(0, ring.life) * 0.35})`
        ctx.beginPath()
        ctx.ellipse((ring.x + shift * 1.2) * w, ring.y * h, ring.radius * w * k, ring.radius * w * k * 0.3, 0, 0, 6.3)
        ctx.stroke()
      }
      this.rings = this.rings.filter((ring) => ring.life > 0)

      const count = calm ? 70 : this.rain.length
      for (let layer = 0; layer < 3; layer++) {
        const length = (0.018 + layer * 0.022) * h
        const speed = 0.9 + layer * 0.7
        ctx.strokeStyle = `rgba(214,220,255,${0.16 + layer * 0.1})`
        ctx.lineWidth = Math.max(1, ((0.6 + layer * 0.7) * w) / 1500)
        ctx.beginPath()
        for (let i = layer; i < count; i += 3) {
          const drop = this.rain[i]
          drop.y += dt * speed * (0.9 + drop.z * 0.4)
          drop.x -= dt * speed * 0.16
          if (drop.y > 1.05) {
            drop.y = -0.08
            drop.x = Math.random() * 1.2
          }
          const x = (drop.x + shift * (0.4 + layer * 0.9)) * w
          const y = drop.y * h
          ctx.moveTo(x, y)
          ctx.lineTo(x - length * 0.18, y + length)
        }
        ctx.stroke()
      }
    }

    if (options.petals) {
      const gust = 0.6 + 0.4 * Math.sin(t * 0.31) + 0.25 * Math.sin(t * 0.83 + 1.7)
      const count = calm ? 14 : this.petals.length
      for (let i = 0; i < count; i++) {
        const p = this.petals[i]
        p.x += dt * (0.05 + p.z * 0.09) * gust * p.speed
        p.y += dt * (0.045 + p.z * 0.06) * p.speed + Math.sin(t * 1.3 + p.phase) * dt * 0.03
        p.angle += p.spin * (0.6 + gust)
        if (p.x > 1.15 || p.y > 1.08) this.petals[i] = newPetal(false)
        const size = (0.004 + p.z * p.z * 0.014) * w
        ctx.save()
        ctx.translate((p.x + shift * (0.5 + p.z * 2.2)) * w, p.y * h)
        ctx.rotate(p.angle)
        ctx.scale(1, 0.45 + 0.4 * Math.sin(t * 2 + p.phase))
        ctx.globalAlpha = p.z > 0.8 ? 0.55 : 0.9
        ctx.fillStyle = p.z > 0.5 ? '#ffb3d4' : '#f47fb0'
        ctx.beginPath()
        ctx.moveTo(-size, 0)
        ctx.quadraticCurveTo(0, -size * 0.9, size, 0)
        ctx.quadraticCurveTo(0, size * 0.9, -size, 0)
        ctx.fill()
        ctx.restore()
      }
    }
  }
}
