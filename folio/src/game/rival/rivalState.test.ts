import { describe, expect, it } from 'vitest';
import { HIT, RivalState } from './rivalState';

const FRAME = 1 / 60;

function run(rival: RivalState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    rival.update(FRAME);
  }
}

describe('RivalState', () => {
  it('se tient en garde tant que rien ne le touche', () => {
    const rival = new RivalState();
    run(rival, 2);
    expect(rival.pose).toBe('guard');
    expect(rival.stunned).toBe(false);
    expect(rival.lean).toBe(0);
  });

  it('encaisse un coup : coup reçu, retour, puis garde', () => {
    const rival = new RivalState();
    rival.hit(0.35);
    expect(rival.pose).toBe('hurt');
    expect(rival.stunned).toBe(true);
    run(rival, HIT.stun + FRAME);
    expect(rival.pose).toBe('hurtRecover');
    run(rival, HIT.recover);
    expect(rival.pose).toBe('guard');
  });

  it('penche plus fort sous un coup puissant, puis se redresse', () => {
    const light = new RivalState();
    light.hit(0.35);
    const heavy = new RivalState();
    heavy.hit(1);
    expect(heavy.lean).toBeGreaterThan(light.lean);
    expect(heavy.lean).toBeCloseTo(HIT.lean, 6);
    run(heavy, 2);
    expect(Math.abs(heavy.lean)).toBeLessThan(0.001);
  });

  it('un nouveau coup relance le coup reçu', () => {
    const rival = new RivalState();
    rival.hit(0.6);
    run(rival, HIT.stun + FRAME);
    rival.hit(0.6);
    expect(rival.pose).toBe('hurt');
  });
});
