import type Phaser from 'phaser';

interface Drop {
  x: number;
  y: number;
  z: number;
}

interface Petal {
  x: number;
  y: number;
  z: number;
  angle: number;
  spin: number;
  phase: number;
  speed: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
}

export interface WeatherFrame {
  /** Secondes depuis le démarrage de la scène. */
  time: number;
  /** Durée de l'image précédente, en secondes. */
  delta: number;
  width: number;
  height: number;
  /** Décalage horizontal de la caméra, pour que les plans proches bougent davantage. */
  shift: number;
  /** Réduit les mouvements : moins de gouttes et de pétales, plus de ronds dans l'eau. */
  calm: boolean;
}

const RAIN_COLOR = 0xd6dcff;
const RING_COLOR = 0xe6dcff;
const PETAL_NEAR = 0xffb3d4;
const PETAL_FAR = 0xf47fb0;

/** Contour d'un pétale de demi-largeur 1 : deux arcs qui se rejoignent aux pointes. */
const PETAL_SHAPE: Phaser.Types.Math.Vector2Like[] = (() => {
  const steps = 6;
  const arc = (side: number) =>
    Array.from({ length: steps }, (_, index) => {
      const t = index / steps;
      return { x: side * (2 * t - 1), y: side * -1.8 * (1 - t) * t };
    });
  return [...arc(1), ...arc(-1)];
})();

const newPetal = (anywhere: boolean): Petal => ({
  x: anywhere ? Math.random() * 1.2 - 0.2 : -0.1 - Math.random() * 0.3,
  y: anywhere ? Math.random() : Math.random() * 0.7 - 0.2,
  z: Math.random(),
  angle: Math.random() * 6.3,
  spin: (Math.random() - 0.5) * 0.08,
  phase: Math.random() * 6.3,
  speed: 0.5 + Math.random() * 0.7,
});

/**
 * Premier plan de l'arène : trois nappes de pluie, ronds dans l'eau et pétales de cerisier.
 * Repris de `WeatherLayer` de `lab/` ; le dessin passe par un `Graphics` Phaser
 * au lieu d'un canvas 2D séparé. Positions en fraction de l'écran.
 */
export class Weather {
  private rain: Drop[] = Array.from({ length: 260 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
  }));
  private petals: Petal[] = Array.from({ length: 46 }, () => newPetal(true));
  private rings: Ring[] = [];

  draw(graphics: Phaser.GameObjects.Graphics, frame: WeatherFrame): void {
    graphics.clear();
    this.drawRain(graphics, frame);
    this.drawPetals(graphics, frame);
  }

  private drawRain(graphics: Phaser.GameObjects.Graphics, frame: WeatherFrame): void {
    const { width: w, height: h, delta: dt, shift, calm } = frame;

    if (!calm && Math.random() < 0.5) {
      this.rings.push({ x: Math.random(), y: 0.75 + Math.random() * 0.25, radius: 0, life: 1 });
    }
    for (const ring of this.rings) {
      ring.radius += dt * 0.05;
      ring.life -= dt * 1.7;
      // les ronds grandissent avec la proximité : plus bas dans l'image, plus large
      const spread = ring.radius * w * (ring.y - 0.66) * 3;
      graphics.lineStyle(Math.max(1, w / 1400), RING_COLOR, Math.max(0, ring.life) * 0.35);
      graphics.strokeEllipse((ring.x + shift * 1.2) * w, ring.y * h, spread * 2, spread * 0.6);
    }
    this.rings = this.rings.filter((ring) => ring.life > 0);

    const count = calm ? 70 : this.rain.length;
    for (let layer = 0; layer < 3; layer++) {
      const length = (0.018 + layer * 0.022) * h;
      const speed = 0.9 + layer * 0.7;
      graphics.lineStyle(Math.max(1, ((0.6 + layer * 0.7) * w) / 1500), RAIN_COLOR, 0.16 + layer * 0.1);
      for (let i = layer; i < count; i += 3) {
        const drop = this.rain[i];
        if (!drop) {
          continue;
        }
        drop.y += dt * speed * (0.9 + drop.z * 0.4);
        drop.x -= dt * speed * 0.16;
        if (drop.y > 1.05) {
          drop.y = -0.08;
          drop.x = Math.random() * 1.2;
        }
        const x = (drop.x + shift * (0.4 + layer * 0.9)) * w;
        const y = drop.y * h;
        graphics.lineBetween(x, y, x - length * 0.18, y + length);
      }
    }
  }

  private drawPetals(graphics: Phaser.GameObjects.Graphics, frame: WeatherFrame): void {
    const { width: w, height: h, time: t, delta: dt, shift, calm } = frame;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.31) + 0.25 * Math.sin(t * 0.83 + 1.7);
    const count = calm ? 14 : this.petals.length;
    for (let i = 0; i < count; i++) {
      let petal = this.petals[i];
      if (!petal) {
        continue;
      }
      petal.x += dt * (0.05 + petal.z * 0.09) * gust * petal.speed;
      petal.y += dt * (0.045 + petal.z * 0.06) * petal.speed + Math.sin(t * 1.3 + petal.phase) * dt * 0.03;
      petal.angle += petal.spin * (0.6 + gust);
      if (petal.x > 1.15 || petal.y > 1.08) {
        petal = newPetal(false);
        this.petals[i] = petal;
      }
      const size = (0.004 + petal.z * petal.z * 0.014) * w;
      graphics.save();
      graphics.translateCanvas((petal.x + shift * (0.5 + petal.z * 2.2)) * w, petal.y * h);
      graphics.rotateCanvas(petal.angle);
      // le pétale tourne sur lui-même : on l'écrase plus ou moins dans sa hauteur
      graphics.scaleCanvas(size, size * (0.45 + 0.4 * Math.sin(t * 2 + petal.phase)));
      graphics.fillStyle(petal.z > 0.5 ? PETAL_NEAR : PETAL_FAR, petal.z > 0.8 ? 0.55 : 0.9);
      graphics.fillPoints(PETAL_SHAPE, true);
      graphics.restore();
    }
  }
}
