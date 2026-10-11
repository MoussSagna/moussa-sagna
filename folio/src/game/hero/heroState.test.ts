import { describe, expect, it } from 'vitest';
import { DASH, DOUBLE_TAP_MS, DoubleTap, HeroState, PLACEMENT, STEP_SECONDS } from './heroState';

const ASPECT = 720 / 1280;
const FRAME = 1 / 60;

/** Fait avancer l'état pendant `seconds`, image par image. */
function run(hero: HeroState, seconds: number, direction: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    hero.update(FRAME, direction, ASPECT);
  }
}

describe('HeroState', () => {
  it('reste en garde et sur place sans commande', () => {
    const hero = new HeroState();
    run(hero, 1, 0);
    expect(hero.pose).toBe('guard');
    expect(hero.x).toBe(PLACEMENT.x);
  });

  it('passe par la pose intermédiaire avant de marcher, puis avant de revenir en garde', () => {
    const hero = new HeroState();
    hero.update(FRAME, 1, ASPECT);
    expect(hero.pose).toBe('step');
    run(hero, STEP_SECONDS + FRAME, 1);
    expect(hero.pose).toBe('walk');
    hero.update(FRAME, 0, ASPECT);
    expect(hero.pose).toBe('step');
    run(hero, STEP_SECONDS + FRAME, 0);
    expect(hero.pose).toBe('guard');
  });

  it('avance vers la droite, recule vers la gauche', () => {
    const hero = new HeroState();
    run(hero, 1, 1);
    const forward = hero.x;
    expect(forward).toBeGreaterThan(PLACEMENT.x);
    run(hero, 0.5, -1);
    expect(hero.x).toBeLessThan(forward);
  });

  it('s’arrête aux bords de l’arène et repasse en garde', () => {
    const hero = new HeroState();
    run(hero, 30, 1);
    expect(hero.x).toBe(PLACEMENT.maxX);
    expect(hero.pose).toBe('guard');
    run(hero, 30, -1);
    expect(hero.x).toBe(PLACEMENT.minX);
  });

  it('dashe sur une distance fixe puis revient en garde', () => {
    const hero = new HeroState();
    hero.dash(1);
    expect(hero.illustration).toBe('dashForward');
    run(hero, DASH.forward.seconds / 2, 0);
    expect(hero.pose).toBe('dash');
    // le déplacement part vite : plus de la moitié du chemin est faite à mi-durée
    expect(hero.x - PLACEMENT.x).toBeGreaterThan(DASH.forward.distance / 2);
    run(hero, DASH.forward.seconds, 0);
    expect(hero.pose).toBe('guard');
    expect(hero.x).toBeCloseTo(PLACEMENT.x + DASH.forward.distance, 5);

    hero.dash(-1);
    expect(hero.illustration).toBe('dashBack');
    run(hero, DASH.back.seconds + FRAME, 0);
    expect(hero.x).toBeCloseTo(PLACEMENT.x + DASH.forward.distance - DASH.back.distance, 5);
  });

  it('ignore une demande de dash pendant un dash, et ne sort pas de l’arène', () => {
    const hero = new HeroState();
    hero.dash(-1);
    hero.dash(1);
    expect(hero.illustration).toBe('dashBack');
    for (let n = 0; n < 6; n++) {
      run(hero, DASH.back.seconds + FRAME, 0);
      hero.dash(-1);
    }
    expect(hero.x).toBeGreaterThanOrEqual(PLACEMENT.minX);
  });
});

describe('DoubleTap', () => {
  it('ne se déclenche qu’au second appui rapproché dans le même sens', () => {
    const taps = new DoubleTap();
    expect(taps.tap(1, 1000)).toBe(false);
    expect(taps.tap(1, 1000 + DOUBLE_TAP_MS - 1)).toBe(true);
    // le compteur repart de zéro : un troisième appui ne redéclenche pas
    expect(taps.tap(1, 1000 + DOUBLE_TAP_MS)).toBe(false);
  });

  it('ignore deux appuis trop espacés ou dans des sens opposés', () => {
    const taps = new DoubleTap();
    expect(taps.tap(1, 0)).toBe(false);
    expect(taps.tap(1, DOUBLE_TAP_MS + 1)).toBe(false);
    expect(taps.tap(-1, DOUBLE_TAP_MS + 50)).toBe(false);
  });
});
