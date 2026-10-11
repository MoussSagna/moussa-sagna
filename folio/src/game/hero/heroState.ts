import { CANVAS } from './poseData';
import type { POSES } from './poseData';
import { GAIT, WALK_SPEED } from './poseRig';

/** Une illustration du personnage. */
export type PoseName = keyof typeof POSES;

/** Position sur le stage, en fraction de l'écran ; `scale` = hauteur de la toile en hauteurs d'écran. */
export const PLACEMENT = { x: 0.33, y: 0.905, scale: 0.546, depth: 0.42, minX: 0.14, maxX: 0.8 };

/** Durée de la pose intermédiaire entre la garde et la marche, en secondes. */
export const STEP_SECONDS = 0.09;

/** Dash : distance en fraction de la largeur de l'écran, durée en secondes. Le déplacement part vite et freine. */
export const DASH = {
  forward: { distance: 0.17, seconds: 0.3 },
  back: { distance: 0.13, seconds: 0.26 },
};

/** Deux appuis sur la même direction en moins de ce délai (millisecondes) déclenchent un dash. */
export const DOUBLE_TAP_MS = 260;

/** Repère le double appui : `tap` renvoie `true` au second appui rapproché dans le même sens. */
export class DoubleTap {
  private last = { direction: 0, at: 0 };

  tap(direction: number, now: number): boolean {
    if (this.last.direction === direction && now - this.last.at < DOUBLE_TAP_MS) {
      this.last = { direction: 0, at: 0 };
      return true;
    }
    this.last = { direction, at: now };
    return false;
  }
}

/**
 * État du personnage, repris de `HeroLayer` de `lab/` : garde à l'arrêt, pose intermédiaire,
 * marche, et dash. On ne saute jamais directement de la garde à la marche.
 */
export class HeroState {
  /** Position horizontale, en fraction de la largeur de l'écran. */
  x = PLACEMENT.x;
  pose: 'guard' | 'step' | 'walk' | 'dash' = 'guard';
  /** Phase du cycle de marche, de 0 à 1. */
  phase = 0;
  /** Dash en cours : sens, position de départ et temps écoulé. */
  dashing = { direction: 1, from: PLACEMENT.x, time: 0 };
  /** Temps restant dans la pose intermédiaire. */
  private stepLeft = 0;

  /** L'illustration à afficher pour l'état courant. */
  get illustration(): PoseName {
    if (this.pose !== 'dash') {
      return this.pose;
    }
    return this.dashing.direction > 0 ? 'dashForward' : 'dashBack';
  }

  /** Lance un dash : 1 vers l'avant, -1 vers l'arrière. Sans effet pendant un dash. */
  dash(direction: number): void {
    if (this.pose === 'dash' || direction === 0) {
      return;
    }
    this.pose = 'dash';
    this.dashing = { direction: Math.sign(direction), from: this.x, time: 0 };
  }

  /** Position du personnage `time` secondes après le début du dash en cours. */
  dashX(time: number): number {
    const move = this.dashing.direction > 0 ? DASH.forward : DASH.back;
    const k = Math.max(0, Math.min(1, time / move.seconds));
    const eased = 1 - (1 - k) ** 3;
    const x = this.dashing.from + this.dashing.direction * move.distance * eased;
    return Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, x));
  }

  /**
   * @param delta durée de l'image, en secondes
   * @param direction 1 vers l'avant, -1 vers l'arrière, 0 à l'arrêt
   * @param aspect hauteur de la scène divisée par sa largeur
   */
  update(delta: number, direction: number, aspect: number): void {
    if (this.pose === 'dash') {
      this.dashing.time += delta;
      this.x = this.dashX(this.dashing.time);
      const move = this.dashing.direction > 0 ? DASH.forward : DASH.back;
      if (this.dashing.time < move.seconds) {
        return;
      }
      this.pose = 'guard';
    }
    const blocked = (direction > 0 && this.x >= PLACEMENT.maxX) || (direction < 0 && this.x <= PLACEMENT.minX);
    const moving = direction !== 0 && !blocked;
    if (this.pose === 'step') {
      this.stepLeft -= delta;
      if (this.stepLeft <= 0) {
        this.pose = moving ? 'walk' : 'guard';
        this.phase = 0;
      }
    } else if ((this.pose === 'guard') === moving) {
      this.pose = 'step';
      this.stepLeft = STEP_SECONDS;
    }
    if (this.pose !== 'walk' || !moving) {
      return;
    }
    this.phase = (((this.phase + (direction * delta) / GAIT.period) % 1) + 1) % 1;
    // le corps avance à la vitesse du pied posé ; jouer le cycle à l'envers donne la marche arrière
    const pixel = (PLACEMENT.scale / CANVAS[1]) * aspect;
    this.x = Math.max(PLACEMENT.minX, Math.min(PLACEMENT.maxX, this.x + direction * WALK_SPEED * pixel * delta));
  }
}
