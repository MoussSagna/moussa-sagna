/**
 * Shigaraki dans l'arène, repris de `RivalLayer` de `lab/` (sans Phaser, testé). Pour l'instant il se tient en
 * garde à sa place et encaisse les coups de Moussa : il ne se déplace pas, ne pare pas et n'attaque pas.
 */

/** Une illustration de Shigaraki. */
export type RivalPoseName = 'guard' | 'hurt' | 'hurtRecover';

/**
 * Ses poses, un dessin chacune (toile de 1024 × 1536, comme celle de Moussa). `ground` : point du dessin posé sur
 * le sol, en pixels de la toile. `scale` : agrandissement autour de ce point, pour que la tête garde la taille de
 * celle de la garde. Valeurs reprises de `POSES` dans `../lab/src/game/rival/RivalLayer.ts`.
 */
export const RIVAL_POSES: Record<RivalPoseName, { ground: [number, number]; scale: number }> = {
  guard: { ground: [525, 1455], scale: 1.1 },
  // le pied avant est levé plus haut que dans la garde : le point au sol est à mi-chemin entre les deux semelles
  hurt: { ground: [511, 1425], scale: 1.1 },
  hurtRecover: { ground: [491, 1399], scale: 1.1 },
};

/** Place de Shigaraki sur le stage, en fraction de la largeur de l'écran. */
export const RIVAL_X = 0.66;

/**
 * Distances en pixels de la toile, devant son point d'appui : `gap`, où Moussa est arrêté quand il avance vers lui ;
 * `surface`, où un coup le touche.
 */
export const RIVAL_BODY = { gap: 760, surface: 310 };

/** Respiration de la garde : amplitude de l'étirement vertical et durée d'un cycle, en secondes. */
export const BREATH = { amplitude: 0.007, period: 3.6 };

/**
 * Coup encaissé : le dessin du coup reçu pendant `stun` secondes, puis celui du retour pendant `recover`
 * secondes. Tout le corps penche aussi en arrière, pieds fixes, puis revient comme un ressort amorti. `lean` :
 * pente de l'inclinaison pour un coup de pleine puissance (décalage horizontal par pixel de hauteur).
 */
export const HIT = { stun: 0.26, recover: 0.16, lean: 0.05, frequency: 2.6, damping: 11 };

export class RivalState {
  x = RIVAL_X;
  pose: RivalPoseName = 'guard';
  /** Inclinaison du corps vers l'arrière (pente), et sa vitesse. */
  lean = 0;
  private velocity = 0;
  private hurtTime = 0;

  /** Vrai tant qu'il est sonné par un coup. */
  get stunned(): boolean {
    return this.pose !== 'guard';
  }

  /** Il encaisse un coup de puissance `power` (1 : coup fort). */
  hit(power: number): void {
    this.pose = 'hurt';
    this.hurtTime = 0;
    this.lean = HIT.lean * (0.45 + 0.55 * Math.min(1, power));
    this.velocity = 0;
  }

  update(delta: number): void {
    if (this.pose !== 'guard') {
      this.hurtTime += delta;
      this.pose = this.hurtTime < HIT.stun ? 'hurt' : 'hurtRecover';
      if (this.hurtTime >= HIT.stun + HIT.recover) {
        this.pose = 'guard';
      }
    }
    // ressort amorti, en petits pas pour rester stable quand une image dure longtemps : l'inclinaison revient à
    // zéro en oscillant un peu
    const stiffness = (2 * Math.PI * HIT.frequency) ** 2;
    const steps = 4;
    const dt = delta / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (-stiffness * this.lean - HIT.damping * this.velocity) * dt;
      this.lean += this.velocity * dt;
    }
  }

  /** Étirement vertical de la respiration, à l'instant `time` (secondes). */
  breath(time: number, amplitude: number): number {
    return 1 + BREATH.amplitude * amplitude * Math.sin((time * 2 * Math.PI) / BREATH.period);
  }
}
